/**
 * OpenVault Memory Retrieval
 *
 * Main retrieval logic for selecting and injecting memories into context.
 * Returns result objects; callers handle UI feedback (toasts, status).
 *
 * RetrievalContext - Consolidated retrieval parameters
 *
 * @typedef {Object} RetrievalContext
 * @property {string} recentContext - Recent messages for BM25 matching
 * @property {string} userMessages - Last 3 user messages for embedding (capped at 1000 chars)
 * @property {number} chatLength - Current chat length for distance scoring
 * @property {string} primaryCharacter - POV character name
 * @property {string[]} activeCharacters - All active characters in scene
 * @property {string} headerName - Header for injection ("Scene" or character name)
 * @property {number} finalTokens - Final context token budget
 * @property {Object} graphNodes - Graph entity nodes for entity detection
 * @property {Object} graphEdges - Graph entity edges for corpus vocabulary
 * @property {Object[]} allAvailableMemories - All memories for expanded IDF corpus
 */

import {
    BUDGET_RATIO_ENTITY,
    BUDGET_RATIO_SCENE,
    BUDGET_RATIO_WORLD,
    CHARACTERS_KEY,
    COMBINED_BOOST_WEIGHT,
    extensionName,
    IMPORTANCE_5_FLOOR,
    MEMORIES_KEY,
    REFLECTION_DECAY_THRESHOLD,
} from '../constants.js';
import { getDeps } from '../deps.js';
import { getQueryEmbedding, isEmbeddingsEnabled } from '../embeddings.js';
import { getFingerprint } from '../extraction/scheduler.js';
import { cachedContent } from '../injection/macros.js';
import { filterMemoriesByPOV, getActiveCharacters, getPOVContext } from '../pov.js';
import { getSettings } from '../settings.js';
import { getOpenVaultData } from '../store/chat-data.js';
import { logDebug, logError } from '../utils/logging.js';
import { isExtensionEnabled, safeSetExtensionPrompt } from '../utils/st-helpers.js';
import { cacheRetrievalDebug } from './debug-cache.js';
import { buildEntityContextFromRetrieval } from './entity-context.js';
import { formatContextForInjection } from './formatting.js';
import { selectRelevantMemories } from './scoring.js';
import { retrieveWorldContext } from './world-context.js';

/**
 * Get memories from hidden (system) messages that need retrieval
 * Memories from visible messages are already in context and don't need injection.
 *
 * Uses MIN message_id check: memory is injectable once the oldest message in its
 * batch is hidden. This is more aggressive than checking all message_ids, allowing
 * earlier injection with minimal overlap risk.
 *
 * @param {Object[]} chat - Chat messages array
 * @param {Object[]} memories - All memories
 * @returns {Object[]} Memories whose oldest source message is hidden
 */
function _getHiddenMemories(chat, memories) {
    // Build fingerprint→index map for current chat
    const fpMap = new Map();
    for (let i = 0; i < chat.length; i++) {
        const fp = getFingerprint(chat[i]);
        fpMap.set(fp, i);
    }

    return memories.filter((m) => {
        // Prefer fingerprints (stable across chat mutations)
        if (m.message_fingerprints?.length > 0) {
            const resolvedIndices = m.message_fingerprints
                .map((fp) => fpMap.get(fp))
                .filter((idx) => idx !== undefined);
            if (resolvedIndices.length > 0) {
                const minId = Math.min(...resolvedIndices);
                return chat[minId]?.is_system;
            }
            // Fingerprints exist but resolve to nothing — source messages were deleted.
            // They are no longer visible, so the memory is injectable.
            return true;
        }
        // Fall back to message_ids ONLY when fingerprints are absent (unmigrated v2 data)
        if (!m.message_ids?.length) return false;
        const minId = Math.min(...m.message_ids);
        return chat[minId]?.is_system;
    });
}

/**
 * Deduplicate memories by ID (reflections may share IDs with source memories)
 * @param {Object[]} memories - Memories to deduplicate
 * @returns {Object[]} Deduplicated memories
 */
function _deduplicateById(memories) {
    const seen = new Set();
    return memories.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });
}

