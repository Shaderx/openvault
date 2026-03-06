import { extensionName } from '../constants.js';
import { getDeps } from '../deps.js';

/**
 * Log message if debug mode is enabled
 * @param {string} message
 */
export function log(message) {
    const settings = getDeps().getExtensionSettings()[extensionName];
    if (settings?.debugMode) {
        getDeps().console.log(`[OpenVault] ${message}`);
    }
}

/**
 * Log full LLM request/response to console when request logging is enabled.
 * Uses console.groupCollapsed for clean F12 experience.
 * @param {string} label - Context label (e.g., "Extraction")
 * @param {Object} data - { messages, maxTokens, profileId, response?, error? }
 */
export function logRequest(label, data) {
    const settings = getDeps().getExtensionSettings()[extensionName];
    if (!settings?.requestLogging) return;

    const isError = !!data.error;
    const prefix = isError ? '❌' : '✅';
    const c = getDeps().console;
    const group = c.groupCollapsed ? c.groupCollapsed.bind(c) : c.log.bind(c);
    const groupEnd = c.groupEnd ? c.groupEnd.bind(c) : () => {};

    group(`[OpenVault] ${prefix} ${label} — ${isError ? 'FAILED' : 'OK'}`);
    c.log('Profile:', data.profileId);
    c.log('Max Tokens:', data.maxTokens);
    c.log('Messages:', data.messages);
    if (data.response !== undefined) {
        c.log('Response:', data.response);
    }
    if (data.error) {
        c.error('Error:', data.error);
        if (data.error.cause) {
            c.error('Caused by:', data.error.cause);
        }
    }
    groupEnd();
}
