# Implementation Plan - Logging Overhaul

> **Reference:** `docs/designs/2026-03-10-logging-overhaul-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Write Failing Tests for New Logging Functions

**Goal:** Red tests for `logDebug`, `logInfo`, `logWarn`, `logError` before any implementation.

**Step 1: Write the Failing Tests**
- File: `tests/utils/logging.test.js`
- Replace the existing `describe('log', ...)` block and add new describe blocks. Keep the `logRequest` tests untouched.
- Code to **add** (inside the outer `describe('logging', ...)`):

```js
describe('logDebug', () => {
    it('logs when debugMode is true', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: { debugMode: true } }),
        });
        logDebug('test debug');
        expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] test debug');
    });

    it('logs with data when debugMode is true', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: { debugMode: true } }),
        });
        logDebug('scores', { top: 0.9 });
        expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] scores', { top: 0.9 });
    });

    it('does not log when debugMode is false', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
        });
        logDebug('hidden');
        expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('does not log when settings are missing', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({}),
        });
        logDebug('hidden');
        expect(mockConsole.log).not.toHaveBeenCalled();
    });
});

describe('logInfo', () => {
    it('always logs regardless of debugMode', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
        });
        logInfo('Extension initialized');
        expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] Extension initialized');
    });

    it('logs with data', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        logInfo('Backfill complete', { memories: 5, nodes: 12 });
        expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] Backfill complete', { memories: 5, nodes: 12 });
    });
});

describe('logWarn', () => {
    it('always warns regardless of debugMode', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
        });
        logWarn('Stale lock cleared');
        expect(mockConsole.warn).toHaveBeenCalledWith('[OpenVault] Stale lock cleared');
    });

    it('warns with data', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        logWarn('Array fallback', { length: 3 });
        expect(mockConsole.warn).toHaveBeenCalledWith('[OpenVault] Array fallback', { length: 3 });
    });
});

