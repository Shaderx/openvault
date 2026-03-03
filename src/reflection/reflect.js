/**
 * OpenVault Reflection Engine
 *
 * Per-character reflection system inspired by the Smallville paper.
 * Synthesizes raw events into high-level insights.
 */

const REFLECTION_THRESHOLD = 30;

/**
 * Check if a character has accumulated enough importance to trigger reflection.
 * @param {Object} reflectionState - Per-character accumulators
 * @param {string} characterName
 * @returns {boolean}
 */
export function shouldReflect(reflectionState, characterName) {
    const charState = reflectionState[characterName];
    if (!charState) return false;
    return charState.importance_sum >= REFLECTION_THRESHOLD;
}

/**
 * Accumulate importance scores from newly extracted events for each involved character.
 * Includes both characters_involved and witnesses.
 * @param {Object} reflectionState - Mutated in place
 * @param {Array} newEvents - Newly extracted event memories
 */
export function accumulateImportance(reflectionState, newEvents) {
    for (const event of newEvents) {
        const importance = event.importance || 3;
        const allCharacters = new Set([
            ...(event.characters_involved || []),
            ...(event.witnesses || []),
        ]);

        for (const charName of allCharacters) {
            if (!reflectionState[charName]) {
                reflectionState[charName] = { importance_sum: 0 };
            }
            reflectionState[charName].importance_sum += importance;
        }
    }
}
