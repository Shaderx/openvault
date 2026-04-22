# Extraction Turn Limit Implementation Plan

**Goal:** Add a new "Max Turns per Batch" slider that caps the number of conversation turns sent to the LLM per extraction call, complementing the existing token budget. The app picks whichever threshold is hit first.
**Testing Conventions:** Unit tests for pure logic (no `vi.mock()`). Use factory helpers (`makeChat`, `makeMessage`, `makeData`) from existing `tests/extraction/scheduler.test.js`. Use `it.each()` for parameterized cases.

---

### Task 1: Add `countTurns` utility and `extractionMaxTurns` default

**Objective:** Add the turn-counting helper function to `tokens.js` and register the new setting with its default value.

**Files to modify/create:**
- Modify: `src/utils/tokens.js` (Purpose: Add `countTurns(chat, messageIds)` — counts complete User+Bot turns in a message ID list)
- Modify: `src/constants.js` (Purpose: Add `extractionMaxTurns: 30` to `defaultSettings`, add hint to `UI_DEFAULT_HINTS`)
- Test: `tests/utils/tokens.test.js` (Create if missing, or append to existing — check with Glob first)

**Instructions for Execution Agent:**
1. **Context Setup:** Read the outlines of `src/utils/tokens.js` and `src/constants.js` (lines 55–65 for defaults, lines 238–255 for hints). Also check if `tests/utils/tokens.test.js` exists.
2. **Write Failing Test:** Test `countTurns` — cases: empty list returns 0, single User message returns 0 (incomplete turn), one full User+Bot pair returns 1, interleaved system messages are skipped, multiple turns counted correctly.
3. **Implement Minimal Code:**
   - In `src/utils/tokens.js`, add `countTurns(chat, messageIds)` that walks the IDs, skips `is_system` messages, and increments a counter each time it sees a Bot message (non-user, non-system) — that marks one complete turn. The function mirrors the logic in `snapToTurnBoundary` (which also walks forward looking for Bot→User boundaries).
   - In `src/constants.js`, add `extractionMaxTurns: 30` to `defaultSettings` right after `extractionRearviewTokens: 6000`.
   - In `src/constants.js`, add `extractionMaxTurns: defaultSettings.extractionMaxTurns` to `UI_DEFAULT_HINTS` in the Extraction section.
4. **Verify:** Run `npx vitest run tests/utils/` and ensure tests pass.
5. **Commit:** `feat(extraction): add countTurns utility and extractionMaxTurns default`

---

### Task 2: Thread `maxTurns` through `getNextBatch`, `isBatchReady`, and `getExtractionBudgetProgress`

**Objective:** Modify the scheduler functions to accept and enforce a turn limit alongside the token budget. The app stops accumulating messages when either the token budget OR the turn limit is reached, whichever comes first.

**Files to modify/create:**
- Modify: `src/extraction/scheduler.js` (Purpose: Add `maxTurns` parameter to `getNextBatch`, `isBatchReady`, `getExtractionBudgetProgress`)
- Test: `tests/extraction/scheduler.test.js`

