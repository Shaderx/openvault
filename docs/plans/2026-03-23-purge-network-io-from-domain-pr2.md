# Purge Network I/O from Domain Logic — Implementation Plan

**Goal:** Remove all ST Vector Storage network calls from `graph.js`, `communities.js`, and `reflect.js`. Domain functions return change sets; orchestrator (`extract.js`) handles bulk I/O at phase boundaries.

**Architecture:** Domain functions (`mergeOrInsertEntity`, `consolidateEdges`, `updateCommunitySummaries`, `generateReflections`) stop calling `syncItemsToST`/`deleteItemsFromST` and instead return `stChanges` objects. A new `applySyncChanges()` helper in `extract.js` collects and dispatches these at phase boundaries. Dead code (`consolidateGraph`, `redirectEdges`) is deleted.

**Tech Stack:** Vitest, ESM, no new dependencies.

**Design doc:** `docs/designs/2026-03-23-purge-network-io-from-domain-pr2.md`

---

**File Structure Overview:**
- Modify: `src/graph/graph.js` — delete dead code, refactor `mergeOrInsertEntity` and `consolidateEdges` return shapes, remove ST imports
- Modify: `src/graph/communities.js` — refactor `updateCommunitySummaries` return shape, remove ST imports
- Modify: `src/reflection/reflect.js` — refactor `generateReflections` return shape, remove ST imports
- Modify: `src/extraction/extract.js` — add `applySyncChanges` helper, wire change sets at phase boundaries
- Modify: `tests/graph/graph.test.js` — delete dead tests, update return-shape assertions
- Modify: `tests/graph/communities.test.js` — add `stChanges` assertions
- Modify: `tests/reflection/reflect.test.js` — update return-shape assertions
- Modify: `tests/extraction/extract.test.js` — verify orchestrator wiring

**Common Pitfalls:**
- `mergeOrInsertEntity` has 5 return paths (fast path, cross-script merge, no-embedding fallback, semantic merge, new node). ALL must return `{ key, stChanges }`.
- `consolidateEdges` runs LLM calls inside `Promise.all` via `ladderQueue`. The `stChanges` array must be populated inside the per-edge callback, then returned from the outer function.
- `generateReflections` currently returns a bare array (`toAdd`). Every call site destructures `reflections`. The test file also checks `reflections.length` and `reflections[0].type` — these must be updated to `result.reflections.length`, etc.
- `communities.test.js` uses `vi.mock('../../src/utils/embedding-codec.js')` which mocks `cyrb53` away. Tests asserting `stChanges.toSync[].hash` will get `undefined` unless the mock provides a `cyrb53` implementation. Add `cyrb53: vi.fn((str) => str.length)` to the mock.
- `extract.test.js` is a locked orchestrator file (≤5 tests). Do NOT add new permutation tests. Only wire the new return shape destructuring.

---

### Task 1: Delete dead code — `consolidateGraph` and `redirectEdges`

**Files:**
- Modify: `src/graph/graph.js`
- Modify: `tests/graph/graph.test.js`

- [ ] Step 1: Write a test verifying `consolidateGraph` and `redirectEdges` are no longer exported

Add to the top of `tests/graph/graph.test.js`, a new describe block:

```js
describe('dead code removal', () => {
    it('consolidateGraph is no longer exported', async () => {
        const exports = await import('../../src/graph/graph.js');
        expect(exports.consolidateGraph).toBeUndefined();
    });

    it('redirectEdges is no longer exported', async () => {
        const exports = await import('../../src/graph/graph.js');
        expect(exports.redirectEdges).toBeUndefined();
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/graph/graph.test.js -t "dead code removal" --run`
Expected: FAIL — both functions still exist.

- [ ] Step 3: Delete `consolidateGraph` and `redirectEdges` from `graph.js`

In `src/graph/graph.js`:

1. Delete the entire `redirectEdges` function (the `export async function redirectEdges(graphData, oldKey, newKey)` block from its JSDoc comment through to its closing brace — approximately lines 520–595).

2. Delete the entire `consolidateGraph` function (the `export async function consolidateGraph(graphData, settings)` block from its JSDoc comment through to its closing brace — approximately lines 597–710).

3. Remove the now-unused import of `yieldToMain` from `'../utils/st-helpers.js'` (it was only used by `consolidateGraph`).

- [ ] Step 4: Delete existing tests for `consolidateGraph` and `redirectEdges`

In `tests/graph/graph.test.js`:

1. Delete the entire `describe('redirectEdges', ...)` block (approximately lines 380–440).

2. Delete the entire `describe('consolidateGraph', ...)` block (approximately 4 tests covering merges, type checking, edge redirection, and alias persistence).

