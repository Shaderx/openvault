# OpenVault Fork Changes (Shaderx/openvault)

Tracks all differences between this fork and [upstream](https://github.com/vadash/openvault).
Use this document to manage merges, decide what to PR upstream, and avoid regressions.

Last audited against: `upstream/master` on 2026-04-22

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

### BUG-10: temporal_anchor not required and no date-vs-time priority
- **Files:** `src/prompts/events/schema.js`, `src/prompts/events/rules.js`, `src/store/schemas.js`
- **Problem:** Three issues with temporal_anchor handling:
  1. **Field marked optional in Zod:** `EventSchema` used `.nullable().optional().default(null)`, so the field could be omitted entirely from the JSON reply. Weaker models that skip optional fields would produce events with no `temporal_anchor` key at all.
  2. **Prompt didn't require the field:** Both `EVENT_SCHEMA` and `EVENT_RULES` described temporal_anchor as extract-if-present with `null` as default, but never stated the field itself must always appear in output.
  3. **No priority between date and time:** When message headers contain both a date and a bare time, or only one of the two, the prompt gave no guidance on which to prefer. A date ("Friday, June 14") is far more useful for temporal anchoring than a bare time ("3:40 PM"), but models treated them equally.
- **Fix:**
  - `schema.js`: Field definition now says "REQUIRED FIELD — always include in output" with date > time priority and examples.
  - `rules.js`: `<field_instructions>` section now has a numbered priority list (date+time → date only → time only → null) with explicit "A date alone is more valuable than a time alone."
  - `schemas.js`: Removed `.optional()` from `temporal_anchor` in `EventSchema` — now `z.string().nullable().default(null)` (required key, null value permitted).

### BUG-11: Memory/chat overlap when external extension hides messages
- **Files:** `src/retrieval/retrieve.js` — `_getHiddenMemories()`
- **Problem:** `_getHiddenMemories` used `Math.min` to check only the **oldest** source message in a memory's extraction batch. If that oldest message was hidden (`is_system = true`), the memory was injected — even when newer source messages from the same batch were still visible in chat. This caused overlapping content between injected `<scene_memory>` entries and visible chat messages, particularly noticeable when a third-party extension (not OpenVault's auto-hide) hides messages using ST's native `is_system` flag.
- **Fix:** Changed `Math.min` → `Math.max` on both code paths (fingerprint-based and legacy `message_ids`). Now checks the **newest** source message in the batch — a memory is only injectable when all of its source messages are hidden. Eliminates overlap regardless of which extension performs the hiding.

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

### FEAT-5: Generate Reflections Button (RE-IMPLEMENTED)
- **Files:** `src/ui/settings.js` (+`handleGenerateReflections`), `templates/settings_panel.html` (+button)
- **What it does:** Adds a "Generate Reflections Now" button in the Reflection Engine section. Bypasses the importance threshold and runs reflection generation for every character that has at least 3 event memories. Shows per-character progress in the button label, pauses 3s between characters for rate limiting, then saves and refreshes UI.
- **History:** Original FEAT-5 was removed as broken dead code. This is a clean reimplementation using the correct imports and data access patterns.
- **Merge strategy:** Handler is self-contained in `settings.js`. Button is 6 lines in the Reflection Engine `<details>` block. Easy to re-add after merge.

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

### FEAT-14: Entity Context Injection
- **Files:** `src/retrieval/entity-context.js` (NEW), `src/retrieval/retrieve.js` (+`_buildMinimalRetrievalContext`, modified `injectContext`), `src/constants.js`
- **What it does:** Injects relevant entity descriptions (characters, locations, items, organizations) as `<entity_context>` right before `<scene_memory>`, using the same injection position and depth (`memoryPosition` / `memoryDepth`). Entities are selected by detecting mentions in recent chat via graph-anchored stem matching, then enriched with 1-hop connected entities from graph edges. Active characters are excluded (already in card definitions).
- **History:** Originally injected at ↓Main (position 1, after system prompt). Moved to co-locate with scene_memory so entities and memories appear together in the prompt, respecting frozen-reply depth adjustments.
- **Merge strategy:** One new file (`entity-context.js`). `retrieve.js`: +1 helper function, ~12 lines added to `injectContext`. Could be PR'd upstream.

