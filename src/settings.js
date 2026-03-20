/**
 * OpenVault Settings Initialization
 *
 * Initializes extension settings with defaults using lodash.merge.
 * Preserves existing user settings while adding any missing defaults.
 */

import { defaultSettings, extensionName } from './constants.js';
import { getDeps } from './deps.js';

/**
 * Initialize extension settings with defaults using lodash.merge.
 * Preserves existing user settings while adding any missing defaults.
 *
 * Note: This is called automatically on module import when running in SillyTavern.
 * In tests, the mocks may not provide lodash - this is expected and handled gracefully.
 */
export function loadSettings() {
    const deps = getDeps();
    const context = deps.getContext();
    const extensionSettings = deps.getExtensionSettings();

    // SillyTavern provides lodash.merge via context
    const { lodash } = context;

    // If lodash isn't available yet (e.g., in test mocks), skip initialization
    // The settings will be initialized properly when running in actual ST
    if (!lodash || !lodash.merge) {
        return;
    }

    // Use lodash.merge (bundled in ST) for proper deep merge
    // This ensures new default settings are added without overwriting user customizations
    extensionSettings[extensionName] = lodash.merge(
        structuredClone(defaultSettings),
        extensionSettings[extensionName] || {}
    );
}

/**
 * Get settings object or nested value using lodash.get
 * @param {string} [path] - Optional lodash path (dot notation)
 * @param {*} [defaultValue] - Default value if path not found
 * @returns {Settings|*} Settings object or value at path
 */
export function getSettings(path, defaultValue) {
    const deps = getDeps();
    const lodash = deps.getContext()?.lodash;
    const settings = deps.getExtensionSettings()[extensionName];

    if (path === undefined) {
        return settings;
    }

    return lodash?.get(settings, path, defaultValue) ?? defaultValue;
}

/**
 * Set settings value using lodash.set
 * @param {string} path - Lodash path (dot notation)
 * @param {*} value - Value to set
 */
export function setSetting(path, value) {
    const deps = getDeps();
    const lodash = deps.getContext()?.lodash;
    const settings = deps.getExtensionSettings()[extensionName];

    lodash.set(settings, path, value);
    deps.saveSettingsDebounced();
}

// Auto-initialize on import
loadSettings();
