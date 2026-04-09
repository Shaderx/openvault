# Test Suite Consolidation Plan

**Goal:** Reduce 75 test files to 56 by merging redundant/split tests and deleting tautological files, with zero test coverage loss.
**Architecture:** Merge source files into target files (append describe blocks), then delete the emptied source files. Every merge is followed by a full suite run to confirm no regressions.
**Tech Stack:** Vitest, no code changes — only test file moves.

---

## File Structure

**Modified files (absorb content):**
- `tests/retrieval/math.test.js` — absorbs math-spread, math-alpha-blend, scoring-clamping
- `tests/retrieval/retrieve.test.js` — absorbs scoring
- `tests/graph/graph.test.js` — absorbs consolidation
- `tests/prompts/formatters.test.js` — absorbs formatters-username
- `tests/reflection/reflect.test.js` — absorbs unified-reflection.integration
- `tests/unit/settings.test.js` — absorbs settings-init
- `tests/extraction/extract.test.js` — absorbs dedup, emergency-cut
- `tests/extraction/events.test.js` — absorbs hide-messages, worker
- `tests/ui/payload-calculator.test.js` — absorbs payload-calculator-math
- `tests/ui/structure.test.js` — absorbs progressive-disclosure.integration

**Deleted files (tautological/zero-value):**
- `tests/extraction/structured-schema-import.test.js` — tests module imports, not behavior
- `tests/prompts/examples/global-synthesis.test.js` — tests example data has required fields
- `tests/unit/render.test.js` — tests template literals contain text
- `tests/unit/macros.test.js` — tests function registration side effects
- `tests/ui/settings-bindings.test.js` — 4 tests that only check `.on()` was called

---

## Purge Tautologies Within Kept Files

Before merging, prune these known-tautological tests from files that survive:

### formatting.test.js
- `exports CURRENT_SCENE_SIZE as 100` — tests constant export
- `exports LEADING_UP_SIZE as 500` — tests constant export

### debug-cache.test.js
- `returns null when no data cached` — tests default return

### prefill.test.js
- `exports PREFILL_PRESETS with all 6 keys` — tests constant export

### state.test.js
- `multiple resets do not throw` — trivial

---

## Task 1: Merge retrieval math-spread.test.js → math.test.js

**Files:**
- Modify: `tests/retrieval/math.test.js`
- Delete: `tests/retrieval/math-spread.test.js`

- [ ] Step 1: Read `tests/retrieval/math-spread.test.js` and `tests/retrieval/math.test.js`

- [ ] Step 2: Append the describe blocks from `math-spread.test.js` into `math.test.js` (as new top-level describe block titled "Large iterable handling")

- [ ] Step 3: Delete `tests/retrieval/math-spread.test.js`

- [ ] Step 4: Run retrieval tests to confirm no regression

Run: `npx vitest run tests/retrieval/`
Expected: All tests PASS, file count reduced by 1

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge math-spread.test.js into math.test.js"
```

---

## Task 2: Merge retrieval math-alpha-blend.test.js → math.test.js

**Files:**
- Modify: `tests/retrieval/math.test.js`
- Delete: `tests/retrieval/math-alpha-blend.test.js`

- [ ] Step 1: Read `tests/retrieval/math-alpha-blend.test.js`

- [ ] Step 2: Append all describe blocks from `math-alpha-blend.test.js` into `math.test.js`

- [ ] Step 3: Delete `tests/retrieval/math-alpha-blend.test.js`

- [ ] Step 4: Run retrieval tests

Run: `npx vitest run tests/retrieval/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge math-alpha-blend.test.js into math.test.js"
```

---

## Task 3: Merge retrieval scoring-clamping.test.js → math.test.js

**Files:**
- Modify: `tests/retrieval/math.test.js`
- Delete: `tests/retrieval/scoring-clamping.test.js`

- [ ] Step 1: Read `tests/retrieval/scoring-clamping.test.js`

- [ ] Step 2: Append all describe blocks from `scoring-clamping.test.js` into `math.test.js`

- [ ] Step 3: Delete `tests/retrieval/scoring-clamping.test.js`

- [ ] Step 4: Run retrieval tests

Run: `npx vitest run tests/retrieval/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge scoring-clamping.test.js into math.test.js"
```

---

## Task 4: Merge retrieval scoring.test.js → retrieve.test.js

**Files:**
- Modify: `tests/retrieval/retrieve.test.js`
- Delete: `tests/retrieval/scoring.test.js`

- [ ] Step 1: Read `tests/retrieval/scoring.test.js` and `tests/retrieval/retrieve.test.js`

- [ ] Step 2: Append all describe blocks from `scoring.test.js` into `retrieve.test.js`

- [ ] Step 3: Delete `tests/retrieval/scoring.test.js`

- [ ] Step 4: Run retrieval tests

Run: `npx vitest run tests/retrieval/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge scoring.test.js into retrieve.test.js"
```

---

## Task 5: Merge graph consolidation.test.js → graph.test.js

**Files:**
- Modify: `tests/graph/graph.test.js`
- Delete: `tests/graph/consolidation.test.js`

- [ ] Step 1: Read `tests/graph/consolidation.test.js` and `tests/graph/graph.test.js`

- [ ] Step 2: Append describe blocks from `consolidation.test.js` into `graph.test.js`

- [ ] Step 3: Delete `tests/graph/consolidation.test.js`

- [ ] Step 4: Run graph tests

Run: `npx vitest run tests/graph/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge consolidation.test.js into graph.test.js"
```

---

## Task 6: Merge prompts formatters-username.test.js → formatters.test.js

**Files:**
- Modify: `tests/prompts/formatters.test.js`
- Delete: `tests/prompts/formatters-username.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `formatters-username.test.js` into `formatters.test.js`

