/**
 * OpenVault Entity Context Injection
 *
 * Selects graph entities relevant to the current scene and formats them
 * as reference material for injection into the system prompt area.
 * Entities provide the LLM with "who/what/where" knowledge before it
 * reads any chat messages — similar to how Lorebook entries work.
 */

import { countTokens } from '../utils/tokens.js';
import { logDebug } from '../utils/logging.js';
import { extractQueryContext, parseRecentMessages } from './query-context.js';

/**
 * Normalize an entity name to a graph key (lowercase, spaces → underscores).
 * @param {string} name
 * @returns {string}
 */
function toKey(name) {
    return (name || '').toLowerCase().replace(/\s+/g, '_').trim();
}

/**
 * Build a formatted entity context block from graph nodes.
 *
 * Selection strategy:
 * 1. Entities detected in recent chat (highest priority)
 * 2. 1-hop connected entities via graph edges (related context)
 * Active characters are excluded — they already have card definitions.
 *
 * @param {Object} graphNodes - Graph nodes keyed by normalized name
 * @param {Object} graphEdges - Graph edges keyed by "src__tgt"
 * @param {string[]} detectedEntities - Entity names from extractQueryContext
 * @param {string[]} activeCharacters - Active character names to exclude
 * @param {number} tokenBudget - Max tokens for entity context
 * @returns {string} Formatted <entity_context> block, or empty string
 */
export function buildEntityContext(graphNodes, graphEdges, detectedEntities, activeCharacters, tokenBudget) {
    if (!graphNodes || Object.keys(graphNodes).length === 0) return '';

    const activeKeys = new Set((activeCharacters || []).map(toKey));
    const nameToKey = new Map();
    for (const [key, node] of Object.entries(graphNodes)) {
        nameToKey.set(toKey(node.name), key);
        for (const alias of node.aliases || []) {
            nameToKey.set(toKey(alias), key);
        }
    }

    const selectedKeys = new Set();
    const orderedEntries = [];

    // Tier 1: entities detected in recent chat
    for (const entityName of detectedEntities) {
        const key = nameToKey.get(toKey(entityName)) || toKey(entityName);
        const node = graphNodes[key];
        if (!node?.description) continue;
        if (activeKeys.has(key)) continue;
        if (selectedKeys.has(key)) continue;
        selectedKeys.add(key);
        orderedEntries.push({ key, node });
    }

    // Tier 2: 1-hop connected entities (related but not directly mentioned)
    if (graphEdges && selectedKeys.size > 0) {
        const connected = [];
        for (const [, edge] of Object.entries(graphEdges)) {
            if (selectedKeys.has(edge.source) && !selectedKeys.has(edge.target)) {
                connected.push({ key: edge.target, edgeDesc: edge.description });
            } else if (selectedKeys.has(edge.target) && !selectedKeys.has(edge.source)) {
                connected.push({ key: edge.source, edgeDesc: edge.description });
            }
        }
        for (const { key } of connected) {
            const node = graphNodes[key];
            if (!node?.description) continue;
            if (activeKeys.has(key)) continue;
            if (selectedKeys.has(key)) continue;
            selectedKeys.add(key);
            orderedEntries.push({ key, node });
        }
    }

    if (orderedEntries.length === 0) return '';

    const header = '<entity_context>';
    const footer = '</entity_context>';
    let usedTokens = countTokens(header + '\n' + footer);
    const lines = [header];

    for (const { node } of orderedEntries) {
        const typeTag = node.type ? ` [${node.type}]` : '';
        const entry = `${node.name}${typeTag}: ${node.description}`;
        const entryTokens = countTokens(entry);
        if (usedTokens + entryTokens > tokenBudget) break;
        lines.push(entry);
        usedTokens += entryTokens;
    }

    if (lines.length <= 1) return '';

    lines.push(footer);
    logDebug(`Entity context: ${lines.length - 2} entities, ${usedTokens} tokens`);
    return lines.join('\n');
}

/**
 * Detect relevant entities and build context from a RetrievalContext.
 * Convenience wrapper that calls extractQueryContext + buildEntityContext.
 *
 * @param {Object} ctx - RetrievalContext object
 * @param {number} tokenBudget - Max tokens for entity context
 * @returns {string} Formatted entity context, or empty string
 */
export function buildEntityContextFromRetrieval(ctx, tokenBudget) {
    const recentMessages = parseRecentMessages(ctx.recentContext, ctx.queryConfig?.entityWindowSize || 10);
    const queryContext = extractQueryContext(
        recentMessages,
        ctx.activeCharacters,
        ctx.graphNodes || {},
        ctx.queryConfig,
    );

    return buildEntityContext(
        ctx.graphNodes,
        ctx.graphEdges,
        queryContext.entities,
        ctx.activeCharacters,
        tokenBudget,
    );
}
