import { getDeps } from '../deps.js';

/**
 * Cached content for macro access.
 * Exported so injection logic can update it.
 * Mutating properties (not reassigning) updates macro return values in-place.
 */
export const cachedContent = {
    memory: '',
    world: ''
};

/**
 * Initialize macros by registering with SillyTavern.
 * Must be called after extension is loaded.
 */
export function initMacros() {
    const { registerMacro } = getDeps().getContext();

    // Macros MUST be synchronous - no async/await
    // Do NOT wrap name in {{ }} - ST does that automatically
    registerMacro('openvault_memory', () => cachedContent.memory);
    registerMacro('openvault_world', () => cachedContent.world);
}

// Auto-initialize on import
initMacros();
