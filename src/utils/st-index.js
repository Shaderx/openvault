// @ts-check

/**
 * Build the exact text used as the ST Vector index payload for a memory.
 * @param {{id: string, summary?: string}} memory - Indexed memory
 * @returns {string}
 */
export function getMemoryIndexText(memory) {
    return `[OV_ID:${memory.id}] ${memory.summary || ''}`;
}

/**
 * Build the exact text used as the ST Vector index payload for a graph node.
 * @param {string} key - Normalized node key
 * @param {{description?: string}} node - Indexed graph node
 * @returns {string}
 */
export function getNodeIndexText(key, node) {
    return `[OV_ID:${key}] ${node.description || ''}`;
}

/**
 * Build the exact text used as the ST Vector index payload for a graph edge.
 * @param {{source: string, target: string, description?: string}} edge - Indexed graph edge
 * @returns {string}
 */
export function getEdgeIndexText(edge) {
    return `[OV_ID:edge_${edge.source}_${edge.target}] ${edge.description || ''}`;
}

/**
 * Build the text used to generate a local embedding for a graph edge.
 * @param {{source: string, target: string, description?: string}} edge - Graph edge
 * @returns {string}
 */
export function getEdgeEmbeddingText(edge) {
    return `relationship: ${edge.source} - ${edge.target}: ${edge.description || ''}`;
}

/**
 * Build the exact text used as the ST Vector index payload for a reflection.
 * @param {{id: string, summary?: string}} reflection - Indexed reflection
 * @returns {string}
 */
export function getReflectionIndexText(reflection) {
    return getMemoryIndexText(reflection);
}

/**
 * Build the exact text used as the ST Vector index payload for a community.
 * @param {string} id - Community ID
 * @param {{retrievalText?: string, title?: string, summary?: string, findings?: string[]}} community - Indexed community
 * @param {{useStored?: boolean}} [options] - Whether to use a persisted retrievalText value
 * @returns {string}
 */
export function getCommunityIndexText(id, community, { useStored = true } = {}) {
    return (
        (useStored ? community.retrievalText : '') ||
        `[OV_ID:${id}] ${community.title || ''}\n${community.summary || ''}\n${(community.findings || []).join('\n')}`
    );
}
