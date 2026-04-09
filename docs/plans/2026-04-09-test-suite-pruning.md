# Test Suite Pruning: Duplicates & Orphan Cleanup

**Goal:** Remove duplicate tests, eliminate orphan root-level files, and enforce the "tests mirror src/" organization rule.
**Architecture:** Pure file moves + deletes. No source code changes. No logic changes. Every task is verified by running the full test suite before and after.
**Tech Stack:** Vitest, git mv, manual import path fixes

---

## File Structure Overview

### Files to DELETE (confirmed duplicates)
- Delete: `tests/scheduler.test.js` — 44 tests duplicating `tests/extraction/scheduler.test.js` (after merging 2 unique tests)
- Delete: `tests/ui/helpers-alias-search.test.js` — 3 tests already covered in `tests/ui-helpers.test.js` lines 159-207

### Files to MOVE (orphan → proper subdirectory)
- Move: `tests/events.test.js` → `tests/extraction/events.test.js`
- Move: `tests/llm.test.js` → `tests/llm/llm.test.js`
- Move: `tests/pov.test.js` → `tests/pov/pov.test.js`
- Move: `tests/state.test.js` → `tests/state/state.test.js`
- Move: `tests/ui-helpers.test.js` → `tests/ui/helpers.test.js`
- Move: `tests/ui-templates.test.js` → `tests/ui/templates.test.js`
- Move: `tests/settings.test.js` → `tests/unit/settings.test.js`
- Move: `tests/payload-calculator.test.js` → `tests/ui/payload-calculator-math.test.js`
- Move: `tests/embeddings.test.js` → `tests/embeddings/embeddings.test.js`
- Move: `tests/constants.test.js` → `tests/constants/constants.test.js`

### Root `prompts.test.js` (84 tests) → split into subdirectory
- Move unique prefill/preamble tests → `tests/prompts/prefill.test.js`
- Move unique resolver tests → `tests/prompts/resolvers.test.js`
- Delete overlapping builder tests (already in `topology.test.js`, `formatters.test.js`)
- Delete overlapping domain module structure tests (already in `examples/*.test.js`)

---

### Task 1: Delete duplicate scheduler tests

**Files:**
- Delete: `tests/scheduler.test.js`
- Modify: `tests/extraction/scheduler.test.js` — add 2 system-message trimTailTurns tests

- [ ] Step 1: Verify the root scheduler.test.js has no unique tests beyond what tests/extraction/scheduler.test.js covers

The root file tests: `getFingerprint`, `getProcessedFingerprints`, `getUnextractedMessageIds`, `isBatchReady`, `getNextBatch`, `getBackfillStats`, `getBackfillMessageIds`, `trimTailTurns`, swipe protection.
The subdir file tests: `trimTailTurns` with system messages (2 tests).

The root file is the comprehensive one. The subdir file has 2 unique tests about `is_system` messages in trimTailTurns that the root file does NOT cover (the root file's trimTailTurns tests don't set `is_system`).

Run: `npx vitest run tests/scheduler.test.js tests/extraction/scheduler.test.js --reporter=verbose`
Expected: All pass

- [ ] Step 2: Copy the 2 unique system-message tests from tests/extraction/scheduler.test.js into a new describe block at the end of tests/scheduler.test.js (before deletion we need them preserved)

Actually — the root file is the one being deleted. The subdir file has the unique tests. So the approach is:
1. The root file's tests are comprehensive but live in the wrong location.
2. The subdir file has 2 unique tests.
3. We keep the subdir file as-is (it already has the unique tests).
4. We delete the root file entirely (its tests are redundant — the functions are the same, and the subdir covers the edge case).

But wait — the root file tests `getFingerprint`, `getProcessedFingerprints`, `getUnextractedMessageIds`, `isBatchReady`, `getNextBatch`, `getBackfillStats`, `getBackfillMessageIds`. The subdir file ONLY tests `trimTailTurns`. The root file is the one with the comprehensive coverage.

**Revised approach:** The subdir file should be deleted, and the root file should be moved to `tests/extraction/scheduler.test.js` (replacing the current 2-test file). But the subdir tests for system messages are unique and need to be preserved.