### FEAT-15: Demand-Based Context Budget Allocation
- **Files:** `src/constants.js` (`MAX_RATIO_ENTITY`, `MAX_RATIO_WORLD` soft caps), `src/retrieval/retrieve.js` (new `_buildEntityText`, `_buildWorldText` helpers; rewritten `selectFormatAndInject` pipeline; simplified `injectContext`), `src/events.js` (fixed schema migration gate)
- **What it does:** Replaces the rigid 60/20/20 fixed-ratio budget split with demand-based allocation. Entity and world context are built first (each with a 20% soft cap), their actual token usage is measured, and scene_memory gets all remaining tokens. With a 15,000 pool and typical entity (400 tokens) + world (800 tokens) usage, scene gets ~13,800 tokens instead of the previous fixed 9,000.
- **Pipeline order:** (1) Build entity context with cap → measure actual tokens, (2) Build world context with cap → measure actual tokens, (3) sceneBudget = totalPool - entityActual - worldActual, (4) Score & select memories with dynamic sceneBudget, (5) Format memories, (6) Inject all three.
- **Also fixes:** Schema migration gate in `events.js` was hardcoded to `schema_version < 2`, preventing V3+ migrations (fingerprint backfill) from running. Changed to `< CURRENT_SCHEMA_VERSION`.
- **Design rationale:** The old fixed split wasted tokens — entity context typically uses 200-500 tokens and world context 300-1000, but each reserved 20% (3,000 tokens at 15k pool). The unused budget was lost to scene_memory, starving "The Story So Far" summaries. Demand-based allocation lets scene absorb whatever entity and world don't need.

### FEAT-16: Reflection Quality Overhaul (Dynamic Importance + Richer Context)
- **Files:** `src/reflection/reflect.js`, `src/prompts/reflection/builder.js`, `src/prompts/reflection/schema.js`, `src/prompts/reflection/examples/en.js`, `src/prompts/reflection/examples/ru.js`, `src/extraction/structured.js`, `src/constants.js`
- **Problems fixed:**
  1. **Hardcoded importance:** All reflections were created with `importance: 4` regardless of content. The LLM was never asked to rate importance.
  2. **No context window budget:** Reflection candidate selection used a fixed count (`REFLECTION_CANDIDATE_LIMIT = 50`) with no token awareness. Long memories could silently overflow context.
  3. **Missing character context:** The reflection prompt received only memory summaries — no character description, no dedicated view of existing reflections.
- **Changes:**
  - **LLM-rated importance (1-5):** Added `importance` field to the reflection output schema (Zod `.catch(4)` for backward compat), prompt schema, and all 10 few-shot examples (EN+RU). The LLM now rates each insight using a durability scale (5=core identity, 1=fleeting observation). Code clamps to 1-5 with fallback to 4.
  - **Token-budgeted context (`reflectionContextTokens: 20000`):** New setting replaces count-based selection. Budget splits 80/20 between recent events and existing reflections, using `sliceToTokenBudget` for both. Removed `REFLECTION_CANDIDATE_LIMIT` import.
  - **Character description injection:** Passes the character card description into the prompt via `<character_description>` XML section, giving the LLM grounding on who the character is.
  - **Dedicated `<existing_reflections>` section:** Previous insights for the character are shown separately from candidate memories, with explicit instruction to build on them or identify contradictions rather than repeat.
- **Merge strategy:** Touches 7 files, all upstream-adjacent. Schema/examples changes are additive. The `buildUnifiedReflectionPrompt` signature gained 2 new params (`existingReflections`, `characterDescription`) — any upstream callers would need updating.

### FEAT-17: Character Rename (Propagated to Tags)
- **Files:** `src/store/chat-data.js` (+`renameCharacter`), `src/ui/templates.js` (+`renderCharacterStateEdit`, modified `renderCharacterState`), `src/ui/render.js` (+`initCharacterEditBindings`, +`handleCharacterRename`), `src/ui/side-panel.js` (+character rename bindings, +`handleSideCharacterRename`), `css/world.css` (+character edit styles)
- **What it does:** Adds a rename button (pencil icon, visible on hover) to each character state card in both the settings panel and sidebar. Clicking it shows an inline text input. On save, `renameCharacter(oldName, newName)` propagates the change to:
  1. `character_states` key
  2. `reflection_state` key
  3. `characters_involved` on every memory
  4. `witnesses` on every memory
  5. Matching graph `PERSON` entity (if one exists) — reuses existing `updateEntity` rename logic (edges, merge redirects, embeddings)