/**
 * Build retrieval context from current state
 * @param {Object} opts - Options
 * @param {string} [opts.pendingUserMessage] - User message not yet in chat
 * @returns {RetrievalContext}
 */
export function buildRetrievalContext(opts = {}) {
    const deps = getDeps();
    const settings = deps.getExtensionSettings()[extensionName];
    const context = deps.getContext();
    const chat = context.chat || [];
    const { povCharacters, isGroupChat } = getPOVContext();

    // Build recent context (all non-system messages)
    let recentContext = chat
        .filter((m) => !m.is_system)
        .map((m) => m.mes)
        .join('\n');
    if (opts.pendingUserMessage) {
        recentContext += '\n\n[User is about to say]: ' + opts.pendingUserMessage;
    }

    // Build user messages for embedding (last 3 user messages, capped at 1000 chars)
    let userMsgs = chat
        .filter((m) => !m.is_system && m.is_user)
        .slice(-3)
        .map((m) => m.mes);
    if (opts.pendingUserMessage) {
        userMsgs.push(opts.pendingUserMessage);
        userMsgs = userMsgs.slice(-3);
    }
    const userMessages = userMsgs.join('\n').slice(-1000);

    const primaryCharacter = isGroupChat ? povCharacters[0] : context.name2;

    const data = getOpenVaultData();

    // Build config objects for domain functions (dependency injection)
    const queryConfig = {
        entityWindowSize: settings.entityWindowSize,
        embeddingWindowSize: settings.embeddingWindowSize,
        recencyDecayFactor: settings.recencyDecayFactor,
        topEntitiesCount: settings.topEntitiesCount,
        entityBoostWeight: settings.entityBoostWeight,
    };

    const scoringConfig = {
        forgetfulnessBaseLambda: settings.forgetfulnessBaseLambda,
        forgetfulnessImportance5Floor: IMPORTANCE_5_FLOOR,
        reflectionDecayThreshold: REFLECTION_DECAY_THRESHOLD,
        vectorSimilarityThreshold: settings.vectorSimilarityThreshold,
        alpha: settings.alpha,
        combinedBoostWeight: COMBINED_BOOST_WEIGHT,
        embeddingSource: settings.embeddingSource,
        transientDecayMultiplier: settings.transientDecayMultiplier,
    };

    // Shared budget pool: split retrievalFinalTokens into scene / entity / world
    const totalPool = settings.retrievalFinalTokens || 10000;
    const sceneBudget = Math.floor(totalPool * BUDGET_RATIO_SCENE);
    const entityBudget = Math.floor(totalPool * BUDGET_RATIO_ENTITY);
    const worldBudget = Math.floor(totalPool * BUDGET_RATIO_WORLD);

    logDebug(`Budget split: total=${totalPool} → scene=${sceneBudget} (${BUDGET_RATIO_SCENE * 100}%) entity=${entityBudget} (${BUDGET_RATIO_ENTITY * 100}%) world=${worldBudget} (${BUDGET_RATIO_WORLD * 100}%)`);

    return {
        recentContext,
        userMessages,
        chatLength: chat.length,
        chatFingerprintMap: (() => {
            const map = new Map();
            for (let i = 0; i < chat.length; i++) {
                map.set(getFingerprint(chat[i]), i);
            }
            return map;
        })(),
        primaryCharacter,
        activeCharacters: getActiveCharacters(),
        headerName: isGroupChat ? povCharacters[0] : 'Scene',
        finalTokens: sceneBudget,
        worldContextBudget: worldBudget,
        entityContextBudget: entityBudget,
        graphNodes: data?.graph?.nodes || {},
        graphEdges: data?.graph?.edges || {},
        allAvailableMemories: data?.[MEMORIES_KEY] || [], // Full memory list for IDF
        idfCache: data?.idf_cache || null, // Pre-computed IDF cache
        queryConfig,
        scoringConfig,
    };
}

/**
 * Compute the IN_CHAT depth that places injection right after frozen replies.
 * Returns null when frozen replies are disabled (caller should use default behavior).
 * @param {Object} settings - Extension settings
 * @returns {number|null} Depth value, or null if frozen replies are off
 */