- [ ] Step 3: Append the 2 system-message tests from tests/extraction/scheduler.test.js into the root tests/scheduler.test.js

Add this describe block at the end of `tests/scheduler.test.js`:

```javascript
describe('trimTailTurns — system messages', () => {
    it('finds Bot→User boundary with system message in between', () => {
        // U(0) B(1) SYS(2) U(3) B(4) SYS(5) U(6)
        chat = [
            makeMessage(false, 'u0'),   // U
            makeMessage(false, 'b1'),   // B — wait, makeMessage takes (isUser, text)
        ];
        // Actually just use inline objects to match the subdir pattern
        const systemChat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'sys', is_user: false, is_system: true },
            { mes: 'u3', is_user: true, is_system: false },
            { mes: 'b4', is_user: false, is_system: false },
            { mes: 'sys2', is_user: false, is_system: true },
            { mes: 'u6', is_user: true, is_system: false },
        ];
        const result = trimTailTurns(systemChat, [0, 1, 2, 3, 4, 5, 6], 1);
        expect(result.length).toBeLessThan(7);
        expect(result.length).toBeGreaterThan(0);
    });

    it('trims correctly when system message blocks boundary detection', () => {
        const systemChat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'sys', is_user: false, is_system: true },
            { mes: 'u3', is_user: true, is_system: false },
            { mes: 'u4', is_user: true, is_system: false },
            { mes: 'b5', is_user: false, is_system: false },
        ];
        const result = trimTailTurns(systemChat, [0, 1, 3, 4, 5], 1);
        expect(result).toEqual([0, 1]);
    });
});
```

- [ ] Step 4: Run the updated root file to confirm the new tests pass

Run: `npx vitest run tests/scheduler.test.js --reporter=verbose`
Expected: All 46 tests pass (44 original + 2 new)

- [ ] Step 5: Delete tests/extraction/scheduler.test.js

```bash
rm tests/extraction/scheduler.test.js
```

- [ ] Step 6: Move tests/scheduler.test.js to tests/extraction/scheduler.test.js

```bash
git mv tests/scheduler.test.js tests/extraction/scheduler.test.js
```

- [ ] Step 7: Fix import paths in the moved file

Change `'../src/constants.js'` to `'../../src/constants.js'`
Change `'../src/extraction/scheduler.js'` to `'../../src/extraction/scheduler.js'`

- [ ] Step 8: Run tests to verify

Run: `npx vitest run tests/extraction/scheduler.test.js --reporter=verbose`
Expected: All 46 tests pass

- [ ] Step 9: Run full suite to verify no broken imports elsewhere

Run: `npx vitest run`
Expected: All pass

- [ ] Step 10: Commit

```bash
git add -A && git commit -m "chore: consolidate scheduler tests into tests/extraction/"
```

---

### Task 2: Delete duplicate alias-search tests

**Files:**
- Delete: `tests/ui/helpers-alias-search.test.js`

- [ ] Step 1: Verify that tests/ui-helpers.test.js already covers alias search

Run: `npx vitest run tests/ui-helpers.test.js --reporter=verbose -t "alias"`
Expected: Tests matching "alias" pass (searches aliases, partial alias match, missing aliases)

- [ ] Step 2: Run the file being deleted to confirm it passes (sanity check)

Run: `npx vitest run tests/ui/helpers-alias-search.test.js --reporter=verbose`
Expected: 3 tests pass

- [ ] Step 3: Delete the redundant file

```bash
rm tests/ui/helpers-alias-search.test.js
```

- [ ] Step 4: Run full suite

