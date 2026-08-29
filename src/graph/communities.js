/**
 * OpenVault Community Detection & Summarization
 *
 * Uses graphology for graph computation and Louvain for community detection.
 */

import { cdnImport } from '../utils/cdn.js';

const [{ default: Graph }, { default: louvain }, { toUndirected }] = await Promise.all([
    cdnImport('graphology'),
    cdnImport('graphology-communities-louvain'),
    cdnImport('graphology-operators'),
]);

import { extensionName, GLOBAL_SYNTHESIS_CHUNK_SIZE, MAIN_CHARACTER_ATTENUATION } from '../constants.js';
import { getDeps } from '../deps.js';
import { getQueryEmbedding } from '../embeddings.js';
import { parseCommunitySummaryResponse, parseGlobalSynthesisResponse } from '../extraction/structured.js';
import { callLLM, LLM_CONFIGS } from '../llm.js';
import { record } from '../perf/store.js';
import {
    buildCommunitySummaryPrompt,
    buildGlobalSynthesisPrompt,
    resolveExtractionPreamble,
    resolveExtractionPrefill,
    resolveOutputLanguage,
} from '../prompts/index.js';
import { cyrb53, hasEmbedding, setEmbedding } from '../utils/embedding-codec.js';
import { logDebug } from '../utils/logging.js';
import { createLadderQueue } from '../utils/queue.js';