function getFrozenAwareDepth(settings) {
    const frozenReplies = settings?.frozenReplies || 0;
    if (frozenReplies <= 0) return null;

    const chat = getDeps().getContext().chat || [];
    let visibleCount = 0;
    let frozenMsgCount = 0;
    let botCount = 0;
    let boundaryFound = false;

    for (const m of chat) {
        if (m.is_system) continue;
        visibleCount++;
        if (!boundaryFound) {
            frozenMsgCount++;
            if (!m.is_user) botCount++;
            if (botCount >= frozenReplies) boundaryFound = true;
        }
    }

    if (!boundaryFound) return null;
    const depth = Math.max(0, visibleCount - frozenMsgCount);
    logDebug(`Frozen-aware depth: visible=${visibleCount} frozen=${frozenMsgCount} → depth=${depth}`);
    return depth;
}

/**
 * Count messages hidden by auto-hide (openvault_hidden flag).
 * @param {Object[]} chat - Chat messages array
 * @returns {{hiddenCount: number, hiddenTurns: number}}
 */
function countHiddenMessages(chat) {
    let hiddenCount = 0;
    for (const m of chat) {
        if (m.openvault_hidden) hiddenCount++;
    }
    return { hiddenCount, hiddenTurns: Math.ceil(hiddenCount / 2) };
}

/**
 * Prepend a gap/context notice into existing <scene_memory> content.
 * Inserts the notice right after the opening <scene_memory> tag line.
 * @param {string} contextText - Formatted memory XML string
 * @param {number} hiddenCount - Number of hidden messages
 * @param {number} hiddenTurns - Approximate number of hidden exchanges
 * @returns {string} Modified context with gap notice inserted
 */
function prependGapNotice(contextText, hiddenCount, hiddenTurns) {
    const notice = `[The following summarizes ${hiddenCount} messages (~${hiddenTurns} exchanges) not shown in chat. Use these memories to maintain narrative continuity across the gap.]`;
    return contextText.replace(
        '<scene_memory>',
        `<scene_memory>\n${notice}`,
    );
}

/**
 * Build a minimal narrative bridge when no memories exist for hidden messages.
 * @param {number} hiddenCount - Number of hidden messages
 * @param {number} hiddenTurns - Approximate number of hidden exchanges
 * @returns {string} Bridge XML block
 */
function buildEmptyBridge(hiddenCount, hiddenTurns) {
    return [
        '<scene_memory>',
        `[${hiddenCount} messages (~${hiddenTurns} exchanges) occurred between the opening scene above and the recent conversation below but are not shown. No extracted memories are available yet for this section.]`,
        '[Continue the narrative naturally from the most recent visible messages. Do not reference or acknowledge this gap directly.]',
        '</scene_memory>',
    ].join('\n');
}

/**
 * Build a lightweight context object for entity detection.
 * Avoids the full buildRetrievalContext() overhead (embeddings, IDF, etc.)
 * since entity detection only needs recent messages and graph data.
 */
function _buildMinimalRetrievalContext(deps, settings, data) {
    const context = deps.getContext();
    const chat = context.chat || [];
    const recentContext = chat
        .filter((m) => !m.is_system)
        .slice(-20)
        .map((m) => m.mes)
        .join('\n');

    return {
        recentContext,
        activeCharacters: getActiveCharacters(),
        graphNodes: data?.graph?.nodes || {},
        graphEdges: data?.graph?.edges || {},
        queryConfig: {
            entityWindowSize: settings?.entityWindowSize ?? 10,
            embeddingWindowSize: settings?.embeddingWindowSize ?? 5,
            recencyDecayFactor: settings?.recencyDecayFactor ?? 0.09,
            topEntitiesCount: settings?.topEntitiesCount ?? 5,
            entityBoostWeight: settings?.entityBoostWeight ?? 5.0,
        },
    };
}

/**
 * Inject retrieved context into the prompt
 * @param {string} contextText - Formatted context to inject
 * @param {string} [worldText] - World context to inject
 */