Run: `npx vitest run`
Expected: All pass (3 fewer tests)

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: remove duplicate alias-search tests (covered in ui-helpers.test.js)"
```

---

### Task 3: Move orphan root files to subdirectories (batch 1)

**Files:**
- Move: `tests/events.test.js` → `tests/extraction/events.test.js`
- Move: `tests/pov.test.js` → `tests/pov/pov.test.js`
- Move: `tests/state.test.js` → `tests/state/state.test.js`
- Move: `tests/llm.test.js` → `tests/llm/llm.test.js`

- [ ] Step 1: Run baseline full suite

Run: `npx vitest run`
Expected: All pass, note total test count

- [ ] Step 2: Move events.test.js

```bash
git mv tests/events.test.js tests/extraction/events.test.js
```

Fix imports: `'../src/constants.js'` → `'../../src/constants.js'`, `'../src/deps.js'` → `'../../src/deps.js'`

- [ ] Step 3: Move pov.test.js

```bash
mkdir -p tests/pov
git mv tests/pov.test.js tests/pov/pov.test.js
```

Fix imports: `'../src/constants.js'` → `'../../src/constants.js'`, `'../src/deps.js'` → `'../../src/deps.js'`, `'../src/pov.js'` → `'../../src/pov.js'`

- [ ] Step 4: Move state.test.js

```bash
mkdir -p tests/state
git mv tests/state.test.js tests/state/state.test.js
```

Fix imports: `'../src/deps.js'` → `'../../src/deps.js'`, `'../src/state.js'` → `'../../src/state.js'`

- [ ] Step 5: Move llm.test.js

```bash
mkdir -p tests/llm
git mv tests/llm.test.js tests/llm/llm.test.js
```

Fix imports: `'../src/deps.js'` → `'../../src/deps.js'`, `'../src/llm.js'` → `'../../src/llm.js'`

- [ ] Step 6: Run full suite to verify all import paths fixed

Run: `npx vitest run`
Expected: All pass, same test count as baseline

- [ ] Step 7: Commit

```bash
git add -A && git commit -m "chore: move orphan test files to proper subdirectories (batch 1)"
```

---

### Task 4: Move orphan root files to subdirectories (batch 2)

**Files:**
- Move: `tests/ui-helpers.test.js` → `tests/ui/helpers.test.js`
- Move: `tests/ui-templates.test.js` → `tests/ui/templates.test.js`
- Move: `tests/settings.test.js` → `tests/unit/settings.test.js`
- Move: `tests/payload-calculator.test.js` → `tests/ui/payload-calculator-math.test.js`

- [ ] Step 1: Run baseline full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 2: Move ui-helpers.test.js

```bash
git mv tests/ui-helpers.test.js tests/ui/helpers.test.js
```

Fix imports: `'../src/ui/helpers.js'` → `'../../src/ui/helpers.js'`

- [ ] Step 3: Move ui-templates.test.js

```bash
git mv tests/ui-templates.test.js tests/ui/templates.test.js
```

Fix imports: `'../src/ui/templates.js'` → `'../../src/ui/templates.js'`, `'../src/constants.js'` → `'../../src/constants.js'`

- [ ] Step 4: Move settings.test.js

```bash
git mv tests/settings.test.js tests/unit/settings.test.js
```

Fix imports (check what it imports — uses mocked lodash, may not import from src at all). Read the file and fix any `'../src/...'` paths to `'../../src/...'`.

- [ ] Step 5: Move payload-calculator.test.js

```bash
git mv tests/payload-calculator.test.js tests/ui/payload-calculator-math.test.js
```

Fix imports: `'../src/constants.js'` → `'../../src/constants.js'`

- [ ] Step 6: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 7: Commit

```bash
git add -A && git commit -m "chore: move orphan test files to proper subdirectories (batch 2)"
```

---

### Task 5: Move remaining orphan root files to subdirectories (batch 3)

**Files:**
- Move: `tests/embeddings.test.js` → `tests/embeddings/embeddings.test.js`
- Move: `tests/constants.test.js` → `tests/constants/constants.test.js`

- [ ] Step 1: Run baseline

Run: `npx vitest run`
Expected: All pass

- [ ] Step 2: Move embeddings.test.js

```bash
git mv tests/embeddings.test.js tests/embeddings/embeddings.test.js
```

Fix imports: `'../src/embeddings.js'` → `'../../src/embeddings.js'`

- [ ] Step 3: Move constants.test.js

```bash
git mv tests/constants.test.js tests/constants/constants.test.js
```

Fix imports: `'../src/constants.js'` → `'../../src/constants.js'`

- [ ] Step 4: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "chore: move orphan test files to proper subdirectories (batch 3)"
```

