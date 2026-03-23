# PR 3: Untangle UI from Business Logic — Implementation Plan

**Goal:** Move `hideExtractedMessages`, `handleEmergencyCut`, and `testOllamaConnection` out of `src/ui/settings.js` into the domain layer, making the UI a thin callback-wiring layer.

**Architecture:** Three functions move: `testOllamaConnection` → `src/embeddings.js`, `hideExtractedMessages` + `executeEmergencyCut` (renamed from `handleEmergencyCut`) → `src/extraction/extract.js`. The UI click handlers become thin wrappers that pass DOM callbacks to the domain functions.

**Tech Stack:** Vitest, JSDOM, `vi.fn()` for callback mocks. No new dependencies.

**File Structure Overview:**
- Modify: `src/embeddings.js` — add `testOllamaConnection` export
- Modify: `src/extraction/extract.js` — add `hideExtractedMessages` and `executeEmergencyCut` exports, new imports from `scheduler.js`, `worker.js`, `state.js`
- Modify: `src/ui/settings.js` — remove 3 function bodies, add thin click handlers
- Modify: `tests/embeddings.test.js` — add `testOllamaConnection` tests
- Create: `tests/extraction/emergency-cut.test.js` — tests for `executeEmergencyCut`
- Modify: `tests/ui/settings-helpers.test.js` — remove moved `handleEmergencyCut` and `hideExtractedMessages` tests
- Modify: `tests/integration/emergency-cut.test.js` — update imports

**Common Pitfalls:**
- `emergencyCutAbortController` must be created BEFORE calling `executeEmergencyCut`, not inside `onStart` — the signal is read at call time
- `isWorkerRunning` is in `src/extraction/worker.js`, not `state.js`
- `getBackfillStats`, `getProcessedFingerprints`, `getFingerprint` are in `scheduler.js` — extract.js doesn't currently import them
- `operationState` is currently imported via `clearAllLocks` from `state.js` — need to add it to the existing import
- The cancel button handler in `showEmergencyCutModal` references the module-level `emergencyCutAbortController` — must stay module-level in `settings.js`
- `extract.js` has a circular dependency risk: it imports from `worker.js`, and `worker.js` imports from `extract.js`. This is fine because `isWorkerRunning` is a simple getter with no side effects, and ESM handles circular imports correctly for named exports that are initialized before use.

---

### Task 1: Add `testOllamaConnection` to `embeddings.js` (RED)

**Files:**
- Test: `tests/embeddings.test.js`

- [ ] Step 1: Write failing tests at the end of `tests/embeddings.test.js`

```js
describe('testOllamaConnection', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true on successful connection', async () => {
        global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
        const { testOllamaConnection } = await import('../src/embeddings.js');

        const result = await testOllamaConnection('http://localhost:11434');

        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:11434/api/tags',
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('throws on HTTP error response', async () => {
        global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
        const { testOllamaConnection } = await import('../src/embeddings.js');

        await expect(testOllamaConnection('http://localhost:11434')).rejects.toThrow('HTTP 500');
    });

    it('throws on network error', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
        const { testOllamaConnection } = await import('../src/embeddings.js');

        await expect(testOllamaConnection('http://localhost:11434')).rejects.toThrow('ECONNREFUSED');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/embeddings.test.js -t "testOllamaConnection" --run`
Expected: FAIL — `testOllamaConnection` is not exported from `embeddings.js`

---

### Task 2: Add `testOllamaConnection` to `embeddings.js` (GREEN)

**Files:**
- Modify: `src/embeddings.js`

- [ ] Step 3: Add the function before the exports block at the end of `src/embeddings.js` (before line 991 `export { getStrategy }`)

```js
// =============================================================================
// Connection Testing
// =============================================================================

/**
 * Test connectivity to an Ollama server.
 * @param {string} url - Ollama base URL (e.g. 'http://localhost:11434')
 * @returns {Promise<true>} Resolves true if connection succeeds
 * @throws {Error} On HTTP error or network failure
 */
export async function testOllamaConnection(url) {
    const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return true;
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npx vitest tests/embeddings.test.js -t "testOllamaConnection" --run`
Expected: PASS (3 tests)

- [ ] Step 5: Run full embeddings test suite

