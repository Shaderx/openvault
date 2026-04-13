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

### BUG-8: Injection position mapping completely wrong
- **Files:** `src/utils/st-helpers.js`, `src/constants.js`, `templates/settings_panel.html`
- **Problem:** Three separate bugs in the injection position system:
  1. **Labels wrong:** UI said "↓Char (After character definitions)" but `setExtensionPrompt` has no "after char defs" position. Both "↑Char" (0) and "↓Char" (1) mapped to the same ST value `IN_PROMPT=0` (end of system prompt, which is *before* char defs).
  2. **IN_CHAT broken:** Position 4 ("In-chat") mapped to ST value `4`, but ST's `IN_CHAT` is value `1`. Injections at this position were silently dropped — including the post-history prompt (FEAT-6).
  3. **AN positions non-existent:** "Before/After AN" (positions 2/3) mapped to ST values `2`/`3`. Value `2` is actually `BEFORE_PROMPT` (before system prompt, not before AN). Value `3` doesn't exist in ST's `extension_prompt_types` — injection lost.
- **Fix:**
  - Fixed `POSITION_MAP`: `0→2` (BEFORE_PROMPT), `1→0` (IN_PROMPT), `4→1` (IN_CHAT). Legacy values 2/3 fall back to IN_PROMPT.
  - Relabeled: "↑Main (Before system prompt)", "↓Main (After system prompt)", "In-chat"
  - Removed broken AN options from the dropdown and constants.
  - Added new "↓Char (After char defs — top of chat)" option: uses `IN_CHAT` at `depth=10000` to place injection at the very start of the chat section, effectively after all system-level content (char defs, personality, scenario). This is the closest equivalent to WI's "After Char Defs" that the extension API supports.
  - Changed default from "↓Main" (position 1) to "↓Char" (position 5) — "After char defs" has greater impact than "After system prompt" and matches what lorebook WI entries call "↓Char".
  - All fallback `?? 1` references updated to `?? 5` in `retrieve.js`, `settings.js`, `render.js`.

### BUG-9: EVENT_SCHEMA example missing temporal_anchor and is_transient fields
- **Files:** `src/prompts/events/schema.js`
- **Problem:** The JSON example in `EVENT_SCHEMA` (the authoritative "output this shape" shown to every extraction model) only listed 7 fields — `temporal_anchor` and `is_transient` were absent. While `EVENT_RULES` described both fields in prose and all few-shot examples included them, weaker/local models prioritize the example shape over rules text and omit any field not present in the schema example. This caused inconsistent `temporal_anchor: null` (missing entirely, not explicitly null) across extractions depending on model capability.
- **Fix:** Added `"temporal_anchor": null` and `"is_transient": false` to the JSON example, plus brief field definitions in the FIELD DEFINITIONS section. Now all models — regardless of instruction-following strength — see the fields in the canonical output shape.

---

## Personal Features (keep separate)

These are fork-only features. Isolate in dedicated files where possible.

### FEAT-1: Side Panel
- **New files (no merge conflict):**
  - `src/ui/side-panel.js` — Full panel logic with sidebar-scoped handlers for:
    - Compact memory cards (buttons beside date, character tag bubbles)
    - Memory edit/delete/save (full inline editing)
    - Entity edit/delete/merge (full CRUD with alias management)
    - Community edit/delete (sidebar-only feature, not in upstream)
  - `css/side-panel.css` — All sidebar styles
  - `templates/side_panel.html` — Panel HTML template
- **Upstream file touches (minimal, merge-safe):**
  - `index.js` — Init, toggle button binding, auto-open on load (~10 lines)
  - `src/ui/render.js` — 1 line: `import('./side-panel.js').then(...)` in `refreshAllUI()`
  - `style.css` — 1 line: `@import url("css/side-panel.css")`
- **Merge strategy:** Side panel files are entirely ours. All CRUD handlers are self-contained in `side-panel.js` — they don't depend on main panel event bindings. The 3 integration hooks in upstream files are minimal and easy to re-add if lost.

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

### ~~FEAT-5: Generate Reflections Button~~ (REMOVED)
- Removed — was broken dead code (wrong imports, missing HTML button).

### FEAT-6: Post-History Prompt Injection
- **Files:** `src/constants.js` (+`postHistoryPrompt` default), `src/retrieval/retrieve.js` (+injection logic), `src/ui/settings.js` (+binding + UI sync), `templates/settings_panel.html` (+textarea)
- **What it does:** Injects a user-defined prompt after all chat messages (IN_CHAT position, depth 0). Useful for steering model behavior with providers that need a trailing instruction to stay in character.
- **Status:** Complete. PR submitted upstream.
- **Merge strategy:** Touches 4 upstream files. Changes are small and additive.

### FEAT-7: Embedding Model Reset on Source Switch
- **Files:** `src/ui/settings.js`
- **What it does:** Calls `strategy.reset()` when embedding source changes (e.g. switching from transformers to ollama), so the new model loads fresh.
- **Merge strategy:** 3 lines in an existing event handler. Easy to re-add.