function escapePromptData(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

/**
 * Convert flat graph data to a graphology instance.
 * @param {Object} graphData - { nodes, edges } from chatMetadata
 * @returns {Graph}
 */
export function toGraphology(graphData) {
    const graph = new Graph({ type: 'directed', allowSelfLoops: false });

    for (const [key, attrs] of Object.entries(graphData.nodes || {})) {
        graph.addNode(key, { ...attrs });
    }

    for (const [key, attrs] of Object.entries(graphData.edges || {})) {
        // Delete self-loops from backing store (defensive - should be prevented at insertion time)
        if (attrs.source === attrs.target) {
            logDebug(`[communities] Removing self-loop edge ${key}: ${attrs.source} -> ${attrs.target}`);
            delete graphData.edges[key];
            continue;
        }
        if (
            attrs.status !== 'resolved' &&
            attrs.status !== 'superseded' &&
            graph.hasNode(attrs.source) &&
            graph.hasNode(attrs.target)
        ) {
            graph.addEdgeWithKey(key, attrs.source, attrs.target, {
                description: attrs.description,
                weight: Math.min(Math.max(attrs.weight || 1, 0), 10) * (attrs.status === 'weakened' ? 0.35 : 1),
            });
        }
    }

    return graph;
}

/**
 * Run Louvain community detection on the graph.
 * Temporarily prunes edges involving main characters to avoid hairball effect.
 * @param {Object} graphData - Flat graph data
 * @param {string[]} mainCharacterKeys - Node keys for main characters (User + Char) to prune
 * @returns {{ communities: Object<string, number>, count: number } | null}
 */
export function detectCommunities(graphData, mainCharacterKeys = []) {
    if (Object.keys(graphData.nodes || {}).length < 3) return null;

    const t0 = performance.now();
    const nodeCount = Object.keys(graphData.nodes).length;
    const edgeCount = Object.keys(graphData.edges || {}).length;

    try {
        const directed = toGraphology(graphData);
        const undirected = toUndirected(directed);

        // Attenuate edges involving main characters instead of dropping them.
        // This breaks hairball gravity in open-world RPs while preventing object
        // orphaning in hub-and-spoke topologies (closed-room RPs).
        const mainSet = new Set(mainCharacterKeys);
        if (mainSet.size > 0) {
            undirected.forEachEdge((edge, attrs, source, target) => {
                if (mainSet.has(source) || mainSet.has(target)) {
                    undirected.setEdgeAttribute(edge, 'weight', (attrs.weight || 1) * MAIN_CHARACTER_ATTENUATION);
                }
            });
        }

        // Fallback safety net for extremely tiny graphs
        if (undirected.order < 3) {
            const fallbackDirected = toGraphology(graphData);
            const fallbackUndirected = toUndirected(fallbackDirected);

            // Logarithmic scaling to reduce black-hole effect of high-weight edges
            fallbackUndirected.forEachEdge((edge, attrs) => {
                fallbackUndirected.setEdgeAttribute(edge, 'weight', Math.log((attrs.weight || 1) + 1) + 1);
            });

            const details = louvain.detailed(fallbackUndirected, {
                getEdgeWeight: 'weight',
                resolution: 1.1,
            });
            return { communities: details.communities, count: details.count };
        }

        const details = louvain.detailed(undirected, {
            getEdgeWeight: 'weight',
            resolution: 1.0,
        });

        // Re-anchor main characters to the community of their strongest neighbor
        // using original un-attenuated weights from graphData.edges.
        for (const mainKey of mainCharacterKeys) {
            if (!graphData.nodes[mainKey]) continue;
            let bestCommunity = 0;
            let bestWeight = -1;
            for (const [_edgeKey, edge] of Object.entries(graphData.edges || {})) {
                const neighborKey =
                    edge.source === mainKey ? edge.target : edge.target === mainKey ? edge.source : null;
                if (neighborKey && details.communities[neighborKey] !== undefined) {
                    if ((edge.weight || 1) > bestWeight) {
                        bestWeight = edge.weight || 1;
                        bestCommunity = details.communities[neighborKey];
                    }
                }
            }
            details.communities[mainKey] = bestCommunity;
        }

        return {
            communities: details.communities,
            count: details.count,
        };
    } finally {
        record('louvain_detection', performance.now() - t0, `${nodeCount} nodes, ${edgeCount} edges`);
    }
}

/**
 * Group nodes by community ID and extract subgraph data for LLM prompts.
 * @param {Object} graphData - Flat graph data
 * @param {Object} communityPartition - nodeKey → communityId mapping
 * @returns {Object<number, { nodeKeys: string[], nodeLines: string[], edgeLines: string[] }>}
 */
export function buildCommunityGroups(graphData, communityPartition) {
    const groups = {};

    // Group node keys
    for (const [nodeKey, communityId] of Object.entries(communityPartition)) {
        if (!groups[communityId]) {
            groups[communityId] = { nodeKeys: [], nodeLines: [], edgeLines: [], boundaryEdgeLines: [] };
        }
        groups[communityId].nodeKeys.push(nodeKey);

        const node = graphData.nodes[nodeKey];
        if (node) {
            groups[communityId].nodeLines.push(
                `- [ID:${escapePromptData(nodeKey)}] ${escapePromptData(node.name)} (${node.type || 'UNKNOWN'}): ${escapePromptData(node.description)}`
            );
        }
    }

    // Assign edges to communities
    for (const [_edgeKey, edge] of Object.entries(graphData.edges || {})) {
        if (edge.status === 'resolved' || edge.status === 'superseded') continue;
        const srcCommunity = communityPartition[edge.source];
        const tgtCommunity = communityPartition[edge.target];

        // Include edge if both endpoints are in the same community
        if (srcCommunity === tgtCommunity && groups[srcCommunity]) {
            const srcNode = graphData.nodes[edge.source];
            const tgtNode = graphData.nodes[edge.target];
            groups[srcCommunity].edgeLines.push(
                `- ${escapePromptData(srcNode?.name || edge.source)} → ${escapePromptData(tgtNode?.name || edge.target)}: ${escapePromptData(edge.description)} [weight: ${edge.weight}; status: ${edge.status || 'active'}]`
            );
        } else {
            const srcNode = graphData.nodes[edge.source];
            const tgtNode = graphData.nodes[edge.target];
            const line = `- [BOUNDARY] ${escapePromptData(srcNode?.name || edge.source)} → ${escapePromptData(tgtNode?.name || edge.target)}: ${escapePromptData(edge.description)} [status: ${edge.status || 'active'}]`;
            if (groups[srcCommunity]) groups[srcCommunity].boundaryEdgeLines.push(line);
            if (groups[tgtCommunity]) groups[tgtCommunity].boundaryEdgeLines.push(line);
        }
    }

    for (const group of Object.values(groups)) {
        group.nodeKeys.sort();
        group.nodeLines.sort();
        group.edgeLines.sort();
        group.boundaryEdgeLines = [...new Set(group.boundaryEdgeLines)].sort().slice(0, 12);
        group.inputHash = String(
            cyrb53([...group.nodeLines, ...group.edgeLines, ...group.boundaryEdgeLines].join('\n'))
        );
    }

    return groups;
}

function overlapScore(a, b) {
    const left = new Set(a || []);
    const right = new Set(b || []);
    let intersection = 0;
    for (const key of left) if (right.has(key)) intersection++;
    const union = left.size + right.size - intersection;
    return union > 0 ? intersection / union : 0;
}

/** Match volatile Louvain labels to stable stored community IDs. */
export function assignStableCommunityIds(communityGroups, existingCommunities) {
    const assignments = {};
    const used = new Set();
    const groups = Object.entries(communityGroups).sort((a, b) => b[1].nodeKeys.length - a[1].nodeKeys.length);
    for (const [temporaryId, group] of groups) {
        let bestId = null;
        let bestScore = 0;
        for (const [id, existing] of Object.entries(existingCommunities || {})) {
            if (used.has(id) || existing.status === 'dissolved' || existing.parentId) continue;
            const score = overlapScore(group.nodeKeys, existing.nodeKeys || []);
            if (score > bestScore) {
                bestScore = score;
                bestId = id;
            }
        }
        const id = bestId && bestScore >= 0.5 ? bestId : `community-${cyrb53(group.nodeKeys.join('|'))}`;
        used.add(id);
        const parents = Object.entries(existingCommunities || {})
            .filter(
                ([, existing]) =>
                    !existing.parentId &&
                    existing.status !== 'dissolved' &&
                    overlapScore(group.nodeKeys, existing.nodeKeys || []) >= 0.25
            )
            .map(([existingId]) => existingId)
            .sort();
        assignments[temporaryId] = { id, parents, overlap: bestScore };
    }
    return assignments;
}

export function getCommunityRetrievalText(id, community) {
    return `[OV_ID:${id}] ${community.title || ''}\n${community.summary || ''}\n${(community.findings || []).join('\n')}`.trim();
}

/** Strictly validate an LLM subdivision against real nodes and active edges. */
export function validateCommunitySubdivisions(proposals, group, graphData) {
    if (!Array.isArray(proposals) || proposals.length < 2 || proposals.length > 4) return [];
    const allowed = new Set(group.nodeKeys);
    const seen = new Set();
    for (const proposal of proposals) {
        if (!Array.isArray(proposal.entity_ids) || proposal.entity_ids.length < 2) return [];
        for (const id of proposal.entity_ids) {
            if (!allowed.has(id) || seen.has(id)) return [];
            seen.add(id);
        }
        const members = new Set(proposal.entity_ids);
        const connected = new Set([proposal.entity_ids[0]]);
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const edge of Object.values(graphData.edges || {})) {
                if (edge.status === 'resolved' || edge.status === 'superseded') continue;
                if (!members.has(edge.source) || !members.has(edge.target)) continue;
                if (connected.has(edge.source) && !connected.has(edge.target)) {
                    connected.add(edge.target);
                    progressed = true;
                }
                if (connected.has(edge.target) && !connected.has(edge.source)) {
                    connected.add(edge.source);
                    progressed = true;
                }
            }
        }
        if (connected.size !== members.size) return [];
    }
    return seen.size === allowed.size ? proposals : [];
}

