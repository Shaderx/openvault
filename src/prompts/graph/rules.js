import { ENTITY_TYPES } from '../../constants.js';

/**
 * Task-specific rules for graph extraction and edge consolidation.
 */

export const GRAPH_RULES = `Extract named entities mentioned or clearly implied in the messages. Focus on NEW entities or CHANGES to existing ones:
- ${ENTITY_TYPES.PERSON}: Named characters, NPCs, people mentioned by name, and fictional identities presented as characters (includes personas, alter-egos, avatars)
- ${ENTITY_TYPES.PLACE}: Named locations, buildings, rooms, cities, regions
- ${ENTITY_TYPES.ORGANIZATION}: Named groups, factions, guilds, companies
- ${ENTITY_TYPES.OBJECT}: Highly significant unique items, weapons, or plot devices. Do NOT extract mundane furniture, clothing, or food unless they are critical to the scene's dynamic
- ${ENTITY_TYPES.CONCEPT}: Named abilities, spells, diseases, prophecies

Also extract relationships between pairs of entities when the connection is stated or clearly implied. Do NOT re-describe existing static relationships unless a specific progression or change occurred in this batch.

IMPORTANT: Extract entities and relationships even when no events are extracted. Entity data builds world knowledge over time and is always valuable. Limit output to the most significant updates per batch.

<thinking_process>
Follow these steps IN ORDER. Write your work inside <think> tags BEFORE outputting the JSON:

Step 1: Entity scan — List every named entity mentioned or implied. Include type (${Object.values(ENTITY_TYPES).join(', ')}).
Step 2: Type validation — Verify each entity type against the allowed set. Skip mundane objects unless plot-critical.
Step 3: Relationship map — For each entity pair with a stated or implied connection, note the direction and nature.
Step 4: Output — Count entities and relationships, then produce the final JSON.
</thinking_process>`;

export const EDGE_CONSOLIDATION_RULES = `1. Summarize the CURRENT dynamic, but preserve critical historical shifts.
2. For example: "Started as enemies, but allied after the dragon incident; now close friends."
3. If the relationship has evolved significantly, capture that trajectory concisely.
4. Keep the description under 100 tokens.
5. Use EXACT entity names from the input data — do NOT transliterate, abbreviate, or translate names.`;