export function injectContext(contextText, worldText = '') {
    const deps = getDeps();
    const settings = deps.getExtensionSettings()[extensionName];

    // Always update cachedContent for macro access
    // NOTE: cachedContent is a live object reference from macros.js.
    // Mutating its properties (not reassigning the binding) is intentional
    // and updates the macro return values in-place.
    cachedContent.memory = contextText || '';
    cachedContent.world = worldText || '';

    // Get position settings with defaults
    let memoryPosition = settings?.injection?.memory?.position ?? 5;
    let memoryDepth = settings?.injection?.memory?.depth ?? 4;
    const worldPosition = settings?.injection?.world?.position ?? 5;
    const worldDepth = settings?.injection?.world?.depth ?? 4;

    // When frozen replies are active and memory is at TOP_OF_CHAT (position 5),
    // switch to IN_CHAT with a computed depth that places injection after frozen messages
    const frozenDepth = getFrozenAwareDepth(settings);
    if (memoryPosition === 5 && frozenDepth !== null) {
        memoryPosition = 4; // IN_CHAT with exact depth
        memoryDepth = frozenDepth;
    }

    // Detect hidden message gap and inject appropriate context:
    // - With memories: prepend a notice explaining these summarize hidden messages
    // - Without memories: inject a minimal bridge noting the gap
    const chat = deps.getContext().chat || [];
    const { hiddenCount, hiddenTurns } = countHiddenMessages(chat);
    let effectiveContent = contextText;

    if (hiddenCount > 0) {
        if (effectiveContent) {
            effectiveContent = prependGapNotice(effectiveContent, hiddenCount, hiddenTurns);
            logDebug(`Gap notice prepended to scene_memory (${hiddenCount} hidden msgs)`);
        } else {
            effectiveContent = buildEmptyBridge(hiddenCount, hiddenTurns);
            logDebug(`Empty bridge injected (${hiddenCount} hidden msgs, no memories)`);
        }
    }

    // Inject memory / bridge content
    if (!effectiveContent) {
        safeSetExtensionPrompt('', 'openvault', memoryPosition, memoryDepth);
    } else if (safeSetExtensionPrompt(effectiveContent, 'openvault', memoryPosition, memoryDepth)) {
        logDebug('Context injected into prompt');
    } else {
        logDebug('Failed to inject context');
    }

    // Inject world content
    if (!worldText) {
        safeSetExtensionPrompt('', 'openvault_world', worldPosition, worldDepth);
    } else {
        safeSetExtensionPrompt(worldText, 'openvault_world', worldPosition, worldDepth);
    }

    // Build and inject entity context at ↓Main (after system prompt)
    // Entities are independent of memories — always inject when graph data exists.
    // Budget comes from the shared pool (20% of retrievalFinalTokens).
    const data = getOpenVaultData();
    const graphNodes = data?.graph?.nodes;
    if (graphNodes && Object.keys(graphNodes).length > 0) {
        const totalPool = settings?.retrievalFinalTokens || 10000;
        const entityBudget = Math.floor(totalPool * BUDGET_RATIO_ENTITY);
        const ctx = _buildMinimalRetrievalContext(deps, settings, data);
        const entityText = buildEntityContextFromRetrieval(ctx, entityBudget);
        safeSetExtensionPrompt(entityText || '', 'openvault_entities', 1, 0);
    } else {
        safeSetExtensionPrompt('', 'openvault_entities', 1, 0);
    }

    // Inject post-history prompt (IN_CHAT at depth 0 = after all messages)
    const postHistoryPrompt = (settings?.postHistoryPrompt || '').trim();
    safeSetExtensionPrompt(postHistoryPrompt, 'openvault_posthistory', 4, 0);
}

/**
 * Core retrieval logic: select relevant memories, format, and inject
 * @param {Object[]} memoriesToUse - Pre-filtered memories to select from
 * @param {Object} data - OpenVault data object
 * @param {RetrievalContext} ctx - Retrieval context
 * @returns {Promise<{memories: Object[], context: string}|null>}
 */