**Instructions for Execution Agent:**
1. **Context Setup:** Read `src/extraction/scheduler.js` fully (it's small — ~220 lines). Read `tests/extraction/scheduler.test.js` lines 255–400 to understand token-based test patterns.
2. **Write Failing Test:** In `tests/extraction/scheduler.test.js`, add a new `describe('getNextBatch (turn-limited)')` block:
   - Batch with 5 turns, token budget unlimited, turn limit 2 → returns exactly 2 turns
   - Batch with 5 turns, token budget very low (stops early), turn limit 10 → token budget wins
   - `isBatchReady` returns true when enough turns exist even if tokens are low
   - `isBatchReady` returns false when neither threshold met
   - Emergency Cut bypasses turn limit (same as token bypass)
3. **Implement Minimal Code:**
   - `getNextBatch(chat, data, tokenBudget, isEmergencyCut = false, maxTurns = Infinity)`:
     - In the accumulation loop, after pushing each ID and updating `currentSum`, check: `if (!isEmergencyCut && countTurns(chat, accumulated) >= maxTurns) break;`
     - Import `countTurns` from `../utils/tokens.js`
   - `isBatchReady(chat, data, tokenBudget, maxTurns = Infinity)`: Check turn count alongside token sum: `return getTokenSum(...) >= tokenBudget || countTurns(chat, unextractedIds) >= maxTurns;`
   - `getExtractionBudgetProgress(chat, data, tokenBudget, maxTurns = Infinity)`: Add `unextractedTurns` and `turnPct` to the return value (for future UI use — the slider hasn't been added yet, but the data should be available).
4. **Verify:** Run `npx vitest run tests/extraction/scheduler.test.js` and ensure all existing and new tests pass.
5. **Commit:** `feat(scheduler): thread maxTurns through getNextBatch and isBatchReady`

---

### Task 3: Wire `extractionMaxTurns` through callers — worker, extract, backfill

**Objective:** Pass the new setting from all call sites that invoke `getNextBatch`, `isBatchReady`, or `getExtractionBudgetProgress`.

**Files to modify/create:**
- Modify: `src/extraction/worker.js` (Purpose: Read `extractionMaxTurns` from settings, pass to `getNextBatch`)
- Modify: `src/extraction/extract.js` (Purpose: Pass `maxTurns` to `getNextBatch` at both call sites — line ~931 and line ~1264)
- Modify: `src/ui/status.js` (Purpose: Pass `maxTurns` to `getExtractionBudgetProgress` around line 137)

**Instructions for Execution Agent:**
1. **Context Setup:** Read the outlines of `worker.js`, `extract.js`, and `status.js`.
2. **Write Failing Test:** No new test file — the existing integration tests cover these call sites. The changes are pure wiring (reading a setting and passing it as a parameter). Verify by running the existing test suite.
3. **Implement Minimal Code:**
   - In `worker.js` (~line 106): Add `const maxTurns = settings.extractionMaxTurns || Infinity;` next to the existing `tokenBudget` line. Update the `getNextBatch` call to pass `maxTurns` as the 5th argument: `getNextBatch(chat, data, tokenBudget, false, maxTurns)`.
   - In `extract.js` (~line 931): Same pattern — read `settings.extractionMaxTurns`, pass to `getNextBatch`.
   - In `extract.js` (~line 1264, backfill): Read `extractionMaxTurns` and pass to `getNextBatch`.
   - In `status.js` (~line 137): Pass `maxTurns` to `getExtractionBudgetProgress`.
4. **Verify:** Run `npx vitest run` to ensure nothing is broken.
5. **Commit:** `feat(extraction): wire extractionMaxTurns through worker and extract callers`

---

### Task 4: Add slider UI, settings binding, reset, and payload calculator

**Objective:** Add the "Max Turns per Batch" slider to the settings panel, wire it to the settings system, include it in reset logic, and mention it in the payload calculator breakdown.

**Files to modify/create:**
- Modify: `templates/settings_panel.html` (Purpose: Add slider between extraction batch size and context window size)
- Modify: `src/ui/settings.js` (Purpose: Add `bindSetting`, `updateUI` sync, add to `RESETTABLE_KEYS`)
- Modify: `src/ui/status.js` (Purpose: Read `extractionMaxTurns` for batch progress if needed)
- Test: `tests/ui/settings.test.js` or `tests/ui/ui-helpers.test.js` (check which exists — may need to add slider structure tests)

**Instructions for Execution Agent:**
1. **Context Setup:** Read `templates/settings_panel.html` lines 340–390 (extraction section). Read `src/ui/settings.js` lines 430–460 (RESETTABLE_KEYS), lines 630–660 (bindSetting calls), lines 925–950 (updateUI).
2. **Write Failing Test:** Add a UI structure test verifying the new slider HTML exists with correct id `openvault_extraction_max_turns`, min 10, max 100, step 1.
3. **Implement Minimal Code:**
   - **HTML** (`settings_panel.html`): Insert between the extraction batch size hint and the context window size label:
     ```html
     <label for="openvault_extraction_max_turns">
         Max Turns per Batch: <span id="openvault_extraction_max_turns_value">30</span> turns
         <small class="openvault-default-hint" data-default-key="extractionMaxTurns"></small>
     </label>
     <input type="range" id="openvault_extraction_max_turns" min="10" max="100" step="1" />
     <small class="openvault-hint">Maximum conversation turns per extraction call. LLMs degrade when processing too many semantically dense exchanges — this caps the count regardless of token budget. The batch stops at whichever limit is hit first</small>
     ```
   - **Settings binding** (`src/ui/settings.js`): Add after the `extraction_token_budget` bindSetting call (~line 644):
     `bindSetting('extraction_max_turns', 'extractionMaxTurns', 'int', () => updatePayloadCalculator());`
   - **Update UI sync** (`src/ui/settings.js` ~line 930): Add:
     ```js
     $('#openvault_extraction_max_turns').val(settings.extractionMaxTurns);
     $('#openvault_extraction_max_turns_value').text(settings.extractionMaxTurns);
     ```
   - **Reset** (`src/ui/settings.js`): Add `'extractionMaxTurns'` to `RESETTABLE_KEYS` array.
4. **Verify:** Run `npx vitest run` and ensure all tests pass. Open the settings panel in browser and verify the slider appears with correct range.
5. **Commit:** `feat(ui): add Max Turns per Batch slider with settings wiring`