### FEAT-8: Worker Auto-Refresh UI
- **Files:** `src/extraction/worker.js`
- **What it does:** Calls `refreshAllUI()` after each successful worker extraction, so the main panel and sidebar update in real-time.
- **Merge strategy:** 2 lines (import + call). Easy to re-add.

### FEAT-9: Reasoning Model Recovery + Doubled Graph Token Budget
- **Files:** `src/llm.js` (response recovery), `src/llm.js` (`LLM_CONFIGS.extraction_graph.maxTokens`)
- **What it does:** Reasoning models (DeepSeek, Kimi, etc.) sometimes put all output in the `reasoning` field and leave `content` empty. This fix:
  1. Detects empty `content` with populated `reasoning` field
  2. Tries to extract a JSON block from the end of the reasoning text (for structured calls)
  3. Falls back to the full reasoning text for downstream parsing
  4. Doubles `extraction_graph` maxTokens from 8000 → 16000 so reasoning models have headroom for both CoT and structured output
- **Merge strategy:** Touches `src/llm.js` only. Could be PR'd — benefits all reasoning model users.

### FEAT-10: Extraction Message Sanitization (Think Blocks + Outgoing Regex)
- **New file (no merge conflict):** `src/utils/message-sanitizer.js` — all sanitization logic isolated here:
  - `sanitizeMessageContent(mes, isUser)` — strips think blocks + applies outgoing regex
  - `getSanitizedTokenCount(chat, index)` / `getSanitizedTokenSum(chat, indices)` — token counting on cleaned content (drop-in replacements for `tokens.js` functions)
  - `clearSanitizedTokenCache()` — clears the sanitized token cache on chat switch
  - Lazily imports ST's regex engine (`extensions/regex/engine.js`) — fails silently if unavailable
- **Upstream file touches (minimal):**
  - `src/extraction/extract.js` — 1 import + 1 call to `sanitizeMessageContent` in message formatting
  - `src/extraction/scheduler.js` — 1 import line changed: aliases `getSanitizedTokenCount`/`Sum` as `getMessageTokenCount`/`getTokenSum` so batch sizing uses cleaned content
  - `src/events.js` — 2 lines: import + call `clearSanitizedTokenCache()` alongside existing `clearTokenCache()`
