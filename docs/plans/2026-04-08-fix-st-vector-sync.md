# Fix: ST Vector Storage Sync Leaks (Orphaned Embeddings)

**Goal:** Ensure all CRUD operations that modify or delete entities/memories/communities return correct `stChanges` with both `toSync` and `toDelete` so ST Vector Storage stays in sync.
**Architecture:** Each mutation function must: (1) push `{ hash }` to `toDelete` for removed items, (2) push `{ hash, text, item }` to `toSync` for modified/created items. Follow the pattern established by `consolidateEdges` and `deleteEntity`.
**Tech Stack:** Vanilla ESM, Vitest

---

### Task 1: Red test — updateCommunitySummaries toDelete for dissolved communities

**Files:**
- Modify: `tests/graph/communities.test.js`

**Common Pitfalls:**
- `updateCommunitySummaries` is async and calls `callLLM` — must mock via `setupTestContext` deps
- Community keys use format `C0`, `C1`, etc.
- `_st_synced` flag on existing communities signals they were previously synced

- [ ] Step 1: Write the failing test

Append to `tests/graph/communities.test.js`:

```javascript
describe('updateCommunitySummaries — dissolved community toDelete', () => {
    beforeEach(async () => {
        await global.registerCdnOverrides();
    });

    it('generates toDelete for communities that dissolved after re-detection', async () => {
        // Mock LLM to return valid summaries for surviving community
        const mockCallLLM = vi.fn().mockResolvedValue(
            JSON.stringify({ title: 'Survivor', summary: 'A surviving community', findings: [] })
        );

        setupTestContext({
            deps: {
                fetch: vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({ embedding: new Array(384).fill(0.1) }),
                }),
            },
        });

        // Patch callLLM via module mock
        vi.doMock('../../src/llm.js', () => ({
            callLLM: mockCallLLM,
            LLM_CONFIGS: { community: {} },
        }));

        const { updateCommunitySummaries } = await import('../../src/graph/communities.js');

        // existingCommunities has C0 and C1, both previously synced
        const existingCommunities = {
            C0: {
                nodeKeys: ['a', 'b'],
                title: 'Old Community 0',
                summary: 'Summary for community 0',
                _st_synced: true,
            },
            C1: {
                nodeKeys: ['c', 'd'],
                title: 'Old Community 1',
                summary: 'Summary for community 1',
                _st_synced: true,
            },
        };

        // communityGroups only has C0 now — C1 dissolved
        const communityGroups = {
            0: { nodeKeys: ['a', 'b', 'e'], nodeLines: ['a line', 'b line', 'e line'], edgeLines: [] },
        };

        const result = await updateCommunitySummaries(
            { nodes: { a: {}, b: {}, e: {} } },
            communityGroups,
            existingCommunities,
            100,
            1 // staleness threshold = 1 so it triggers
        );

        // C1 should appear in toDelete
        expect(result.stChanges.toDelete).toBeDefined();
        expect(result.stChanges.toDelete.length).toBeGreaterThanOrEqual(1);

        vi.doUnmock('../../src/llm.js');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/graph/communities.test.js -t "dissolved community"`
Expected: FAIL — `result.stChanges.toDelete` is undefined (no toDelete generated)

- [ ] Step 3: Commit failing test

```bash
git add tests/graph/communities.test.js && git commit -m "test: add failing test for dissolved community toDelete"
```

---

### Task 2: Green — fix updateCommunitySummaries toDelete

**Files:**
- Modify: `src/graph/communities.js`

- [ ] Step 1: Write the implementation

After the `stChanges.toSync` loop (around line 283), add a diff loop that finds dissolved communities:

```javascript
    // Build change set for ST sync (orchestrator handles network I/O)
    const stChanges = { toSync: [], toDelete: [] };
    for (const [id, community] of Object.entries(updatedCommunities)) {
        if (community.summary) {
            const text = `[OV_ID:${id}] ${community.summary}`;
            stChanges.toSync.push({ hash: cyrb53(text), text, item: community });
        }
    }

    // Detect dissolved communities — present in existing but absent in updated
    for (const [id, community] of Object.entries(existingCommunities)) {
        if (!updatedCommunities[id] && community._st_synced) {
            const text = `[OV_ID:${id}] ${community.summary || ''}`;
            stChanges.toDelete.push({ hash: cyrb53(text) });
        }
    }
```

- [ ] Step 2: Run tests

Run: `npx vitest run tests/graph/communities.test.js`
Expected: ALL PASS

- [ ] Step 3: Commit