Run: `npx vitest tests/embeddings.test.js --run`
Expected: All tests PASS — no regressions

- [ ] Step 6: Commit

```bash
git add src/embeddings.js tests/embeddings.test.js && git commit -m "$(cat <<'EOF'
refactor(embeddings): add testOllamaConnection as pure domain function

Moves Ollama connectivity testing out of UI layer. No DOM/jQuery
dependencies — just fetch + throw on failure.
EOF
)"
```

---

### Task 3: Add `hideExtractedMessages` to `extract.js` (RED)

**Files:**
- Create: `tests/extraction/hide-messages.test.js`

- [ ] Step 7: Write failing tests. These are integration tests because `hideExtractedMessages` calls `getDeps()`.

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';

describe('hideExtractedMessages', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        resetDeps();
        vi.restoreAllMocks();
    });

    it('hides messages whose fingerprints are in the processed set', async () => {
        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getProcessedFingerprints').mockReturnValue(new Set(['fp1', 'fp2']));
        vi.spyOn(schedulerModule, 'getFingerprint').mockImplementation((msg) => msg.fp);

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const mockChat = [
            { fp: 'fp1', is_system: false },
            { fp: 'fp2', is_system: false },
            { fp: 'fp3', is_system: false },
            { fp: 'fp1', is_system: true },
        ];
        const mockSave = vi.fn(async () => true);
        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: mockChat }),
            saveChatConditional: mockSave,
            console: globalThis.console,
        });

        const { hideExtractedMessages } = await import('../../src/extraction/extract.js');
        const count = await hideExtractedMessages();

        expect(count).toBe(2);
        expect(mockChat[0].is_system).toBe(true);
        expect(mockChat[1].is_system).toBe(true);
        expect(mockChat[2].is_system).toBe(false);
        expect(mockSave).toHaveBeenCalled();
    });

    it('returns 0 and does not save when nothing to hide', async () => {
        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getProcessedFingerprints').mockReturnValue(new Set([]));
        vi.spyOn(schedulerModule, 'getFingerprint').mockImplementation((msg) => msg.fp);

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const mockSave = vi.fn(async () => true);
        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: [{ fp: 'fp1', is_system: false }] }),
            saveChatConditional: mockSave,
            console: globalThis.console,
        });

        const { hideExtractedMessages } = await import('../../src/extraction/extract.js');
        const count = await hideExtractedMessages();

        expect(count).toBe(0);
        expect(mockSave).not.toHaveBeenCalled();
    });
});
```

- [ ] Step 8: Run test to verify it fails

Run: `npx vitest tests/extraction/hide-messages.test.js --run`
Expected: FAIL — `hideExtractedMessages` is not exported from `extract.js`

---

### Task 4: Add `hideExtractedMessages` to `extract.js` (GREEN)

**Files:**
- Modify: `src/extraction/extract.js`

- [ ] Step 9: Add new imports to `extract.js`. Find the existing import from `../state.js` (line ~88: `import { clearAllLocks } from '../state.js';`) and add `operationState`:

```js
import { clearAllLocks, operationState } from '../state.js';
```

Add new import from `scheduler.js` right after the `createLadderQueue` import (at the end of the import block, around line ~101):

```js
import { getBackfillStats, getFingerprint, getProcessedFingerprints } from './scheduler.js';
import { isWorkerRunning } from './worker.js';
```

- [ ] Step 10: Add `hideExtractedMessages` function. Place it after `applySyncChanges` (around line ~68, before the first exported function `canonicalizeEventCharNames`). Find the line `import { createLadderQueue } from '../utils/queue.js';` and the comment `// =============================================================================` that follows (before `canonicalizeEventCharNames`). Insert the function between the imports block and the first export:

```js
// =============================================================================
// Message Hiding (moved from ui/settings.js)
// =============================================================================

/**
 * Hide all extracted messages from LLM context by setting is_system=true.
 * Only hides messages that have been successfully processed (fingerprint in processed set).
 * @returns {Promise<number>} Number of messages hidden
 */
export async function hideExtractedMessages() {
    const context = getDeps().getContext();
    const chat = context.chat || [];
    const data = getOpenVaultData();
    const processedFps = getProcessedFingerprints(data);

    let hiddenCount = 0;
    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (processedFps.has(getFingerprint(msg)) && !msg.is_system) {
            msg.is_system = true;
            hiddenCount++;
        }
    }

    if (hiddenCount > 0) {
        await getDeps().saveChatConditional();
        logInfo(`Emergency Cut: hid ${hiddenCount} messages (all extracted)`);
    }
    return hiddenCount;
}
```