3. Remove `consolidateGraph` and `redirectEdges` from the import statement at the top of the file:
```js
// BEFORE
import {
    consolidateEdges,
    consolidateGraph,
    createEmptyGraph,
    expandMainCharacterKeys,
    findCrossScriptCharacterKeys,
    initGraphState,
    markEdgeForConsolidation,
    mergeOrInsertEntity,
    normalizeKey,
    redirectEdges,
    shouldMergeEntities,
    upsertEntity,
    upsertRelationship,
} from '../../src/graph/graph.js';

// AFTER
import {
    consolidateEdges,
    createEmptyGraph,
    expandMainCharacterKeys,
    findCrossScriptCharacterKeys,
    initGraphState,
    markEdgeForConsolidation,
    mergeOrInsertEntity,
    normalizeKey,
    shouldMergeEntities,
    upsertEntity,
    upsertRelationship,
} from '../../src/graph/graph.js';
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/graph/graph.test.js --run`
Expected: ALL PASS. Dead code removed, dead tests removed, new "dead code removal" tests pass.

- [ ] Step 6: Clean up now-unused imports in `graph.js`

After deleting `consolidateGraph` and `redirectEdges`, check if any imports in `graph.js` are now unused:

- `deleteItemsFromST` — was used by `redirectEdges` and `consolidateGraph`. Check if still used by `mergeOrInsertEntity` or `consolidateEdges`. Per the codebase: `deleteItemsFromST` is NOT used by `mergeOrInsertEntity` (only `syncItemsToST`) or `consolidateEdges` (only `syncItemsToST`). **Remove** `deleteItemsFromST` from imports.
- `yieldToMain` — only used by `consolidateGraph`. **Remove** from imports.

In `src/graph/graph.js`, update the import from `data.js`:
```js
// BEFORE
import { deleteItemsFromST, getCurrentChatId, isStVectorSource, syncItemsToST } from '../utils/data.js';

// AFTER (deleteItemsFromST removed; others still used by mergeOrInsertEntity/consolidateEdges for now)
import { getCurrentChatId, isStVectorSource, syncItemsToST } from '../utils/data.js';
```

Remove the `yieldToMain` import line:
```js
// DELETE this line
import { yieldToMain } from '../utils/st-helpers.js';
```

- [ ] Step 7: Run full test suite to verify no regressions

Run: `npx vitest tests/graph/graph.test.js --run`
Expected: ALL PASS.

- [ ] Step 8: Commit

```bash
git add src/graph/graph.js tests/graph/graph.test.js && git commit -m "$(cat <<'EOF'
refactor(graph): delete dead code — consolidateGraph and redirectEdges

Both functions had zero call sites in production. Remove them along
with their tests and now-unused imports (deleteItemsFromST, yieldToMain).
EOF
)"
```

---

### Task 2: Refactor `mergeOrInsertEntity` to return `{ key, stChanges }`

**Files:**
- Modify: `src/graph/graph.js`
- Modify: `tests/graph/graph.test.js`

- [ ] Step 1: Update existing tests to expect `{ key, stChanges }` return shape

In `tests/graph/graph.test.js`, update the `describe('mergeOrInsertEntity', ...)` block. Every test that does `const key = await mergeOrInsertEntity(...)` or `expect(key).toBe(...)` must destructure:

```js
// BEFORE
const key = await mergeOrInsertEntity(graphData, 'castle', 'PLACE', 'Updated', 3, mockSettings);
expect(key).toBe('castle');

// AFTER
const { key } = await mergeOrInsertEntity(graphData, 'castle', 'PLACE', 'Updated', 3, mockSettings);
expect(key).toBe('castle');
```

Apply this pattern to ALL tests in the `mergeOrInsertEntity` describe block. There are ~14 tests that call `mergeOrInsertEntity` and check the returned key. Update each one.

Also update the `describe('edge creation with semantic merge', ...)` test:
```js
// BEFORE
const resolvedKey = await mergeOrInsertEntity(graphData, "Vova's Room", 'PLACE', 'A room', 3, settings);
expect(resolvedKey).toBe('vova apartment');

// AFTER
const { key: resolvedKey } = await mergeOrInsertEntity(graphData, "Vova's Room", 'PLACE', 'A room', 3, settings);
expect(resolvedKey).toBe('vova apartment');
```

And the `describe('_mergeRedirects serialization', ...)` test:
```js
// BEFORE (no key assertion, just calls mergeOrInsertEntity)
await mergeOrInsertEntity(graphData, 'Alice Smith', 'PERSON', 'Also Alice', 3, { ... });

// AFTER (no change needed — destructuring is optional when return value isn't used)
```

And the `describe('mergeOrInsertEntity - description in embedding', ...)` test — same, no key assertion, no change needed.

- [ ] Step 2: Add a test for `stChanges` on new-node creation path

Add to the `describe('mergeOrInsertEntity', ...)` block:

```js
it('returns stChanges.toSync with new node when creating a new entity', async () => {
    const { getDocumentEmbedding } = await import('../../src/embeddings.js');
    const { cyrb53 } = await import('../../src/utils/embedding-codec.js');
    getDocumentEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

    const { key, stChanges } = await mergeOrInsertEntity(graphData, 'Dragon', 'PERSON', 'A fire beast', 3, mockSettings);
    expect(key).toBe('dragon');
    expect(stChanges.toSync).toHaveLength(1);
    expect(stChanges.toSync[0].text).toBe('[OV_ID:dragon] A fire beast');
    expect(stChanges.toSync[0].item).toBe(graphData.nodes.dragon);
    expect(stChanges.toSync[0].hash).toBeDefined();
    expect(stChanges.toDelete).toHaveLength(0);
});

it('returns empty stChanges on fast path (exact key match)', async () => {
    upsertEntity(graphData, 'Castle', 'PLACE', 'A fortress');
    const { key, stChanges } = await mergeOrInsertEntity(graphData, 'castle', 'PLACE', 'Updated', 3, mockSettings);
    expect(key).toBe('castle');
    expect(stChanges.toSync).toHaveLength(0);
    expect(stChanges.toDelete).toHaveLength(0);
});

it('returns empty stChanges on semantic merge path (existing node updated)', async () => {
    const { getDocumentEmbedding } = await import('../../src/embeddings.js');
    getDocumentEmbedding.mockResolvedValue([0.9, 0.1, 0]);

    upsertEntity(graphData, "Vova's House", 'PLACE', 'Home');
    graphData.nodes['vova house'].embedding = [0.9, 0.1, 0];

    const { key, stChanges } = await mergeOrInsertEntity(graphData, "Vova's Apartment", 'PLACE', 'Flat', 3, mockSettings);
    expect(key).toBe('vova house');
    expect(stChanges.toSync).toHaveLength(0);
    expect(stChanges.toDelete).toHaveLength(0);
});
```

- [ ] Step 3: Run tests to verify they fail

Run: `npx vitest tests/graph/graph.test.js -t "mergeOrInsertEntity" --run`
Expected: FAIL — `mergeOrInsertEntity` returns a string, not `{ key, stChanges }`.

- [ ] Step 4: Implement the new return shape in `mergeOrInsertEntity`

In `src/graph/graph.js`, modify `mergeOrInsertEntity`:

1. At the top of the function, initialize the change set:
```js
export async function mergeOrInsertEntity(graphData, name, type, description, cap, settings) {
    const key = normalizeKey(name);
    const stChanges = { toSync: [], toDelete: [] };
```

2. **Fast path** (exact key match) — change `return key;` to:
```js
return { key, stChanges };
```

3. **Cross-script merge** (PERSON Cyrillic match) — change `return existingKey;` to:
```js
return { key: existingKey, stChanges };
```

4. **No embedding fallback** — change `return key;` to:
```js
return { key, stChanges };
```

5. **Semantic merge** — change `return bestMatch;` to:
```js
return { key: bestMatch, stChanges };
```

6. **New node creation** (bottom of function) — replace the ST sync block and final return:
```js
// BEFORE
    // No match: create new node with embedding
    upsertEntity(graphData, name, type, description, cap);
    setEmbedding(graphData.nodes[key], newEmbedding);

    // Sync graph node to ST Vector Storage
    if (isStVectorSource()) {
        const chatId = getCurrentChatId();
        const node = graphData.nodes[key];
        const text = `[OV_ID:${key}] ${node.description}`;
        await syncItemsToST([{ hash: cyrb53(text), text }], chatId);
        markStSynced(node);
    }

    return key;

// AFTER
    // No match: create new node with embedding
    upsertEntity(graphData, name, type, description, cap);
    setEmbedding(graphData.nodes[key], newEmbedding);

    const node = graphData.nodes[key];
    const text = `[OV_ID:${key}] ${node.description}`;
    stChanges.toSync.push({ hash: cyrb53(text), text, item: node });

    return { key, stChanges };
```

7. Remove now-unused imports. After this change, `syncItemsToST`, `isStVectorSource`, `getCurrentChatId`, and `markStSynced` may still be used by `consolidateEdges`. Check:
   - `syncItemsToST` — still used by `consolidateEdges`. Keep for now.
   - `isStVectorSource` — still used by `consolidateEdges`. Keep for now.
   - `getCurrentChatId` — still used by `consolidateEdges`. Keep for now.
   - `markStSynced` — still used by `consolidateEdges`. Keep for now.

   So no import changes yet.

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/graph/graph.test.js -t "mergeOrInsertEntity" --run`
Expected: ALL PASS.

- [ ] Step 6: Commit

```bash
git add src/graph/graph.js tests/graph/graph.test.js && git commit -m "$(cat <<'EOF'
refactor(graph): mergeOrInsertEntity returns { key, stChanges }