---

### Task 6: Split and absorb root prompts.test.js

This is the largest task. The root `tests/prompts.test.js` (84 tests, 854 lines) must be split into focused subdirectory files and then deleted.

**Analysis of overlap with existing subdir files:**

| Root describe block | Existing subdir coverage | Action |
|---|---|---|
| `buildCommunitySummaryPrompt` (7 tests) | `topology.test.js` covers structure | **DELETE** — topology already tests layout |
| `buildEventExtractionPrompt` (5 tests) | `topology.test.js` covers structure | **DELETE** — overlaps |
| `buildEventExtractionPrompt output conventions` (4 tests) | No overlap | **MOVE** to `tests/prompts/builders.test.js` |
| `all prompts use raw JSON instruction` (2 tests) | No overlap | **MOVE** to `tests/prompts/builders.test.js` |
| `buildGraphExtractionPrompt` (4 tests) | `topology.test.js` covers structure | **DELETE** — overlaps |
| `prefill parameter` (8 tests) | No overlap | **MOVE** to `tests/prompts/prefill.test.js` |
| `think tag support` (4 tests) | No overlap | **MOVE** to `tests/prompts/prefill.test.js` |
| `CN preamble and assistant prefill` (5 tests) | Partial — `topology.test.js` uses CN preamble but doesn't test preamble switching | **MOVE** to `tests/prompts/prefill.test.js` |
| `preamble and prefill exports` (7 tests) | No overlap | **MOVE** to `tests/prompts/prefill.test.js` |
| `defaultSettings preamble/prefill keys` (4 tests) | No overlap | **MOVE** to `tests/prompts/prefill.test.js` |
| `buildMessages via buildEventExtractionPrompt` (5 tests) | `topology.test.js` partially covers | **MERGE** unique asserts into `topology.test.js` or **DELETE** if fully covered |
| `buildMessages via non-event prompts` (3 tests) | Partially covered | **MERGE** unique asserts or **DELETE** |
| `resolveExtractionPreamble` (5 tests) | No overlap | **MOVE** to `tests/prompts/resolvers.test.js` |
| `resolveExtractionPrefill` (7 tests) | No overlap | **MOVE** to `tests/prompts/resolvers.test.js` |
| `resolveOutputLanguage` (6 tests) | No overlap | **MOVE** to `tests/prompts/resolvers.test.js` |
| `output language in builders` (7 tests) | No overlap | **MOVE** to `tests/prompts/resolvers.test.js` |
| `multilingual prompt compliance` (5 tests) | No overlap (asserts content presence) | **DELETE** — fragile content-sniffing tests per tests/CLAUDE.md rule "No prompt-content tests" |
| `buildUnifiedReflectionPrompt` (1 test) | `topology.test.js` covers structure | **DELETE** — overlaps |
| `buildEdgeConsolidationPrompt` (4 tests) | `topology.test.js` covers structure; `formatters.test.js` covers constraints assembly | **DELETE** — overlaps |
| `buildGlobalSynthesisPrompt` (4 tests) | `topology.test.js` covers structure | **DELETE** — overlaps |
| `domain module structure` (6 tests) | `examples/*.test.js` covers structure | **DELETE** — overlaps |

**Files:**
- Create: `tests/prompts/prefill.test.js`
- Create: `tests/prompts/resolvers.test.js`
- Modify: `tests/prompts/topology.test.js` — absorb any unique builder tests
- Delete: `tests/prompts.test.js`

- [ ] Step 1: Run baseline

Run: `npx vitest run tests/prompts.test.js tests/prompts/ --reporter=verbose`
Expected: All pass, note total count

- [ ] Step 2: Create `tests/prompts/prefill.test.js`

Extract the following describe blocks from `tests/prompts.test.js` into a new file:
- `prefill parameter` (8 tests)
- `think tag support` (4 tests)
- `CN preamble and assistant prefill` (5 tests)
- `preamble and prefill exports` (7 tests)
- `defaultSettings preamble/prefill keys` (4 tests)