- [ ] Step 11: Run test to verify it passes

Run: `npx vitest tests/extraction/hide-messages.test.js --run`
Expected: PASS (2 tests)

- [ ] Step 12: Run full extraction test suite to check for regressions

Run: `npx vitest tests/extraction/ --run`
Expected: All tests PASS

- [ ] Step 13: Commit

```bash
git add src/extraction/extract.js tests/extraction/hide-messages.test.js && git commit -m "$(cat <<'EOF'
refactor(extract): move hideExtractedMessages from UI to domain layer

Pure domain function — depends on scheduler fingerprints and getDeps(),
not on jQuery or DOM. Strips verbose debug logging, keeps essential
info log.
EOF
)"
```

---

### Task 5: Add `executeEmergencyCut` to `extract.js` (RED)

**Files:**
- Create: `tests/extraction/emergency-cut.test.js`

- [ ] Step 14: Write failing tests. These test the callback wiring — mock `getDeps()`, `isWorkerRunning`, `getBackfillStats`, and verify the right callbacks fire.

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';

describe('executeEmergencyCut', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        resetDeps();
        vi.restoreAllMocks();
    });

    it('calls onWarning and returns if worker is running', async () => {
        const workerModule = await import('../../src/extraction/worker.js');
        vi.spyOn(workerModule, 'isWorkerRunning').mockReturnValue(true);

        const { executeEmergencyCut } = await import('../../src/extraction/extract.js');
        const onWarning = vi.fn();

        await executeEmergencyCut({ onWarning });

        expect(onWarning).toHaveBeenCalledWith('Background extraction in progress. Please wait a moment.');
    });

    it('calls onWarning when no messages to extract or hide', async () => {
        const workerModule = await import('../../src/extraction/worker.js');
        vi.spyOn(workerModule, 'isWorkerRunning').mockReturnValue(false);

        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getBackfillStats').mockReturnValue({
            totalMessages: 5, extractedCount: 5, unextractedCount: 0,
        });
        vi.spyOn(schedulerModule, 'getProcessedFingerprints').mockReturnValue(new Set());
        vi.spyOn(schedulerModule, 'getFingerprint').mockImplementation((msg) => msg.fp);

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: [{ fp: 'fp1', is_system: true }] }),
            console: globalThis.console,
        });

        const { executeEmergencyCut } = await import('../../src/extraction/extract.js');
        const onWarning = vi.fn();

        await executeEmergencyCut({ onWarning });

        expect(onWarning).toHaveBeenCalledWith('No messages to hide');
    });

    it('returns early if user declines confirmation', async () => {
        const workerModule = await import('../../src/extraction/worker.js');
        vi.spyOn(workerModule, 'isWorkerRunning').mockReturnValue(false);

        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getBackfillStats').mockReturnValue({
            totalMessages: 10, extractedCount: 5, unextractedCount: 5,
        });

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: [] }),
            console: globalThis.console,
        });

        const { executeEmergencyCut } = await import('../../src/extraction/extract.js');
        const onConfirmPrompt = vi.fn(() => false);
        const onStart = vi.fn();

        await executeEmergencyCut({ onConfirmPrompt, onStart });

        expect(onConfirmPrompt).toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
    });

    it('hide-only path: skips extraction when all messages already extracted', async () => {
        const workerModule = await import('../../src/extraction/worker.js');
        vi.spyOn(workerModule, 'isWorkerRunning').mockReturnValue(false);

        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getBackfillStats').mockReturnValue({
            totalMessages: 5, extractedCount: 5, unextractedCount: 0,
        });
        vi.spyOn(schedulerModule, 'getProcessedFingerprints').mockReturnValue(new Set(['fp1', 'fp2']));
        vi.spyOn(schedulerModule, 'getFingerprint').mockImplementation((msg) => msg.fp);

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const mockChat = [
            { fp: 'fp1', is_system: false },
            { fp: 'fp2', is_system: false },
        ];
        const mockSave = vi.fn(async () => true);
        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: mockChat }),
            saveChatConditional: mockSave,
            console: globalThis.console,
        });

        const { executeEmergencyCut } = await import('../../src/extraction/extract.js');
        const onConfirmPrompt = vi.fn(() => true);
        const onComplete = vi.fn();
        const onStart = vi.fn();

        await executeEmergencyCut({ onConfirmPrompt, onComplete, onStart });

        expect(onConfirmPrompt).toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled(); // No extraction phase
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ messagesProcessed: 0, eventsCreated: 0, hiddenCount: 2 }),
        );
    });

    it('calls onError with isCancel=true on AbortError', async () => {
        const workerModule = await import('../../src/extraction/worker.js');
        vi.spyOn(workerModule, 'isWorkerRunning').mockReturnValue(false);

        const schedulerModule = await import('../../src/extraction/scheduler.js');
        vi.spyOn(schedulerModule, 'getBackfillStats').mockReturnValue({
            totalMessages: 10, extractedCount: 0, unextractedCount: 10,
        });

        const dataModule = await import('../../src/utils/data.js');
        vi.spyOn(dataModule, 'getOpenVaultData').mockReturnValue({ memories: [] });

        const depsModule = await import('../../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getContext: () => ({ chat: [{ mes: 'test' }] }),
            console: globalThis.console,
        });

        // Mock extractAllMessages to throw AbortError
        const extractModule = await import('../../src/extraction/extract.js');
        vi.spyOn(extractModule, 'extractAllMessages').mockRejectedValue(
            new DOMException('Aborted', 'AbortError'),
        );

        const onConfirmPrompt = vi.fn(() => true);
        const onStart = vi.fn();
        const onError = vi.fn();

        await extractModule.executeEmergencyCut({ onConfirmPrompt, onStart, onError });

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'AbortError' }),
            true,
        );
    });
});
```

- [ ] Step 15: Run test to verify it fails

Run: `npx vitest tests/extraction/emergency-cut.test.js --run`
Expected: FAIL — `executeEmergencyCut` is not exported from `extract.js`

---

### Task 6: Add `executeEmergencyCut` to `extract.js` (GREEN)

**Files:**
- Modify: `src/extraction/extract.js`

- [ ] Step 16: Add `executeEmergencyCut` function right after `hideExtractedMessages` (which was added in Task 4):

```js
/**
 * Execute an Emergency Cut — extract all unprocessed messages and hide them.
 * Domain orchestrator with callback injection for UI updates.
 *
 * @param {Object} options
 * @param {function(string): void} [options.onWarning] - Called for non-fatal warnings
 * @param {function(string): boolean} [options.onConfirmPrompt] - Called for user confirmation; return false to cancel
 * @param {function(): void} [options.onStart] - Called when extraction phase begins
 * @param {function(number, number, number): void} [options.onProgress] - Called per batch (batchNum, totalBatches, eventsCreated)
 * @param {function(): void} [options.onPhase2Start] - Called when Phase 2 begins (uncancellable)
 * @param {function({messagesProcessed: number, eventsCreated: number, hiddenCount: number}): void} [options.onComplete] - Called on success
 * @param {function(Error, boolean): void} [options.onError] - Called on failure (error, isCancel)
 * @param {AbortSignal} [options.abortSignal] - For cancellation
 */