```bash
git add src/graph/communities.js && git commit -m "fix: generate toDelete for dissolved communities in updateCommunitySummaries"
```

---

### Task 3: Red test — mergeEntities missing toSync for surviving node

**Files:**
- Modify: `tests/store/chat-data-merge.test.js`

- [ ] Step 1: Write the failing test

```javascript
it('returns toSync for surviving target node after merge', async () => {
    const saveFn = vi.fn(async () => true);
    setupTestContext({
        context: {
            chatMetadata: {
                openvault: {
                    schema_version: 3,
                    memories: [],
                    character_states: {},
                    processed_message_ids: [],
                    graph: {
                        nodes: {
                            alice: {
                                name: 'Alice',
                                type: 'PERSON',
                                description: 'A young woman',
                                mentions: 3,
                                aliases: [],
                            },
                            bob: {
                                name: 'Bob',
                                type: 'PERSON',
                                description: 'A tall man',
                                mentions: 2,
                                aliases: [],
                                _st_synced: true,
                            },
                        },
                        edges: {},
                        _mergeRedirects: {},
                    },
                },
            },
        },
        deps: { saveChatConditional: saveFn },
    });

    const { mergeEntities } = await import('../../src/store/chat-data.js');
    const result = await mergeEntities('bob', 'alice');

    expect(result.success).toBe(true);
    expect(result.stChanges.toDelete).toBeDefined();
    expect(result.stChanges.toDelete.length).toBeGreaterThan(0);
    // The bug: toSync is missing for the surviving node
    expect(result.stChanges.toSync).toBeDefined();
    expect(result.stChanges.toSync.length).toBeGreaterThan(0);
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/store/chat-data-merge.test.js -t "surviving target"`
Expected: FAIL — `result.stChanges.toSync` is undefined

- [ ] Step 3: Commit failing test

```bash
git add tests/store/chat-data-merge.test.js && git commit -m "test: add failing test for mergeEntities toSync"
```

---

### Task 4: Green — fix mergeEntities toSync

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Write the implementation

In `mergeEntities`, after `deleteEmbedding(targetNode)` and before `await saveChatConditional()`, add `toSync` for the surviving target node:

```javascript
    // Invalidate target embedding since description changed
    deleteEmbedding(targetNode);

    // Sync updated target node to ST Vector Storage
    const toSync = [];
    const targetText = `[OV_ID:${targetKey}] ${targetNode.description}`;
    toSync.push({ hash: cyrb53(targetText), text: targetText, item: targetNode });

    // Also sync any edges that were modified during merge
    for (const [edgeKey, edge] of Object.entries(g.edges)) {
        if (edge.source === targetKey || edge.target === targetKey) {
            // Only include edges that were actually modified in this merge
            const edgeId = `edge_${edge.source}_${edge.target}`;
            const edgeText = `[OV_ID:${edgeId}] ${edge.description}`;
            toSync.push({ hash: cyrb53(edgeText), text: edgeText, item: edge });
        }
    }

    // 5. Save
    await saveChatConditional();

    return {
        success: true,
        stChanges: { toDelete, toSync },
    };
```

Note: This replaces the existing return statement at the end of `mergeEntities`. The `toDelete` array is already built throughout the function — just need to add `toSync` alongside it.

- [ ] Step 2: Run tests

Run: `npx vitest run tests/store/chat-data-merge.test.js`
Expected: ALL PASS

- [ ] Step 3: Commit

```bash
git add src/store/chat-data.js && git commit -m "fix: return toSync for surviving target node in mergeEntities"
```

---

### Task 5: Red test — updateEntity simple update missing toSync

**Files:**
- Modify: `tests/store/chat-data-updateEntity.test.js`

- [ ] Step 1: Write the failing test

```javascript
it('returns toSync when updating description without rename', async () => {
    const saveFn = vi.fn(async () => true);
    setupTestContext({
        context: {
            chatMetadata: {
                openvault: {
                    schema_version: 3,
                    memories: [],
                    character_states: {},
                    processed_message_ids: [],
                    graph: {
                        nodes: {
                            alice: {
                                name: 'Alice',
                                type: 'PERSON',
                                description: 'Old description',
                                mentions: 1,
                                aliases: [],
                            },
                        },
                        edges: {},
                        _mergeRedirects: {},
                    },
                },
            },
        },
        deps: { saveChatConditional: saveFn },
    });

    const { updateEntity } = await import('../../src/store/chat-data.js');
    const result = await updateEntity('alice', { description: 'New description' });

    expect(result).not.toBeNull();
    expect(result.key).toBe('alice');
    // Bug: no stChanges returned for simple field update
    expect(result.stChanges).toBeDefined();
    expect(result.stChanges.toSync).toBeDefined();
    expect(result.stChanges.toSync.length).toBeGreaterThan(0);
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/store/chat-data-updateEntity.test.js -t "updating description without rename"`
Expected: FAIL — `result.stChanges` is undefined

