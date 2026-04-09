# Test Suite Pruning — Option C: Balanced (~20% / 3,500 lines)

**Goal:** Remove low-value tests (~3,500 lines / 20% of suite) while preserving safety nets for critical algorithms.

**Architecture:** Tests follow the pyramid: Unit (pure math, no mocks), UI Structure (regex HTML parsing), Integration (full pipeline with `setupTestContext`). We keep all Unit tests for core algorithms and prune redundant/trivial tests.

**Tech Stack:** Vitest, jsdom for DOM tests, manual mocks via `setupTestContext`.

---

## File Structure Overview

**Delete entirely (7 files, ~950 lines):**
- `tests/unit/settings.test.js` - lodash delegation wrapper tests
- `tests/store/schemas.test.js` - Zod validation tautologies
- `tests/scripts/generate-types.test.js` - build artifact check
- `tests/utils/logging.test.js` - console.log wrapper tests
- `tests/utils/dom.test.js` - trivial escapeHtml tests
- `tests/perf/tab.test.js` - DOM rendering for perf table
- `tests/integration/injection.test.js` - heavily mocked integration

**Prune partially (8 files, ~2,500 lines):**
- `tests/ui/structure.test.js` - remove ~150 lines of redundant HTML string checks
- `tests/ui/settings-helpers.test.js` - remove ~200 lines of jQuery mock tests
- `tests/prompts/resolvers.test.js` - delete entirely (overlaps with format.test.js)
- `tests/prompts/format.test.js` - keep 4 tests, remove 8
- `tests/perf/instrumentation.test.js` - keep 1 test, remove 3
- `tests/perf/store.test.js` - keep 2 tests, remove 7
- `tests/retrieval/debug-cache.test.js` - keep 1 test, remove 2
- `tests/utils/embedding-codec.test.js` - keep 4 roundtrip tests, remove 9

---

## Task 1: Delete Low-Value Unit Test Files

**Files:**
- Delete: `tests/unit/settings.test.js`
- Delete: `tests/store/schemas.test.js`
- Delete: `tests/scripts/generate-types.test.js`
- Delete: `tests/utils/logging.test.js`
- Delete: `tests/utils/dom.test.js`

**Purpose:** Remove tests that:
- Test library wrappers (lodash get/set/has/merge)
- Test Zod validation constraints (tautological - Zod handles this)
- Test build artifacts (generated types file)
- Test console.log wrappers with prefixes
- Test trivial HTML escaping

**Common Pitfalls:**
- Do NOT delete `tests/unit/` directory itself - keep it for future unit tests
- These are the only files in these locations, so no imports to update

- [ ] Step 1: Delete settings.test.js

Run: `git rm tests/unit/settings.test.js`
Expected: File removed, ~153 lines deleted

- [ ] Step 2: Delete schemas.test.js

Run: `git rm tests/store/schemas.test.js`
Expected: File removed, ~68 lines deleted

- [ ] Step 3: Delete generate-types.test.js

Run: `git rm tests/scripts/generate-types.test.js`
Expected: File removed, ~22 lines deleted

- [ ] Step 4: Delete logging.test.js

Run: `git rm tests/utils/logging.test.js`
Expected: File removed, ~214 lines deleted

- [ ] Step 5: Delete dom.test.js

Run: `git rm tests/utils/dom.test.js`
Expected: File removed, ~43 lines deleted

- [ ] Step 6: Run tests to ensure suite still passes

Run: `npm test`
Expected: All tests pass (56 files -> 51 files)

- [ ] Step 7: Commit

```bash
git commit -m "chore: prune low-value unit tests (settings, schemas, logging, dom)"
```

---

## Task 2: Delete Low-Value Integration and Perf Files

**Files:**
- Delete: `tests/integration/injection.test.js`
- Delete: `tests/perf/tab.test.js`

**Purpose:**
- injection.test.js: Heavily mocked integration test with 13+ vi.doMock calls. Tests mocked function calls, not actual integration.
- tab.test.js: Tests DOM rendering for performance table. Low-value UI test with jsdom setup.

- [ ] Step 1: Delete injection.test.js

Run: `git rm tests/integration/injection.test.js`
Expected: File removed, ~167 lines deleted

- [ ] Step 2: Delete tab.test.js

Run: `git rm tests/perf/tab.test.js`
Expected: File removed, ~71 lines deleted