/**
 * Check if two arrays contain the same elements (order-independent).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function sameMembers(a, b) {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((item) => setA.has(item));
}

/**
 * Generate or update community summaries.
 * Only regenerates communities whose node membership changed.
 * Skips communities with fewer than 2 nodes (islands).
 * @param {Object} graphData - Flat graph data
 * @param {Object} communityGroups - Output of buildCommunityGroups
 * @param {Object} existingCommunities - Current community summaries from state
 * @param {number} currentMessageCount - Current graph message count for staleness detection
 * @param {number} stalenessThreshold - Message count threshold for forced re-summarization
 * @param {boolean} isSingleCommunity - Whether Louvain produced only one community
 * @returns {Promise<{ communities: Object, global_world_state: Object|null, stChanges: Object }>} Updated communities, optional global state, and ST sync changes
 */
export async function updateCommunitySummaries(
    graphData,
    communityGroups,
    existingCommunities,
    currentMessageCount = 0,
    stalenessThreshold = 100,
    isSingleCommunity = false
) {
    const t0 = performance.now();
    const deps = getDeps();
    const settings = deps.getExtensionSettings()?.[extensionName] || {};
    const preamble = resolveExtractionPreamble(settings);
    const outputLanguage = resolveOutputLanguage(settings);
    const prefill = resolveExtractionPrefill(settings);
    const updatedCommunities = {};
    const assignments = assignStableCommunityIds(communityGroups, existingCommunities);
    const changedIds = new Set();
    let hadStaleFailure = false;

    // Track how many communities were actually updated
    let updatedCount = 0;

    const ladderQueue = await createLadderQueue(settings.maxConcurrency);
    const promises = [];

    for (const [communityId, group] of Object.entries(communityGroups)) {
        // Skip solo nodes - they don't form a meaningful community
        if (group.nodeKeys.length < 2) continue;

        const assignment = assignments[communityId];
        const key = assignment.id;
        const existing = existingCommunities[key];

        // Check if membership has changed
        const membershipChanged = !existing || !sameMembers(existing.nodeKeys || [], group.nodeKeys);
        const inputChanged = !existing || existing.inputHash !== group.inputHash;

        // Check staleness: message count delta exceeds threshold
        const messageDelta = currentMessageCount - (existing?.lastUpdatedMessageCount || 0);
        const isStale = messageDelta >= stalenessThreshold;

        // Check if embedding is missing (need to regenerate if so)
        const missingEmbedding = existing && !hasEmbedding(existing);

        // Special case: if only one community, always re-summarize at staleness interval
        const singleCommunityForceRefresh = isSingleCommunity && isStale;

        // Skip if membership hasn't changed AND not stale AND not missing embedding
        if (!inputChanged && !membershipChanged && !isStale && !missingEmbedding && !singleCommunityForceRefresh) {
            updatedCommunities[key] = existing;
            for (const [childId, child] of Object.entries(existingCommunities)) {
                if (child.parentId === key && child.parentInputHash === group.inputHash) {
                    updatedCommunities[childId] = child;
                }
            }
            continue;
        }
        changedIds.add(key);

        // Queue the LLM summarization
        promises.push(
            ladderQueue
                .add(async () => {
                    const prompt = buildCommunitySummaryPrompt(
                        group.nodeLines,
                        [...(group.edgeLines || []), ...(group.boundaryEdgeLines || [])],
                        preamble,
                        outputLanguage,
                        prefill
                    );
                    const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
                    const parsed = parseCommunitySummaryResponse(response);
                    const community = {
                        id: key,
                        nodeKeys: group.nodeKeys,
                        title: parsed.title,
                        summary: parsed.summary,
                        findings: parsed.findings,
                        lastUpdated: deps.Date.now(),
                        lastUpdatedMessageCount: currentMessageCount,
                        inputHash: group.inputHash,
                        status: 'active',
                        boundaryEdges: group.boundaryEdgeLines || [],
                        lineage: { parents: assignment.parents.filter((id) => id !== key), children: [] },
                    };
                    community.retrievalText = getCommunityRetrievalText(key, community);
                    const embedding = await getQueryEmbedding(community.retrievalText);
                    if (embedding) {
                        setEmbedding(community, embedding);
                    }
                    updatedCommunities[key] = community;
                    updatedCount++;

                    const proposedSubdivisions = validateCommunitySubdivisions(parsed.subcommunities, group, graphData);
                    const proposalHash =
                        proposedSubdivisions.length > 0
                            ? String(
                                  cyrb53(
                                      proposedSubdivisions
                                          .map((proposal) => [...proposal.entity_ids].sort().join('|'))
                                          .sort()
                                          .join('::')
                                  )
                              )
                            : '';
                    const hadExistingSplit = Object.values(existingCommunities).some(
                        (candidate) => candidate.parentId === key
                    );
                    const subdivisions =
                        hadExistingSplit || (proposalHash && existing?.pendingSplitHash === proposalHash)
                            ? proposedSubdivisions
                            : [];
                    if (proposedSubdivisions.length > 0 && subdivisions.length === 0) {
                        community.pendingSplitHash = proposalHash;
                    }
                    const usedChildIds = new Set();
                    for (const proposal of subdivisions) {
                        let childId = null;
                        let childScore = 0;
                        for (const [candidateId, candidate] of Object.entries(existingCommunities)) {
                            if (candidate.parentId !== key || usedChildIds.has(candidateId)) continue;
                            const score = overlapScore(proposal.entity_ids, candidate.nodeKeys || []);
                            if (score > childScore) {
                                childScore = score;
                                childId = candidateId;
                            }
                        }
                        if (!childId || childScore < 0.5) {
                            childId = `community-${cyrb53(`${key}|${[...proposal.entity_ids].sort().join('|')}`)}`;
                        }
                        usedChildIds.add(childId);
                        changedIds.add(childId);
                        const child = {
                            id: childId,
                            nodeKeys: [...proposal.entity_ids].sort(),
                            title: proposal.title,
                            summary: proposal.summary,
                            findings: proposal.findings,
                            status: 'active',
                            inputHash: String(
                                cyrb53(`${group.inputHash}|${[...proposal.entity_ids].sort().join('|')}`)
                            ),
                            parentId: key,
                            parentInputHash: group.inputHash,
                            lastUpdated: deps.Date.now(),
                            lastUpdatedMessageCount: currentMessageCount,
                            lineage: { parents: [key], children: [] },
                        };
                        child.retrievalText = getCommunityRetrievalText(childId, child);
                        const childEmbedding = await getQueryEmbedding(child.retrievalText);
                        if (childEmbedding) setEmbedding(child, childEmbedding);
                        updatedCommunities[childId] = child;
                        community.lineage.children.push(childId);
                        updatedCount++;
                    }
                    logDebug(`Community ${key}: "${parsed.title}" (${group.nodeKeys.length} nodes)`);
                })
                .catch((error) => {
                    logDebug(`Community ${key} summarization failed: ${error.message}`);
                    hadStaleFailure = true;
                    updatedCommunities[key] = {
                        id: key,
                        nodeKeys: group.nodeKeys,
                        title: existing?.title || 'Stale community',
                        summary: '',
                        findings: [],
                        inputHash: group.inputHash,
                        status: 'stale',
                        lastKnownSummary: existing?.summary || '',
                        boundaryEdges: group.boundaryEdgeLines || [],
                        lineage: { parents: assignment.parents.filter((id) => id !== key), children: [] },
                    };
                })
        );
    }

    await Promise.all(promises);

    // Build change set for ST sync (orchestrator handles network I/O)
    const stChanges = { toSync: [], toDelete: [] };
    for (const [id, community] of Object.entries(updatedCommunities)) {
        const existing = existingCommunities[id];
        if (changedIds.has(id) && existing?._st_synced) {
            const oldText = existing.retrievalText || getCommunityRetrievalText(id, existing);
            stChanges.toDelete.push({ hash: cyrb53(oldText) });
        }
        if (changedIds.has(id) && community.status === 'active' && community.summary) {
            const text = community.retrievalText || getCommunityRetrievalText(id, community);
            stChanges.toSync.push({ hash: cyrb53(text), text, item: community });
        }
    }

    // Detect dissolved communities — present in existing but absent in updated
    for (const [id, community] of Object.entries(existingCommunities)) {
        if (!updatedCommunities[id] && community._st_synced) {
            const text = community.retrievalText || getCommunityRetrievalText(id, community);
            stChanges.toDelete.push({ hash: cyrb53(text) });
        }
    }

    const communityCount = Object.keys(updatedCommunities).length;
    record('llm_communities', performance.now() - t0, `${communityCount} communities`);

    // Trigger global world state synthesis if any communities were updated
    let globalState = null;
    if (updatedCount > 0 && !hadStaleFailure) {
        globalState = await generateGlobalWorldState(updatedCommunities, preamble, outputLanguage, prefill);
    }

    // Return object with communities and optional global state
    return {
        communities: updatedCommunities,
        global_world_state: globalState,
        stChanges,
    };
}