export async function executeEmergencyCut(options = {}) {
    const {
        onWarning,
        onConfirmPrompt,
        onStart,
        onProgress,
        onPhase2Start,
        onComplete,
        onError,
        abortSignal,
    } = options;

    if (isWorkerRunning()) {
        onWarning?.('Background extraction in progress. Please wait a moment.');
        return;
    }

    const context = getDeps().getContext();
    const chat = context.chat || [];
    const data = getOpenVaultData();
    const stats = getBackfillStats(chat, data);

    let shouldExtract = true;

    if (stats.unextractedCount === 0) {
        const processedFps = getProcessedFingerprints(data);
        const hideableCount = chat.filter((m) =>
            !m.is_system && processedFps.has(getFingerprint(m)),
        ).length;

        if (hideableCount === 0) {
            onWarning?.('No messages to hide');
            return;
        }

        const msg = `All messages are already extracted. Hide ${hideableCount} messages from the LLM to break the loop?\n\n` +
            'The LLM will only see: preset, char card, lorebooks, and OpenVault memories.';
        if (!onConfirmPrompt?.(msg)) return;
        shouldExtract = false;
    } else {
        const msg = `Extract and hide ${stats.unextractedCount} unprocessed messages?\n\n` +
            'The LLM will only see: preset, char card, lorebooks, and OpenVault memories.';
        if (!onConfirmPrompt?.(msg)) return;
    }

    if (!shouldExtract) {
        const hiddenCount = await hideExtractedMessages();
        onComplete?.({ messagesProcessed: 0, eventsCreated: 0, hiddenCount });
        return;
    }

    onStart?.();
    operationState.extractionInProgress = true;

    try {
        const result = await extractAllMessages({
            isEmergencyCut: true,
            progressCallback: onProgress,
            abortSignal,
            onPhase2Start,
        });

        const hiddenCount = await hideExtractedMessages();

        onComplete?.({
            messagesProcessed: result.messagesProcessed,
            eventsCreated: result.eventsCreated,
            hiddenCount,
        });
    } catch (err) {
        onError?.(err, err.name === 'AbortError');
    } finally {
        operationState.extractionInProgress = false;
    }
}
```

- [ ] Step 17: Run test to verify it passes

Run: `npx vitest tests/extraction/emergency-cut.test.js --run`
Expected: PASS (5 tests)

- [ ] Step 18: Run full extraction test suite

Run: `npx vitest tests/extraction/ --run`
Expected: All tests PASS

- [ ] Step 19: Commit

```bash
git add src/extraction/extract.js tests/extraction/emergency-cut.test.js && git commit -m "$(cat <<'EOF'
refactor(extract): add executeEmergencyCut with callback injection

