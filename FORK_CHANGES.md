# OpenVault Fork Changes (Shaderx/openvault)

Tracks all differences between this fork and [upstream](https://github.com/vadash/openvault).
Use this document to manage merges, decide what to PR upstream, and avoid regressions.

Last audited against: `upstream/master` on 2026-04-10

---

## Legend

| Tag | Meaning |
|-----|---------|
| **BUG** | Fix for a bug that also exists in upstream — PR candidate |
| **FEAT** | Personal feature not in upstream — keep separate |
| **PREF** | Fork-specific preference/config — keep separate |

---

## Bug Fixes (PR candidates)

These fix real issues in upstream and should ideally be contributed back.

### BUG-1: 502 Bad Gateway not recognized as rate-limit error
- **Files:** `src/utils/queue.js`
- **Problem:** `isRateLimitError()` only checked for 429 and timeout. APIs that return 502 during overload caused hard failures instead of AIMD backoff.
- **Fix:** Added `502`, `"Bad Gateway"` to the detection list.

### BUG-2: Missing rpmDelay before Phase 2 LLM calls
- **Files:** `src/extraction/extract.js`, `src/state.js`, `src/llm.js`
- **Problem:** Phase 1 completes, then Phase 2 (reflections + communities) fires immediately with no rate-limit spacing, triggering 502s.
- **Fix:** Added `rpmDelay()` calls before `synthesizeReflections` and `synthesizeCommunities` in both the inline Phase 2 block and `runPhase2Enrichment`. Centralized `lastApiCallTime` in `state.js` and update it from `callLLM` after every response.

### BUG-3: Batch count shows 0/0 (NaN%) after swipe protection
- **Files:** `src/extraction/scheduler.js`
- **Problem:** `getBackfillMessageIds` calculates `batchCount` via token budgeting. After `trimTailTurns` removes recent messages, remaining messages may not fill a complete batch, so `batchCount` is 0. But `getNextBatch` uses snap-to-turn-boundary and finds a valid batch anyway. Progress displays "0/0 batches (NaN%)".
- **Fix:** If `messageIds.length > 0 && batchCount === 0`, set `batchCount = 1`.

### BUG-4: Missing CSS imports in style.css
- **Files:** `style.css`
- **Problem:** Upstream created `css/entities.css` and `css/entity-crud.css` but forgot to `@import` them in `style.css`. Entity CRUD buttons (edit/merge/delete) have no styling.
- **Fix:** Added the two `@import` lines.

### BUG-5: Entity action buttons white-on-white
- **Files:** `css/entity-crud.css`
- **Problem:** `.openvault-entity-action-btn` has `background: transparent` but no explicit `color`. On light themes, buttons inherit `color: white` and become invisible.
- **Fix:** Added `color: var(--SmartThemeBodyColor, inherit)`.

### BUG-6: Missing CSS for community/entity UI elements
- **Files:** `css/world.css`
- **Problem:** Upstream templates reference `.openvault-community-actions`, `.openvault-community-editing`, `.openvault-entity-footer`, and entity card hover effects, but `world.css` doesn't define them.
- **Fix:** Added the missing rule blocks.

### BUG-7: Memory card action button styles missing
- **Files:** `css/cards.css`
- **Problem:** Memory card action icons (`.openvault-memory-card-actions`) have no styles for visibility, hover effects, or theme color inheritance.
- **Fix:** Added styles with opacity transitions and theme-aware colors.

---

## Personal Features (keep separate)

These are fork-only features. Isolate in dedicated files where possible.

### FEAT-1: Side Panel
- **New files (no merge conflict):**
  - `src/ui/side-panel.js` — Full panel logic, compact memory renderer, sidebar-scoped event handlers
  - `css/side-panel.css` — All sidebar styles
  - `templates/side_panel.html` — Panel HTML template
- **Upstream file touches (minimal, merge-safe):**
  - `index.js` — Init, toggle button binding, auto-open on load (~10 lines)
  - `src/ui/render.js` — 1 line: `import('./side-panel.js').then(...)` in `refreshAllUI()`
  - `style.css` — 1 line: `@import url("css/side-panel.css")`
- **Merge strategy:** Side panel files are entirely ours. The 3 integration hooks in upstream files are minimal and easy to re-add if lost.

### FEAT-2: Reset & Backfill
- **Files:** `src/ui/settings.js` (+`handleResetAndBackfill`), `templates/settings_panel.html` (+button)
- **What it does:** Un-hides all `openvault_hidden` messages, deletes all OpenVault data, then re-extracts entire chat. Shows detailed toast progress.
- **Merge strategy:** Both files are upstream-owned. The function is self-contained — easy to re-add after merge if lost. Button HTML is 4 lines in the Advanced tab.

### FEAT-3: Empty Extraction Retry
- **Files:** `src/extraction/extract.js` (+`_emptyExtractionAttempts` map, retry logic), `src/extraction/worker.js` (retry in worker loop), `index.js` (toast for `no_events_retry`)
- **What it does:** If the LLM returns 0 events for a batch, retries up to 2 times before marking messages as permanently processed. Prevents a single bad LLM response from discarding an entire batch.
- **Merge strategy:** Touches upstream files. Could be PR'd as it's a broadly useful robustness improvement.

### FEAT-4: Latest Message Exclusion
- **Files:** `src/extraction/scheduler.js` (`getUnextractedMessageIds` + callers)
- **What it does:** Excludes the most recent message from automatic extraction to avoid extracting content the user is still regenerating/editing. Backfill and emergency cut pass `includeLatest: true` to override.
- **Merge strategy:** Touches upstream file. Could be PR'd — prevents premature extraction of in-progress messages.

### FEAT-5: Generate Reflections Button (BROKEN)
- **Files:** `src/ui/settings.js` (+`handleGenerateReflections`, button binding)
- **What it does:** Force-generates reflections for all characters, bypassing importance threshold.
- **Status: BROKEN — 3 issues:**
  1. Button `#openvault_generate_reflections_btn` does not exist in `settings_panel.html` (binding is dead)
  2. Imports from `../utils/data.js` which doesn't exist (should be `../store/chat-data.js`)
  3. Calls `saveOpenVaultData()` which isn't exported (should use `getDeps().saveChatConditional()`)
- **Action:** Either fix or remove the dead code.

### FEAT-6: Post-History Prompt Injection (PARTIAL)
- **Files:** `src/constants.js` (+`postHistoryPrompt` default), `src/retrieval/retrieve.js` (+injection logic), `src/ui/settings.js` (+binding + UI sync)
- **What it does:** Injects a user-defined prompt after all chat messages (IN_CHAT position, depth 0).
- **Status: PARTIAL** — Backend injection works but `#openvault_post_history_prompt` input field is missing from `settings_panel.html`. Settings binding and UI sync exist but have no visible UI element.
- **Merge strategy:** Touches 3 upstream files. Changes are small and additive. Needs HTML input added to complete the feature.

### FEAT-7: Embedding Model Reset on Source Switch
- **Files:** `src/ui/settings.js`
- **What it does:** Calls `strategy.reset()` when embedding source changes (e.g. switching from transformers to ollama), so the new model loads fresh.
- **Merge strategy:** 3 lines in an existing event handler. Easy to re-add.

### FEAT-8: Worker Auto-Refresh UI
- **Files:** `src/extraction/worker.js`
- **What it does:** Calls `refreshAllUI()` after each successful worker extraction, so the main panel and sidebar update in real-time.
- **Merge strategy:** 2 lines (import + call). Easy to re-add.

---

## Preferences (fork-only defaults)

### PREF-1: Language Defaults (CN → EN)
- **Files:** `src/constants.js`, `src/settings.js`
- **What it does:** Changes default preamble/prefill/output language from Chinese to English. Includes a one-time migration for existing installs.
- **Merge strategy:** Will conflict on every upstream merge of `constants.js`. Keep migration in `settings.js` to handle upstream's CN defaults at runtime.

### PREF-2: WebGPU Warning Suppression
- **Files:** `src/embeddings.js`
- **What it does:** Deletes `webgpu.powerPreference` to suppress a Chromium/Windows console warning (crbug.com/369219127).
- **Merge strategy:** Self-contained try/catch block. Could be PR'd.

### PREF-3: Embedding Warmup on Init
- **Files:** `index.js`
- **What it does:** Fires a dummy `getDocumentEmbedding('warmup')` call on extension init to eagerly load the transformers pipeline.
- **Merge strategy:** 3 lines at end of init. Easy to re-add.

### PREF-4: .gitignore additions
- **Files:** `.gitignore`
- **What it does:** Ignores `sync-upstream.bat` and `nul`.

---

## Merge Checklist

After every `git merge upstream/master`, verify:

1. [ ] `style.css` still has `@import` for `entities.css`, `entity-crud.css`, `side-panel.css`
2. [ ] `src/ui/render.js` `refreshAllUI()` still calls `refreshSidePanel()` via lazy import
3. [ ] `index.js` still inits side panel and binds toggle
4. [ ] `templates/settings_panel.html` still has Reset & Backfill button
5. [ ] `src/ui/settings.js` still has `handleResetAndBackfill` and button binding
6. [ ] `src/extraction/extract.js` still has `rpmDelay` before Phase 2 calls
7. [ ] `src/state.js` still has `lastApiCallTime` exports
8. [ ] `src/llm.js` still calls `setLastApiCallTime` after responses
9. [ ] No duplicate function declarations (check `git diff --check` for conflict markers)
10. [ ] Extension loads without console errors