- **Why:** When the LLM misspells or misnames a character during extraction, all subsequent memories carry the wrong name in their character tags. Previously there was no way to fix this without manually editing chat metadata.
- **Merge strategy:** Store function is self-contained. Template change adds a wrapper div + button to existing `renderCharacterState`. Event bindings are additive in both `render.js` and `side-panel.js`. CSS is in upstream-owned `world.css` but non-conflicting (new selectors only).

### FEAT-18: OpenAI-Compatible Embedding API
- **Files:** `src/constants.js` (+`OPENAI_API` source, +3 default settings), `src/embeddings.js` (+`OpenAICompatibleStrategy` class, +`testOpenAIApiConnection` export, updated 5 call sites), `templates/settings_panel.html` (+dropdown option, +settings section), `src/ui/settings.js` (+bindings, +test handler, +PRESERVED_KEYS, +updateUI sync)
- **What it does:** Adds a new "OpenAI-Compatible API" embedding source that calls the standard `/v1/embeddings` endpoint. Configurable via three fields: API Base URL, API Key, and Model Name. Compatible with OpenAI, Together AI, Voyage AI, Mistral, and any provider implementing the OpenAI embeddings format. Includes a "Test" button to verify connectivity. Settings survive reset (added to `PRESERVED_KEYS`). Switching to/from this source triggers the standard embedding invalidation and auto-backfill flow.
- **Settings added:** `embeddingApiUrl`, `embeddingApiKey`, `embeddingApiModel`
- **Merge strategy:** `constants.js`: +1 enum value, +3 defaults. `embeddings.js`: new class + 1-line registry entry + 3 extra options per call site (non-breaking — other strategies ignore unknown options). `settings_panel.html`: +1 `<option>`, +1 settings `<div>`. `settings.js`: +15 lines bindings, +30 lines test handler. All additive, no existing logic modified.

### FEAT-19: Disable "Present:" Character Injection (NPC Detection Broken)
- **Files:** `src/retrieval/formatting.js` (removed `formatPresent` helper + all `presentLine` usage), `src/retrieval/retrieve.js` (removed `activeCharacters.filter` → passes `[]`)
- **What it does:** Removes the `Present: Bob, Charlie` line from the `## Current Scene` bucket inside `<scene_memory>`. The line was built from SillyTavern's group chat `activeCharacters` API, which does not reliably detect which NPCs are present in the current scene.
- **What is NOT removed:** All character tracking, state management, and emotional injection remain fully intact:
  - Extraction still populates `characters_involved`, `witnesses`, and `character_states` with emotions per memory
  - Scoring still boosts memories by `primaryCharacter` relevance
  - Entity context still uses `activeCharacters` for filtering entity injection
  - `formatEmotionalTrajectory` still renders `Emotions:` line when `characterEmotions` is provided
  - `renameCharacter` and all CRUD operations on character states are unchanged
- **Signature preserved:** `formatContextForInjection` still accepts a `presentCharacters` parameter (as `_presentCharacters`) to avoid breaking any external callers — the parameter is simply ignored.
- **Temp fix:** This is a workaround until NPC presence detection is improved. The parameter can be re-enabled by restoring the `formatPresent` helper and wiring `presentCharacters` back through.
- **Merge strategy:** Only 2 files touched. Changes are subtractive (removal), easy to revert.

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