Domain orchestrator for Emergency Cut. Accepts onWarning, onConfirmPrompt,
onStart, onProgress, onPhase2Start, onComplete, onError callbacks.
No DOM, jQuery, or toast dependencies.
EOF
)"
```

---

### Task 7: Wire UI click handlers in `settings.js`

**Files:**
- Modify: `src/ui/settings.js`

- [ ] Step 20: Add new imports near the top of `settings.js`. Add after the existing `import { getEmbeddingStatus, getStrategy, isEmbeddingsEnabled, setEmbeddingStatusCallback } from '../embeddings.js';` line:

```js
import { testOllamaConnection } from '../embeddings.js';
```

Wait — `testOllamaConnection` is from the same module as `getEmbeddingStatus` etc. Merge into the existing import:

Change the existing line:
```js
import { getEmbeddingStatus, getStrategy, isEmbeddingsEnabled, setEmbeddingStatusCallback } from '../embeddings.js';
```
To:
```js
import { getEmbeddingStatus, getStrategy, isEmbeddingsEnabled, setEmbeddingStatusCallback, testOllamaConnection } from '../embeddings.js';
```

Add a new import for `executeEmergencyCut`. Place after the embeddings import:
```js
import { executeEmergencyCut } from '../extraction/extract.js';
```

- [ ] Step 21: Replace the `testOllamaConnection` function (lines ~269-305). Delete the entire function body and replace with a thin wrapper named `handleOllamaTestClick`:

Delete from `async function testOllamaConnection() {` through the closing `}` and the `setTimeout` block. Replace with:

```js
/**
 * Handle Ollama test button click — thin UI wrapper around domain function.
 */