Fix imports:
```javascript
import { defaultSettings } from '../../src/constants.js';
import {
    buildEdgeConsolidationPrompt,
    buildEventExtractionPrompt,
    buildGraphExtractionPrompt,
    buildUnifiedReflectionPrompt,
    PREFILL_PRESETS,
    resolveExtractionPreamble,
    resolveExtractionPrefill,
    SYSTEM_PREAMBLE_CN,
    SYSTEM_PREAMBLE_EN,
} from '../../src/prompts/index.js';
```

- [ ] Step 3: Create `tests/prompts/resolvers.test.js`

Extract the following describe blocks:
- `resolveExtractionPreamble` (5 tests)
- `resolveExtractionPrefill` (7 tests)
- `resolveOutputLanguage` (6 tests)
- `output language in builders` (7 tests)

Fix imports:
```javascript
import {
    buildEdgeConsolidationPrompt,
    buildEventExtractionPrompt,
    buildGraphExtractionPrompt,
    buildUnifiedReflectionPrompt,
    resolveExtractionPreamble,
    resolveExtractionPrefill,
    resolveOutputLanguage,
} from '../../src/prompts/index.js';
import { defaultSettings } from '../../src/constants.js';
```

- [ ] Step 4: Check if `buildMessages via buildEventExtractionPrompt` and `buildMessages via non-event prompts` have unique asserts not covered by `topology.test.js`

Read both describe blocks. If they only assert the same things topology tests (system/user message structure, prefill behavior, preamble switching), delete them. If they have unique assertions (e.g., specific return value shapes), absorb those into `topology.test.js`.

- [ ] Step 5: Delete `buildEventExtractionPrompt output conventions`, `all prompts use raw JSON instruction`, and `multilingual prompt compliance` describe blocks

These are prompt-content tests that the CLAUDE.md explicitly forbids ("No prompt-content tests. Don't assert literal prompt strings — they break on every edit and test nothing behavioral"). Drop them.

- [ ] Step 6: Delete the root `tests/prompts.test.js`

```bash
rm tests/prompts.test.js
```

- [ ] Step 7: Run full prompts test suite

Run: `npx vitest run tests/prompts/ --reporter=verbose`
Expected: All pass

- [ ] Step 8: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 9: Commit

```bash
git add -A && git commit -m "chore: split prompts.test.js into focused subdirectory files, remove content-sniffing tests"
```

---

### Task 7: Final verification and cleanup

- [ ] Step 1: Run full suite with verbose output

Run: `npx vitest run --reporter=verbose`
Expected: All pass. Verify no orphan root-level .test.js files remain.

- [ ] Step 2: Verify no orphan root-level test files remain

```bash
ls tests/*.test.js
```
Expected: No output (empty — all files now in subdirectories)

- [ ] Step 3: Run `npm run check` to verify pre-commit hooks pass

Run: `npm run check`
Expected: All checks pass (sync-version, generate-types, lint, jsdoc, css, typecheck)

- [ ] Step 4: Final commit if any cleanup needed

```bash
git add -A && git commit -m "chore: test suite pruning complete — no orphan root-level test files"
```

---

## Common Pitfalls

- **Import path depth.** Every move from `tests/X.test.js` to `tests/subdir/X.test.js` adds one `../` to all imports. Miss one and the test silently fails to import (Vitest reports 0 tests).
- **`global.registerCdnOverrides()` in moved files.** If any moved file calls `registerCdnOverrides()` after `vi.resetModules()`, the path to the setup module may need updating.
- **The scheduler reversal.** Task 1 is counterintuitive: the ROOT file has the comprehensive tests, the SUBDIR has the unique edge case. We merge the unique tests INTO the root file before moving it.
- **prompts.test.js is the highest-risk task.** It has 84 tests with tangled imports from `../../src/prompts/index.js` (barrel re-export) vs direct domain imports. Pay attention to which import path each extracted block needs.
- **`parseConsolidationResponse` import.** The root `prompts.test.js` imports this from `../src/extraction/structured.js`. Any describe block that uses it (like `buildEdgeConsolidationPrompt` last test) needs the extraction import preserved in the target file.
