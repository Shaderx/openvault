/**
 * OpenVault Message Sanitizer (Fork-only)
 *
 * Cleans chat message content before it reaches the extraction LLM:
 *   1. Strips thinking/reasoning tags (<think>, [THINK], *thinks:*, etc.)
 *   2. Applies SillyTavern's outgoing-prompt regex scripts (OOC removal, formatting, etc.)
 *
 * Also provides sanitized token counting so batch sizing reflects actual
 * content that will be sent to the LLM (without inflated think-block tokens).
 *
 * Isolated in its own module to minimize upstream merge conflicts.
 */

import { stripThinkingTags } from './text.js';
import { logDebug } from './logging.js';
import { countTokens } from './tokens.js';

/** @type {{ getRegexedString: Function, regex_placement: Object } | null} */
let _regexEngine = null;
let _regexLoadAttempted = false;

async function ensureRegexEngine() {
    if (_regexEngine || _regexLoadAttempted) return;
    _regexLoadAttempted = true;
    try {
        _regexEngine = await import('../../../../regex/engine.js');
    } catch {
        logDebug('ST regex engine not available — outgoing regex will be skipped');
    }
}

ensureRegexEngine();

/**
 * Apply SillyTavern's outgoing-prompt regex scripts to text.
 * Only runs scripts with `isPrompt: true` (the "alter outgoing prompt" flag).
 * @param {string} text
 * @param {boolean} isUser
 * @returns {string}
 */
function applyOutgoingRegex(text, isUser) {
    try {
        if (!_regexEngine) return text;
        const placement = isUser
            ? _regexEngine.regex_placement.USER_INPUT
            : _regexEngine.regex_placement.AI_OUTPUT;
        return _regexEngine.getRegexedString(text, placement, { isPrompt: true });
    } catch {
        return text;
    }
}

/**
 * Sanitize a single message's content for extraction.
 * Strips think blocks, then applies outgoing-prompt regex.
 * @param {string} mes - Raw message content (m.mes)
 * @param {boolean} isUser - Whether the message is from the user
 * @returns {string} Cleaned text
 */
export function sanitizeMessageContent(mes, isUser) {
    let text = stripThinkingTags(mes || '');
    text = applyOutgoingRegex(text, isUser);
    return text;
}

// ── Regex fingerprint (invalidates cache when scripts change) ────────

let _regexFingerprint = '';

/**
 * Build a lightweight fingerprint of active outgoing-prompt regex scripts.
 * Changes when scripts are toggled, added, removed, or edited.
 */
function getRegexFingerprint() {
    try {
        if (!_regexEngine?.getRegexScripts) return '';
        const scripts = _regexEngine.getRegexScripts();
        const active = scripts
            .filter((s) => !s.disabled && s.promptOnly)
            .map((s) => `${s.scriptName}|${s.findRegex}|${s.replaceString}`)
            .join('\n');
        return active;
    } catch {
        return '';
    }
}

/**
 * Recompute the regex fingerprint and clear the sanitized token cache
 * if the active regex configuration has changed.
 * Called automatically before token lookups and can be called externally
 * (e.g. on regex toggle events).
 */
export function refreshRegexFingerprint() {
    const fp = getRegexFingerprint();
    if (fp !== _regexFingerprint) {
        _regexFingerprint = fp;
        _sanitizedTokenCache.clear();
    }
}

// ── Sanitized token counting (for accurate batch sizing) ────────────

const MAX_CACHE_SIZE = 2000;
/** @type {Map<string, number>} */
const _sanitizedTokenCache = new Map();

/**
 * Get token count for a message using sanitized content.
 * Drop-in replacement for tokens.js getMessageTokenCount.
 * @param {Array<{mes?: string, is_user?: boolean}>} chat
 * @param {number} index
 * @returns {number}
 */
export function getSanitizedTokenCount(chat, index) {
    refreshRegexFingerprint();

    const msg = chat[index];
    const raw = msg?.mes || '';
    const key = `san_${index}_${raw.length}`;

    if (_sanitizedTokenCache.has(key)) {
        const v = _sanitizedTokenCache.get(key);
        _sanitizedTokenCache.delete(key);
        _sanitizedTokenCache.set(key, v);
        return v;
    }

    const clean = sanitizeMessageContent(raw, !!msg?.is_user);
    const count = clean.length === 0 ? 0 : countTokens(clean);

    if (_sanitizedTokenCache.size >= MAX_CACHE_SIZE) {
        const oldest = _sanitizedTokenCache.keys().next().value;
        _sanitizedTokenCache.delete(oldest);
    }
    _sanitizedTokenCache.set(key, count);
    return count;
}

/**
 * Sum sanitized token counts for a list of message indices.
 * Drop-in replacement for tokens.js getTokenSum.
 * @param {Array<{mes?: string, is_user?: boolean}>} chat
 * @param {number[]} indices
 * @returns {number}
 */
export function getSanitizedTokenSum(chat, indices) {
    let total = 0;
    for (const i of indices) {
        total += getSanitizedTokenCount(chat, i);
    }
    return total;
}

/**
 * Clear the sanitized token cache. Call on CHAT_CHANGED.
 */
export function clearSanitizedTokenCache() {
    _sanitizedTokenCache.clear();
}