### PREF-4: Boot Stage Logging + APP_READY Safety Net
- **Files:** `index.js`
- **What it does:** Two changes:
  1. **Boot stage logging:** Adds `[OpenVault:boot] Stage N` console.log messages at each init step. Stages:
     - `0` — Module evaluation start (before static imports resolve)
     - `1` — Static imports resolved, module body executing
     - `2` — jQuery DOM-ready fired
     - `3` — `getDeps()` OK, registering `APP_READY` listener
     - `4` — Init starting (logs whether triggered by `APP_READY` or `fallback-timer`)
     - `5` — Version check passed
     - `6` — `loadSettings()` complete (settings panel HTML loaded)
     - `7` — `registerCommands()` complete
     - `8` — Side panel initialized
     - `9` — Perf data loaded
     - `10` — **INIT COMPLETE** ✓
     - Failed stages log `FAILED at Stage N` with the error.
  2. **APP_READY safety net:** If SillyTavern's init pipeline stalls before emitting `APP_READY` (observed: other extensions or ST core init steps can hang/throw, blocking all downstream events), a 15-second fallback timer self-initializes the extension. The init function is guarded (`_initDone` flag) so it only runs once — whichever trigger arrives first wins.
- **Why:** Diagnosed that the extension loads fine (stages 0–3) but `APP_READY` sometimes never fires because SillyTavern's `firstLoadInit` has ~35 init steps between `activateExtensions()` and the `APP_READY` emit. Any one of those hanging kills the event.
- **Merge strategy:** Init logic extracted to `initExtension()` function. ~40 lines added to `index.js`. No upstream logic changes.
- **Constant:** `FALLBACK_TIMEOUT_MS = 15000` (15 seconds). Tunable if needed.

### ~~PREF-4-OLD: Loading Order Priority~~ (REVERTED)
- Reverted to upstream `loading_order: 100`. No longer needed.

### ~~PREF-4-OLD: Embedding Warmup on Init~~ (REMOVED)
- Removed the dummy `getDocumentEmbedding('warmup')` call on extension init.

### ~~PREF-5: .gitignore additions~~ (REMOVED)
- Reverted `.gitignore` to upstream defaults. Removed `sync-upstream.bat`.

---

## Merge Checklist

After every `git merge upstream/master`, verify:

1. [ ] `style.css` still has `@import` for `entities.css`, `entity-crud.css`, `side-panel.css`
2. [ ] `src/ui/render.js` `refreshAllUI()` still calls `refreshSidePanel()` via lazy import
3. [ ] `index.js` still inits side panel and binds toggle
4. [ ] `templates/settings_panel.html` still has Reset & Backfill button + Generate Reflections button
5. [ ] `src/ui/settings.js` still has `handleResetAndBackfill`, `handleGenerateReflections`, and button bindings
6. [ ] `src/extraction/extract.js` still has `rpmDelay` before Phase 2 calls + `sanitizeMessageContent` in message formatting + `getLastApiCallTime`/`setLastApiCallTime` imports from state.js
7. [ ] `src/state.js` still has `lastApiCallTime` exports
8. [ ] `src/llm.js` still calls `setLastApiCallTime` after responses
9. [ ] No duplicate function declarations or imports (check `git diff --check` for conflict markers)
10. [ ] `src/extraction/scheduler.js` still imports sanitized token functions from `message-sanitizer.js` (not raw from `tokens.js`)
11. [ ] `src/extraction/worker.js` has single `refreshAllUI` import (no duplicates)
12. [ ] `src/ui/settings.js` `onProgress` callbacks match 5-param signature `(batchNum, totalBatches, progressPercent, eventsCreated, retryText)`
13. [ ] `src/prompts/reflection/examples/*.js` — all examples have both CoD-style thinking AND `importance` field in output JSON
14. [ ] `src/extraction/structured.js` — `UnifiedReflectionSchema` has `importance` field
15. [ ] `src/store/chat-data.js` still exports `renameCharacter`
16. [ ] `src/ui/templates.js` still exports `renderCharacterStateEdit` and `renderCharacterState` includes edit button
17. [ ] `src/ui/render.js` still calls `initCharacterEditBindings()` in `initBrowser()`
18. [ ] `src/ui/side-panel.js` still has character rename bindings in `bindSidePanelEvents()`
19. [ ] `src/embeddings.js` still has `OpenAICompatibleStrategy` registered in `strategies` map and `testOpenAIApiConnection` export
20. [ ] `src/ui/settings.js` still has `handleOpenAIApiTestClick`, OpenAI API field bindings, and `embeddingApiUrl/Key/Model` in `PRESERVED_KEYS`
21. [ ] `templates/settings_panel.html` still has `openai_api` option in embedding source dropdown and `#openvault_openai_api_settings` section
22. [ ] Extension loads without console errors