- [ ] Step 3: Run tests to verify suite passes

Run: `npm test`
Expected: All tests pass (51 files -> 49 files)

- [ ] Step 4: Commit

```bash
git commit -m "chore: prune mocked integration and low-value perf DOM tests"
```

---

## Task 3: Delete Overlapping Prompt Tests

**Files:**
- Delete: `tests/prompts/resolvers.test.js`

**Purpose:**
- resolvers.test.js: Tests language detection in prompts. 6 tests that overlap significantly with format.test.js coverage.
- The builder functions tested here are already covered by format.test.js and topology.test.js.

**Common Pitfalls:**
- No imports reference this file directly, safe to delete

- [ ] Step 1: Delete resolvers.test.js

Run: `git rm tests/prompts/resolvers.test.js`
Expected: File removed, ~69 lines deleted

- [ ] Step 2: Run tests to verify

Run: `npm test`
Expected: All tests pass (49 files -> 48 files)

- [ ] Step 3: Commit

```bash
git commit -m "chore: prune overlapping prompt resolver tests"
```

---

## Task 4: Prune UI Structure Tests (Remove Redundant HTML Checks)

**Files:**
- Modify: `tests/ui/structure.test.js`

**Purpose:**
- This file has 302 lines testing HTML template structure via regex/string matching.
- Many tests verify simple containment (e.g., `expect(html).toContain('Quick Toggles')`).
- We will remove ~150 lines of redundant checks while keeping core structural validations.

**Tests to Remove:**
1. Dashboard tab: "has Status Card visible (not in details)" - checks CSS class
2. Dashboard tab: "has collapsible details for Connection Settings" - checks HTML tags exist
3. Advanced tab: "has warning banner before any settings" - checks ordering
4. Advanced tab: "has Scoring & Weights in collapsible details" - checks string containment
5. Advanced tab: "has Decay Math section" - checks string containment
6. Advanced tab: "has Similarity Thresholds section" - checks string containment
7. Memories tab: "has Memory Browser before any settings" - checks ordering
8. Memories tab: "has Character States section in collapsible details" - checks HTML structure
9. Memories tab: "has Extraction & Context section" - checks string containment
10. Memories tab: "has Reflection Engine section" - checks string containment
11. Tab Structure: "has no World tab" - checks negative (no "data-tab=world")
12. Progressive Disclosure: "has all 6 tabs" - counts HTML elements
13. Progressive Disclosure: "Entities has no visible range inputs" - complex line-by-line parsing

**Tests to Keep:**
- "has Emergency Cut button in Extraction Progress card" - critical safety feature
- "has Emergency Cut modal at correct location" - critical safety feature
- "renames reset button to clarify scope" - user-facing text
- "correct entity type options" - validates business logic
- "does not have invalid entity types" - security/validation
- "Dashboard has Quick Toggles before collapsible sections" - UX ordering
- "Memories has browser before settings" - UX ordering
- "Advanced has warning banner" - safety warning

- [ ] Step 1: Read current structure.test.js

Run: `cat tests/ui/structure.test.js`
Expected: Full file content for editing

- [ ] Step 2: Remove redundant test blocks

Edit `tests/ui/structure.test.js`:
- Remove "has Status Card visible (not in details)" test block (lines ~35-46)
- Remove "has collapsible details for Connection Settings" test block
- Remove "has warning banner before any settings" from Advanced tab
- Remove "has Scoring & Weights in collapsible details"
- Remove "has Decay Math section"
- Remove "has Similarity Thresholds section"
- Remove "renames reset button to clarify scope" (this is config, not structure)
- Remove "has Character States section in collapsible details"
- Remove "has Extraction & Context section"
- Remove "has Reflection Engine section"
- Remove "renamed Extraction Token Budget to Extraction Batch Size" (config change)
- Remove "has no World tab" (negative assertion, low value)
- Remove "has Graph Stats Card in Entities tab" (negative assertion)
- Remove "has no visible sliders/inputs in Entities tab" (complex regex parsing)
- Remove "has all 6 tabs" count test
- Remove "Entities has no visible range inputs" (complex line parsing)

- [ ] Step 3: Run tests to verify remaining tests pass

Run: `npm test tests/ui/structure.test.js`
Expected: Remaining ~12 tests pass

- [ ] Step 4: Commit