Instead of calling syncItemsToST directly, the function now returns
a change set. The orchestrator will handle network I/O.
EOF
)"
```

---

### Task 3: Refactor `consolidateEdges` to return `{ count, stChanges }`

**Files:**
- Modify: `src/graph/graph.js`
- Modify: `tests/graph/graph.test.js`

- [ ] Step 1: Update existing tests and add `stChanges` assertion

In `tests/graph/graph.test.js`, update the `describe('consolidateEdges', ...)` block:

```js
it('consolidates edges marked for consolidation', async () => {
    const { callLLM: mockCallLLM } = await import('../../src/llm.js');
    const { isEmbeddingsEnabled } = await import('../../src/embeddings.js');

    mockCallLLM.mockResolvedValue(JSON.stringify({ consolidated_description: 'From strangers to battle allies' }));
    isEmbeddingsEnabled.mockReturnValue(false);

    const graph = {
        nodes: {
            alice: { name: 'Alice', type: 'PERSON', description: 'test', mentions: 1, embedding_b64: null },
            bob: { name: 'Bob', type: 'PERSON', description: 'test', mentions: 1, embedding_b64: null },
        },
        edges: {
            alice__bob: {
                source: 'alice',
                target: 'bob',
                description: 'Met | Traded | Fought | Celebrated | Parted',
                weight: 5,
                _descriptionTokens: 600,
            },
        },
        _edgesNeedingConsolidation: ['alice__bob'],
    };

    const mockSettings = { consolidationTokenThreshold: 500 };

    const { count, stChanges } = await consolidateEdges(graph, mockSettings);
    expect(count).toBe(1);
    expect(graph.edges.alice__bob.description).toBe('From strangers to battle allies');
    expect(graph._edgesNeedingConsolidation).toHaveLength(0);
    // stChanges contains the consolidated edge for ST sync
    expect(stChanges.toSync).toHaveLength(1);
    expect(stChanges.toSync[0].text).toBe('[OV_ID:edge_alice_bob] From strangers to battle allies');
    expect(stChanges.toSync[0].item).toBe(graph.edges.alice__bob);
});

it('returns 0 count and empty stChanges when no edges need consolidation', async () => {
    const graph = {
        nodes: {
            alice: { name: 'Alice', type: 'PERSON', description: 'test', mentions: 1 },
            bob: { name: 'Bob', type: 'PERSON', description: 'test', mentions: 1 },
        },
        edges: {
            alice__bob: {
                source: 'alice',
                target: 'bob',
                description: 'Met',
                weight: 1,
                _descriptionTokens: 5,
            },
        },
        _edgesNeedingConsolidation: [],
    };

    const { count, stChanges } = await consolidateEdges(graph, {});
    expect(count).toBe(0);
    expect(stChanges.toSync).toHaveLength(0);
});