describe('logError', () => {
    it('logs error message with prefix', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        logError('Something broke');
        expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Something broke');
    });

    it('logs error object when provided', () => {
        setDeps({
            console: mockConsole,
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        const err = new Error('boom');
        logError('Parse failed', err);
        expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Parse failed');
        expect(mockConsole.error).toHaveBeenCalledWith(err);
    });

    it('logs context object in collapsed group when provided', () => {
        const groupCollapsed = vi.fn();
        const groupEnd = vi.fn();
        setDeps({
            console: { ...mockConsole, groupCollapsed, groupEnd },
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        logError('Extraction failed', new Error('timeout'), { messageCount: 42 });
        expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Extraction failed');
        expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] Error context');
        expect(mockConsole.log).toHaveBeenCalledWith({ messageCount: 42 });
        expect(groupEnd).toHaveBeenCalled();
    });

    it('skips context group when context is not provided', () => {
        const groupCollapsed = vi.fn();
        setDeps({
            console: { ...mockConsole, groupCollapsed, groupEnd: vi.fn() },
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        logError('Simple error', new Error('x'));
        expect(groupCollapsed).not.toHaveBeenCalled();
    });

    it('handles missing groupCollapsed gracefully', () => {
        setDeps({
            console: mockConsole, // no groupCollapsed
            getExtensionSettings: () => ({ [extensionName]: {} }),
        });
        // Should not throw even with context
        logError('Fallback test', new Error('y'), { key: 'val' });
        expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Fallback test');
        expect(mockConsole.log).toHaveBeenCalledWith({ key: 'val' });
    });
});
```

- Update the import line at the top from:
  ```js
  import { log, logRequest } from '../../src/utils/logging.js';
  ```
  to:
  ```js
  import { logDebug, logInfo, logWarn, logError, logRequest } from '../../src/utils/logging.js';
  ```
- Delete the old `describe('log', ...)` block (3 tests).

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/utils/logging.test.js`
- Expect: Fail — `logDebug`, `logInfo`, `logWarn`, `logError` are not exported from `logging.js`.

---

### Task 2: Implement the New Logging Functions (Green)

**Goal:** Make all Task 1 tests pass by rewriting `src/utils/logging.js`.

**Step 1: Implementation**
- File: `src/utils/logging.js`
- Rewrite the file. Keep `logRequest` unchanged. Replace `log()` with:

```js
import { extensionName } from '../constants.js';
import { getDeps } from '../deps.js';

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
}
```

- Keep the existing `logRequest` function exactly as-is, appended after these.

**Step 2: Verify (Green)**
- Command: `npx vitest run tests/utils/logging.test.js`
- Expect: All tests PASS (new tests + existing `logRequest` tests).

**Step 3: Git Commit**
- Command: `git add src/utils/logging.js tests/utils/logging.test.js && git commit -m "feat(logging): add logDebug, logInfo, logWarn, logError to logging module"`

---

### Task 3: Rename `log` to `logDebug` Across 14 Files

**Goal:** Replace all `import { log }` / `log(...)` with `import { logDebug }` / `logDebug(...)`.

**Step 1: Identify all call sites**
Run: `grep -rn "import.*{ log.*} from.*logging" src/` and `grep -rn "\blog(" src/` to confirm the 14 files listed in the design.

**Step 2: For each file, make two edits:**
1. Change import: `import { log }` -> `import { logDebug }` (some files also import `logRequest` — keep that).
2. Replace all `log(` calls with `logDebug(` calls. Use replace-all within each file.

Files and their import lines to change:

| File | Current import | New import |
|---|---|---|
| `src/embeddings.js` | `{ log }` | `{ logDebug }` |
| `src/llm.js` | `{ log, logRequest }` | `{ logDebug, logRequest }` |
| `src/events.js` | `{ log }` | `{ logDebug }` |
| `src/graph/communities.js` | `{ log }` | `{ logDebug }` |
| `src/graph/graph.js` | `{ log }` | `{ logDebug }` |
| `src/extraction/extract.js` | `{ log }` | `{ logDebug }` |
| `src/extraction/worker.js` | `{ log }` | `{ logDebug }` |
| `src/perf/store.js` | `{ log }` | `{ logDebug }` |
| `src/pov.js` | `{ log }` | `{ logDebug }` |
| `src/reflection/reflect.js` | `{ log }` | `{ logDebug }` |
| `src/retrieval/retrieve.js` | `{ log }` | `{ logDebug }` |
| `src/retrieval/scoring.js` | `{ log }` | `{ logDebug }` |
| `src/ui/status.js` | `{ log }` | `{ logDebug }` |
| `src/utils/data.js` | `{ log }` | `{ logDebug }` |

**Step 3: Verify**
- Command: `npx vitest run`
- Expect: Full suite passes. No test imports `log` directly — tests go through `getDeps().console` mocks.
- Also run: `grep -rn "\blog(" src/` — should return zero matches outside comments/strings.

**Step 4: Git Commit**
- Command: `git add -A && git commit -m "refactor(logging): rename log() to logDebug() across 14 files"`

---

### Task 4: Eradicate Bare Console Calls — `src/ui/settings.js`

**Goal:** Replace 3 bare `console.*` calls in settings.js with logging imports.

**Step 1: Implementation**
- File: `src/ui/settings.js`
- Add import at top: `import { logInfo, logWarn, logError } from '../utils/logging.js';`
- Line 59: `console.error('[OpenVault] Ollama test failed:', err)` → `logError('Ollama test failed', err)`
- Line 338: `console.warn(\`[OpenVault] Unknown default hint key: ${key}\`)` → `logWarn(\`Unknown default hint key: ${key}\`)`
- Line 387: `console.log('[OpenVault] Settings loaded')` → `logInfo('Settings loaded')`
- Line 515: `console.warn('[OpenVault] Failed to reset old embedding strategy:', err)` → `logWarn('Failed to reset old embedding strategy: ' + err.message)`

**Step 2: Verify**
- Command: `npx vitest run`
- Expect: PASS (no tests directly assert on these console calls).
- Also run: `grep -n "console\." src/ui/settings.js` — should return zero matches.

**Step 3: Git Commit**
- Command: `git add src/ui/settings.js && git commit -m "refactor(logging): replace bare console calls in settings.js"`

---

### Task 5: Eradicate Bare Console Calls — `src/extraction/structured.js`

**Goal:** Replace 1 bare `console.warn` in structured.js.

**Step 1: Implementation**
- File: `src/extraction/structured.js`
- Add import: `import { logWarn } from '../utils/logging.js';`
- Line 126: `console.warn('[OpenVault] LLM returned array instead of object in parseStructuredResponse')` → `logWarn('LLM returned array instead of object in parseStructuredResponse')`

**Step 2: Verify**
- Command: `npx vitest run tests/extraction/structured.test.js`
- Expect: PASS.
- Also run: `grep -n "console\." src/extraction/structured.js` — should return zero matches.

**Step 3: Git Commit**
- Command: `git add src/extraction/structured.js && git commit -m "refactor(logging): replace bare console.warn in structured.js"`

---

### Task 6: Eradicate `getDeps().console` Calls — Batch 1 (5 small files)

**Goal:** Migrate `getDeps().console.*` in `state.js`, `utils/data.js`, `utils/text.js`, `utils/st-helpers.js`, `events.js`.

**Step 1: Implementation for each file:**

**`src/state.js`**
- Add import: `import { logWarn } from './utils/logging.js';`
- Line 61: `getDeps().console.warn('OpenVault: Generation lock timeout - clearing stale lock')` → `logWarn('Generation lock timeout - clearing stale lock')`

**`src/utils/data.js`**
- Already imports from `logging.js`. Add `logWarn, logError` to the import.
- Line 15: `getDeps().console.warn('[OpenVault] getContext() returned null/undefined')` → `logWarn('getContext() returned null/undefined')`
- Line 52-53: `getDeps().console.warn(...)` → `logWarn('Chat switched during save ...')`
- Line 66: `getDeps().console.error('[OpenVault] Failed to save data:', error)` → `logError('Failed to save data', error)`

**`src/utils/text.js`**
- Add import: `import { logError, logWarn } from './logging.js';`
- Lines 116-117: `getDeps().console.error(...)` × 2 → `logError('JSON parse returned non-object/array', null, { type: typeof parsed, rawInput: input.slice(0, 500) })` (Phase D enrichment done here too)
- Line 123: `getDeps().console.warn(...)` → `logWarn('LLM returned array instead of object, applying recovery wrapper')`
- Lines 134-135: `getDeps().console.error(...)` × 2 → `logError('JSON parse failed', e, { rawInput: input.slice(0, 2000) })` (Phase D enrichment done here too)
- Remove `import { getDeps } from '../deps.js'` if no other usage remains; otherwise keep.

**`src/utils/st-helpers.js`**
- Add import: `import { logError } from './logging.js';`
- Line 30: `getDeps().console.error('[OpenVault] Failed to set extension prompt:', error)` → `logError('Failed to set extension prompt', error)`
- Remove `getDeps` import if unused after this.

**`src/events.js`**
- Already imports from `logging.js`. Add `logError` to the import.
- Line 176: `getDeps().console.error('OpenVault: Error during pre-generation retrieval:', error)` → `logError('Error during pre-generation retrieval', error)`

**Step 2: Verify**
- Command: `npx vitest run tests/utils/data.test.js tests/utils/text.test.js tests/utils/st-helpers.test.js tests/state.test.js tests/events.test.js`
- Expect: PASS. The `data.test.js` assertions (`expect(mockConsole.warn).toHaveBeenCalled()`, `expect(mockConsole.error).toHaveBeenCalled()`) will still pass because `logWarn`/`logError` route through `getDeps().console`.

**Step 3: Git Commit**
- Command: `git add -A && git commit -m "refactor(logging): replace getDeps().console in state, data, text, st-helpers, events"`

---

### Task 7: Eradicate `getDeps().console` Calls — Batch 2 (4 heavier files)

**Goal:** Migrate `getDeps().console.*` in `extraction/worker.js`, `extraction/extract.js`, `embeddings.js`, `retrieval/retrieve.js`.

**Step 1: Implementation for each file:**

**`src/extraction/worker.js`**
- Already imports from `logging.js`. Add `logError` to the import.
- Line 167: `getDeps().console.error('[OpenVault] Background worker error:', err)` → `logError('Background worker error', err)`

**`src/extraction/extract.js`**
- Already imports from `logging.js`. Add `logError` to the import.
- Line 584: `deps.console.error(\`[OpenVault] Reflection error for ${characterName}:\`, error)` → `logError(\`Reflection error for ${characterName}\`, error)`
- Line 616: `deps.console.error('[OpenVault] Community detection error:', error)` → `logError('Community detection error', error)`
- Line 626: `deps.console.error('[OpenVault] Phase 2 (reflection/community) error:', phase2Error)` → `logError('Phase 2 error', phase2Error, { characterName })` (Phase D enrichment)
- Line 643: `deps.console.error('[OpenVault] Extraction error:', error)` → `logError('Extraction error', error, { messageCount: messages.length })` (Phase D enrichment)
- Line 800: `console.error('[OpenVault] Extraction stopped after exceeding backoff limit:', error)` → `logError('Extraction stopped after exceeding backoff limit', error)`
- Note: `extract.js` references `deps.console` via a local `const deps = getDeps()` pattern. After migrating these calls, check if `deps.console` is still used anywhere in the function. If not, the destructure can be simplified in a later cleanup — do NOT restructure the function now.

**`src/embeddings.js`**
- Already imports from `logging.js`. Add `logError` to the import.
- Line 778: `getDeps().console.error('[OpenVault] Backfill embeddings error:', error)` → `logError('Backfill embeddings error', error)`
- Also find the `TransformersStrategy` and `OllamaStrategy` catch blocks and add context:
  - Transformers catch: `logError('Transformers embedding failed', error, { modelName: this.modelName, textSnippet: text.slice(0, 100) })`
  - Ollama catch: `logError('Ollama embedding failed', error, { modelName: this.modelName, textSnippet: text.slice(0, 100) })`

**`src/retrieval/retrieve.js`**
- Already imports from `logging.js`. Add `logError` to the import.
- Line 307: `getDeps().console.error('[OpenVault] Retrieval error:', error)` → `logError('Retrieval error', error)`

**Step 2: Verify**
- Command: `npx vitest run tests/extraction/worker.test.js tests/extraction/extract.test.js tests/embeddings.test.js tests/retrieval/retrieve.test.js`
- Expect: PASS.

**Step 3: Full suite check**
- Command: `npx vitest run`
- Expect: All tests pass.

**Step 4: Git Commit**
- Command: `git add -A && git commit -m "refactor(logging): replace getDeps().console in worker, extract, embeddings, retrieve"`

---

### Task 8: Promote Lifecycle Logs to `logInfo`

**Goal:** Upgrade 3 rare milestone messages from `logDebug` to `logInfo`.

**Step 1: Implementation**

**`src/embeddings.js`**
- Find the backfill complete log (currently `logDebug('Backfill complete: ...')` after Task 3 rename).
- Change to `logInfo(...)`. Add `logInfo` to the import.

**`src/extraction/extract.js`**
- Find `logDebug(\`Extracted ${events.length} events\`)` (after Task 3 rename).
- Change to `logInfo(...)`. Add `logInfo` to the import.

**`src/ui/settings.js`**
- Already done in Task 4 (`logInfo('Settings loaded')`). Verify it's there.

**Step 2: Verify**
- Command: `npx vitest run`
- Expect: PASS. These are runtime-only changes with no test assertions on their content.

**Step 3: Git Commit**
- Command: `git add -A && git commit -m "feat(logging): promote 3 lifecycle messages to logInfo"`

---

### Task 9: Update `src/utils/CLAUDE.md` with Logging Guidelines

**Goal:** Replace the 2-bullet `logging.js` section with the full reference table from the design doc.

**Step 1: Implementation**
- File: `src/utils/CLAUDE.md`
- Replace the section:
  ```markdown
  ### `logging.js`
  - `log()`: Guarded by `settings.debugMode`. Auto-prefixes `[OpenVault]`.
  - `logRequest()`: Detailed LLM payload debugging using `console.groupCollapsed()`.
  ```
  with the full section from design doc Section 6 (the table + rules block).

**Step 2: Verify**
- Read the file and confirm the table renders correctly.
- Command: `npx vitest run` (sanity — doc change shouldn't break anything).

**Step 3: Git Commit**
- Command: `git add src/utils/CLAUDE.md && git commit -m "docs: update CLAUDE.md with logging guidelines"`

---

### Task 10: Lint and Final Verification

**Goal:** Clean up any unused imports and confirm zero regressions.

**Step 1: Lint**
- Command: `npx biome check --write src/`
- Fix any unused `getDeps` imports that remain after migration.

**Step 2: Full Test Suite**
- Command: `npx vitest run`
- Expect: All tests PASS.

**Step 3: Grep Audit**
- Command: `grep -rn "console\.\(log\|warn\|error\)" src/ --include="*.js" | grep -v deps.js | grep -v logging.js`
- Expect: Zero matches. Every console call is routed through `logging.js`.

**Step 4: Git Commit**
- Command: `git add -A && git commit -m "chore(logging): lint cleanup and remove unused getDeps imports"`