async function handleOllamaTestClick() {
    const $btn = $('#openvault_test_ollama_btn');
    const url = $('#openvault_ollama_url').val().trim();

    if (!url) {
        $btn.removeClass('success').addClass('error');
        $btn.html('<i class="fa-solid fa-xmark"></i> No URL');
        return;
    }

    $btn.removeClass('success error');
    $btn.html('<i class="fa-solid fa-spinner fa-spin"></i> Testing...');

    try {
        await testOllamaConnection(url);
        $btn.removeClass('error').addClass('success');
        $btn.html('<i class="fa-solid fa-check"></i> Connected');
    } catch (err) {
        $btn.removeClass('success').addClass('error');
        $btn.html('<i class="fa-solid fa-xmark"></i> Failed');
        logError('Ollama test failed', err);
    }

    setTimeout(() => {
        $btn.removeClass('success error');
        $btn.html('<i class="fa-solid fa-plug"></i> Test');
    }, 3000);
}
```

- [ ] Step 22: Update the Ollama test button binding (line ~900). Change:

```js
$('#openvault_test_ollama_btn').on('click', testOllamaConnection);
```
To:
```js
$('#openvault_test_ollama_btn').on('click', handleOllamaTestClick);
```

- [ ] Step 23: Delete the `hideExtractedMessages` function entirely (lines ~117-168). Remove the `export async function hideExtractedMessages()` and its full body.

- [ ] Step 24: Replace the `handleEmergencyCut` function (lines ~170-265) with the thin click handler. Delete from `export async function handleEmergencyCut() {` through its closing `}`. Replace with:

```js
/**
 * Handle Emergency Cut button click — thin UI wrapper around domain function.
 */
async function handleEmergencyCutClick() {
    emergencyCutAbortController = new AbortController();

    await executeEmergencyCut({
        onWarning: (msg) => showToast('warning', msg),
        onConfirmPrompt: (msg) => confirm(msg),
        onStart: () => {
            $('#send_textarea').prop('disabled', true);
            showEmergencyCutModal();
        },
        onProgress: (batch, total, events) => updateEmergencyCutProgress(batch, total, events),
        onPhase2Start: () => disableEmergencyCutCancel(),
        onComplete: ({ messagesProcessed, eventsCreated, hiddenCount }) => {
            if (messagesProcessed > 0) {
                showToast('success',
                    `Emergency Cut complete. ${messagesProcessed} messages processed, ` +
                    `${eventsCreated} memories created. Chat history hidden.`,
                );
            } else {
                showToast('success', `Emergency Cut complete. ${hiddenCount} messages hidden from context.`);
            }
            $('#send_textarea').prop('disabled', false);
            hideEmergencyCutModal();
            emergencyCutAbortController = null;
            refreshAllUI();
        },
        onError: (err, isCancel) => {
            const message = isCancel
                ? 'Emergency Cut cancelled. No messages were hidden.'
                : `Emergency Cut failed: ${err.message}. No messages were hidden.`;
            showToast(isCancel ? 'info' : 'error', message);
            logError('Emergency Cut failed', err);
            $('#send_textarea').prop('disabled', false);
            hideEmergencyCutModal();
            emergencyCutAbortController = null;
        },
        abortSignal: emergencyCutAbortController.signal,
    });
}
```

- [ ] Step 25: Update the Emergency Cut button binding (line ~872). Change:

```js
$('#openvault_emergency_cut_btn').on('click', handleEmergencyCut);
```
To:
```js
$('#openvault_emergency_cut_btn').on('click', handleEmergencyCutClick);
```

- [ ] Step 26: Run Biome lint/format check

Run: `npx biome check src/ui/settings.js`
Expected: No errors (or auto-fixable only)

- [ ] Step 27: Run full test suite

Run: `npm run test:run`
Expected: Some tests FAIL — the tests in `settings-helpers.test.js` and `integration/emergency-cut.test.js` still import from `settings.js` for the moved functions. This is expected and fixed in Task 8.

- [ ] Step 28: Commit the UI changes (tests will be fixed next)

```bash
git add src/ui/settings.js && git commit -m "$(cat <<'EOF'
refactor(settings): wire UI to domain functions via callbacks