```bash
git add tests/ui/structure.test.js && git commit -m "chore: prune redundant HTML structure tests"
```

---

## Task 5: Prune Settings Helpers Tests (Reduce jQuery Mocking)

**Files:**
- Modify: `tests/ui/settings-helpers.test.js`

**Purpose:**
- 285 lines of heavy jQuery mocking for modal helpers.
- Tests implementation details (keydown handlers, CSS classes) rather than behavior.
- Remove ~200 lines while keeping core modal behavior tests.

**Tests to Remove:**
1. "binds keydown trap that blocks events outside modal" - tests internal jQuery event binding
2. "allows Tab and Enter inside modal without blocking" - tests internal event routing
3. "Escape key triggers cancel button click if not disabled" - tests internal key handler
4. "adds hidden class and removes keydown handler" - tests implementation details
5. All tests in "updateEmergencyCutProgress" - simple DOM update
6. All tests in "disableEmergencyCutCancel" - simple DOM update

**Tests to Keep:**
- "appends modal to body and removes hidden class" - core behavior
- "shows modal and hides modal" - integration

- [ ] Step 1: Read current settings-helpers.test.js

Run: `cat tests/ui/settings-helpers.test.js`
Expected: File content for editing

- [ ] Step 2: Remove redundant test blocks

Edit `tests/ui/settings-helpers.test.js`:
- Keep only 2-3 core tests for modal show/hide
- Remove detailed keydown handler tests
- Remove progress bar update tests
- Remove cancel button disable tests

- [ ] Step 3: Run tests

Run: `npm test tests/ui/settings-helpers.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/ui/settings-helpers.test.js && git commit -m "chore: prune jQuery mock tests from settings helpers"
```

---

## Task 6: Prune Prompt Format Tests

**Files:**
- Modify: `tests/prompts/format.test.js`

**Purpose:**
- 124 lines testing XML tag wrapping for examples.
- Keep core formatting tests, remove edge cases that don't add value.

**Tests to Remove:**
1. "wraps input in <input> tags" - tested by first test
2. "wraps output in <ideal_output> tags" - tested by first test
3. "separates examples with double newline" - formatting detail
4. All language filtering tests except one sample

**Tests to Keep:**
- "wraps each example in numbered XML tags" - core behavior
- "includes thinking block when thinking field is present" - core behavior
- "omits thinking block when thinking field is absent" - core behavior
- "numbers multiple examples sequentially" - core behavior
- One language filtering test

- [ ] Step 1: Read current format.test.js

Run: `cat tests/prompts/format.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/prompts/format.test.js`:
- Keep ~4 core formatting tests
- Remove ~8 tests covering minor variations

- [ ] Step 3: Run tests

Run: `npm test tests/prompts/format.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/prompts/format.test.js && git commit -m "chore: prune redundant prompt format tests"
```

---

## Task 7: Prune Prompt Topology Tests

**Files:**
- Modify: `tests/prompts/topology.test.js`

**Purpose:**
- 126 lines testing that system vs user prompts have correct structure.
- Remove redundant topology checks while keeping one per prompt type.

**Tests to Remove:**
- "graph: schema and rules in user prompt" - redundant pattern
- "edge consolidation: schema and rules in user prompt" - redundant pattern
- "reflection: schema and rules in user prompt" - redundant pattern
- "community: schema and rules in user prompt" - redundant pattern
- "global synthesis: schema and rules in user prompt" - redundant pattern
- "user prompts contain task-specific rules" - detail
- "system prompts still contain <examples>" - detail

**Tests to Keep:**
- "events: schema and rules in user prompt, not system" - representative test
- "all builders default to auto" - default behavior

- [ ] Step 1: Read topology.test.js

Run: `cat tests/prompts/topology.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/prompts/topology.test.js`:
- Keep 2-3 representative tests
- Remove 5 redundant pattern tests

- [ ] Step 3: Run tests

Run: `npm test tests/prompts/topology.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/prompts/topology.test.js && git commit -m "chore: prune redundant prompt topology tests"
```

---

## Task 8: Prune Perf Instrumentation Tests

**Files:**
- Modify: `tests/perf/instrumentation.test.js`

**Purpose:**
- 92 lines testing that metrics get recorded.
- Keep one representative test, remove 3.