- [ ] Step 3: Commit

```bash
git add tests/store/chat-data-updateEntity.test.js && git commit -m "test: add failing test for updateEntity simple update toSync"
```

---

### Task 6: Green — fix updateEntity simple update toSync

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Write the implementation

In the `else` branch (simple field update, no rename) of `updateEntity`, add `stChanges.toSync`:

```javascript
    } else {
        // Simple field update, no rename
        Object.assign(node, {
            type: updates.type ?? node.type,
            description: updates.description ?? node.description,
            aliases: updates.aliases ?? node.aliases ?? [],
        });

        // Invalidate embedding on description change
        if (updates.description !== undefined) {
            deleteEmbedding(node);
        }

        await saveChatConditional();

        // Return stChanges for ST Vector sync if description changed
        const stChanges = {};
        if (updates.description !== undefined) {
            const text = `[OV_ID:${key}] ${node.description}`;
            stChanges.toSync = [{ hash: cyrb53(text), text, item: node }];
        }

        return { key, stChanges: Object.keys(stChanges).length > 0 ? stChanges : undefined };
    }
```

- [ ] Step 2: Run tests

Run: `npx vitest run tests/store/chat-data-updateEntity.test.js`
Expected: ALL PASS

- [ ] Step 3: Commit

```bash
git add src/store/chat-data.js && git commit -m "fix: return toSync for simple entity updates in updateEntity"
```

---

### Task 7: Red test — updateMemory and deleteMemory missing stChanges

**Files:**
- Modify: `tests/store/chat-data.test.js`

- [ ] Step 1: Write the failing tests

```javascript
describe('updateMemory — stChanges', () => {
    it('returns stChanges with toSync when summary changes', async () => {
        const saveFn = vi.fn(async () => true);
        setupTestContext({
            deps: { saveChatConditional: saveFn },
        });

        // First create a memory
        const data = getOpenVaultData();
        data[MEMORIES_KEY] = [
            { id: 'mem1', summary: 'Old summary', importance: 5 },
        ];

        const result = await updateMemory('mem1', { summary: 'New summary' });

        // Bug: updateMemory returns boolean, not stChanges object
        expect(result).not.toBe(true);
        expect(result).toHaveProperty('stChanges');
        expect(result.stChanges.toSync).toBeDefined();
        expect(result.stChanges.toSync.length).toBeGreaterThan(0);
    });
});

describe('deleteMemory — stChanges', () => {
    it('returns stChanges with toDelete when memory had embedding', async () => {
        const saveFn = vi.fn(async () => true);
        setupTestContext({
            deps: { saveChatConditional: saveFn },
        });

        const data = getOpenVaultData();
        data[MEMORIES_KEY] = [
            { id: 'mem1', summary: 'A memory to delete', importance: 5, _st_synced: true },
        ];

        const result = await deleteMemory('mem1');

        // Bug: deleteMemory returns boolean, not stChanges object
        expect(result).not.toBe(true);
        expect(result).toHaveProperty('stChanges');
        expect(result.stChanges.toDelete).toBeDefined();
        expect(result.stChanges.toDelete.length).toBeGreaterThan(0);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/store/chat-data.test.js -t "stChanges"`
Expected: FAIL

- [ ] Step 3: Commit

```bash
git add tests/store/chat-data.test.js && git commit -m "test: add failing tests for updateMemory/deleteMemory stChanges"
```

---

### Task 8: Green — fix updateMemory and deleteMemory stChanges

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Fix updateMemory

Replace the return value and add stChanges logic:

```javascript
async function updateMemory(id, updates) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }

    const memory = data[MEMORIES_KEY]?.find((/** @type {Memory} */ m) => m.id === id);
    if (!memory) {
        logDebug(`Memory ${id} not found`);
        return { success: false };
    }

    // Track if summary changed (requires re-embedding)
    const summaryChanged = updates.summary !== undefined && updates.summary !== memory.summary;

    // Apply allowed updates
    const allowedFields = ['summary', 'importance', 'tags', 'is_secret', 'temporal_anchor', 'is_transient'];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            memory[field] = updates[field];
        }
    }

    const stChanges = {};

    // If summary changed, invalidate embedding and queue for re-sync
    if (summaryChanged) {
        deleteEmbedding(memory);
        const text = memory.summary || '';
        stChanges.toSync = [{ hash: cyrb53(text), text, item: memory }];
    }

    await getDeps().saveChatConditional();
    logDebug(`Updated memory ${id}${summaryChanged ? ' (embedding invalidated)' : ''}`);
    return {
        success: true,
        stChanges: Object.keys(stChanges).length > 0 ? stChanges : undefined,
    };
}
```

