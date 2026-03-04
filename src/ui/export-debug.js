/**
 * OpenVault Debug Export
 *
 * Assembles and exports full system state + last retrieval debug data to clipboard.
 */

import { extensionName, CHARACTERS_KEY, MEMORIES_KEY } from '../constants.js';
import { getDeps } from '../deps.js';
import { isEmbeddingsEnabled } from '../embeddings.js';
import { getLastRetrievalDebug } from '../retrieval/debug-cache.js';
import { getOpenVaultData, showToast } from '../utils.js';

const RECENT_CONTEXT_CAP = 2000;

/**
 * Strip embedding arrays from an object (shallow clone).
 * @param {Object} obj
 * @returns {Object} Clone without 'embedding' key
 */
function stripEmbedding(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = { ...obj };
    delete clone.embedding;
    return clone;
}

/**
 * Build memory statistics from memories array.
 * @param {Object[]} memories
 * @returns {Object}
 */
function buildMemoryStats(memories) {
    const byType = {};
    const byImportance = {};
    let importanceSum = 0;

    for (const m of memories) {
        const type = m.type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
        const imp = String(m.importance || 0);
        byImportance[imp] = (byImportance[imp] || 0) + 1;
        importanceSum += m.importance || 0;
    }

    return {
        total: memories.length,
        byType,
        byImportance,
        averageImportance: memories.length > 0 ? Math.round((importanceSum / memories.length) * 100) / 100 : 0,
    };
}

/**
 * Build character state summary (counts instead of arrays).
 * @param {Object} characterStates
 * @returns {Object}
 */
function buildCharacterSummary(characterStates) {
    if (!characterStates) return {};
    const result = {};
    for (const [name, state] of Object.entries(characterStates)) {
        result[name] = {
            emotion: state.current_emotion || 'neutral',
            intensity: state.emotion_intensity || 0,
            knownEvents: state.known_events?.length || 0,
        };
    }
    return result;
}

/**
 * Build graph summary + raw (embeddings stripped).
 * @param {Object} graph
 * @returns {Object}
 */
function buildGraphExport(graph) {
    if (!graph) return { summary: { nodeCount: 0, edgeCount: 0, typeBreakdown: {}, topEntitiesByMentions: [] }, raw: { nodes: {}, edges: {} } };

    const nodes = graph.nodes || {};
    const edges = graph.edges || {};
    const nodeEntries = Object.values(nodes);
    const edgeEntries = Object.values(edges);

    // Type breakdown
    const typeBreakdown = {};
    for (const node of nodeEntries) {
        const t = node.type || 'UNKNOWN';
        typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }

    // Top entities by mentions
    const topEntities = nodeEntries
        .slice()
        .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
        .slice(0, 10)
        .map((n) => ({ name: n.name, type: n.type, mentions: n.mentions || 0 }));

    // Raw without embeddings
    const rawNodes = {};
    for (const [key, node] of Object.entries(nodes)) {
        rawNodes[key] = stripEmbedding(node);
    }

    return {
        summary: {
            nodeCount: nodeEntries.length,
            edgeCount: edgeEntries.length,
            typeBreakdown,
            topEntitiesByMentions: topEntities,
        },
        raw: { nodes: rawNodes, edges: { ...edges } },
    };
}

/**
 * Build communities export (embeddings stripped).
 * @param {Object} communities
 * @returns {Object}
 */
function buildCommunitiesExport(communities) {
    if (!communities) return { count: 0, details: {} };
    const details = {};
    for (const [id, comm] of Object.entries(communities)) {
        details[id] = {
            title: comm.title,
            summary: comm.summary,
            findings: comm.findings,
            nodeCount: comm.nodes?.length || 0,
        };
    }
    return { count: Object.keys(communities).length, details };
}

/**
 * Build the full export payload.
 * @returns {Object} JSON-serializable payload
 */
export function buildExportPayload() {
    const deps = getDeps();
    const settings = deps.getExtensionSettings()[extensionName] || {};
    const data = getOpenVaultData() || {};
    const memories = data[MEMORIES_KEY] || [];
    const characterStates = data[CHARACTERS_KEY] || {};
    const graph = data.graph || {};
    const communities = data.communities || {};

    // Cached retrieval debug data
    const cached = getLastRetrievalDebug();

    // Truncate recentContext in cached data if present
    let lastRetrieval = null;
    if (cached) {
        lastRetrieval = { ...cached };
        if (lastRetrieval.retrievalContext?.userMessages) {
            // userMessages is already capped at 1000 by buildRetrievalContext, keep as-is
        }
    }

    return {
        openvault_debug_export: true,
        exportedAt: new Date().toISOString(),

        lastRetrieval,

        state: {
            memories: buildMemoryStats(memories),
            characterStates: buildCharacterSummary(characterStates),
            graph: buildGraphExport(graph),
            communities: buildCommunitiesExport(communities),
        },

        settings: {
            alpha: settings.alpha,
            vectorSimilarityThreshold: settings.vectorSimilarityThreshold,
            combinedBoostWeight: settings.combinedBoostWeight,
            forgetfulnessBaseLambda: settings.forgetfulnessBaseLambda,
            forgetfulnessImportance5Floor: settings.forgetfulnessImportance5Floor,
            retrievalFinalTokens: settings.retrievalFinalTokens,
            worldContextBudget: settings.worldContextBudget,
            embeddingsEnabled: isEmbeddingsEnabled(),
            embeddingSource: settings.embeddingSource,
            autoMode: settings.enabled,
            debugMode: settings.debugMode,
        },
    };
}

/**
 * Export debug data to clipboard. Shows toast on success/failure.
 */
export async function exportToClipboard() {
    try {
        const payload = buildExportPayload();
        const json = JSON.stringify(payload, null, 2);
        await navigator.clipboard.writeText(json);
        showToast('success', `Copied ${(json.length / 1024).toFixed(1)}KB to clipboard`);
    } catch (err) {
        // Fallback for clipboard API failure
        try {
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(buildExportPayload(), null, 2);
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('success', 'Copied to clipboard (fallback)');
        } catch (fallbackErr) {
            showToast('error', 'Failed to copy to clipboard');
        }
    }
}
