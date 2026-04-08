# Fix: IDF Cache Permanent Invalidation + Worker Race Condition

**Goal:** (1) IDF cache counts only active memories so it stays valid after archiving. (2) `resetSessionController()` always fires on chat switch even when extension is disabled.
**Architecture:** Filter archived memories before IDF calculation. Move session reset above the enabled check.
**Tech Stack:** Vanilla ESM, Vitest

---

### Task 1: Red test — IDF cache invalidation with archived memories

**Files:**
- Modify: `tests/extraction/extract.test.js`

**Common Pitfalls:**
- `updateIDFCache` is not exported — it's module-scoped. The test must test it through the exported pipeline, or the function needs to be exported.
- Check if it's already exported. If not, export it for testing.

- [ ] Step 1: Verify `updateIDFCache` export status

Search for `export` near `updateIDFCache` in `src/extraction/extract.js`. If not exported, add the export.

- [ ] Step 2: Write the failing test

```javascript
describe('updateIDFCache — archived memories', () => {
    it('counts only active memories, excluding archived', async () => {
        const { updateIDFCache } = await import('../../src/extraction/extract.js');

        const data = {
            memories: [
                { id: 'm1', summary: 'Active memory one', tokens: ['active', 'memory', 'one'] },
                { id: 'm2', summary: 'Active memory two', tokens: ['active', 'memory', 'two'] },
                { id: 'm3', summary: 'Archived memory', tokens: ['archived', 'memory'], archived: true },
                { id: 'm4', summary: 'Another archived', tokens: ['another', 'archived'], archived: true },
            ],
        };

        updateIDFCache(data);

        // Should count 2 active memories, NOT 4 total
        expect(data.idf_cache.memoryCount).toBe(2);
    });

    it('produces cache that validates against active-only corpus', async () => {
        const { updateIDFCache } = await import('../../src/extraction/extract.js');

        const data = {
            memories: [
                { id: 'm1', summary: 'Active one', tokens: ['active', 'one'] },
                { id: 'm2', summary: 'Active two', tokens: ['active', 'two'] },
                { id: 'm3', summary: 'Archived', tokens: ['archived'], archived: true },
            ],
        };

        updateIDFCache(data);

        // Simulate what scoreMemories validates:
        // activeMemories = memories.filter(m => !m.archived) → length = 2
        // hiddenMemories = [] → length = 0
        // totalCorpusSize = 2
        // cacheValid = idfCache.memoryCount === totalCorpusSize
        expect(data.idf_cache.memoryCount).toBe(2);
    });
});
```

- [ ] Step 3: Run test to verify it fails

Run: `npx vitest run tests/extraction/extract.test.js -t "archived memories"`
Expected: FAIL — `memoryCount` is 4 (counts all memories) instead of 2

- [ ] Step 4: Commit failing test

```bash
git add tests/extraction/extract.test.js && git commit -m "test: add failing tests for IDF cache archived memory exclusion"
```

---

### Task 2: Green — fix updateIDFCache to exclude archived

**Files:**
- Modify: `src/extraction/extract.js`

- [ ] Step 1: Write the implementation

In `updateIDFCache`, filter out archived memories before calculating:

```javascript
function updateIDFCache(data, _graphNodes = {}) {
    const allMemories = data[MEMORIES_KEY] || [];
    // Only include active (non-archived) memories in IDF calculation
    const memories = allMemories.filter((m) => !m.archived);
    if (memories.length === 0) return;

    // Build tokenized corpus from active memory tokens
    const tokenizedMemories = new Map();
    for (let i = 0; i < memories.length; i++) {
        const m = memories[i];
        // Use pre-computed tokens if available, otherwise tokenize summary
        tokenizedMemories.set(i, m.tokens || tokenize(m.summary || ''));
    }

    // Calculate IDF from active memories only
    const { idfMap, avgDL } = calculateIDF(memories, tokenizedMemories);

    // Convert Map to plain object for JSON serialization
    const idfCache = {
        idfMap: Object.fromEntries(idfMap),
        avgDL,
        memoryCount: memories.length,
        timestamp: Date.now(),
    };

    data.idf_cache = idfCache;
    logDebug(`IDF cache updated: ${memories.length} active memories, avgDL=${avgDL.toFixed(2)}`);
}
```

- [ ] Step 2: Run tests

Run: `npx vitest run tests/extraction/extract.test.js -t "archived memories"`
Expected: ALL PASS

- [ ] Step 3: Run full extraction tests

Run: `npx vitest run tests/extraction/`
Expected: ALL PASS

- [ ] Step 4: Commit

```bash
git add src/extraction/extract.js && git commit -m "fix: exclude archived memories from IDF cache count"
```

---

### Task 3: Red test — onChatChanged resetSessionController ordering

**Files:**
- Modify: `tests/events.test.js`

**Common Pitfalls:**
- `resetSessionController` is in `src/state.js` and fires `AbortController.abort()`
- Need to mock `isExtensionEnabled` to return `false` and verify `resetSessionController` still fires
- Must use `vi.resetModules()` and `global.registerCdnOverrides()` to re-import with different mock state

- [ ] Step 1: Write the failing test

```javascript
describe('onChatChanged — session reset', () => {
    it('resets session controller even when extension is disabled', async () => {
        // Set up a session controller that we can observe
        const { resetSessionController, getSessionSignal } = await import('../src/state.js');
        resetSessionController(); // fresh controller
        const oldSignal = getSessionSignal();
        expect(oldSignal.aborted).toBe(false);

        // Now disable the extension
        setupTestContext({
            settings: {
                enabled: false, // Extension disabled
            },
            deps: {
                saveChatConditional: vi.fn(async () => true),
            },
        });

        // Switch chat while extension is disabled
        const { onChatChanged } = await import('../src/events.js');
        await onChatChanged();

        // The old signal should have been aborted regardless of extension state
        expect(oldSignal.aborted).toBe(true);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/events.test.js -t "session reset"`
Expected: FAIL — `oldSignal.aborted` is `false` because `onChatChanged` returned early

- [ ] Step 3: Commit failing test

```bash
git add tests/events.test.js && git commit -m "test: add failing test for onChatChanged session reset when disabled"
```

---

### Task 4: Green — fix onChatChanged ordering

**Files:**
- Modify: `src/events.js`

- [ ] Step 1: Write the implementation

Move `resetSessionController()` above the `isExtensionEnabled()` check:

```javascript
async function onChatChanged() {
    // FIRST: abort all in-flight operations from previous chat
    // This must run regardless of extension state to prevent stale workers
    resetSessionController();

    if (!isExtensionEnabled()) return;

    // ... rest of function unchanged ...
```

The change is literally swapping lines 220 and 223 in the current code.

- [ ] Step 2: Run tests

Run: `npx vitest run tests/events.test.js`
Expected: ALL PASS

- [ ] Step 3: Commit

```bash
git add src/events.js && git commit -m "fix: always reset session controller on chat change, even when disabled"
```

---

### Task 5: Run full pre-commit checks

- [ ] Step 1: Run `npm run check`

Run: `npm run check`
Expected: PASS

- [ ] Step 2: Run full test suite

Run: `npm test`
Expected: ALL PASS

- [ ] Step 3: Final commit if any auto-fixes applied

```bash
git add -A && git commit -m "chore: pre-commit fixes for cache and lifecycle changes"
```