- [ ] Step 2: Fix deleteMemory

```javascript
async function deleteMemory(id) {
    const data = getOpenVaultData();
    if (!data) {
        showToast('warning', 'No chat loaded');
        return { success: false };
    }

    const idx = data[MEMORIES_KEY]?.findIndex((/** @type {Memory} */ m) => m.id === id);
    if (idx === -1) {
        logDebug(`Memory ${id} not found`);
        return { success: false };
    }

    const memory = data[MEMORIES_KEY][idx];
    const stChanges = {};

    // Queue for ST Vector deletion if previously synced
    if (memory._st_synced) {
        const text = memory.summary || '';
        stChanges.toDelete = [{ hash: cyrb53(text) }];
    }

    data[MEMORIES_KEY].splice(idx, 1);
    await getDeps().saveChatConditional();
    logDebug(`Deleted memory ${id}`);
    return {
        success: true,
        stChanges: Object.keys(stChanges).length > 0 ? stChanges : undefined,
    };
}
```

- [ ] Step 3: Update callers that check boolean return

Search for callers of `updateMemory` and `deleteMemory` that do `if (result)` or `if (!result)` — these now return `{ success }` objects instead of `true`/`false`. The truthy boolean check still works (objects are truthy). But verify the UI code in `src/ui/render.js` which has its own `deleteMemory` wrapper.

- [ ] Step 4: Run tests

Run: `npx vitest run tests/store/chat-data.test.js`
Expected: ALL PASS

- [ ] Step 5: Commit

```bash
git add src/store/chat-data.js && git commit -m "fix: return stChanges from updateMemory and deleteMemory"
```

---

### Task 9: Fix mergeOrInsertEntity — all merge paths missing toSync

**Files:**
- Modify: `src/graph/graph.js`

**Common Pitfalls:**
- The function has 4 early-return paths that all skip toSync: exact match, cross-script, no-embedding, semantic merge
- Only the "new node" path (line 511+) generates toSync correctly
- `cyrb53` and `deleteEmbedding` are imported from `src/utils/embedding-codec.js`

- [ ] Step 1: Write the implementation

At the top of `mergeOrInsertEntity`, create a helper to push toSync:

Add a local helper right after `const stChanges = { toSync: [], toDelete: [] };`:

```javascript
    /** Push updated node to stChanges.toSync */
    const syncNode = (nodeKey) => {
        const n = graphData.nodes[nodeKey];
        if (n) {
            const t = `[OV_ID:${nodeKey}] ${n.description}`;
            stChanges.toSync.push({ hash: cyrb53(t), text: t, item: n });
        }
    };
```

Then add `syncNode()` calls before each early return:

1. **Exact key match** (fast path):
```javascript
    if (graphData.nodes[key]) {
        upsertEntity(graphData, name, type, description, cap);
        syncNode(key);
        return { key, stChanges };
    }
```

2. **Cross-script merge**:
```javascript
    // ... after upsertEntity and alias push ...
    syncNode(existingKey);
    return { key: existingKey, stChanges };
```

3. **No-embedding fallback**:
```javascript
    if (!newEmbedding) {
        upsertEntity(graphData, name, type, description, cap);
        syncNode(key);
        return { key, stChanges };
    }
```

4. **Semantic merge (bestMatch)**:
```javascript
    // ... after upsertEntity and alias push ...
    syncNode(bestMatch);
    return { key: bestMatch, stChanges };
```

5. **New node** — already correct, keep as-is.

- [ ] Step 2: Run existing graph tests

Run: `npx vitest run tests/graph/graph.test.js`
Expected: ALL PASS (existing tests don't check stChanges toSync content, but shouldn't break)

- [ ] Step 3: Commit

```bash
git add src/graph/graph.js && git commit -m "fix: push toSync for all merge paths in mergeOrInsertEntity"
```

---

### Task 10: Run full pre-commit checks

- [ ] Step 1: Run `npm run check`

Run: `npm run check`
Expected: PASS

- [ ] Step 2: Run full test suite

Run: `npm test`
Expected: ALL PASS

- [ ] Step 3: Final commit if any auto-fixes applied

```bash
git add -A && git commit -m "chore: pre-commit fixes for ST Vector sync changes"
```
