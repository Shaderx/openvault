// @ts-check

import {
    CHARACTERS_KEY,
    CHAT_LIFECYCLE,
    CONSOLIDATION,
    EMBEDDING_SOURCES,
    GRAPH_JACCARD_DUPLICATE_THRESHOLD,
    MEMORIES_KEY,
    METADATA_KEY,
    PROCESSED_MESSAGES_KEY,
} from '../constants.js';
import { getDeps } from '../deps.js';
import { createEmptyGraph, normalizeKey } from '../graph/graph.js';
import { record } from '../perf/store.js';
import { purgeSTCollection } from '../services/st-vector.js';
import { getSessionSignal } from '../state.js';
import { showToast } from '../utils/dom.js';
import { cyrb53, deleteEmbedding } from '../utils/embedding-codec.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.js';
import { yieldToMain } from '../utils/st-helpers.js';
import { getCommunityIndexText, getEdgeIndexText, getMemoryIndexText, getNodeIndexText } from '../utils/st-index.js';
import { mergeDescriptions } from '../utils/text.js';
import { countTokens } from '../utils/tokens.js';

/** @typedef {import('../types.d.ts').OpenVaultData} OpenVaultData */
/** @typedef {import('../types.d.ts').Memory} Memory */
/** @typedef {import('../types.d.ts').MemoryUpdate} MemoryUpdate */

/**
 * Get OpenVault data from chat metadata.
 * @returns {OpenVaultData | null} Returns null if context is not available
 */
export function getOpenVaultData() {
    const context = getDeps().getContext();
    if (!context) {
        logWarn('getContext() returned null/undefined');
        return null;
    }
    if (!context.chatMetadata) {
        context.chatMetadata = {};
    }
    if (!context.chatMetadata[METADATA_KEY]) {
        context.chatMetadata[METADATA_KEY] = {
            schema_version: 5,
            [MEMORIES_KEY]: [],
            [CHARACTERS_KEY]: {},
            [PROCESSED_MESSAGES_KEY]: [],
            reflection_state: {},
            graph: createEmptyGraph(),
            communities: {},
            graph_message_count: 0,
            lifecycle: { status: CHAT_LIFECYCLE.READY },
            archives: { revision: 0, segments: [], next_sequence: 1, rollups: [] },
            diagnostics: { archive: {}, volatile: {}, compaction: {}, rebuild: {} },
        };
    }
    const data = context.chatMetadata[METADATA_KEY];

    return data;
}

/**
 * Get current chat ID for tracking across async operations.
 * @returns {string | null} Chat ID or null if unavailable
 */
export function getCurrentChatId() {
    const context = getDeps().getContext();
    return context?.chatId || context?.chat_metadata?.chat_id || null;
}

/**
 * Check whether an async mutation still belongs to the chat it started in.
 * A missing chat ID cannot be guarded, so preserve the legacy behavior for
 * older/test contexts that do not expose one.
 * @param {string|null} expectedChatId - Chat ID captured before awaiting
 * @returns {boolean}
 */
function isExpectedChat(expectedChatId) {
    return expectedChatId === null || getCurrentChatId() === expectedChatId;
}

/**
 * Save OpenVault data to chat metadata.
 * @param {string} [expectedChatId] - If provided, verify chat hasn't changed before saving
 * @returns {Promise<boolean>} True if save succeeded, false otherwise
 */
export async function saveOpenVaultData(expectedChatId = null) {
    const t0 = performance.now();
    // Capture the session signal together with the chat ID. A chat can switch
    // away and back to the same ID before this async save resumes; the old
    // signal still identifies that this operation belongs to the old session.
    const signal = getSessionSignal();
    const isCurrent = () => !signal.aborted && isExpectedChat(expectedChatId);

    if (!isCurrent()) return false;

    try {
        await yieldToMain(); // Yield before ST's heavy synchronous save
        if (!isCurrent()) return false;
        await getDeps().saveChatConditional();
        if (!isCurrent()) return false;
        await yieldToMain(); // Yield after the thread-blocking operation
        if (!isCurrent()) return false;
        record('chat_save', performance.now() - t0);
        logDebug('Data saved to chat metadata');
        return true;
    } catch (error) {
        // Abort and stale-session failures are expected during chat changes.
        // Do not report them as errors or record a save against the new chat.
        if (error?.name === 'AbortError' || !isCurrent()) return false;
        record('chat_save', performance.now() - t0);
        logError('Failed to save data', error);
        showToast('error', `Failed to save data: ${error.message}`);
        return false;
    }
}