async function selectFormatAndInject(memoriesToUse, data, ctx) {
    const { primaryCharacter, activeCharacters, headerName, finalTokens, chatLength, userMessages } = ctx;

    const selectionResult = await selectRelevantMemories(memoriesToUse, ctx);
    const relevantMemories = selectionResult.memories;

    if (!relevantMemories || relevantMemories.length === 0) {
        // Clear cachedContent and world context if no memories found
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return null;
    }

    // Get emotional context
    const primaryCharState = data[CHARACTERS_KEY]?.[primaryCharacter];
    const emotionalInfo = {
        emotion: primaryCharState?.current_emotion || 'neutral',
        fromMessages: primaryCharState?.emotion_from_messages || null,
    };

    // Get present characters (excluding POV)
    const presentCharacters = activeCharacters.filter((c) => c !== primaryCharacter);

    // Format and inject memories
    const formattedContext = formatContextForInjection(
        relevantMemories,
        presentCharacters,
        emotionalInfo,
        headerName,
        finalTokens,
        chatLength
    );

    // Prepare world context for injection
    let worldText = '';
    const worldCommunities = data.communities;
    if (worldCommunities && Object.keys(worldCommunities).length > 0) {
        let worldQueryEmbedding = null;
        if (isEmbeddingsEnabled()) {
            worldQueryEmbedding = await getQueryEmbedding(userMessages || ctx.recentContext?.slice(-500));
        }
        // Always call retrieveWorldContext - it handles macro intent detection
        // even when embeddings are null (e.g., for st_vector source)
        const worldResult = retrieveWorldContext(
            worldCommunities,
            data.global_world_state || null,
            userMessages || '',
            worldQueryEmbedding, // May be null for st_vector
            ctx.worldContextBudget,
            selectionResult.communityIds || null // ST Vector community IDs from scoring
        );
        worldText = worldResult.text || '';
        // Cache world context result for debug export
        if (worldResult?.text) {
            cacheRetrievalDebug({
                injectedWorldContext: worldResult.text,
                isMacroIntent: worldResult.isMacroIntent,
            });
        }
    }

    // Inject memory and world content (entity context is built inside injectContext)
    injectContext(formattedContext, worldText);

    // Cache injected context for debug export
    cacheRetrievalDebug({
        injectedContext: formattedContext,
        selectedCount: relevantMemories.length,
        eventsCount: relevantMemories.filter((m) => m.type !== 'reflection').length,
        reflectionsCount: relevantMemories.filter((m) => m.type === 'reflection').length,
    });

    return { memories: relevantMemories, context: formattedContext };
}

/**
 * Retrieve relevant context and inject into prompt
 * @returns {Promise<{memories: Object[], context: string}|null>}
 */
