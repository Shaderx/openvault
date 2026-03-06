# Implementation Plan — Code Review Fixes (Items 3, 4, 5)

> **Reference:** `docs/designs/2026-03-06-code-review-fixes-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Add `GENERATION_STOPPED` to event stub

**Goal:** Update the test stub so the new event type is available in tests.

**Step 1: Edit stub**
- File: `tests/stubs/extensions.js`
- Add `GENERATION_STOPPED: 'GENERATION_STOPPED'` to `eventTypes`:
```js
export const eventTypes = {
    APP_READY: 'APP_READY',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    CHAT_CHANGED: 'CHAT_CHANGED',
    GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
    GENERATION_ENDED: 'GENERATION_ENDED',
    GENERATION_STOPPED: 'GENERATION_STOPPED',
};
```

**Step 2: Verify**
- Command: `npm test`
- Expect: All existing tests still pass (no behavioral change yet).

**Step 3: Git Commit**
- `git add . && git commit -m "test: add GENERATION_STOPPED to event stubs"`

---

### Task 2: Wire `GENERATION_STOPPED` to `onGenerationEnded`

**Goal:** The Stop button in SillyTavern clears the generation lock immediately instead of waiting 2 minutes.

**Step 1: Edit EVENT_MAP**
- File: `src/events.js`
- In the `EVENT_MAP` array, add one entry after `GENERATION_ENDED`:
```js
const EVENT_MAP = [
    ['GENERATION_AFTER_COMMANDS', onBeforeGeneration],
    ['GENERATION_ENDED', onGenerationEnded],
    ['GENERATION_STOPPED', onGenerationEnded],
    ['MESSAGE_RECEIVED', onMessageReceived],
    ['CHAT_CHANGED', onChatChanged],
];
```
No changes to `state.js` — `clearGenerationLock()` is already idempotent.

**Step 2: Verify**
- Command: `npm test`
- Expect: All tests pass. No event tests exist (events.js is intentionally untested — see ARCHITECTURE.md §3.5), so this is a wiring-only change.

**Step 3: Git Commit**
- `git add . && git commit -m "fix: clear generation lock on GENERATION_STOPPED event"`

---

### Task 3: Replace `yieldToMain` with `scheduler.yield()`

**Goal:** Remove artificial ~4ms delay per yield in tight loops.

**Step 1: Edit implementation**
- File: `src/utils.js`
- Replace the `yieldToMain` function body (around line 483):
```js
// Before:
export function yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// After:
export function yieldToMain() {
    return scheduler.yield();
}
```
- Update the JSDoc comment to reference `scheduler.yield()` instead of `setTimeout`.

**Step 2: Verify**
- Command: `npm test`
- Expect: The existing `yieldToMain` test in `tests/utils.test.js:637` will fail because `scheduler` is not available in Node/vitest. Fix in next step.

**Step 3: Update the test**
- File: `tests/utils.test.js`
- The existing test (around line 637):
```js
describe('yieldToMain', () => {
    it('returns a promise that resolves', async () => {
        const before = performance.now();
        await yieldToMain();
        const after = performance.now();
        expect(after - before).toBeGreaterThanOrEqual(0);
    });
});
```
- Add a `beforeEach` to stub `globalThis.scheduler` since Node doesn't have it:
```js
describe('yieldToMain', () => {
    beforeEach(() => {
        globalThis.scheduler = { yield: () => Promise.resolve() };
    });
    afterEach(() => {
        delete globalThis.scheduler;
    });

    it('returns a promise that resolves', async () => {
        await yieldToMain();
        // scheduler.yield() resolves — no hang
    });
});
```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: All tests pass.

**Step 5: Git Commit**
- `git add . && git commit -m "perf: replace setTimeout(0) with scheduler.yield()"`

---

### Task 4: Add `bindSetting` helper and convert standard handlers

**Goal:** Replace 34 identical copy-paste handler blocks with declarative one-liners.

**Step 1: Add `bindSetting` helper**
- File: `src/ui/settings.js`
- Add this function at the top of `bindUIElements()`, before the first handler:
```js
function bindSetting(id, key, type = 'int', callback = null) {
    const event = type === 'bool' ? 'change' : 'input';
    $(`#openvault_${id}`).on(event, function () {
        let val;
        if (type === 'bool') val = $(this).is(':checked');
        else if (type === 'float') val = parseFloat($(this).val());
        else val = parseInt($(this).val(), 10);

        saveSetting(key, val);
        if (type !== 'bool') $(`#openvault_${id}_value`).text(val);
        if (callback) callback(val);
    });
}
```

**Step 2: Replace all 34 standard handlers**
- File: `src/ui/settings.js`
- Replace the handler blocks with these one-liners. Group by section, preserving existing comments.

```js
// Basic toggles
bindSetting('enabled', 'enabled', 'bool', () => updateEventListeners());
bindSetting('debug', 'debugMode', 'bool');
bindSetting('request_logging', 'requestLogging', 'bool');

