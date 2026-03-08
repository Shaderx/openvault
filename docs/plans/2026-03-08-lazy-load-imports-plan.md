# Implementation Plan - Lazy-Load ES Module Imports

> **Reference:** `docs/designs/2026-03-08-lazy-load-imports-design.md`
> **Execution:** Use `executing-plans` skill.

## Overview

Convert 15 static imports to dynamic `import()` across 4 files. This defers all 6 CDN dependency fetches until first use, improving startup time. No API changes — existing tests should pass unchanged.

---

## Task 1: Lazy-load imports in `index.js`

**Goal:** Convert 2 static imports to dynamic `import()` for slash command callbacks.

**Step 1: Read current file**
- Command: `Read file_path="C:/projects/openvault/index.js"`
- Verify lines 11-12 contain static imports:
  - `extractMemories` from `./src/extraction/extract.js`
  - `retrieveAndInjectContext` from `./src/retrieval/retrieve.js`

**Step 2: Remove static imports**
- File: `index.js`
- Delete lines 11-12 (the import statements)

**Step 3: Update `/openvault-extract` callback**
- File: `index.js`
- Find the `openvault-extract` callback function (around line 36)
- Before the `setStatus('extracting')` line, add:
  ```js
  const { extractMemories } = await import('./src/extraction/extract.js');
  ```

**Step 4: Update `/openvault-retrieve` callback**
- File: `index.js`
- Find the `openvault-retrieve` callback function (around line 57)
- Before the `setStatus('retrieving')` line, add:
  ```js
  const { retrieveAndInjectContext } = await import('./src/retrieval/retrieve.js');
  ```

**Step 5: Verify no syntax errors**
- Command: `node -c index.js`
- Expect: No errors (may fail due to JSX-like syntax in comments, but should parse imports)

**Step 6: Run existing tests**
- Command: `npm test`
- Expect: All tests pass (tests use dynamic imports via `setupTestContext`)

---

## Task 2: Lazy-load imports in `src/events.js`

**Goal:** Convert 7 static imports to dynamic `import()` across event handlers.

**Step 1: Read current file**
- Command: `Read file_path="C:/projects/openvault/src/events.js"`
- Verify lines 9-18 contain static imports for:
  - `clearEmbeddingCache` from `./embeddings.js`
  - `cleanupCharacterStates` from `./extraction/extract.js`
  - `getExtractedMessageIds` from `./extraction/scheduler.js`
  - `wakeUpBackgroundWorker` from `./extraction/worker.js`
  - `clearRetrievalDebug` from `./retrieval/debug-cache.js`
  - `updateInjection` from `./retrieval/retrieve.js`
  - Token functions from `./utils/tokens.js`

**Step 2: Remove static imports from top of file**
- File: `src/events.js`
- Delete import lines 9-18 (all the imports listed above)
- Keep the imports from `./constants.js`, `./deps.js`, `./state.js`, and UI helpers — those are NOT lazy-loaded

**Step 3: Update `onChatChanged()` function**
- File: `src/events.js`
- Change function signature from `function onChatChanged()` to `async function onChatChanged()`
- At the start of the function body, add:
  ```js
  const { clearEmbeddingCache } = await import('./embeddings.js');
  const { cleanupCharacterStates } = await import('./extraction/extract.js');
  const { clearRetrievalDebug } = await import('./retrieval/debug-cache.js');
  ```
- Note: These imports can be parallel with `Promise.all()` but sequential is fine for simplicity

**Step 4: Update `onMessageReceived()` function**
- File: `src/events.js`
- Change function signature from `function onMessageReceived(messageId)` to `async function onMessageReceived(messageId)`
- At the start of the function body (after the early returns), add:
  ```js
  const { wakeUpBackgroundWorker } = await import('./extraction/worker.js');
  ```

**Step 5: Update `onBeforeGeneration()` function**
- File: `src/events.js`
- This function is already `async` — no signature change needed
- After the `await autoHideOldMessages()` call, add:
  ```js
  const { updateInjection } = await import('./retrieval/retrieve.js');
  ```