Emergency Cut and Ollama test click handlers are now thin wrappers
that delegate to executeEmergencyCut (extract.js) and
testOllamaConnection (embeddings.js).
EOF
)"
```

---

### Task 8: Update tests — remove old, fix imports

**Files:**
- Modify: `tests/ui/settings-helpers.test.js` — remove `handleEmergencyCut` and `hideExtractedMessages` describes
- Modify: `tests/integration/emergency-cut.test.js` — update imports to new locations

- [ ] Step 29: In `tests/ui/settings-helpers.test.js`, delete the two `describe` blocks at the bottom of the file:
  - Delete the `describe('handleEmergencyCut', ...)` block (lines ~291-325 approximately)
  - Delete the `describe('hideExtractedMessages', ...)` block (lines ~333-403 approximately)

  These tests are now covered by `tests/extraction/emergency-cut.test.js` and `tests/extraction/hide-messages.test.js`.

- [ ] Step 30: Rewrite `tests/integration/emergency-cut.test.js`. The domain exports (`hideExtractedMessages`, `executeEmergencyCut`) now come from `extract.js`. UI helpers (`showEmergencyCutModal`, etc.) remain in `settings.js`:

```js
import { describe, expect, it } from 'vitest';

describe('Emergency Cut Integration', () => {
    describe('Domain exports from extract.js', () => {
        it('exports executeEmergencyCut function', async () => {
            const { executeEmergencyCut } = await import('../../src/extraction/extract.js');
            expect(typeof executeEmergencyCut).toBe('function');
        });

        it('exports hideExtractedMessages function', async () => {
            const { hideExtractedMessages } = await import('../../src/extraction/extract.js');
            expect(typeof hideExtractedMessages).toBe('function');
        });
    });

    describe('UI exports from settings.js', () => {
        it('exports showEmergencyCutModal function', async () => {
            const { showEmergencyCutModal } = await import('../../src/ui/settings.js');
            expect(typeof showEmergencyCutModal).toBe('function');
        });

        it('exports hideEmergencyCutModal function', async () => {
            const { hideEmergencyCutModal } = await import('../../src/ui/settings.js');
            expect(typeof hideEmergencyCutModal).toBe('function');
        });

        it('exports updateEmergencyCutProgress function', async () => {
            const { updateEmergencyCutProgress } = await import('../../src/ui/settings.js');
            expect(typeof updateEmergencyCutProgress).toBe('function');
        });

        it('exports disableEmergencyCutCancel function', async () => {
            const { disableEmergencyCutCancel } = await import('../../src/ui/settings.js');
            expect(typeof disableEmergencyCutCancel).toBe('function');
        });
    });

    describe('extractAllMessages accepts emergencyCut options', () => {
        it('extractAllMessages accepts options object', async () => {
            const { extractAllMessages } = await import('../../src/extraction/extract.js');
            expect(typeof extractAllMessages).toBe('function');
            expect(extractAllMessages.length).toBe(1);
        });
    });
});
```

- [ ] Step 31: Run full test suite

Run: `npm run test:run`
Expected: All tests PASS

- [ ] Step 32: Commit

```bash
git add tests/ui/settings-helpers.test.js tests/integration/emergency-cut.test.js && git commit -m "$(cat <<'EOF'
test: update emergency cut tests for new domain locations

Remove moved handleEmergencyCut/hideExtractedMessages tests from
settings-helpers. Update integration test imports to extract.js.
EOF
)"
```

---

### Task 9: Final verification — zero domain logic in UI

**Files:** None (verification only)

- [ ] Step 33: Verify no domain imports remain in `settings.js`

Run: `grep -n "extraction/scheduler\|extraction/worker\|state\.js.*operationState\|getProcessedFingerprints\|getFingerprint\|getBackfillStats\|isWorkerRunning" src/ui/settings.js`
Expected: No output (zero matches)

- [ ] Step 34: Verify new exports exist

Run: `grep -n "export.*testOllamaConnection" src/embeddings.js && grep -n "export.*hideExtractedMessages\|export.*executeEmergencyCut" src/extraction/extract.js`
Expected: 3 lines showing the exports

- [ ] Step 35: Run full test suite one final time

Run: `npm run test:run`
Expected: All tests PASS

- [ ] Step 36: Commit verification confirmation

```bash
git log --oneline -5
```

Expected output shows 4 commits from this PR:
1. `refactor(embeddings): add testOllamaConnection as pure domain function`
2. `refactor(extract): move hideExtractedMessages from UI to domain layer`
3. `refactor(extract): add executeEmergencyCut with callback injection`
4. `refactor(settings): wire UI to domain functions via callbacks`
5. `test: update emergency cut tests for new domain locations`
