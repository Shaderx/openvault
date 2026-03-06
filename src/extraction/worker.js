/**
 * OpenVault Background Worker
 *
 * Processes extraction batches in the background without blocking the chat UI.
 * Single-instance: only one worker loop runs at a time.
 * Uses a wakeGeneration counter to reset backoff when new messages arrive.
 */

let isRunning = false;
let wakeGeneration = 0;

/**
 * Wake up the background worker. Fire-and-forget.
 * Safe to call multiple times — only one instance runs.
 * If worker is already running, increments wake generation
 * so it resets backoff and re-checks for work.
 */
export function wakeUpBackgroundWorker() {
    wakeGeneration++;
    if (isRunning) return;
    isRunning = true;
    runWorkerLoop().finally(() => {
        isRunning = false;
    });
}

/**
 * Check if the background worker is currently processing.
 */
export function isWorkerRunning() {
    return isRunning;
}

/**
 * Get current wake generation (for testing).
 */
export function getWakeGeneration() {
    return wakeGeneration;
}

/**
 * Increment wake generation (for testing).
 */
export function incrementWakeGeneration() {
    wakeGeneration++;
}

/**
 * Interruptible sleep that checks wakeGeneration every 500ms.
 * Resolves early if a new message arrives (generation changes).
 * @param {number} totalMs - Total sleep duration
 * @param {number} generationAtStart - The wakeGeneration value when sleep started
 */
export async function interruptibleSleep(totalMs, generationAtStart) {
    const chunkMs = 500;
    let elapsed = 0;
    while (elapsed < totalMs) {
        await new Promise((r) => setTimeout(r, Math.min(chunkMs, totalMs - elapsed)));
        elapsed += chunkMs;
        if (wakeGeneration !== generationAtStart) return;
    }
}

/**
 * Main worker loop. Stub — will be implemented in Task 4.
 */
async function runWorkerLoop() {
    // Stub: immediately returns. Full implementation in Task 4.
}
