/**
 * OpenVault State Management
 *
 * Handles operation state machine, generation locks, and chat loading cooldown.
 */

import { GENERATION_LOCK_TIMEOUT_MS } from './constants.js';
import { getDeps } from './deps.js';
import { logWarn } from './utils/logging.js';

// Session-scoped AbortController — one per active chat session.
// On CHAT_CHANGED, the old controller is aborted and a new one is created.
let _sessionController = new AbortController();

// Session-scoped disable flag for migration failures
// Unlike global settings, this only affects the current chat session
let _sessionDisabled = false;

/** @typedef {{failures: number, nextRetryAt: number, suppressed: boolean}} ReflectionRetryMarker */

// Reflection transport failures are retried per character, but only inside
// the current chat session. A chat change clears this map with the session
// controller so a failure in one chat cannot suppress another chat's work.
/** @type {Map<string, ReflectionRetryMarker>} */
const _reflectionRetryMarkers = new Map();

/**
 * Return a copy of the current character retry marker.
 * @param {string} characterName
 * @returns {ReflectionRetryMarker | null}
 */
export function getReflectionRetryMarker(characterName) {
    const marker = _reflectionRetryMarkers.get(characterName);
    return marker ? { ...marker } : null;
}

/**
 * Check whether a character's failed reflection should wait before retrying.
 * @param {string} characterName
 * @param {number} [now]
 * @returns {boolean}
 */
export function isReflectionRetrySuppressed(characterName, now = getDeps().Date.now()) {
    const marker = _reflectionRetryMarkers.get(characterName);
    if (!marker) return false;
    return marker.suppressed || marker.nextRetryAt > Number(now);
}

/**
 * Record one non-cancellation reflection failure.
 * @param {string} characterName
 * @param {number} cooldownMs
 * @param {number} maxFailures
 * @param {number} [now]
 * @returns {ReflectionRetryMarker}
 */
export function recordReflectionRetryFailure(characterName, cooldownMs, maxFailures, now = getDeps().Date.now()) {
    const previous = _reflectionRetryMarkers.get(characterName);
    const boundedMaxFailures = Number.isFinite(Number(maxFailures)) ? Math.max(1, Math.floor(Number(maxFailures))) : 1;
    const boundedCooldownMs = Number.isFinite(Number(cooldownMs)) ? Math.max(0, Number(cooldownMs)) : 0;
    const failures = Math.min((previous?.failures || 0) + 1, boundedMaxFailures);
    const marker = {
        failures,
        nextRetryAt: Number(now) + boundedCooldownMs,
        suppressed: failures >= boundedMaxFailures,
    };
    _reflectionRetryMarkers.set(characterName, marker);
    return { ...marker };
}

/**
 * Clear a character marker after successful generation.
 * @param {string} characterName
 */
export function clearReflectionRetry(characterName) {
    _reflectionRetryMarkers.delete(characterName);
}

/** Clear all session-scoped reflection retry markers. */
export function clearReflectionRetryState() {
    _reflectionRetryMarkers.clear();
}

/**
 * Get the current session's AbortSignal.
 * Leaf I/O functions (callLLM, embedding) read this as their default signal.
 * @returns {AbortSignal}
 */
export function getSessionSignal() {
    return _sessionController.signal;
}

/**
 * Abort all in-flight operations and create a fresh controller.
 * Called on CHAT_CHANGED before any new work starts.
 */
export function resetSessionController() {
    _sessionController.abort();
    _sessionController = new AbortController();
    _sessionDisabled = false; // Reset kill-switch on chat change
    clearReflectionRetryState();
}

/**
 * Check if OpenVault is disabled for the current session.
 * Used when schema migration fails to prevent further damage.
 * @returns {boolean}
 */
export function isSessionDisabled() {
    return _sessionDisabled;
}

/**
 * Set the session-scoped disabled flag.
 * @param {boolean} value
 */
export function setSessionDisabled(value) {
    _sessionDisabled = value;
}