it('respects MAX_CONSOLIDATION_BATCH limit', async () => {
    const { callLLM: mockCallLLM } = await import('../../src/llm.js');
    const { isEmbeddingsEnabled } = await import('../../src/embeddings.js');

    mockCallLLM.mockResolvedValue(JSON.stringify({ consolidated_description: 'Consolidated' }));
    isEmbeddingsEnabled.mockReturnValue(false);

    const graph = {
        nodes: {},
        edges: {},
        _edgesNeedingConsolidation: [],
    };

    for (let i = 0; i < 15; i++) {
        const src = `node${i}`;
        const tgt = `node${i + 1}`;
        graph.nodes[src] = { name: src, type: 'PERSON', description: 'test', mentions: 1 };
        graph.nodes[tgt] = { name: tgt, type: 'PERSON', description: 'test', mentions: 1 };
        graph.edges[`${src}__${tgt}`] = {
            source: src,
            target: tgt,
            description: 'Long description',
            weight: 1,
            _descriptionTokens: 600,
        };
        graph._edgesNeedingConsolidation.push(`${src}__${tgt}`);
    }

    const { count, stChanges } = await consolidateEdges(graph, {});
    expect(count).toBe(10);
    expect(graph._edgesNeedingConsolidation).toHaveLength(5);
    expect(stChanges.toSync).toHaveLength(10);
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest tests/graph/graph.test.js -t "consolidateEdges" --run`
Expected: FAIL — `consolidateEdges` returns a number, not `{ count, stChanges }`.

- [ ] Step 3: Implement the new return shape in `consolidateEdges`

In `src/graph/graph.js`, modify `consolidateEdges`:

1. At the top, handle the early return:
```js
export async function consolidateEdges(graphData, _settings) {
    if (!graphData._edgesNeedingConsolidation?.length) {
        return { count: 0, stChanges: { toSync: [] } };
    }
```

2. Initialize `stChanges` after the early return guard:
```js
    const stChanges = { toSync: [] };
    const toProcess = graphData._edgesNeedingConsolidation.slice(0, CONSOLIDATION.MAX_CONSOLIDATION_BATCH);
```

3. Inside the per-edge success callback (after `setEmbedding` and the edge description update), replace the ST sync block:
```js
// BEFORE
                        // Sync consolidated edge to ST Vector Storage
                        if (isStVectorSource()) {
                            const chatId = getCurrentChatId();
                            const edgeId = `edge_${edge.source}_${edge.target}`;
                            const text = `[OV_ID:${edgeId}] ${edge.description}`;
                            await syncItemsToST([{ hash: cyrb53(text), text, index: 0 }], chatId);
                            markStSynced(edge);
                        }

// AFTER
                        const edgeId = `edge_${edge.source}_${edge.target}`;
                        const text = `[OV_ID:${edgeId}] ${edge.description}`;
                        stChanges.toSync.push({ hash: cyrb53(text), text, item: edge });
```

4. Change the final return:
```js
// BEFORE
    return successfulKeys.length;

// AFTER
    return { count: successfulKeys.length, stChanges };
```

5. Now remove ALL remaining ST imports from `graph.js`. After this change, `syncItemsToST`, `isStVectorSource`, `getCurrentChatId`, and `markStSynced` are no longer used anywhere in the file:

```js
// BEFORE
import { getCurrentChatId, isStVectorSource, syncItemsToST } from '../utils/data.js';
import { cyrb53, getEmbedding, hasEmbedding, markStSynced, setEmbedding } from '../utils/embedding-codec.js';

// AFTER
import { cyrb53, getEmbedding, hasEmbedding, setEmbedding } from '../utils/embedding-codec.js';
```

Delete the entire `data.js` import line — no functions from it are used anymore.

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest tests/graph/graph.test.js --run`
Expected: ALL PASS.

- [ ] Step 5: Run full test suite for regressions

Run: `npm run test:run`
Expected: Failures in `extract.test.js` (callers of `mergeOrInsertEntity` and `consolidateEdges` not yet updated). Graph tests pass. This is expected — orchestrator wiring happens in Task 6.

- [ ] Step 6: Commit

```bash
git add src/graph/graph.js tests/graph/graph.test.js && git commit -m "$(cat <<'EOF'
refactor(graph): consolidateEdges returns { count, stChanges }

Remove all ST Vector imports from graph.js. Both mergeOrInsertEntity
and consolidateEdges now return change sets instead of making network calls.
EOF
)"
```

---

### Task 4: Refactor `updateCommunitySummaries` to return `stChanges`

**Files:**
- Modify: `src/graph/communities.js`
- Modify: `tests/graph/communities.test.js`

- [ ] Step 1: Add `cyrb53` to the embedding-codec mock in `communities.test.js`

The existing mock in `tests/graph/communities.test.js` does not include `cyrb53`. Add it:

```js
// Find the existing vi.mock('../../src/utils/embedding-codec.js', ...) block and add:
    cyrb53: vi.fn((str) => str.length),  // Simple hash stub for testing
```

- [ ] Step 2: Add `stChanges` assertions to existing tests

In `tests/graph/communities.test.js`, update the `describe('updateCommunitySummaries', ...)` block:

In the `'generates summaries for new communities'` test, add at the end:
```js
    // stChanges contains the new community for ST sync
    expect(result.stChanges).toBeDefined();
    expect(result.stChanges.toSync.length).toBeGreaterThan(0);
    expect(result.stChanges.toSync[0].text).toContain('[OV_ID:C0]');
    expect(result.stChanges.toSync[0].item).toBe(result.communities.C0);
```

In the `'skips communities whose membership has not changed'` test, add:
```js
    // Existing unchanged community is still in stChanges (idempotent sync)
    expect(result.stChanges).toBeDefined();
    expect(result.stChanges.toSync.length).toBeGreaterThan(0);
```

In the `'skips communities with fewer than 2 nodes'` test, add:
```js
    expect(result.stChanges).toBeDefined();
    expect(result.stChanges.toSync).toHaveLength(0);
```

In the `'handles LLM errors gracefully by keeping existing communities'` test, add:
```js
    expect(result.stChanges).toBeDefined();
    // Existing community has a summary so it's in stChanges
    expect(result.stChanges.toSync.length).toBeGreaterThan(0);
```

Also update `describe('updateCommunitySummaries with queue', ...)`:

```js
    // Verify stChanges returned
    expect(result.stChanges).toBeDefined();
    expect(result.stChanges.toSync).toHaveLength(3);
```

- [ ] Step 3: Run tests to verify they fail

Run: `npx vitest tests/graph/communities.test.js -t "updateCommunitySummaries" --run`
Expected: FAIL — `result.stChanges` is `undefined`.

- [ ] Step 4: Implement the new return shape in `updateCommunitySummaries`

In `src/graph/communities.js`:

1. Remove ST-related imports from `data.js`:
```js
// BEFORE
import { getCurrentChatId, isStVectorSource, syncItemsToST } from '../utils/data.js';

// AFTER — delete the entire import line (no data.js functions needed)
```

2. Remove ST-related imports from `embedding-codec.js`:
```js
// BEFORE
import { cyrb53, hasEmbedding, isStSynced, markStSynced, setEmbedding } from '../utils/embedding-codec.js';

// AFTER
import { cyrb53, hasEmbedding, setEmbedding } from '../utils/embedding-codec.js';
```

3. Replace the `if (isStVectorSource()) { ... }` block (after `await Promise.all(promises)`) with the `stChanges` construction:
```js
// BEFORE
    // Sync community summaries to ST Vector Storage
    if (isStVectorSource()) {
        const chatId = getCurrentChatId();
        const items = [];
        for (const [id, community] of Object.entries(updatedCommunities)) {
            if (community.summary && !isStSynced(community)) {
                const text = `[OV_ID:${id}] ${community.summary}`;
                items.push({ hash: cyrb53(text), text, index: 0 });
                markStSynced(community);
            }
        }
        if (items.length > 0) {
            await syncItemsToST(items, chatId);
        }
    }

// AFTER
    // Build change set for ST sync (orchestrator handles network I/O)
    const stChanges = { toSync: [] };
    for (const [id, community] of Object.entries(updatedCommunities)) {
        if (community.summary) {
            const text = `[OV_ID:${id}] ${community.summary}`;
            stChanges.toSync.push({ hash: cyrb53(text), text, item: community });
        }
    }
```

4. Update the return statement at the bottom of the function:
```js
// BEFORE
    return { communities: updatedCommunities, global_world_state: globalState };

// AFTER
    return { communities: updatedCommunities, global_world_state: globalState, stChanges };
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/graph/communities.test.js --run`
Expected: ALL PASS.

- [ ] Step 6: Commit

```bash
git add src/graph/communities.js tests/graph/communities.test.js && git commit -m "$(cat <<'EOF'
refactor(communities): updateCommunitySummaries returns stChanges

Remove all ST Vector imports from communities.js. Community sync
data is returned to the orchestrator instead of sent directly.
EOF
)"
```

---

### Task 5: Refactor `generateReflections` to return `{ reflections, stChanges }`

**Files:**
- Modify: `src/reflection/reflect.js`
- Modify: `tests/reflection/reflect.test.js`

- [ ] Step 1: Update existing tests to expect `{ reflections, stChanges }` return shape

In `tests/reflection/reflect.test.js`, update the `describe('generateReflections', ...)` block:

```js
it('returns reflection memory objects', async () => {
    const { reflections } = await generateReflections(characterName, allMemories, characterStates);
    expect(reflections.length).toBeGreaterThan(0);
    expect(reflections[0].type).toBe('reflection');
    expect(reflections[0].character).toBe('Alice');
    expect(reflections[0].source_ids).toBeDefined();
    expect(reflections[0].summary).toBeDefined();
    expect(reflections[0].embedding).toBeDefined();
});

it('makes 1 LLM call total (unified reflection)', async () => {
    await generateReflections(characterName, allMemories, characterStates);
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
});

it('assigns importance 4 to reflections by default', async () => {
    const { reflections } = await generateReflections(characterName, allMemories, characterStates);
    for (const r of reflections) {
        expect(r.importance).toBe(4);
    }
});

it('sets character as sole witness', async () => {
    const { reflections } = await generateReflections(characterName, allMemories, characterStates);
    for (const r of reflections) {
        expect(r.witnesses).toEqual(['Alice']);
    }
});
```

Add a new test for `stChanges`:

```js
it('returns stChanges with sync items for each reflection', async () => {
    const { reflections, stChanges } = await generateReflections(characterName, allMemories, characterStates);
    expect(stChanges.toSync).toHaveLength(reflections.length);
    for (let i = 0; i < reflections.length; i++) {
        expect(stChanges.toSync[i].text).toContain(`[OV_ID:${reflections[i].id}]`);
        expect(stChanges.toSync[i].item).toBe(reflections[i]);
        expect(stChanges.toSync[i].hash).toBeDefined();
    }
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest tests/reflection/reflect.test.js -t "generateReflections" --run`
Expected: FAIL — `generateReflections` returns a bare array, not `{ reflections, stChanges }`.

- [ ] Step 3: Implement the new return shape in `generateReflections`

In `src/reflection/reflect.js`:

1. Remove ST-related imports from `data.js`:
```js
// BEFORE
import { generateId, getCurrentChatId, isStVectorSource, syncItemsToST } from '../utils/data.js';

// AFTER
import { generateId } from '../utils/data.js';
```

2. Remove ST-related imports from `embedding-codec.js`:
```js
// BEFORE
import { cyrb53, getEmbedding, hasEmbedding, isStSynced, markStSynced } from '../utils/embedding-codec.js';

// AFTER
import { cyrb53, getEmbedding, hasEmbedding } from '../utils/embedding-codec.js';
```

3. Replace the ST sync block and return statement at the bottom of `generateReflections`:
```js
// BEFORE
    // Sync reflections to ST Vector Storage if enabled
    if (isStVectorSource()) {
        const chatId = getCurrentChatId();
        const unsyncedReflections = toAdd.filter((r) => !isStSynced(r));
        if (unsyncedReflections.length > 0) {
            const items = unsyncedReflections.map((r) => ({
                hash: cyrb53(`[OV_ID:${r.id}] ${r.summary}`),
                text: `[OV_ID:${r.id}] ${r.summary}`,
                index: 0,
            }));
            const success = await syncItemsToST(items, chatId);
            if (success) {
                for (const r of unsyncedReflections) markStSynced(r);
            }
        }
    }

    record('llm_reflection', performance.now() - t0);
    return toAdd;

// AFTER
    const stChanges = { toSync: [] };
    for (const r of toAdd) {
        const text = `[OV_ID:${r.id}] ${r.summary}`;
        stChanges.toSync.push({ hash: cyrb53(text), text, item: r });
    }

    record('llm_reflection', performance.now() - t0);
    return { reflections: toAdd, stChanges };
```

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest tests/reflection/reflect.test.js --run`
Expected: ALL PASS.

- [ ] Step 5: Commit

```bash
git add src/reflection/reflect.js tests/reflection/reflect.test.js && git commit -m "$(cat <<'EOF'
refactor(reflect): generateReflections returns { reflections, stChanges }

Remove all ST Vector imports from reflect.js. Reflection sync data
is returned to the orchestrator instead of sent directly.
EOF
)"
```

---

### Task 6: Wire `applySyncChanges` in `extract.js` orchestrator

**Files:**
- Modify: `src/extraction/extract.js`
- Modify: `tests/extraction/extract.test.js`

- [ ] Step 1: Add `applySyncChanges` helper and update Phase 1 entity wiring

In `src/extraction/extract.js`:

1. Add the helper function (after the `rpmDelay` function, before the main `extractMemories` function):

```js
/**
 * Apply ST Vector Storage sync changes from domain function return values.
 * Handles both sync (insert) and delete operations in bulk.
 * @param {{ toSync?: Array<{hash: number, text: string, item: object}>, toDelete?: Array<{hash: number}> }} stChanges
 */
async function applySyncChanges(stChanges) {
    if (!isStVectorSource()) return;
    const chatId = getCurrentChatId();
    if (stChanges.toSync?.length > 0) {
        const items = stChanges.toSync.map((c) => ({ hash: c.hash, text: c.text, index: 0 }));
        const success = await syncItemsToST(items, chatId);
        if (success) {
            for (const c of stChanges.toSync) markStSynced(c.item);
        }
    }
    if (stChanges.toDelete?.length > 0) {
        await deleteItemsFromST(stChanges.toDelete.map((c) => c.hash), chatId);
    }
}
```

2. Add `deleteItemsFromST` to the `data.js` import (it will be needed for future delete operations, and `applySyncChanges` supports it):

```js
// BEFORE
import {
    getCurrentChatId,
    getOpenVaultData,
    isStVectorSource,
    saveOpenVaultData,
    syncItemsToST,
} from '../utils/data.js';

// AFTER
import {
    deleteItemsFromST,
    getCurrentChatId,
    getOpenVaultData,
    isStVectorSource,
    saveOpenVaultData,
    syncItemsToST,
} from '../utils/data.js';
```

3. Update the entity loop in Phase 1 (`extractMemories`, around line 638):

```js
// BEFORE
        if (validated.entities) {
            const t0Merge = performance.now();
            const existingNodeCount = Object.keys(data.graph.nodes).length;
            for (const entity of validated.entities) {
                if (entity.name === 'Unknown') continue;
                await mergeOrInsertEntity(
                    data.graph,
                    entity.name,
                    entity.type,
                    entity.description,
                    entityCap,
                    settings
                );
            }

// AFTER
        const graphSyncChanges = { toSync: [], toDelete: [] };
        if (validated.entities) {
            const t0Merge = performance.now();
            const existingNodeCount = Object.keys(data.graph.nodes).length;
            for (const entity of validated.entities) {
                if (entity.name === 'Unknown') continue;
                const { stChanges: entityChanges } = await mergeOrInsertEntity(
                    data.graph,
                    entity.name,
                    entity.type,
                    entity.description,
                    entityCap,
                    settings
                );
                graphSyncChanges.toSync.push(...entityChanges.toSync);
                graphSyncChanges.toDelete.push(...entityChanges.toDelete);
            }
```

4. After the existing event ST sync block (around line 703), add graph sync:

```js
        // (existing event sync block stays as-is)

        // Sync graph nodes to ST Vector Storage
        await applySyncChanges(graphSyncChanges);
```

- [ ] Step 2: Update Phase 2 reflection wiring in `extractMemories`

In `extractMemories`, around line 736, update the reflection callback:

```js
// BEFORE
                            ladderQueue
                                .add(async () => {
                                    const reflections = await generateReflections(
                                        characterName,
                                        data[MEMORIES_KEY] || [],
                                        data[CHARACTERS_KEY] || {}
                                    );
                                    if (reflections.length > 0) {
                                        data[MEMORIES_KEY].push(...reflections);
                                    }

// AFTER
                            ladderQueue
                                .add(async () => {
                                    const { reflections, stChanges } = await generateReflections(
                                        characterName,
                                        data[MEMORIES_KEY] || [],
                                        data[CHARACTERS_KEY] || {}
                                    );
                                    if (reflections.length > 0) {
                                        data[MEMORIES_KEY].push(...reflections);
                                    }
                                    await applySyncChanges(stChanges);
```

- [ ] Step 3: Update Phase 2 edge consolidation wiring in `extractMemories`

Around line 774:

```js
// BEFORE
                        const consolidated = await consolidateEdges(data.graph, settings);
                        if (consolidated > 0) {
                            logDebug(`Consolidated ${consolidated} graph edges before community summarization`);
                        }

// AFTER
                        const { count: consolidated, stChanges: edgeChanges } = await consolidateEdges(data.graph, settings);
                        if (consolidated > 0) {
                            logDebug(`Consolidated ${consolidated} graph edges before community summarization`);
                        }
                        await applySyncChanges(edgeChanges);
```

- [ ] Step 4: Update Phase 2 community wiring in `extractMemories`

Around line 783:

```js
// BEFORE
                        const communityUpdateResult = await updateCommunitySummaries(
                            data.graph,
                            groups,
                            data.communities || {},
                            currCount,
                            stalenessThreshold,
                            isSingleCommunity
                        );
                        data.communities = communityUpdateResult.communities;
                        if (communityUpdateResult.global_world_state) {
                            data.global_world_state = communityUpdateResult.global_world_state;
                        }

// AFTER
                        const communityUpdateResult = await updateCommunitySummaries(
                            data.graph,
                            groups,
                            data.communities || {},
                            currCount,
                            stalenessThreshold,
                            isSingleCommunity
                        );
                        data.communities = communityUpdateResult.communities;
                        if (communityUpdateResult.global_world_state) {
                            data.global_world_state = communityUpdateResult.global_world_state;
                        }
                        await applySyncChanges(communityUpdateResult.stChanges);
```

- [ ] Step 5: Apply identical changes to `runPhase2Enrichment`

In `runPhase2Enrichment`, apply the same destructuring changes:

1. **Reflections** (around line 884):
```js
// BEFORE
                            const reflections = await generateReflections(
                                characterName,
                                memories,
                                data[CHARACTERS_KEY] || {}
                            );
                            if (reflections.length > 0) {
                                data[MEMORIES_KEY].push(...reflections);
                            }

// AFTER
                            const { reflections, stChanges } = await generateReflections(
                                characterName,
                                memories,
                                data[CHARACTERS_KEY] || {}
                            );
                            if (reflections.length > 0) {
                                data[MEMORIES_KEY].push(...reflections);
                            }
                            await applySyncChanges(stChanges);
```

2. **Edge consolidation** (around line 919):
```js
// BEFORE
                    const consolidated = await consolidateEdges(data.graph, settings);
                    if (consolidated > 0) {
                        logDebug(`Consolidated ${consolidated} graph edges before community summarization`);
                    }

// AFTER
                    const { count: consolidated, stChanges: edgeChanges } = await consolidateEdges(data.graph, settings);
                    if (consolidated > 0) {
                        logDebug(`Consolidated ${consolidated} graph edges before community summarization`);
                    }
                    await applySyncChanges(edgeChanges);
```

3. **Communities** (around line 928):
```js
// BEFORE
                const communityUpdateResult = await updateCommunitySummaries(
                    data.graph,
                    groups,
                    data.communities || {},
                    data.graph_message_count || 0,
                    stalenessThreshold,
                    isSingleCommunity
                );
                data.communities = communityUpdateResult.communities;
                if (communityUpdateResult.global_world_state) {
                    data.global_world_state = communityUpdateResult.global_world_state;
                }

// AFTER
                const communityUpdateResult = await updateCommunitySummaries(
                    data.graph,
                    groups,
                    data.communities || {},
                    data.graph_message_count || 0,
                    stalenessThreshold,
                    isSingleCommunity
                );
                data.communities = communityUpdateResult.communities;
                if (communityUpdateResult.global_world_state) {
                    data.global_world_state = communityUpdateResult.global_world_state;
                }
                await applySyncChanges(communityUpdateResult.stChanges);
```

- [ ] Step 6: Run the full test suite

Run: `npm run test:run`
Expected: ALL PASS. The orchestrator now correctly destructures the new return shapes from all domain functions.

- [ ] Step 7: Commit

```bash
git add src/extraction/extract.js && git commit -m "$(cat <<'EOF'
refactor(extract): wire applySyncChanges at phase boundaries

Add applySyncChanges helper that handles bulk ST Vector sync from
domain function change sets. All Phase 1 and Phase 2 code paths
(extractMemories + runPhase2Enrichment) now use it.
EOF
)"
```

---

### Task 7: Final verification — no ST imports remain in domain files

**Files:**
- None to modify (verification only)

- [ ] Step 1: Verify no ST imports remain in domain files

Run:
```bash
grep -n "syncItemsToST\|deleteItemsFromST\|isStVectorSource\|markStSynced\|isStSynced" src/graph/graph.js src/graph/communities.js src/reflection/reflect.js
```

Expected: No output (no matches). All ST imports removed.

- [ ] Step 2: Verify no `getDeps().fetch` calls in domain files

Run:
```bash
grep -n "getDeps.*fetch\|data\.js" src/graph/graph.js src/graph/communities.js src/reflection/reflect.js
```

Expected: No matches for `getDeps().fetch`. The `data.js` import should only remain in `reflect.js` for `generateId`.

- [ ] Step 3: Run full test suite

Run: `npm run test:run`
Expected: ALL PASS.

- [ ] Step 4: Commit verification note

```bash
git add -A && git commit -m "$(cat <<'EOF'
task 7: final verification — network I/O purged from domain logic

Confirmed: no syncItemsToST, deleteItemsFromST, isStVectorSource,
or markStSynced imports remain in graph.js, communities.js, or reflect.js.
EOF
)"
```