- **Why:** Raw `m.mes` may contain think blocks that inflate token counts, causing more batches than necessary. Outgoing-prompt regex scripts (OOC removal, formatting fixes, token reduction) should apply to extraction just like they do to the main AI.
- **Bug fixed (2026-04-13):** UI budget bars in `status.js` and `settings.js` imported raw `getTokenSum` from `tokens.js` instead of `getSanitizedTokenSum` from `message-sanitizer.js`. The core scheduler used sanitized counts (so backfill correctly blocked when threshold wasn't met), but the bars displayed raw token counts — making the bar appear stuck/wrong. Also: the sanitized token cache keyed on `index + raw.length` which didn't change when regex scripts were toggled, so cached values persisted across regex changes. Added `refreshRegexFingerprint()` that detects active regex config changes and auto-clears the cache.
- **Merge strategy:** Core logic in new file. Only 3 upstream files touched with 1-2 line changes each.

### FEAT-11: Sidebar Reflection Badge
- **Files:** `src/ui/side-panel.js` (fork-owned — **zero upstream file changes**)
- **What it does:** Shows a `💡 Reflection` badge on reflection memories in the sidebar, displayed in the time anchor position (since reflections don't have time anchors). Regular memories still show the clock icon + anchor text as before.
- **Merge strategy:** Change is entirely within our fork-owned file. Will never conflict with upstream merges.

### FEAT-12: Frozen Initial Replies (Style Anchoring)
- **Files:** `src/constants.js` (+`frozenReplies` default), `src/events.js` (auto-hide skip), `src/retrieval/retrieve.js` (+`getFrozenAwareDepth` + injection depth), `src/ui/settings.js` (+binding), `templates/settings_panel.html` (+slider)
- **What it does:** Keeps the first N bot replies (and their interleaved user messages) always visible in chat, preventing auto-hide from removing them. When active, the `<scene_memory>` injection is placed right after the frozen messages instead of at the top of chat. This preserves the opening writing style as a permanent style anchor — OpenVault memories capture plot events but not prose style, so without this the model loses its tone reference as the conversation grows.
- **Merge strategy:** All changes are additive blocks, no existing logic modified. `constants.js`: +1 default, +1 hint. `events.js`: ~10 lines inserted after `visibleIndices` loop. `retrieve.js`: +1 helper function, +3 lines in `injectContext`. `settings_panel.html`: +6 lines. `settings.js`: +4 lines. Could be PR'd upstream.

### FEAT-14: Entity Context Injection (System Prompt)
- **Files:** `src/retrieval/entity-context.js` (NEW), `src/retrieval/retrieve.js` (+`_buildMinimalRetrievalContext`, modified `injectContext`), `src/constants.js`
- **What it does:** Injects relevant entity descriptions (characters, locations, items, organizations) into the system prompt area (↓Main / IN_PROMPT position), giving the LLM "who/what/where" reference knowledge before it reads any chat messages. Entities are selected by detecting mentions in recent chat via graph-anchored stem matching, then enriched with 1-hop connected entities from graph edges. Active characters are excluded (already in card definitions).
- **Design rationale:** Entities are static reference material (like Lorebook entries), while communities are dynamic thematic summaries. Entities belong at the system level; communities belong near/in chat. This separation mirrors how SillyTavern's own World Info uses "Before/After Char Defs" positions for reference data.
- **Merge strategy:** One new file (`entity-context.js`). `retrieve.js`: +1 helper function, ~12 lines added to `injectContext`. Could be PR'd upstream.

### FEAT-15: Shared Context Budget Pool (60/20/20 Split)
- **Files:** `src/constants.js` (+`BUDGET_RATIO_SCENE/ENTITY/WORLD`, removed `entityContextBudget`), `src/retrieval/retrieve.js` (modified `buildRetrievalContext` + `injectContext`)
- **What it does:** Replaces the separate fixed-cap budgets for scene memories, entities, and world context with a single shared pool derived from "Final Context Budget" (`retrievalFinalTokens`). The pool is split: **60% scene memories**, **20% entity context**, **20% world/communities**. With the default 10,000 pool this gives scene=6000, entity=2000, world=2000 tokens. With a 15,000 pool: scene=9000, entity=3000, world=3000.
- **Design rationale:** A single slider controls the total OpenVault injection footprint, making budget tuning intuitive. The 60/20/20 split prioritizes narrative memories (the largest and most dynamic block) while giving meaningful budgets to reference data (entities) and thematic context (communities). Ratios are exported constants, easy to adjust.
- **Merge strategy:** `constants.js`: +3 exported ratio constants, -1 setting. `retrieve.js`: ~6 lines changed in `buildRetrievalContext` to compute split, ~1 line in `injectContext`. Minimal diff, could be PR'd upstream.

### FEAT-13: Narrative Bridge for Hidden Message Gaps
- **Files:** `src/retrieval/retrieve.js` (+`countHiddenMessages`, +`prependGapNotice`, +`buildEmptyBridge`, modified `injectContext`)
- **What it does:** When auto-hide removes messages from the middle of chat, the LLM sees a jarring jump from frozen opening messages to recent messages with no explanation. This feature detects the gap (`openvault_hidden` flag) and handles two cases:
  - **With memories:** Prepends a notice inside the existing `<scene_memory>` block explaining that these memories summarize N hidden messages, telling the LLM to use them for narrative continuity.
  - **Without memories:** Injects a minimal `<scene_memory>` bridge at the cut point noting the gap and instructing the LLM to continue naturally.
- **Merge strategy:** Three private helper functions + ~10 lines added to `injectContext`. No existing logic modified, only the injection path is extended. Could be PR'd upstream alongside FEAT-12.

---

## Preferences (fork-only defaults)

### PREF-1: Language Migration (CN → EN at runtime)
- **Files:** `src/settings.js` (migration only — `constants.js` matches upstream)
- **What it does:** One-time migration in `loadSettings()` switches existing installs from CN to EN defaults. Defaults in `constants.js` are left as upstream's `cn` values to avoid merge conflicts.
- **Merge strategy:** Only touches `settings.js`. Will not conflict with `constants.js` merges.

### PREF-2: Hide Emotion Intensity Bar
- **Files:** `css/side-panel.css` (fork-owned — **zero upstream file changes**)
- **What it does:** Hides the `.openvault-emotion-bar` via `display: none`. Upstream hardcodes `emotion_intensity: 5` on character state creation and never updates it from LLM output, so every character permanently shows a 50% bar. The emotion text label is still displayed.
- **Merge strategy:** Single CSS rule in fork-owned file. Will never conflict with upstream merges.

### PREF-3: WebGPU Warning Suppression
- **Files:** `src/embeddings.js`
- **What it does:** Deletes `webgpu.powerPreference` to suppress a Chromium/Windows console warning (crbug.com/369219127).
- **Merge strategy:** Self-contained try/catch block. Could be PR'd.

### PREF-4: Embedding Warmup on Init
- **Files:** `index.js`
- **What it does:** Fires a dummy `getDocumentEmbedding('warmup')` call on extension init to eagerly load the transformers pipeline.
- **Merge strategy:** 3 lines at end of init. Easy to re-add.

### ~~PREF-5: .gitignore additions~~ (REMOVED)
- Reverted `.gitignore` to upstream defaults. Removed `sync-upstream.bat`.

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
10. [ ] `src/extraction/extract.js` still uses `sanitizeMessageContent` from `message-sanitizer.js` in message formatting
11. [ ] Extension loads without console errors