export async function retrieveAndInjectContext() {
    if (!isExtensionEnabled()) {
        logDebug('OpenVault disabled, skipping retrieval');
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return null;
    }

    const deps = getDeps();
    const context = deps.getContext();
    const chat = context.chat;

    if (!chat || chat.length === 0) {
        logDebug('No chat to retrieve context for');
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return null;
    }

    const data = getOpenVaultData();
    if (!data) {
        logDebug('No chat context available');
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return null;
    }
    const memories = data[MEMORIES_KEY] || [];

    if (memories.length === 0) {
        logDebug('No memories stored yet');
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return null;
    }

    try {
        const { povCharacters, isGroupChat } = getPOVContext();

        // Filter to memories from hidden messages only (visible messages are already in context)
        const hiddenMemories = _getHiddenMemories(chat, memories);
        // Include reflections (which have no message_ids) in candidate set - respecting user toggle
        const includeReflections = getSettings('reflectionInjectionEnabled', true);
        const reflections = includeReflections ? memories.filter((m) => m.type === 'reflection') : [];
        const candidateMemories = _deduplicateById([...hiddenMemories, ...reflections]);

        // Filter memories by POV
        const accessibleMemories = filterMemoriesByPOV(candidateMemories, povCharacters, data);
        logDebug(
            `Retrieval filter: total=${memories.length}, hidden=${hiddenMemories.length}, reflections=${reflections.length}, pov=${accessibleMemories.length} (mode=${isGroupChat ? 'group' : 'narrator'}, chars=[${povCharacters.join(', ')}])`
        );

        // Cache filter stats for debug export
        cacheRetrievalDebug({
            filters: {
                totalMemories: memories.length,
                hiddenMemories: hiddenMemories.length,
                afterPOVFilter: accessibleMemories.length,
            },
            povCharacters,
        });

        // Fallback to hidden memories if POV filter is too strict
        let memoriesToUse = accessibleMemories;
        if (accessibleMemories.length === 0 && hiddenMemories.length > 0) {
            logDebug('POV filter returned 0 results, using all hidden memories as fallback');
            memoriesToUse = hiddenMemories;
        }

        if (memoriesToUse.length === 0) {
            logDebug('No memories available');
            cachedContent.memory = '';
            cachedContent.world = '';
            injectContext('', '');
            return null;
        }

        const ctx = buildRetrievalContext();

        // Cache retrieval context for debug export
        cacheRetrievalDebug({
            retrievalContext: {
                userMessages: ctx.userMessages,
                chatLength: ctx.chatLength,
                primaryCharacter: ctx.primaryCharacter,
                activeCharacters: ctx.activeCharacters,
                sceneBudget: ctx.finalTokens,
                worldBudget: ctx.worldContextBudget,
                entityBudget: ctx.entityContextBudget,
            },
        });

        const result = await selectFormatAndInject(memoriesToUse, data, ctx);

        if (!result) {
            logDebug('No relevant memories found');
            cachedContent.memory = '';
            cachedContent.world = '';
            injectContext('', '');
            return null;
        }

        logDebug(`Injected ${result.memories.length} memories into context`);
        return result;
    } catch (error) {
        const chatLength = chat?.length || 0;
        const povCharacters = getPOVContext().povCharacters;
        logError('Retrieval error', error, { chatLength, povCharacters });
        throw error;
    }
}

/**
 * Update the injection (for automatic mode)
 * This rebuilds and re-injects context based on current state
 * @param {string} pendingUserMessage - Optional user message not yet in chat
 */
export async function updateInjection(pendingUserMessage = '') {
    // Clear injection if disabled or not in automatic mode
    if (!isExtensionEnabled()) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }

    const deps = getDeps();
    const context = deps.getContext();
    if (!context.chat || context.chat.length === 0) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }

    const data = getOpenVaultData();
    if (!data) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }
    const memories = data[MEMORIES_KEY] || [];

    if (memories.length === 0) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }

    const { povCharacters } = getPOVContext();

    // Filter to memories from hidden messages only (visible messages are already in context)
    const hiddenMemories = _getHiddenMemories(context.chat, memories);
    // Include reflections (which have no message_ids) in candidate set - respecting user toggle
    const includeReflections = getSettings('reflectionInjectionEnabled', true);
    const reflections = includeReflections ? memories.filter((m) => m.type === 'reflection') : [];
    const candidateMemories = _deduplicateById([...hiddenMemories, ...reflections]);

    // Filter memories by POV
    const accessibleMemories = filterMemoriesByPOV(candidateMemories, povCharacters, data);
    logDebug(
        `Retrieval filter: total=${memories.length} hidden=${hiddenMemories.length} reflections=${reflections.length} candidates=${candidateMemories.length} accessible=${accessibleMemories.length}`
    );

    // Fallback to candidate memories if POV filter is too strict
    let memoriesToUse = accessibleMemories;
    if (accessibleMemories.length === 0 && candidateMemories.length > 0) {
        logDebug('Injection: POV filter returned 0, using all candidate memories as fallback');
        memoriesToUse = candidateMemories;
    }

    if (memoriesToUse.length === 0) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }

    if (pendingUserMessage) {
        logDebug(`Including pending user message in retrieval context`);
    }

    const ctx = buildRetrievalContext({ pendingUserMessage });

    const result = await selectFormatAndInject(memoriesToUse, data, ctx);

    if (!result) {
        cachedContent.memory = '';
        cachedContent.world = '';
        injectContext('', '');
        return;
    }

    logDebug(`Injection updated: ${result.memories.length} memories`);
}