// Tracks when the last LLM API call completed (or when rpmDelay last ran).
// Updated by callLLM after every response and by rpmDelay before each call,
// so that rate-limit spacing is based on actual API activity.
let _lastApiCallTime = 0;

/** @returns {number} */
export function getLastApiCallTime() {
    return _lastApiCallTime;
}

/** @param {number} t */
export function setLastApiCallTime(t) {
    _lastApiCallTime = t;
}

// Operation state machine to prevent concurrent operations
export const operationState = {
    generationInProgress: false,
    extractionInProgress: false,
    retrievalInProgress: false,
};

// Generation lock timeout handle
let generationLockTimeout = null;

// Chat loading state - prevents operations during initial chat load
// Start with cooldown active to prevent any operations before APP_READY completes
let chatLoadingCooldown = true;
let chatLoadingTimeout = null;

// Worker singleton state — moved from worker.js for concurrency visibility
let _workerRunning = false;
let _wakeGeneration = 0;

/**
 * Check if the background worker is currently processing.
 */
export function isWorkerRunning() {
    return _workerRunning;
}

/**
 * Set the background worker running state.
 * @param {boolean} value
 */
export function setWorkerRunning(value) {
    _workerRunning = value;
}

/**
 * Get current wake generation counter.
 * Used by interruptible sleep to detect new messages.
 * @returns {number}
 */
export function getWakeGeneration() {
    return _wakeGeneration;
}

/**
 * Increment wake generation to signal the worker to reset backoff.
 */
export function incrementWakeGeneration() {
    _wakeGeneration++;
}

/**
 * Set generation lock with safety timeout
 */
export function setGenerationLock() {
    operationState.generationInProgress = true;

    // Clear any existing safety timeout
    if (generationLockTimeout) {
        getDeps().clearTimeout(generationLockTimeout);
    }

    // Set safety timeout - if GENERATION_ENDED doesn't fire, clear the lock anyway
    generationLockTimeout = getDeps().setTimeout(() => {
        if (operationState.generationInProgress) {
            logWarn('Generation lock timeout - clearing stale lock');
            operationState.generationInProgress = false;
        }
    }, GENERATION_LOCK_TIMEOUT_MS);
}

/**
 * Clear generation lock and cancel safety timeout
 */
export function clearGenerationLock() {
    operationState.generationInProgress = false;
    if (generationLockTimeout) {
        getDeps().clearTimeout(generationLockTimeout);
        generationLockTimeout = null;
    }
}

/**
 * Clear all generation lock state (for backfill completion)
 */
export function clearAllLocks() {
    operationState.generationInProgress = false;
    operationState.extractionInProgress = false;
    operationState.retrievalInProgress = false;
    _workerRunning = false;
    if (generationLockTimeout) {
        getDeps().clearTimeout(generationLockTimeout);
        generationLockTimeout = null;
    }
}

/**
 * Check if chat loading cooldown is active
 * @returns {boolean}
 */
export function isChatLoadingCooldown() {
    return chatLoadingCooldown;
}

/**
 * Set chat loading cooldown with automatic clear after timeout
 * @param {number} timeoutMs - Timeout in milliseconds (default 2000)
 * @param {function} logFn - Optional logging function
 */
export function setChatLoadingCooldown(timeoutMs = 2000, logFn = null) {
    chatLoadingCooldown = true;
    if (chatLoadingTimeout) {
        getDeps().clearTimeout(chatLoadingTimeout);
    }
    chatLoadingTimeout = getDeps().setTimeout(() => {
        chatLoadingCooldown = false;
        if (logFn) logFn('Chat load cooldown cleared');
    }, timeoutMs);
}

/**
 * Reset operation states on chat change (only if safe)
 */
export function resetOperationStatesIfSafe() {
    if (!operationState.generationInProgress) {
        operationState.extractionInProgress = false;
        operationState.retrievalInProgress = false;
    }
}
