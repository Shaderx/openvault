import { extensionName } from '../constants.js';
import { getDeps } from '../deps.js';

// =============================================================================
// Error Ring Buffer — captured in memory for the Error Log UI panel
// =============================================================================
const MAX_ERROR_LOG = 50;
const errorLog = [];

function pushError(level, msg, detail) {
    let detailStr;
    if (detail instanceof Error) {
        detailStr = `${detail.name}: ${detail.message}`;
    } else if (typeof detail === 'string') {
        detailStr = detail;
    } else if (detail !== undefined && detail !== null) {
        try { detailStr = JSON.stringify(detail); } catch { detailStr = String(detail); }
    } else {
        detailStr = '';
    }
    errorLog.push({ ts: new Date().toLocaleTimeString(), level, msg, detail: detailStr });
    if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
}

/** Get snapshot of the error ring buffer (newest last). */
export function getErrorLog() {
    return errorLog;
}

/** Clear all captured errors. */
export function clearErrorLog() {
    errorLog.length = 0;
}

/**
 * Debug-only log. Hidden unless settings.debugMode is true.
 * @param {string} msg
 * @param {unknown} [data]
 */
export function logDebug(msg, data) {
    const settings = getDeps().getExtensionSettings()[extensionName];
    if (!settings?.debugMode) return;
    const c = getDeps().console;
    if (data !== undefined) {
        c.log(`[OpenVault] ${msg}`, data);
    } else {
        c.log(`[OpenVault] ${msg}`);
    }
}

/**
 * Always-visible info log. Use for rare lifecycle milestones only.
 * @param {string} msg
 * @param {unknown} [data]
 */
export function logInfo(msg, data) {
    const c = getDeps().console;
    if (data !== undefined) {
        c.log(`[OpenVault] ${msg}`, data);
    } else {
        c.log(`[OpenVault] ${msg}`);
    }
}

/**
 * Always-visible warning. Recovered errors, edge-case fallbacks.
 * @param {string} msg
 * @param {unknown} [data]
 */
export function logWarn(msg, data) {
    const c = getDeps().console;
    if (data !== undefined) {
        c.warn(`[OpenVault] ${msg}`, data);
    } else {
        c.warn(`[OpenVault] ${msg}`);
    }
    pushError('WARN', msg, data);
}

/**
 * Always-visible error log with optional error object and context.
 * @param {string} msg - Human description of what failed
 * @param {Error} [error] - The caught error object
 * @param {Record<string, unknown>} [context] - Debugging state (counts, model names, truncated inputs)
 */
export function logError(msg, error, context) {
    const c = getDeps().console;
    c.error(`[OpenVault] ${msg}`);
    if (error) {
        c.error(error);
    }
    if (context) {
        const group = c.groupCollapsed?.bind(c) ?? c.log.bind(c);
        const groupEnd = c.groupEnd?.bind(c) ?? (() => {});
        group('[OpenVault] Error context');
        c.log(context);
        groupEnd();
    }
    const detail = stringifyError(error, context);
    pushError('ERROR', msg, detail);
}

/**
 * Robust error stringifier — handles Error objects, strings, plain objects,
 * and anything else thrown by third-party code (e.g. Transformers.js).
 */
function stringifyError(error, context) {
    if (!error && !context) return '';
    let parts = [];
    if (error) {
        if (error instanceof Error) {
            parts.push(`${error.name}: ${error.message}`);
            if (error.stack) parts.push(error.stack.split('\n').slice(0, 3).join('\n'));
        } else if (typeof error === 'string') {
            parts.push(error);
        } else {
            try { parts.push(JSON.stringify(error)); } catch { parts.push(String(error)); }
        }
    }
    if (context) {
        try { parts.push('ctx: ' + JSON.stringify(context)); } catch { parts.push('ctx: [unserializable]'); }
    }
    return parts.join(' | ');
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

    if (isError) {
        // Full verbose output for failures
        group(`[OpenVault] ${prefix} ${label} — FAILED`);
        c.log('Profile:', data.profileId);
        c.log('Max Tokens:', data.maxTokens);
        c.log('Messages:', data.messages);
        if (data.response !== undefined) {
            c.log('Response:', data.response);
        }
        c.error('Error:', data.error);
        if (data.error.cause) {
            c.error('Caused by:', data.error.cause);
        }
        groupEnd();
    } else {
        // Compact summary for successful calls
        const responseLength = typeof data.response === 'string' ? data.response.length : 0;
        const messageCount = Array.isArray(data.messages) ? data.messages.length : 0;
        group(`[OpenVault] ✅ ${label} — OK (${responseLength} chars, ${messageCount} messages)`);
        c.log('Profile:', data.profileId);
        c.log('Max Tokens:', data.maxTokens);
        groupEnd();
    }
}