**Step 6: Update `autoHideOldMessages()` function**
- File: `src/events.js`
- This function is already `async` — no signature change needed
- At the start of the function body, add:
  ```js
  const { getExtractedMessageIds } = await import('./extraction/scheduler.js');
  const { getMessageTokenCount, getTokenSum, snapToTurnBoundary } = await import('./utils/tokens.js');
  ```

**Step 7: Run tests to verify**
- Command: `npm test tests/events.test.js`
- Expect: All tests pass
- Note: Tests use `await import('../src/events.js')` which resolves the same module cache

**Step 8: Git commit**
- Command: `git add src/events.js && git commit -m "refactor(events): lazy-load 7 imports in event handlers"`

---

## Task 3: Lazy-load imports in `src/ui/settings.js`

**Goal:** Convert 4 static imports to dynamic `import()` in settings UI handlers.

**Step 1: Read current file**
- Command: `Read file_path="C:/projects/openvault/src/ui/settings.js"`
- Identify lines containing:
  - `extractAllMessages` from `../extraction/extract.js` (around line 103)
  - `isWorkerRunning` from `../extraction/worker.js` (around line 104)
  - Token functions from `../utils/tokens.js` (around line 18)
  - Scheduler functions from `../extraction/scheduler.js` (around line 17)

**Step 2: Remove static imports**
- File: `src/ui/settings.js`
- Delete the import statements identified above
- Keep all other imports (constants, deps, embeddings, events, UI helpers, data, dom)

**Step 3: Update `handleExtractAll()` function**
- File: `src/ui/settings.js`
- Find the `handleExtractAll` async function (around line 126)
- At the start of the function body, add:
  ```js
  const { extractAllMessages } = await import('../extraction/extract.js');
  const { isWorkerRunning } = await import('../extraction/worker.js');
  ```

**Step 4: Update `updateBudgetIndicators()` function**
- File: `src/ui/settings.js`
- Change function signature from `export function updateBudgetIndicators()` to `export async function updateBudgetIndicators()`
- At the start of the function body, add:
  ```js
  const { getTokenSum } = await import('../utils/tokens.js');
  const { getExtractedMessageIds, getUnextractedMessageIds } = await import('../extraction/scheduler.js');
  ```

**Step 5: Verify `refreshAllUI()` caller handles async**
- File: `src/ui/render.js`
- Command: `grep -n "updateBudgetIndicators" src/ui/render.js`
- Verify caller is `refreshAllUI()` which is fire-and-forget
- If needed, update caller to not await (but it should already be fire-and-forget)