**Tests to Remove:**
1. "scoreMemories records memory_scoring metric" - side effect test
2. "filterSimilarEvents records event_dedup metric" - side effect test
3. "saveOpenVaultData records chat_save metric" - side effect test

**Tests to Keep:**
- "autoHideOldMessages records auto_hide metric" - one representative instrumentation test

- [ ] Step 1: Read instrumentation.test.js

Run: `cat tests/perf/instrumentation.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/perf/instrumentation.test.js`:
- Keep first test block only
- Remove 3 other metric recording tests

- [ ] Step 3: Run tests

Run: `npm test tests/perf/instrumentation.test.js`
Expected: Remaining test passes

- [ ] Step 4: Commit

```bash
git add tests/perf/instrumentation.test.js && git commit -m "chore: prune redundant perf instrumentation tests"
```

---

## Task 9: Prune Perf Store Tests

**Files:**
- Modify: `tests/perf/store.test.js`

**Purpose:**
- 79 lines testing in-memory perf store operations.
- Simple get/set operations - keep 2, remove 7.

**Tests to Keep:**
1. "record() stores a metric and getAll() returns it" - core behavior
2. "formatForClipboard() produces readable text" - user-facing output

**Tests to Remove:**
- "record() overwrites previous value"
- "record() persists to chatMetadata"
- "getAll() returns empty object"
- "loadFromChat() hydrates store"
- "loadFromChat() clears previous data"
- "formatForClipboard() returns placeholder"
- "record() ignores unknown metric IDs"

- [ ] Step 1: Read store.test.js

Run: `cat tests/perf/store.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/perf/store.test.js`:
- Keep 2 core tests
- Remove 7 implementation detail tests

- [ ] Step 3: Run tests

Run: `npm test tests/perf/store.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/perf/store.test.js && git commit -m "chore: prune redundant perf store tests"
```

---

## Task 10: Prune Debug Cache Tests

**Files:**
- Modify: `tests/retrieval/debug-cache.test.js`

**Purpose:**
- 107 lines testing debug cache storage.
- Keep 1 test, remove 2.

**Tests to Keep:**
1. "includes importance, retrieval_hits, mentions, characters_involved" - validates debug data structure

**Tests to Remove:**
- "stores full summary without truncation" - simple storage
- "defaults retrieval_hits to 0 and mentions to 1" - default value test

- [ ] Step 1: Read debug-cache.test.js

Run: `cat tests/retrieval/debug-cache.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/retrieval/debug-cache.test.js`:
- Keep middle test (data structure validation)
- Remove first and last tests

- [ ] Step 3: Run tests

Run: `npm test tests/retrieval/debug-cache.test.js`
Expected: Remaining test passes

- [ ] Step 4: Commit

```bash
git add tests/retrieval/debug-cache.test.js && git commit -m "chore: prune redundant debug cache tests"
```

---

## Task 11: Prune Embedding Codec Tests

**Files:**
- Modify: `tests/utils/embedding-codec.test.js`

**Purpose:**
- 128 lines testing Base64 encoding/decoding.
- Keep 4 roundtrip tests, remove 9 edge case tests.

**Tests to Keep:**
1. "encodes to Base64 and decodes back to Float32Array" - basic roundtrip
2. "roundtrips a realistic 384-dim normalized vector" - realistic data
3. "wraps legacy number[] in Float32Array" - backward compatibility
4. "hasEmbedding returns true for embedding_b64" - detection function

**Tests to Remove:**
- "prefers embedding_b64 over legacy embedding"
- "returns Float32Array from Base64 decode"
- "returns Float32Array from legacy path"
- "deletes legacy embedding key"
- "accepts Float32Array input"
- "returns true for legacy embedding"
- "removes both embedding_b64 and embedding"
- "handles object with only legacy key"
- "getEmbedding returns null for legacy array after migration"

- [ ] Step 1: Read embedding-codec.test.js

Run: `cat tests/utils/embedding-codec.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/utils/embedding-codec.test.js`:
- Keep 4 core roundtrip/compatibility tests
- Remove 9 edge case and implementation detail tests

- [ ] Step 3: Run tests

Run: `npm test tests/utils/embedding-codec.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/utils/embedding-codec.test.js && git commit -m "chore: prune redundant embedding codec tests"
```

---

## Task 12: Prune Payload Calculator Tests

**Files:**
- Modify: `tests/ui/payload-calculator.test.js`