- [ ] Step 3: Delete `tests/prompts/formatters-username.test.js`

- [ ] Step 4: Run prompts tests

Run: `npx vitest run tests/prompts/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge formatters-username.test.js into formatters.test.js"
```

---

## Task 7: Merge reflection unified-reflection.integration.test.js → reflect.test.js

**Files:**
- Modify: `tests/reflection/reflect.test.js`
- Delete: `tests/reflection/unified-reflection.integration.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `unified-reflection.integration.test.js` into `reflect.test.js`

- [ ] Step 3: Delete `tests/reflection/unified-reflection.integration.test.js`

- [ ] Step 4: Run reflection tests

Run: `npx vitest run tests/reflection/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge unified-reflection.integration.test.js into reflect.test.js"
```

---

## Task 8: Merge unit settings-init.test.js → settings.test.js

**Files:**
- Modify: `tests/unit/settings.test.js`
- Delete: `tests/unit/settings-init.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `settings-init.test.js` into `settings.test.js`

- [ ] Step 3: Delete `tests/unit/settings-init.test.js`

- [ ] Step 4: Run unit tests

Run: `npx vitest run tests/unit/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge settings-init.test.js into settings.test.js"
```

---

## Task 9: Merge extraction dedup.test.js → extract.test.js

**Files:**
- Modify: `tests/extraction/extract.test.js`
- Delete: `tests/extraction/dedup.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `dedup.test.js` into `extract.test.js`

- [ ] Step 3: Delete `tests/extraction/dedup.test.js`

- [ ] Step 4: Run extraction tests

Run: `npx vitest run tests/extraction/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge dedup.test.js into extract.test.js"
```

---

## Task 10: Merge extraction emergency-cut.test.js → extract.test.js

**Files:**
- Modify: `tests/extraction/extract.test.js`
- Delete: `tests/extraction/emergency-cut.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `emergency-cut.test.js` into `extract.test.js`

- [ ] Step 3: Delete `tests/extraction/emergency-cut.test.js`

- [ ] Step 4: Run extraction tests

Run: `npx vitest run tests/extraction/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge emergency-cut.test.js into extract.test.js"
```

---

## Task 11: Merge extraction hide-messages.test.js + worker.test.js → events.test.js

**Files:**
- Modify: `tests/extraction/events.test.js`
- Delete: `tests/extraction/hide-messages.test.js`
- Delete: `tests/extraction/worker.test.js`

- [ ] Step 1: Read all three files

- [ ] Step 2: Append describe blocks from `hide-messages.test.js` and `worker.test.js` into `events.test.js`

- [ ] Step 3: Delete `tests/extraction/hide-messages.test.js` and `tests/extraction/worker.test.js`

- [ ] Step 4: Run extraction tests

Run: `npx vitest run tests/extraction/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge hide-messages.test.js and worker.test.js into events.test.js"
```

---

## Task 12: Merge ui payload-calculator-math.test.js → payload-calculator.test.js

**Files:**
- Modify: `tests/ui/payload-calculator.test.js`
- Delete: `tests/ui/payload-calculator-math.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `payload-calculator-math.test.js` into `payload-calculator.test.js`

- [ ] Step 3: Delete `tests/ui/payload-calculator-math.test.js`

- [ ] Step 4: Run UI tests

Run: `npx vitest run tests/ui/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge payload-calculator-math.test.js into payload-calculator.test.js"
```

---

## Task 13: Merge ui progressive-disclosure.integration.test.js → structure.test.js

**Files:**
- Modify: `tests/ui/structure.test.js`
- Delete: `tests/ui/progressive-disclosure.integration.test.js`

- [ ] Step 1: Read both files

- [ ] Step 2: Append describe blocks from `progressive-disclosure.integration.test.js` into `structure.test.js`

- [ ] Step 3: Delete `tests/ui/progressive-disclosure.integration.test.js`

- [ ] Step 4: Run UI tests

Run: `npx vitest run tests/ui/`
Expected: All tests PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: merge progressive-disclosure.integration.test.js into structure.test.js"
```

---

## Task 14: Delete tautological test files

**Files:**
- Delete: `tests/extraction/structured-schema-import.test.js`
- Delete: `tests/prompts/examples/global-synthesis.test.js`
- Delete: `tests/unit/render.test.js`
- Delete: `tests/unit/macros.test.js`
- Delete: `tests/ui/settings-bindings.test.js`

- [ ] Step 1: Delete all 5 files

- [ ] Step 2: Run full suite to confirm no regressions (these files contributed zero behavioral coverage)

Run: `npx vitest run`
Expected: All tests PASS, file count reduced by 5

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "chore: delete tautological test files (imports-only, constant-exports, binding-registration)"
```

---

## Task 15: Prune tautological tests within kept files

**Files:**
- Modify: `tests/retrieval/formatting.test.js` — remove 2 constant-export tests
- Modify: `tests/retrieval/debug-cache.test.js` — remove 1 default-return test
- Modify: `tests/prompts/prefill.test.js` — remove 1 constant-export test
- Modify: `tests/state/state.test.js` — remove 1 trivial test

- [ ] Step 1: Read each file, identify and remove the tautological tests listed above

- [ ] Step 2: Run full suite

Run: `npx vitest run`
Expected: All tests PASS

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "chore: prune tautological tests from formatting, debug-cache, prefill, state"
```

---

## Task 16: Final verification

- [ ] Step 1: Run full suite

Run: `npx vitest run`
Expected: All tests PASS

- [ ] Step 2: Count files to confirm target

Run: `find tests -name "*.test.js" | wc -l`
Expected: 56 (down from 75)

- [ ] Step 3: Run pre-commit checks

Run: `npm run check`
Expected: All checks pass
