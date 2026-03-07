# Implementation Plan - Eliminate Hardcoded Fallback Values

> **Reference:** `docs/designs/2026-03-07-eliminate-hardcoded-fallbacks-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Add QUERY_CONTEXT_DEFAULTS keys to defaultSettings

**Goal:** Ensure all settings keys that are read anywhere in the codebase exist in `defaultSettings`, so `loadSettings()` guarantees they're populated.

**Step 1: Write the Failing Test**
- File: `tests/constants.test.js`
- Add a new `describe` block after the existing ones:
```js
describe('defaultSettings includes query-context keys', () => {
    it('entityWindowSize is 10', () => {
        expect(defaultSettings.entityWindowSize).toBe(10);
    });
    it('embeddingWindowSize is 5', () => {
        expect(defaultSettings.embeddingWindowSize).toBe(5);
    });
    it('recencyDecayFactor is 0.09', () => {
        expect(defaultSettings.recencyDecayFactor).toBe(0.09);
    });
    it('topEntitiesCount is 5', () => {
        expect(defaultSettings.topEntitiesCount).toBe(5);
    });
    it('entityBoostWeight is 5.0', () => {
        expect(defaultSettings.entityBoostWeight).toBe(5.0);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npm test -- tests/constants.test.js`
- Expect: 5 failures — keys don't exist in `defaultSettings` yet.

**Step 3: Implementation (Green)**
- File: `src/constants.js`
- After the `entityMergeSimilarityThreshold: 0.95,` line inside `defaultSettings`, add:
```js
    // Query context settings (previously only in QUERY_CONTEXT_DEFAULTS)
    entityWindowSize: 10,        // messages to scan for entities
    embeddingWindowSize: 5,      // messages for embedding query
    recencyDecayFactor: 0.09,    // weight reduction per position
    topEntitiesCount: 5,         // max entities to inject
    entityBoostWeight: 5.0,      // BM25 boost for extracted entities
```

**Step 4: Verify (Green)**
- Command: `npm test -- tests/constants.test.js`
- Expect: PASS (all 5 new tests + existing tests).

**Step 5: Git Commit**
- `git add . && git commit -m "feat(constants): add query-context keys to defaultSettings"`

---

### Task 2: Remove fallbacks from extraction pipeline

**Goal:** Remove all `?? hardcoded` and `|| hardcoded` patterns in `src/extraction/extract.js` and `src/extraction/worker.js`.

**Step 1: Verify Baseline (Green)**
- Command: `npm test -- tests/extraction/extract.test.js`
- Expect: PASS.

**Step 2: Edit `src/extraction/extract.js`**

Remove fallbacks from these lines (11 edits):

| Line | Old | New |
|------|-----|-----|
| 36 | `settings.backfillMaxRPM \|\| 30` | `settings.backfillMaxRPM` |
| 188 | `settings.extractionRearviewTokens \|\| 12000` | `settings.extractionRearviewTokens` |
| 329 | `settings.extractionTokenBudget \|\| 16000` | `settings.extractionTokenBudget` |
| 444 | `settings.dedupSimilarityThreshold ?? 0.92` | `settings.dedupSimilarityThreshold` |
| 445 | `settings.dedupJaccardThreshold ?? 0.6` | `settings.dedupJaccardThreshold` |
| 456 | `settings.entityDescriptionCap ?? 3` | `settings.entityDescriptionCap` |
| 469 | `settings.edgeDescriptionCap ?? 5` | `settings.edgeDescriptionCap` |
| 516 | `settings.reflectionThreshold ?? 30` | `settings.reflectionThreshold` |
| 538 | `settings.communityDetectionInterval ?? 50` | `settings.communityDetectionInterval` |
| 550 | `settings.communityStalenessThreshold ?? 100` | `settings.communityStalenessThreshold` |
| 607 | `settings.extractionTokenBudget \|\| 16000` | `settings.extractionTokenBudget` |

**Step 3: Edit `src/extraction/worker.js`**

| Line | Old | New |
|------|-----|-----|
| 122 | `settings.extractionTokenBudget \|\| 16000` | `settings.extractionTokenBudget` |

**Step 4: Verify (Green)**
- Command: `npm test -- tests/extraction/extract.test.js`
- Expect: PASS.

**Step 5: Git Commit**
- `git add . && git commit -m "refactor(extraction): remove hardcoded setting fallbacks"`

---

### Task 3: Remove fallbacks from retrieval pipeline

**Goal:** Remove all `?? hardcoded` and `|| hardcoded` patterns in `src/retrieval/scoring.js`, `src/retrieval/math.js`, `src/retrieval/retrieve.js`, and `src/retrieval/query-context.js`.

**Step 1: Verify Baseline (Green)**
- Command: `npm test -- tests/math.test.js tests/retrieval/retrieve.test.js tests/query-context.test.js`
- Expect: PASS.

**Step 2: Edit `src/retrieval/scoring.js`**

| Line | Old | New |
|------|-----|-----|
| 25 | `settings.forgetfulnessBaseLambda ?? 0.05` | `settings.forgetfulnessBaseLambda` |
| 26 | `settings.forgetfulnessImportance5Floor ?? 5` | `settings.forgetfulnessImportance5Floor` |
| 27 | `settings.reflectionDecayThreshold ?? 750` | `settings.reflectionDecayThreshold` |
| 31 | `settings.alpha ?? 0.7` | `settings.alpha` |
| 32 | `settings.combinedBoostWeight ?? 15` | `settings.combinedBoostWeight` |

**Step 3: Edit `src/retrieval/math.js`**

| Line | Old | New |
|------|-----|-----|
| 190 | `settings.alpha ?? 0.7` | `settings.alpha` |
| 191 | `settings.combinedBoostWeight ?? 15` | `settings.combinedBoostWeight` |
| 199 | `settings.vectorSimilarityThreshold \|\| 0.5` | `settings.vectorSimilarityThreshold` |
| 219 | `(constants.reflectionDecayThreshold ?? 750)` | `constants.reflectionDecayThreshold` |
| 220 | `constants.reflectionDecayThreshold ?? 750` | `constants.reflectionDecayThreshold` |

**Step 4: Edit `src/retrieval/retrieve.js`**

| Line | Old | New |
|------|-----|-----|
| 112 | `settings.retrievalFinalTokens \|\| 12000` | `settings.retrievalFinalTokens` |
| 113 | `settings.worldContextBudget \|\| 2000` | `settings.worldContextBudget` |

**Step 5: Edit `src/retrieval/query-context.js`**

Remove the `QUERY_CONTEXT_DEFAULTS` fallbacks AND the now-unused import. The `getQueryContextSettings()` function simplifies to:

```js
function getQueryContextSettings() {
    const settings = getDeps().getExtensionSettings()[extensionName];
    return {
        entityWindowSize: settings.entityWindowSize,
        embeddingWindowSize: settings.embeddingWindowSize,
        recencyDecayFactor: settings.recencyDecayFactor,
        topEntitiesCount: settings.topEntitiesCount,
        entityBoostWeight: settings.entityBoostWeight,
    };
}
```

Also update the import line: remove `QUERY_CONTEXT_DEFAULTS` from `import { extensionName, QUERY_CONTEXT_DEFAULTS } from '../constants.js';`.

**Step 6: Verify (Green)**
- Command: `npm test -- tests/math.test.js tests/retrieval/retrieve.test.js tests/query-context.test.js`
- Expect: PASS.

**Step 7: Git Commit**
- `git add . && git commit -m "refactor(retrieval): remove hardcoded setting fallbacks"`

---

### Task 4: Remove fallbacks from graph, reflection, embeddings, events, render

**Goal:** Remove all `?? hardcoded` and `|| hardcoded` patterns in 5 files.

**Step 1: Verify Baseline (Green)**
- Command: `npm test -- tests/graph/graph.test.js tests/reflection/reflect.test.js tests/embeddings.test.js tests/events.test.js`
- Expect: PASS.

**Step 2: Edit `src/graph/graph.js`**

| Line | Old | New |
|------|-----|-----|
| 271 | `settings?.entityMergeSimilarityThreshold ?? 0.9` | `settings.entityMergeSimilarityThreshold` |
| 386 | `settings?.entityMergeSimilarityThreshold ?? 0.9` | `settings.entityMergeSimilarityThreshold` |
| 447 | `settings?.entityDescriptionCap ?? 3` | `settings.entityDescriptionCap` |

Note: also remove the optional chaining `?.` since settings is guaranteed populated.

**Step 3: Edit `src/reflection/reflect.js`**

| Line | Old | New |
|------|-----|-----|
| 192 | `settings.maxReflectionsPerCharacter ?? 50` | `settings.maxReflectionsPerCharacter` |
| 264 | `settings.maxInsightsPerReflection ?? 3` | `settings.maxInsightsPerReflection` |
| 301 | `settings.reflectionDedupThreshold ?? 0.9` | `settings.reflectionDedupThreshold` |

**Step 4: Edit `src/embeddings.js`**

| Line | Old | New |
|------|-----|-----|
| 303 | `settings?.embeddingQueryPrefix ?? 'query: '` | `settings.embeddingQueryPrefix` |
| 309 | `settings?.embeddingDocPrefix ?? 'passage: '` | `settings.embeddingDocPrefix` |

For the `embeddingSource` fallbacks — there are 7 occurrences of `settings?.embeddingSource \|\| 'multilingual-e5-small'`. Replace all with `settings.embeddingSource`:

Lines: 446, 480, 491, 526, 555, 609, 646.

**Step 5: Edit `src/events.js`**

| Line | Old | New |
|------|-----|-----|
| 48 | `settings.visibleChatBudget \|\| 16000` | `settings.visibleChatBudget` |

**Step 6: Edit `src/ui/render.js`**

| Line | Old | New |
|------|-----|-----|
| 332 | `settings.reflectionThreshold ?? 30` | `settings.reflectionThreshold` |

**Step 7: Verify (Green)**
- Command: `npm test -- tests/graph/graph.test.js tests/reflection/reflect.test.js tests/embeddings.test.js tests/events.test.js`
- Expect: PASS.

**Step 8: Git Commit**
- `git add . && git commit -m "refactor(core): remove hardcoded setting fallbacks from graph, reflection, embeddings, events, render"`

---

### Task 5: Remove fallbacks from settings.js

**Goal:** Remove all `?? hardcoded`, `?? defaultSettings.xxx`, `?? QUERY_CONTEXT_DEFAULTS.xxx`, and `|| hardcoded` patterns in `src/ui/settings.js`.

**Step 1: Verify Baseline (Green)**
- Command: `npm test`
- Expect: PASS (full suite).

**Step 2: Edit `src/ui/settings.js` — `updateUI()` function**

Remove fallbacks from all `.val()` and `.text()` calls. 54 edits total. Pattern:
```diff
- $('#openvault_extraction_token_budget').val(settings.extractionTokenBudget ?? 12000);
+ $('#openvault_extraction_token_budget').val(settings.extractionTokenBudget);
```

Settings to strip fallbacks from (each appears in both `.val()` and `.text()` calls):
- `extractionTokenBudget ?? 12000` (lines 541, 542)
- `visibleChatBudget ?? 16000` (lines 549, 550)
- `alpha ?? defaultSettings.alpha` (lines 561, 562)
- `combinedBoostWeight ?? defaultSettings.combinedBoostWeight` (lines 564, 565)
- `vectorSimilarityThreshold ?? 0.5` (lines 567, 568)
- `dedupSimilarityThreshold ?? 0.92` (lines 570, 571)
- `entityMergeSimilarityThreshold ?? 0.94` (lines 573, 574)
- `edgeDescriptionCap ?? 5` (lines 576, 577)
- `entityWindowSize ?? 10` (lines 580, 581)
- `embeddingWindowSize ?? 5` (lines 583, 584)
- `topEntitiesCount ?? 5` (lines 586, 587)
- `entityBoostWeight ?? QUERY_CONTEXT_DEFAULTS.entityBoostWeight` (lines 589, 590)
- `embeddingSource \|\| 'multilingual-e5-small'` (line 596)
- `ollamaUrl \|\| ''` (line 598)
- `embeddingModel \|\| ''` (line 599)
- `embeddingQueryPrefix ?? defaultSettings.embeddingQueryPrefix` (line 600)
- `embeddingDocPrefix ?? defaultSettings.embeddingDocPrefix` (line 601)
- `reflectionThreshold ?? 30` (lines 608, 609)
- `maxInsightsPerReflection ?? 3` (lines 611, 612)
- `reflectionDedupThreshold ?? 0.9` (lines 614, 615, 616)
- `worldContextBudget ?? 2000` (lines 618, 619, 620)
- `communityDetectionInterval ?? 50` (lines 622, 623)
- `forgetfulnessBaseLambda ?? 0.05` (lines 632, 633)
- `forgetfulnessImportance5Floor ?? 5` (lines 636, 637)
- `reflectionDecayThreshold ?? 750` (lines 640, 641)
- `entityDescriptionCap ?? 3` (lines 644, 645)
- `maxReflectionsPerCharacter ?? 50` (lines 648, 649)
- `communityStalenessThreshold ?? 100` (lines 652, 653)
- `dedupJaccardThreshold ?? 0.6` (lines 656, 657)

**Step 3: Edit `src/ui/settings.js` — `updateBudgetIndicators()` function**

| Line | Old | New |
|------|-----|-----|
| 687 | `settings.extractionTokenBudget \|\| 16000` | `settings.extractionTokenBudget` |
| 700 | `settings.visibleChatBudget \|\| 16000` | `settings.visibleChatBudget` |

**Step 4: Edit `src/ui/settings.js` — `updatePayloadCalculator()` function**

| Line | Old | New |
|------|-----|-----|
| 109 | `Number($('#openvault_extraction_token_budget').val()) \|\| 12000` | `Number($('#openvault_extraction_token_budget').val()) \|\| defaultSettings.extractionTokenBudget` |
| 110 | `Number($('#openvault_extraction_rearview').val()) \|\| 8000` | `Number($('#openvault_extraction_rearview').val()) \|\| defaultSettings.extractionRearviewTokens` |

Note: These two `||` patterns read from the DOM, not from `settings`. The `||` is still needed because `Number('')` returns `0` (falsy). But the fallback value should reference `defaultSettings` instead of a hardcoded number. Import `defaultSettings` if not already imported.

**Step 5: Clean up imports**
- Remove `QUERY_CONTEXT_DEFAULTS` from the imports in `settings.js` if it's no longer used.
- Ensure `defaultSettings` remains imported (it's used by `loadSettings()`).

**Step 6: Verify (Green)**
- Command: `npm test`
- Expect: PASS (full suite).

**Step 7: Git Commit**
- `git add . && git commit -m "refactor(ui): remove hardcoded setting fallbacks from settings.js"`

---

### Task 6: Remove hardcoded values from HTML template

**Goal:** Remove `value="..."` attributes from all `<input>` elements in `templates/settings_panel.html` that are populated by `updateUI()`.

**Step 1: Edit `templates/settings_panel.html`**

Remove the `value="..."` attribute from these 21 inputs (keep `min`, `max`, `step`, `id`, `class` — only strip `value`):

| Line | Input ID | Remove |
|------|----------|--------|
| 290 | `openvault_extraction_token_budget` | `value="12000"` |
| 308 | `openvault_extraction_rearview` | `value="8000"` |
| 333 | `openvault_reflection_threshold` | `value="30"` |
| 342 | `openvault_max_insights` | `value="3"` |
| 357 | `openvault_reflection_dedup_threshold` | `value="0.90"` |
| 373 | `openvault_max_reflections` | `value="50"` |
| 383 | `openvault_reflection_decay_threshold` | `value="750"` |
| 397 | `openvault_entity_description_cap` | `value="3"` |
| 406 | `openvault_edge_description_cap` | `value="5"` |
| 415 | `openvault_community_interval` | `value="50"` |
| 425 | `openvault_community_staleness` | `value="100"` |
| 438 | `openvault_backfill_rpm` | `value="30"` |
| 497 | `openvault_final_budget` | `value="12000"` |
| 507 | `openvault_world_context_budget` | `value="2000"` |
| 516 | `openvault_visible_chat_budget` | `value="16000"` |
| 537 | `openvault_entity_window` | `value="10"` |
| 546 | `openvault_embedding_window` | `value="5"` |
| 555 | `openvault_top_entities` | `value="5"` |
| 564 | `openvault_entity_boost` | `value="5.0"` |
| 617 | `openvault_alpha` | `value="0.7"` |
| 626 | `openvault_combined_weight` | `value="15"` |
| 639 | `openvault_forgetfulness_lambda` | `value="0.05"` |
| 648 | `openvault_importance5_floor` | `value="5"` |
| 661 | `openvault_vector_threshold` | `value="0.5"` |
| 670 | `openvault_dedup_threshold` | `value="0.92"` |
| 679 | `openvault_dedup_jaccard` | `value="0.60"` |
| 688 | `openvault_entity_merge_threshold` | `value="0.80"` |

**Step 2: Verify**
- Command: `npm test -- tests/ui-templates.test.js`
- Expect: PASS (or adjust test if it asserts specific `value` attributes).

**Step 3: Git Commit**
- `git add . && git commit -m "refactor(ui): remove hardcoded default values from HTML template"`

---

### Task 7: Final verification and squash commit

**Goal:** Run full test suite, verify no regressions, create a single squash commit.

**Step 1: Full Test Suite**
- Command: `npm test`
- Expect: ALL PASS.

**Step 2: Lint Check**
- Command: `npx biome check src/ templates/` (or whatever the project lint command is)
- Expect: No new errors.

**Step 3: Search for Remaining Hardcoded Fallbacks**
- Verify no remaining `settings.xxx ?? <number>` or `settings.xxx || <number>` patterns exist (grep the src/ directory).
- Any remaining `??` or `||` patterns should only be data-field fallbacks (e.g., `event.importance || 3`), not settings defaults.

**Step 4: Squash Commits**
- `git rebase -i` to squash Tasks 1-6 into a single commit:
- `refactor: eliminate hardcoded setting fallbacks — use constants.js as single source of truth`