/**
 * Generate a unique ID.
 * @returns {string} Unique ID string
 */
export function generateId() {
    return `${getDeps().Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Update a memory by ID.
 * @param {string} id - Memory ID to update
 * @param {MemoryUpdate} updates - Fields to update
 * @returns {Promise<{success: boolean, stChanges?: {toSync?: {hash: number, text: string, item: Memory}[]}}>} Result with success flag and optional ST Vector changes
 */
export async function updateMemory(id, updates) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }
    const expectedChatId = getCurrentChatId();

    const memory = data[MEMORIES_KEY]?.find((/** @type {Memory} */ m) => m.id === id);
    if (!memory) {
        logDebug(`Memory ${id} not found`);
        return { success: false };
    }

    // Track if summary changed (requires re-embedding)
    const summaryChanged = updates.summary !== undefined && updates.summary !== memory.summary;
    const oldText = getMemoryIndexText(memory);
    const wasSynced = memory._st_synced === true;

    // Apply allowed updates
    const allowedFields = ['summary', 'importance', 'tags', 'is_secret', 'temporal_anchor', 'is_transient'];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            memory[field] = updates[field];
        }
    }

    const stChanges = {};

    // If summary changed, invalidate embedding and queue for re-sync
    if (summaryChanged) {
        if (wasSynced) {
            stChanges.toDelete = [{ hash: cyrb53(oldText) }];
        }
        deleteEmbedding(memory);
        const text = getMemoryIndexText(memory);
        stChanges.toSync = [{ hash: cyrb53(text), text, item: memory }];
    }

    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }
    logDebug(`Updated memory ${id}${summaryChanged ? ' (embedding invalidated)' : ''}`);
    return {
        success: true,
        stChanges: Object.keys(stChanges).length > 0 ? stChanges : undefined,
    };
}

/**
 * Delete a memory by ID.
 * @param {string} id - Memory ID to delete
 * @returns {Promise<{success: boolean, stChanges?: {toDelete: {hash: number}[]}}>} Result with success flag and optional ST Vector changes
 */
export async function deleteMemory(id) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }
    const expectedChatId = getCurrentChatId();

    const idx = data[MEMORIES_KEY]?.findIndex((/** @type {Memory} */ m) => m.id === id);
    if (idx === -1) {
        logDebug(`Memory ${id} not found`);
        return { success: false };
    }

    const memory = data[MEMORIES_KEY][idx];
    const stChanges = {};

    // Queue for ST Vector deletion if previously synced
    if (memory._st_synced) {
        const text = getMemoryIndexText(memory);
        stChanges.toDelete = [{ hash: cyrb53(text) }];
    }

    data[MEMORIES_KEY].splice(idx, 1);
    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }
    logDebug(`Deleted memory ${id}`);
    return {
        success: true,
        stChanges: Object.keys(stChanges).length > 0 ? stChanges : undefined,
    };
}

/**
 * Update an entity's fields. Handles rename by rewriting edges and merge redirects.
 * @param {string} key - Current normalized entity key
 * @param {Object} updates - { name?, type?, description?, aliases? }
 * @returns {Promise<{key: string, stChanges?: {toDelete?: {hash: number}[], toSync?: {hash: number, text: string, item: any}[]}}|null>} Result with new key and optional ST Vector changes, null on failure
 */
export async function updateEntity(key, updates) {
    const data = getOpenVaultData();
    if (!data) return null;
    const expectedChatId = getCurrentChatId();
    const graph = data.graph;
    const node = graph.nodes[key];

    if (!node) {
        logWarn(`Cannot update entity: ${key} not found`);
        return null;
    }

    // Determine if renaming
    const newName = updates.name ?? node.name;
    const newKey = normalizeKey(newName);

    // If renaming, check for collision
    if (newKey !== key) {
        if (graph.nodes[newKey]) {
            logWarn(`Cannot rename to '${newName}': entity already exists`);
            return null;
        }
    }

    if (newKey !== key) {
        // Track old hash for ST Vector deletion if synced
        const toDelete = [];
        const toSync = [];
        const wasSynced = node._st_synced === true;
        if (wasSynced) {
            toDelete.push({ hash: cyrb53(getNodeIndexText(key, node)) });
        }

        // Create new node with updated fields
        graph.nodes[newKey] = {
            ...node,
            name: newName,
            type: updates.type ?? node.type,
            description: updates.description ?? node.description,
            aliases: updates.aliases ?? node.aliases ?? [],
        };

        // Delete old node
        delete graph.nodes[key];

        // Rewrite edges
        for (const [edgeKey, edge] of Object.entries(graph.edges)) {
            let needsRewrite = false;
            let newSource = edge.source;
            let newTarget = edge.target;

            if (edge.source === key) {
                newSource = newKey;
                needsRewrite = true;
            }
            if (edge.target === key) {
                newTarget = newKey;
                needsRewrite = true;
            }

            if (needsRewrite) {
                const newEdgeKey = `${newSource}__${newTarget}`;

                const edgeWasSynced = edge._st_synced === true;
                // Queue old edge for ST Vector deletion if synced
                if (edgeWasSynced) {
                    toDelete.push({ hash: cyrb53(getEdgeIndexText(edge)) });
                }

                delete graph.edges[edgeKey];
                const newEdge = {
                    ...edge,
                    source: newSource,
                    target: newTarget,
                };
                deleteEmbedding(newEdge);
                graph.edges[newEdgeKey] = newEdge;
                if (edgeWasSynced) {
                    const text = getEdgeIndexText(newEdge);
                    toSync.push({ hash: cyrb53(text), text, item: newEdge });
                }
            }
        }

        // Guard _mergeRedirects (matches pattern in graph.js:272)
        if (!graph._mergeRedirects) graph._mergeRedirects = {};
        graph._mergeRedirects[key] = newKey;

        // Fix any existing redirects that still point to oldKey.
        // _resolveKey() is non-recursive, so chained redirects
        // (A → oldKey → newKey) would resolve A to a deleted node.
        for (const [rk, rv] of Object.entries(graph._mergeRedirects)) {
            if (rv === key && rk !== key) {
                graph._mergeRedirects[rk] = newKey;
            }
        }

        // Invalidate embedding on new node
        deleteEmbedding(graph.nodes[newKey]);

        const nodeText = getNodeIndexText(newKey, graph.nodes[newKey]);
        toSync.push({ hash: cyrb53(nodeText), text: nodeText, item: graph.nodes[newKey] });

        if (!(await saveOpenVaultData(expectedChatId))) {
            return null;
        }
        return {
            key: newKey,
            stChanges: toDelete.length > 0 || toSync.length > 0 ? { toDelete, toSync } : undefined,
        };
    } else {
        // Simple field update, no rename
        const descriptionChanged = updates.description !== undefined && updates.description !== node.description;
        const wasSynced = node._st_synced === true;
        const oldText = getNodeIndexText(key, node);
        Object.assign(node, {
            type: updates.type ?? node.type,
            description: updates.description ?? node.description,
            aliases: updates.aliases ?? node.aliases ?? [],
        });

        // Invalidate embedding on description change
        if (descriptionChanged) {
            const toDelete = wasSynced ? [{ hash: cyrb53(oldText) }] : [];
            deleteEmbedding(node);
            const text = getNodeIndexText(key, node);
            const toSync = [{ hash: cyrb53(text), text, item: node }];
            if (!(await saveOpenVaultData(expectedChatId))) {
                return null;
            }
            return { key, stChanges: { toDelete, toSync } };
        }

        if (!(await saveOpenVaultData(expectedChatId))) {
            return null;
        }
        return { key, stChanges: undefined };
    }
}

/**
 * Delete an entity and all its edges and merge redirects.
 * Also deletes from ST Vector storage if _st_synced to prevent orphan embeddings.
 * @param {string} key - Normalized entity key
 * @returns {Promise<{success: boolean, stChanges?: {toDelete: {hash: number}[]}}>}
 */
export async function deleteEntity(key) {
    const data = getOpenVaultData();
    if (!data) return { success: false };
    const expectedChatId = getCurrentChatId();
    const graph = data.graph;

    const node = graph.nodes[key];
    if (!node) {
        logWarn(`Cannot delete entity: ${key} not found`);
        return { success: false };
    }

    // Track ST Vector items to delete (prevent orphan embeddings)
    const toDelete = [];
    if (node._st_synced) {
        toDelete.push({ hash: cyrb53(getNodeIndexText(key, node)) });
    }

    // Delete the node
    delete graph.nodes[key];

    // Remove all edges connected to this entity
    for (const [edgeKey, edge] of Object.entries(graph.edges)) {
        if (edge.source === key || edge.target === key) {
            if (edge._st_synced) {
                toDelete.push({ hash: cyrb53(getEdgeIndexText(edge)) });
            }
            delete graph.edges[edgeKey];
        }
    }

    // Guard _mergeRedirects before iterating (matches graph.js:272)
    if (graph._mergeRedirects) {
        for (const [redirectKey, redirectValue] of Object.entries(graph._mergeRedirects)) {
            if (redirectKey === key || redirectValue === key) {
                delete graph._mergeRedirects[redirectKey];
            }
        }
    }

    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }

    return {
        success: true,
        stChanges: toDelete.length > 0 ? { toDelete } : undefined,
    };
}

/**
 * Delete all OpenVault data for the current chat.
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteCurrentChatData() {
    const context = getDeps().getContext();
    const expectedChatId = getCurrentChatId();
    const signal = getSessionSignal();

    if (!context?.chatMetadata) {
        logDebug('No chat metadata found');
        return false;
    }

    // Unhide all messages that were hidden by auto-hide
    // is_system flags persist even when memories are cleared, which would
    // leave those messages permanently unextractable
    const chat = context.chat || [];
    let unhiddenCount = 0;
    for (const msg of chat) {
        if (msg.openvault_hidden && msg.is_system) {
            msg.is_system = false;
            delete msg.openvault_hidden;
            unhiddenCount++;
        }
    }
    if (unhiddenCount > 0) {
        logDebug(`Unhid ${unhiddenCount} messages after memory clear`);
    }

    // Purge ST Vector Storage if using st_vector
    const settings = getDeps().getExtensionSettings()?.openvault;
    if (settings?.embeddingSource === EMBEDDING_SOURCES.ST_VECTOR) {
        const chatId = expectedChatId;
        if (chatId) {
            try {
                const purged = await purgeSTCollection(chatId);
                if (!purged) {
                    logWarn('Failed to purge ST collection during chat data deletion', new Error('Purge failed'));
                } else {
                    logInfo(`Purged ST Vector collection for cleared chat: ${chatId}`);
                }
            } catch (err) {
                logWarn('Failed to purge ST collection during chat data deletion', err);
                // Don't fail the whole operation - OpenVault data is already cleared
            }
        }
    }

    if (signal.aborted || !isExpectedChat(expectedChatId)) return false;

    delete context.chatMetadata[METADATA_KEY];
    if (!(await saveOpenVaultData(expectedChatId))) {
        return false;
    }
    // saveOpenVaultData records timing through the store, whose diagnostics
    // lookup lazily creates a new in-memory object after deletion. Keep the
    // cleared key absent in the originating chat as promised by this API.
    delete context.chatMetadata[METADATA_KEY];
    logDebug('Deleted all chat data');
    return true;
}

/**
 * Update a community by ID.
 * @param {string} id - Community ID (e.g. "C0")
 * @param {Object} updates - Fields to update (title, summary, findings)
 * @returns {Promise<Object>} Structured result and ST vector changes
 */
export async function updateCommunity(id, updates) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }
    const expectedChatId = getCurrentChatId();

    const community = data.communities?.[id];
    if (!community) {
        logDebug(`Community ${id} not found`);
        return { success: false };
    }

    const oldText = getCommunityIndexText(id, community);
    const contentChanged = ['title', 'summary', 'findings'].some(
        (field) => updates[field] !== undefined && updates[field] !== community[field]
    );

    const allowedFields = ['title', 'summary', 'findings'];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            community[field] = updates[field];
        }
    }

    const stChanges = { toDelete: [], toSync: [] };
    if (contentChanged) {
        if (community._st_synced) stChanges.toDelete.push({ hash: cyrb53(oldText) });
        deleteEmbedding(community);
        community.retrievalText = getCommunityIndexText(id, community, { useStored: false });
        stChanges.toSync.push({
            hash: cyrb53(community.retrievalText),
            text: community.retrievalText,
            item: community,
        });
    }

    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }
    logDebug(`Updated community ${id}${contentChanged ? ' (embedding invalidated)' : ''}`);
    return { success: true, stChanges };
}

/**
 * Delete a community by ID.
 * @param {string} id - Community ID (e.g. "C0")
 * @returns {Promise<Object>} Structured result and ST vector changes
 */
export async function deleteCommunity(id) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }
    const expectedChatId = getCurrentChatId();

    if (!data.communities?.[id]) {
        logDebug(`Community ${id} not found`);
        return { success: false };
    }

    const community = data.communities[id];
    const text = getCommunityIndexText(id, community);
    const stChanges = community._st_synced ? { toDelete: [{ hash: cyrb53(text) }] } : undefined;
    delete data.communities[id];
    delete data.global_world_state;
    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }
    logDebug(`Deleted community ${id}`);
    return { success: true, stChanges };
}

/**
 * Rename a character across all data: character_states, reflection_state,
 * and every memory's characters_involved / witnesses arrays.
 * Optionally updates the matching graph PERSON entity.
 * @param {string} oldName - Current character name
 * @param {string} newName - Desired character name
 * @returns {Promise<{success: boolean, stChanges?: {toDelete?: {hash: number}[], toSync?: {hash: number, text: string, item: any}[]}}>}
 */
export async function renameCharacter(oldName, newName) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }
    const expectedChatId = getCurrentChatId();

    if (!oldName || !newName || oldName === newName) {
        return { success: false };
    }

    const characters = data[CHARACTERS_KEY] || {};
    if (characters[newName]) {
        showToast('warning', `Character "${newName}" already exists`);
        return { success: false };
    }

    // 1. Rename key in character_states
    if (characters[oldName]) {
        characters[newName] = { ...characters[oldName], name: newName };
        delete characters[oldName];
    }

    // 2. Rename key in reflection_state
    const reflectionState = data.reflection_state || {};
    if (reflectionState[oldName]) {
        reflectionState[newName] = reflectionState[oldName];
        delete reflectionState[oldName];
    }

    // 3. Update characters_involved and witnesses in all memories
    const memories = data[MEMORIES_KEY] || [];
    for (const memory of memories) {
        if (memory.characters_involved) {
            memory.characters_involved = memory.characters_involved.map((c) => (c === oldName ? newName : c));
        }
        if (memory.witnesses) {
            memory.witnesses = memory.witnesses.map((c) => (c === oldName ? newName : c));
        }
    }

    // 4. Update matching graph PERSON entity if one exists
    let entityResult = null;
    let entityUpdateAttempted = false;
    const graph = data.graph;
    if (graph?.nodes) {
        const oldKey = normalizeKey(oldName);
        if (graph.nodes[oldKey] && graph.nodes[oldKey].type === 'PERSON') {
            entityUpdateAttempted = true;
            entityResult = await updateEntity(oldKey, { name: newName });
        }
    }

    if (entityUpdateAttempted && !entityResult) {
        return { success: false };
    }
    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }
    logInfo(`Renamed character "${oldName}" → "${newName}"`);

    return {
        success: true,
        stChanges: entityResult?.stChanges,
    };
}

/**
 * Append new memories to the store.
 * @param {Memory[]} newMemories - Memory objects to add
 * @returns {void}
 */
export function addMemories(newMemories) {
    const data = getOpenVaultData();
    if (!data || newMemories.length === 0) return;
    data[MEMORIES_KEY] = data[MEMORIES_KEY] || [];
    data[MEMORIES_KEY].push(...newMemories);
}

/**
 * Record message fingerprints as processed.
 * @param {string[]} fingerprints - Message fingerprints to mark
 * @returns {void}
 */
export function markMessagesProcessed(fingerprints) {
    const data = getOpenVaultData();
    if (!data || fingerprints.length === 0) return;
    data[PROCESSED_MESSAGES_KEY] = data[PROCESSED_MESSAGES_KEY] || [];
    data[PROCESSED_MESSAGES_KEY].push(...fingerprints);
}

/**
 * Increment the graph message count.
 * @param {number} count - Number of messages to add
 * @returns {void}
 */
export function incrementGraphMessageCount(count) {
    const data = getOpenVaultData();
    if (!data) return;
    data.graph_message_count = (data.graph_message_count || 0) + count;
}

/**
 * Merge source entity into target entity. Source is deleted.
 * @param {string} sourceKey - Entity to absorb (will be deleted)
 * @param {string} targetKey - Entity that survives
 * @param {Object} graph - The graph object (defaults to current graph from deps)
 * @returns {Promise<{ success: boolean, stChanges?: { toDelete: { hash: number }[], toSync?: { hash: number, text: string, item: any }[] } }>}
 */
export async function mergeEntities(sourceKey, targetKey, graph = null) {
    const ctx = getDeps().getContext();
    const expectedChatId = getCurrentChatId();
    const g = graph || ctx?.chatMetadata?.openvault?.graph;

    if (!g) {
        return { success: false };
    }

    // Validation
    if (sourceKey === targetKey) {
        return { success: false };
    }

    const sourceNode = g.nodes[sourceKey];
    const targetNode = g.nodes[targetKey];

    if (!sourceNode || !targetNode) {
        return { success: false };
    }

    const toDelete = [];
    const toSync = [];
    const sourceWasSynced = sourceNode._st_synced === true;
    const targetWasSynced = targetNode._st_synced === true;
    const oldTargetDescription = targetNode.description;

    // 1. Combine node data onto target
    targetNode.mentions += sourceNode.mentions;

    // Merge aliases (source name becomes an alias)
    const allAliases = [...(targetNode.aliases || []), ...(sourceNode.aliases || []), sourceNode.name];
    targetNode.aliases = [...new Set(allAliases)];

    // Merge descriptions using segmented Jaccard dedup
    targetNode.description = mergeDescriptions(
        targetNode.description,
        sourceNode.description,
        GRAPH_JACCARD_DUPLICATE_THRESHOLD
    );

    // 2. Set merge redirect and cascade
    if (!g._mergeRedirects) {
        g._mergeRedirects = {};
    }
    g._mergeRedirects[sourceKey] = targetKey;

    // Cascade: update any redirects pointing to source
    for (const [key, value] of Object.entries(g._mergeRedirects)) {
        if (value === sourceKey && key !== sourceKey) {
            g._mergeRedirects[key] = targetKey;
        }
    }

    // 3. Rewrite and combine edges
    const edgesToProcess = Object.entries(g.edges).filter(
        ([_, edge]) => edge.source === sourceKey || edge.target === sourceKey
    );

    for (const [oldKey, edge] of edgesToProcess) {
        const newSource = edge.source === sourceKey ? targetKey : edge.source;
        const newTarget = edge.target === sourceKey ? targetKey : edge.target;
        const newKey = `${newSource}__${newTarget}`;
        const edgeWasSynced = edge._st_synced === true;

        // Self-loop check: delete if would be target->target
        if (newSource === newTarget) {
            if (edgeWasSynced) {
                toDelete.push({ hash: cyrb53(getEdgeIndexText(edge)) });
            }
            delete g.edges[oldKey];
            continue;
        }

        // Collision check: target edge already exists
        if (g.edges[newKey] && newKey !== oldKey) {
            const existingEdge = g.edges[newKey];
            const existingEdgeWasSynced = existingEdge._st_synced === true;
            const oldExistingEdgeText = getEdgeIndexText(existingEdge);
            const oldDescription = existingEdge.description;
            existingEdge.weight += edge.weight;

            // Merge descriptions
            existingEdge.description = mergeDescriptions(
                existingEdge.description,
                edge.description,
                GRAPH_JACCARD_DUPLICATE_THRESHOLD
            );

            // Recalculate tokens using proper token counter
            if (existingEdge._descriptionTokens !== undefined) {
                existingEdge._descriptionTokens = countTokens(existingEdge.description);
            }

            // Check consolidation threshold
            if (existingEdge._descriptionTokens > CONSOLIDATION.TOKEN_THRESHOLD) {
                if (!g._edgesNeedingConsolidation) {
                    g._edgesNeedingConsolidation = [];
                }
                if (!g._edgesNeedingConsolidation.includes(newKey)) {
                    g._edgesNeedingConsolidation.push(newKey);
                }
            }

            // Collect hash for old edge deletion
            if (edgeWasSynced) {
                toDelete.push({ hash: cyrb53(getEdgeIndexText(edge)) });
            }

            const edgeDescriptionChanged = existingEdge.description !== oldDescription;
            if (edgeDescriptionChanged) {
                // The surviving edge has a different indexed payload. Capture its
                // old hash before clearing sync state, then queue the replacement.
                if (existingEdgeWasSynced) {
                    toDelete.push({ hash: cyrb53(oldExistingEdgeText) });
                }
                deleteEmbedding(existingEdge);
                if (existingEdgeWasSynced || edgeWasSynced) {
                    const mergedEdgeText = getEdgeIndexText(existingEdge);
                    toSync.push({ hash: cyrb53(mergedEdgeText), text: mergedEdgeText, item: existingEdge });
                }
            }

            delete g.edges[oldKey];
        } else if (newKey !== oldKey) {
            // No collision: rewrite edge
            if (edgeWasSynced) {
                toDelete.push({ hash: cyrb53(getEdgeIndexText(edge)) });
            }
            edge.source = newSource;
            edge.target = newTarget;
            deleteEmbedding(edge);
            g.edges[newKey] = edge;
            delete g.edges[oldKey];

            // Queue rewritten edge for re-sync
            if (edgeWasSynced) {
                const rewrittenEdgeText = getEdgeIndexText(edge);
                toSync.push({ hash: cyrb53(rewrittenEdgeText), text: rewrittenEdgeText, item: edge });
            }
        }
    }

    // 4. Cleanup
    // Collect hash for source node deletion
    if (sourceWasSynced) {
        toDelete.push({ hash: cyrb53(getNodeIndexText(sourceKey, sourceNode)) });
    }

    delete g.nodes[sourceKey];

    const targetDescriptionChanged = targetNode.description !== oldTargetDescription;
    if (targetDescriptionChanged) {
        if (targetWasSynced) {
            toDelete.push({ hash: cyrb53(getNodeIndexText(targetKey, { description: oldTargetDescription })) });
        }
        deleteEmbedding(targetNode);
    }

    // If source was synced, its content must be represented by the surviving
    // target even when description deduplication leaves the target text intact.
    // If only the target was synced, replace its vector only when its text changed.
    if (sourceWasSynced || (targetWasSynced && targetDescriptionChanged)) {
        const text = getNodeIndexText(targetKey, targetNode);
        toSync.push({ hash: cyrb53(text), text, item: targetNode });
    }

    // 5. Save
    if (!(await saveOpenVaultData(expectedChatId))) {
        return { success: false };
    }

    return {
        success: true,
        stChanges: { toDelete, toSync },
    };
}
