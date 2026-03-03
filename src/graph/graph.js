/**
 * OpenVault Graph Module
 *
 * Flat-JSON graph CRUD for entity and relationship storage.
 * All data stored in chatMetadata.openvault.graph as { nodes, edges }.
 */

/**
 * Normalize an entity name to a consistent key.
 * @param {string} name
 * @returns {string}
 */
function normalizeKey(name) {
    return name.toLowerCase().trim();
}

/**
 * Upsert an entity node into the flat graph structure.
 * Merges descriptions and increments mentions on duplicates.
 * @param {Object} graphData - The graph object { nodes, edges } (mutated in place)
 * @param {string} name - Entity name (original casing preserved on first insert)
 * @param {string} type - PERSON | PLACE | ORGANIZATION | OBJECT | CONCEPT
 * @param {string} description - Entity description
 */
export function upsertEntity(graphData, name, type, description) {
    const key = normalizeKey(name);
    const existing = graphData.nodes[key];

    if (existing) {
        if (!existing.description.includes(description)) {
            existing.description = existing.description + ' | ' + description;
        }
        existing.mentions += 1;
    } else {
        graphData.nodes[key] = {
            name: name.trim(),
            type,
            description,
            mentions: 1,
        };
    }
}

/**
 * Upsert a relationship edge. Increments weight on duplicates.
 * On duplicate edges: increments weight AND appends description if different.
 * Silently skips if source or target node doesn't exist.
 * @param {Object} graphData - The graph object { nodes, edges } (mutated in place)
 * @param {string} source - Source entity name (will be normalized)
 * @param {string} target - Target entity name (will be normalized)
 * @param {string} description - Relationship description
 */
export function upsertRelationship(graphData, source, target, description) {
    const srcKey = normalizeKey(source);
    const tgtKey = normalizeKey(target);

    if (!graphData.nodes[srcKey] || !graphData.nodes[tgtKey]) return;

    const edgeKey = `${srcKey}__${tgtKey}`;
    const existing = graphData.edges[edgeKey];

    if (existing) {
        existing.weight += 1;
        if (!existing.description.includes(description)) {
            existing.description = existing.description + ' | ' + description;
        }
    } else {
        graphData.edges[edgeKey] = {
            source: srcKey,
            target: tgtKey,
            description,
            weight: 1,
        };
    }
}

/**
 * Create an empty flat graph structure.
 * @returns {{ nodes: Object, edges: Object }}
 */
export function createEmptyGraph() {
    return { nodes: {}, edges: {} };
}

/**
 * Initialize graph-related state fields on the openvault data object.
 * Does not overwrite existing fields.
 * @param {Object} data - The openvault data object (mutated in place)
 */
export function initGraphState(data) {
    if (!data.graph) data.graph = createEmptyGraph();
    if (!data.communities) data.communities = {};
    if (!data.reflection_state) data.reflection_state = {};
    if (data.graph_message_count == null) data.graph_message_count = 0;
}