**Purpose:**
- 160 lines testing emoji thresholds for payload calculator.
- Keep 2 tests, remove 4.

**Tests to Keep:**
1. "defaults (12k + 8k) = 22k = green" - core threshold logic
2. "48k + 16k = 66k = red" - upper threshold

**Tests to Remove:**
- "shows LLM compatibility warning" - DOM test
- "shows green emoji for totals under 32k" - DOM test
- "shows red emoji for totals over 64k" - DOM test
- "boundary: exactly 32k = green" - edge case
- "boundary: 32001 = yellow" - edge case

- [ ] Step 1: Read payload-calculator.test.js

Run: `cat tests/ui/payload-calculator.test.js`
Expected: File content

- [ ] Step 2: Remove redundant tests

Edit `tests/ui/payload-calculator.test.js`:
- Keep pure calculation tests (getPayloadSeverity function)
- Remove DOM manipulation tests

- [ ] Step 3: Run tests

Run: `npm test tests/ui/payload-calculator.test.js`
Expected: Remaining tests pass

- [ ] Step 4: Commit

```bash
git add tests/ui/payload-calculator.test.js && git commit -m "chore: prune DOM tests from payload calculator"
```

---

## Task 13: Final Verification

**Purpose:**
- Run full test suite to ensure everything still works.
- Verify line count reduction is ~3,500 lines.

- [ ] Step 1: Run full test suite

Run: `npm test`
Expected: All tests pass (48 files, reduced from 56)

- [ ] Step 2: Check line count reduction

Run: `git diff --stat HEAD~12`
Expected: Approximately 3,000-4,000 lines deleted

- [ ] Step 3: Verify key tests still exist

Run:
```bash
npm test tests/retrieval/math.test.js
npm test tests/graph/graph.test.js
npm test tests/extraction/extract.test.js
npm test tests/retrieval/formatting.test.js
npm test tests/store/chat-data.test.js
npm test tests/extraction/events.test.js
npm test tests/utils/queue.test.js
npm test tests/pov/pov.test.js
```
Expected: All pass (critical algorithm tests preserved)

- [ ] Step 4: Final commit

```bash
git commit --amend -m "chore: prune ~20% of test suite (3,500 lines) - Option C Balanced

Deleted 7 low-value test files:
- tests/unit/settings.test.js (lodash wrapper)
- tests/store/schemas.test.js (Zod tautologies)
- tests/scripts/generate-types.test.js (build artifact)
- tests/utils/logging.test.js (console wrapper)
- tests/utils/dom.test.js (trivial escaping)
- tests/perf/tab.test.js (DOM rendering)
- tests/integration/injection.test.js (heavily mocked)
- tests/prompts/resolvers.test.js (overlapping coverage)

Pruned 8 files to reduce redundancy:
- tests/ui/structure.test.js (-150 lines)
- tests/ui/settings-helpers.test.js (-200 lines)
- tests/prompts/format.test.js (-8 tests)
- tests/prompts/topology.test.js (-5 tests)
- tests/perf/instrumentation.test.js (-3 tests)
- tests/perf/store.test.js (-7 tests)
- tests/retrieval/debug-cache.test.js (-2 tests)
- tests/utils/embedding-codec.test.js (-9 tests)
- tests/ui/payload-calculator.test.js (-4 tests)

Preserved all core algorithm tests:
- retrieval/math.test.js (1,475 lines)
- graph/graph.test.js (1,198 lines)
- extraction/extract.test.js (925 lines)
- retrieval/formatting.test.js (875 lines)
- store/chat-data.test.js (849 lines)
- extraction/events.test.js (728 lines)
- utils/queue.test.js (235 lines)
- pov/pov.test.js (473 lines)"
```

---

## Summary

This plan removes approximately **3,500 lines (20%)** of the test suite while preserving:
- All core algorithm tests (math, graph, extraction)
- All data mutation safety tests
- All complex integration pipeline tests
- Representative samples of each test category

**Risk Level:** Low. The removed tests are either:
1. Testing library/framework behavior
2. Testing trivial utilities
3. Heavily mocked with low integration value
4. Overlapping with other test coverage
5. Testing implementation details rather than behavior

**Remaining Test Suite:** ~14,000 lines across 48 files, focused on high-value behavioral and algorithmic coverage.