/**
 * Synthesize community summaries into a global narrative.
 * Uses single-pass for small sets, map-reduce for larger sets.
 *
 * @param {Object[]} communityList - Array of community objects with { title, summary, findings }
 * @param {string} preamble - Extraction preamble
 * @param {string} outputLanguage - Output language setting
 * @param {string} prefill - Required prefill for assistant message
 * @returns {Promise<string|null>} Global summary string, or null if all chunks fail
 */
export async function synthesizeInChunks(communityList, preamble, outputLanguage, prefill) {
    if (communityList.length <= GLOBAL_SYNTHESIS_CHUNK_SIZE) {
        // Small set: single-pass (current behavior)
        const prompt = buildGlobalSynthesisPrompt(communityList, preamble, outputLanguage, prefill);
        const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
        return parseGlobalSynthesisResponse(response).global_summary;
    }

    // Map phase: chunk communities, get regional summaries (parallelized)
    const chunks = [];
    for (let i = 0; i < communityList.length; i += GLOBAL_SYNTHESIS_CHUNK_SIZE) {
        chunks.push(communityList.slice(i, i + GLOBAL_SYNTHESIS_CHUNK_SIZE));
    }

    const settings = getDeps().getExtensionSettings()?.[extensionName] || {};
    const ladderQueue = await createLadderQueue(settings.maxConcurrency);

    const results = await Promise.all(
        chunks.map((chunk) =>
            ladderQueue
                .add(async () => {
                    const prompt = buildGlobalSynthesisPrompt(chunk, preamble, outputLanguage, prefill);
                    const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
                    return parseGlobalSynthesisResponse(response).global_summary;
                })
                .catch((err) => {
                    logDebug(`Regional synthesis chunk failed, skipping: ${err.message}`);
                    return null;
                })
        )
    );

    const regionalSummaries = results.filter((r) => r !== null);

    if (regionalSummaries.length === 0) return null;

    // Reduce phase: synthesize regional summaries into final global summary
    const pseudoCommunities = regionalSummaries.map((summary, i) => ({
        title: `Region ${i + 1}`,
        summary,
        findings: [],
    }));
    const reducePrompt = buildGlobalSynthesisPrompt(pseudoCommunities, preamble, outputLanguage, prefill);
    const reduceResponse = await callLLM(reducePrompt, LLM_CONFIGS.community, { structured: true });
    return parseGlobalSynthesisResponse(reduceResponse).global_summary;
}

/**
 * Generate global world state from all community summaries.
 * Called after community updates, only if 1+ communities changed.
 *
 * @param {Object} communities - All community summaries
 * @param {string} preamble - Extraction preamble language
 * @param {string} outputLanguage - Output language setting
 * @param {string} prefill - Required prefill for assistant message
 * @returns {Promise<{ summary: string, last_updated: number, community_count: number } | null>}
 */
export async function generateGlobalWorldState(communities, preamble, outputLanguage, prefill) {
    const communityList = Object.values(communities || {}).filter(
        (community) => community.status === 'active' && !(community.lineage?.children?.length > 0)
    );
    if (communityList.length === 0) {
        return null;
    }

    const t0 = performance.now();
    const deps = getDeps();

    try {
        const summary = await synthesizeInChunks(communityList, preamble, outputLanguage, prefill);

        const result = {
            summary,
            last_updated: deps.Date.now(),
            community_count: communityList.length,
        };

        logDebug(`Global world state synthesized from ${communityList.length} communities`);
        record('global_synthesis', performance.now() - t0, `${communityList.length} communities`);
        return result;
    } catch (error) {
        logDebug(`Global world state synthesis failed: ${error.message}`);
        return null;
    }
}