**Step 6: Run tests**
- Command: `npm test tests/ui-helpers.test.js`
- Expect: Tests pass (UI helpers test doesn't directly test settings.js)

**Step 7: Git commit**
- Command: `git add src/ui/settings.js && git commit -m "refactor(settings): lazy-load 4 imports in settings UI"`

---

## Task 4: Lazy-load imports in `src/ui/status.js`

**Goal:** Convert 2 static imports to dynamic `import()` in status display.

**Step 1: Read current file**
- Command: `Read file_path="C:/projects/openvault/src/ui/status.js"`
- Verify lines 7-8 contain static imports:
  - `getExtractedMessageIds, getUnextractedMessageIds` from `../extraction/scheduler.js`
  - `getTokenSum` from `../utils/tokens.js`

**Step 2: Remove static imports**
- File: `src/ui/status.js`
- Delete import lines 7-8
- Keep all other imports (constants, deps, data, logging, helpers)

**Step 3: Update `refreshStats()` function**
- File: `src/ui/status.js`
- Change function signature from `export function refreshStats()` to `export async function refreshStats()`
- At the start of the function body (after the early return for no data), add:
  ```js
  const { getTokenSum } = await import('../utils/tokens.js');
  const { getExtractedMessageIds, getUnextractedMessageIds } = await import('../extraction/scheduler.js');
  ```
- Important: Add this AFTER the `if (!data)` early return, so we don't import when no chat is loaded

**Step 4: Verify callers handle async**
- File: `src/ui/render.js`
- Command: `grep -n "refreshStats" src/ui/render.js`
- Verify callers are fire-and-forget (no await)
- If any caller explicitly awaits, remove the await

**Step 5: Run tests**
- Command: `npm test`
- Expect: All tests pass

**Step 6: Git commit**
- Command: `git add src/ui/status.js && git commit -m "refactor(status): lazy-load 2 imports in stats display"`

---

## Task 5: Final verification with browser DevTools

**Goal:** Verify CDN requests are deferred and features work correctly.

**Step 1: Build the extension**
- Command: `npm run build` (if build step exists) or ensure files are ready for browser

**Step 2: Open browser DevTools Network tab**
- Open Chrome DevTools (F12)
- Go to Network tab
- Filter by "esm.sh" domain

**Step 3: Reload SillyTavern without triggering any features**
- Reload the page
- Verify: No esm.sh requests appear in Network tab

**Step 4: Trigger extraction and verify CDN loads**
- Send a message in chat
- Verify: esm.sh requests for `gpt-tokenizer`, `jsonrepair`, `zod` appear
- Verify: Message is hidden (extraction worked)

**Step 5: Verify chat switch cleanup**
- Switch to a different chat
- Verify: No new esm.sh requests (modules already cached)
- Verify: Settings panel refreshes correctly

**Step 6: Verify Extract All button**
- Open OpenVault settings panel
- Click "Extract All" button
- Verify: Extraction runs without errors
- Verify: Status indicators update

**Step 7: Verify stats display**
- Open settings panel
- Verify: Batch progress bar shows correct values
- Verify: Budget indicators display correctly

**Step 8: Run full test suite**
- Command: `npm test`
- Expect: All tests pass

**Step 9: Git commit verification notes**
- Command: `echo "Lazy-load imports verified - CDN deps deferred, all features functional" >> VERIFICATION.md`
- Commit verification notes: `git add VERIFICATION.md && git commit -m "test: verify lazy-load imports - CDN deferred, features functional"`

---

## Task 6: Clean up and documentation

**Step 1: Remove verification artifact if created**
- Command: `rm VERIFICATION.md` (if created)

**Step 2: Verify all files modified**
- Command: `git status`
- Verify only these files are modified:
  - `index.js`
  - `src/events.js`
  - `src/ui/settings.js`
  - `src/ui/status.js`

**Step 3: Final test run**
- Command: `npm test`
- Expect: All tests pass

**Step 4: Create summary of changes**
- File: `docs/releases/2026-03-08-lazy-load.md`
- Content:
  ```markdown
  # Lazy-Load Imports (2026-03-08)

  ## Changes
  - Converted 15 static imports to dynamic `import()` across 4 files
  - All 6 CDN dependencies now load on-demand instead of at startup

  ## Modules Deferred
  - gpt-tokenizer (via utils/tokens.js)
  - jsonrepair, zod (via extraction/structured.js)
  - snowball-stemmers (via utils/stemmer.js)
  - stopword (via utils/stopwords.js)
  - graphology + plugins (via graph/communities.js)

  ## Verification
  - No esm.sh requests at page load
  - All features functional after CDN loads
  - Existing tests pass unchanged
  ```

**Step 5: Final commit**
- Command: `git add docs/releases/2026-03-08-lazy-load.md && git commit -m "docs: add lazy-load imports release notes"`

---

## Success Criteria

1. ✓ All 15 static imports converted to dynamic `import()`
2. ✓ No esm.sh requests in Network tab at startup
3. ✓ All features functional (extraction, retrieval, settings UI, stats)
4. ✓ All existing tests pass unchanged
5. ✓ No API changes — function signatures compatible (fire-and-forget async)