// Extraction settings
bindSetting('messages_per_extraction', 'messagesPerExtraction');
bindSetting('extraction_rearview', 'extractionRearviewTokens', 'int', (v) =>
    updateWordsDisplay(v, 'openvault_extraction_rearview_words'));

// Retrieval pipeline settings
bindSetting('final_budget', 'retrievalFinalTokens', 'int', (v) =>
    updateWordsDisplay(v, 'openvault_final_budget_words'));

// Auto-hide settings
bindSetting('auto_hide', 'autoHideEnabled', 'bool');
bindSetting('auto_hide_threshold', 'autoHideThreshold');

// Scoring weights (alpha-blend)
bindSetting('alpha', 'alpha', 'float');
bindSetting('combined_weight', 'combinedBoostWeight', 'float');
bindSetting('vector_threshold', 'vectorSimilarityThreshold', 'float');
bindSetting('dedup_threshold', 'dedupSimilarityThreshold', 'float');
bindSetting('entity_merge_threshold', 'entityMergeSimilarityThreshold', 'float');
bindSetting('edge_description_cap', 'edgeDescriptionCap');

// Query context enhancement settings
bindSetting('entity_window', 'entityWindowSize');
bindSetting('embedding_window', 'embeddingWindowSize');
bindSetting('top_entities', 'topEntitiesCount');
bindSetting('entity_boost', 'entityBoostWeight', 'float');

// Feature settings
bindSetting('reflection_threshold', 'reflectionThreshold');
bindSetting('max_insights', 'maxInsightsPerReflection');
bindSetting('reflection_dedup_threshold', 'reflectionDedupThreshold', 'float', (v) =>
    updateReflectionDedupDisplay(v));
bindSetting('world_context_budget', 'worldContextBudget', 'int', (v) =>
    updateWordsDisplay(v, 'openvault_world_context_budget_words'));
bindSetting('community_interval', 'communityDetectionInterval');

// Forgetfulness curve settings
bindSetting('forgetfulness_lambda', 'forgetfulnessBaseLambda', 'float');
bindSetting('importance5_floor', 'forgetfulnessImportance5Floor');

// Reflection decay threshold
bindSetting('reflection_decay_threshold', 'reflectionDecayThreshold');

// Entity description cap
bindSetting('entity_description_cap', 'entityDescriptionCap');

// Max reflections per character
bindSetting('max_reflections', 'maxReflectionsPerCharacter');

// Community staleness threshold
bindSetting('community_staleness', 'communityStalenessThreshold');

// Jaccard dedup threshold
bindSetting('dedup_jaccard', 'dedupJaccardThreshold', 'float');
```

**Step 3: Keep these 7 handlers manual (unchanged)**
These don't fit the pattern:
1. `#openvault_backfill_rpm` — uses `validateRPM()` and writes corrected value back
2. `#openvault_ollama_url` — string `.trim()`, no display text
3. `#openvault_embedding_model` — string `.trim()`, no display text
4. `#openvault_embedding_query_prefix` — string, no display text
5. `#openvault_embedding_doc_prefix` — string, no display text
6. `#openvault_embedding_source` — complex async with strategy reset + prefix auto-populate
7. `#openvault_extraction_profile` — simple string saveSetting, no display text

**Step 4: Remove block comments from converted handlers**
The `// =========================================================================` banner comments above the NEW settings are no longer needed — the one-liners are self-documenting. Remove the multi-line banners for: forgetfulness settings, reflection decay, entity description cap, max reflections, community staleness, jaccard dedup.

**Step 5: Verify**
- Command: `npm test`
- Expect: All tests pass. `settings.js` has no unit tests (UI wiring — intentionally untested per ARCHITECTURE.md §3.5).
- Manual check: count lines in `bindUIElements` — should be ~80 lines shorter than before.

**Step 6: Git Commit**
- `git add . && git commit -m "refactor: replace 34 repetitive settings handlers with bindSetting()"`

---

### Task 5: Final verification and squash commit

**Goal:** Ensure all changes work together and the full test suite passes.

**Step 1: Run full test suite**
- Command: `npm test`
- Expect: All tests pass, zero regressions.

**Step 2: Verify line count reduction**
- Count lines in `src/ui/settings.js` — should be ~620-640 (down from 771).

**Step 3: Verify no dead code**
- Ensure no orphaned `$('#openvault_...')` handler blocks remain that were supposed to be converted.
- Ensure `updateWordsDisplay` and `updateReflectionDedupDisplay` are still referenced (they're used in callbacks).
