# Implementation Plan - Debug Export Redesign

> **Reference:** `docs/designs/2026-03-11-debug-export-redesign.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Expand `cacheScoringDetails` cached fields

**Goal:** Store full summary (no truncation) and add `importance`, `retrieval_hits`, `mentions`, `characters_involved` to each cached scoring entry.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/debug-cache.test.js`
- Add test after the existing `'clears cache'` test:

```javascript
import { cacheScoringDetails, getCachedScoringDetails, clearRetrievalDebug } from '../../src/retrieval/debug-cache.js';

describe('cacheScoringDetails', () => {
    beforeEach(() => {
        clearRetrievalDebug();
    });

    it('stores full summary without truncation', () => {
        const longSummary = 'A'.repeat(200);
        const results = [{
            memory: { id: 'm1', type: 'event', summary: longSummary, retrieval_hits: 3, mentions: 5, characters_involved: ['Alice'] },
            score: 5.0,
            breakdown: { base: 2, baseAfterFloor: 2, recencyPenalty: 0, vectorSimilarity: 0, vectorBonus: 0, bm25Score: 0, bm25Bonus: 0, hitDamping: 0.67, frequencyFactor: 1.08, total: 5, distance: 42, importance: 4 },
        }];
        cacheScoringDetails(results, new Set(['m1']));
        const cached = getCachedScoringDetails();
        expect(cached[0].summary).toBe(longSummary);
        expect(cached[0].summary.length).toBe(200);
    });

    it('includes importance, retrieval_hits, mentions, characters_involved', () => {
        const results = [{
            memory: { id: 'm1', type: 'event', summary: 'Test', retrieval_hits: 5, mentions: 3, characters_involved: ['Alice', 'Bob'] },
            score: 4.0,
            breakdown: { base: 2, baseAfterFloor: 2, recencyPenalty: 0, vectorSimilarity: 0, vectorBonus: 0, bm25Score: 0, bm25Bonus: 0, hitDamping: 1, frequencyFactor: 1, total: 4, distance: 10, importance: 3 },
        }];
        cacheScoringDetails(results, new Set(['m1']));
        const cached = getCachedScoringDetails();
        expect(cached[0].importance).toBe(3);
        expect(cached[0].retrieval_hits).toBe(5);
        expect(cached[0].mentions).toBe(3);
        expect(cached[0].characters_involved).toEqual(['Alice', 'Bob']);
    });

    it('defaults retrieval_hits to 0 and mentions to 1 when missing', () => {
        const results = [{
            memory: { id: 'm1', type: 'event', summary: 'Test' },
            score: 2.0,
            breakdown: { base: 2, baseAfterFloor: 2, recencyPenalty: 0, vectorSimilarity: 0, vectorBonus: 0, bm25Score: 0, bm25Bonus: 0, hitDamping: 1, frequencyFactor: 1, total: 2, distance: 5, importance: 2 },
        }];
        cacheScoringDetails(results, new Set());
        const cached = getCachedScoringDetails();
        expect(cached[0].retrieval_hits).toBe(0);
        expect(cached[0].mentions).toBe(1);
        expect(cached[0].characters_involved).toEqual([]);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/retrieval/debug-cache.test.js`
- Expect: Fails — `cached[0].summary.length` is 80 (truncated), `importance`/`retrieval_hits`/`mentions`/`characters_involved` are undefined.

**Step 3: Implementation (Green)**
- File: `src/retrieval/debug-cache.js`
- In `cacheScoringDetails()`, replace the mapping body (lines 34-58):

```javascript
export function cacheScoringDetails(scoredResults, selectedIds) {
    const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

    cachedScoringDetails = scoredResults.map(({ memory, breakdown }) => {
        return {
            memoryId: memory.id,
            type: memory.type || 'event',
            summary: memory.summary || '',
            scores: {
                base: breakdown.base,
                baseAfterFloor: breakdown.baseAfterFloor,
                recencyPenalty: breakdown.recencyPenalty,
                vectorSimilarity: breakdown.vectorSimilarity,
                vectorBonus: breakdown.vectorBonus,
                bm25Score: breakdown.bm25Score,
                bm25Bonus: breakdown.bm25Bonus,
                hitDamping: breakdown.hitDamping,
                frequencyFactor: breakdown.frequencyFactor,
                total: breakdown.total,
            },
            selected: selectedSet.has(memory.id),
            distance: breakdown.distance,
            importance: breakdown.importance,
            retrieval_hits: memory.retrieval_hits || 0,
            mentions: memory.mentions || 1,
            characters_involved: memory.characters_involved || [],
        };
    });
}
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/debug-cache.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): expand cacheScoringDetails with importance, retrieval_hits, mentions, characters_involved; store full summary"`

---

### Task 2: Add optional `meta` parameter to `buildBM25Tokens`

**Goal:** Allow callers to receive BM25 tier counts (entity/grounded/non-grounded) via an optional metadata object.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/query-context.test.js`
- Add test inside the existing `'buildBM25Tokens with corpusVocab'` describe block:

```javascript
it('populates meta object with tier counts when provided', async () => {
    const { buildBM25Tokens } = await import('../../src/retrieval/query-context.js');
    const corpusVocab = new Set(['sword', 'magic']);
    const entities = { entities: ['Dragon'], weights: { Dragon: 3 } };
    const meta = {};
    buildBM25Tokens('sword castle', entities, corpusVocab, meta);
    expect(meta.entityStems).toBeTypeOf('number');
    expect(meta.entityStems).toBeGreaterThan(0); // 'dragon' stem from entity
    expect(meta.grounded).toBeGreaterThanOrEqual(1); // 'sword' is in corpus
    expect(meta.nonGrounded).toBeGreaterThanOrEqual(0); // 'castle' is not in corpus (may be filtered by length/stem)
    expect(meta.entityStems + meta.grounded + meta.nonGrounded).toBeGreaterThan(0);
});

it('does not fail when meta is not provided', async () => {
    const { buildBM25Tokens } = await import('../../src/retrieval/query-context.js');
    const corpusVocab = new Set(['sword']);
    const tokens = buildBM25Tokens('sword', { entities: [], weights: {} }, corpusVocab);
    expect(tokens.length).toBeGreaterThan(0);
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/retrieval/query-context.test.js`
- Expect: First test fails — `meta.entityStems` is undefined (meta is never written to).

**Step 3: Implementation (Green)**
- File: `src/retrieval/query-context.js`
- Add `meta = null` as 4th parameter to `buildBM25Tokens` signature.
- Track counts at each layer and fill `meta` at end of function.

Changes to `buildBM25Tokens`:

1. Add parameter: `export function buildBM25Tokens(userMessage, extractedEntities, corpusVocab = null, meta = null) {`

2. After Layer 1 entity loop, track count:
```javascript
const entityStemCount = tokens.length; // Count after Layer 1
```

3. After Layer 2/3 processing (inside the `if (corpusVocab && corpusVocab.size > 0)` block), track counts:
```javascript
const groundedCount = uniqueGrounded.length * groundedBoost;
const nonGroundedCount = uniqueNonGrounded.length * nonGroundedBoost;
```

4. At end of function before `return tokens`:
```javascript
if (meta) {
    meta.entityStems = entityStemCount;
    meta.grounded = corpusVocab && corpusVocab.size > 0 ? groundedCount : 0;
    meta.nonGrounded = corpusVocab && corpusVocab.size > 0 ? nonGroundedCount : 0;
}
```

Note: The `entityStemCount`, `groundedCount`, `nonGroundedCount` variables need to be scoped correctly. Initialize `let groundedCount = 0, nonGroundedCount = 0;` before the `if (corpusVocab)` block so they're accessible at the meta-fill point.

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/query-context.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): add optional meta parameter to buildBM25Tokens for tier count tracking"`

---

### Task 3: Cache BM25 tier metadata and token budget info in scoring pipeline

**Goal:** Wire the BM25 meta into `cacheRetrievalDebug` and add token budget stats after `sliceToTokenBudget`.

**Step 1: Write the Failing Test**
- No direct unit test for this wiring — it's integration-level (mocking the full scoring pipeline is excessive). Verification comes from Task 9's export tests.
- Instead, verify no regressions.

**Step 2: Run Test (Red/verify baseline)**
- Command: `npx vitest run tests/retrieval/`
- Expect: All existing tests pass.

**Step 3: Implementation (Green)**
- File: `src/retrieval/scoring.js`

**Change 1**: In `selectRelevantMemoriesSimple()`, pass `meta` to `buildBM25Tokens` and cache tier data:

Replace the BM25 + cache block (around lines 100-117):

```javascript
    let bm25Tokens = [];
    const bm25Meta = {};
    if (hasEvents) {
        const corpusVocab = buildCorpusVocab(
            memories,
            allHiddenMemories,
            ctx.graphNodes || {},
            ctx.graphEdges || {}
        );
        bm25Tokens = buildBM25Tokens(userMessages, queryContext, corpusVocab, bm25Meta);
    }

    // Cache query context for debug export
    cacheRetrievalDebug({
        queryContext: {
            entities: queryContext.entities,
            embeddingQuery: embeddingQuery,
            bm25Tokens: {
                total: Array.isArray(bm25Tokens) ? bm25Tokens.length : 0,
                entityStems: bm25Meta.entityStems || 0,
                grounded: bm25Meta.grounded || 0,
                nonGrounded: bm25Meta.nonGrounded || 0,
            },
        },
    });
```

**Change 2**: In `selectRelevantMemories()`, cache token budget after `sliceToTokenBudget`:

After `cacheScoringDetails(scoredResults, selectedIds);` (around line 175), add:

```javascript
    // Cache token budget utilization for debug export
    cacheRetrievalDebug({
        tokenBudget: {
            budget: finalTokens,
            scoredCount: scoredMemories.length,
            selectedCount: finalResults.length,
            trimmedByBudget: scoredMemories.length - finalResults.length,
        },
    });
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/`
- Expect: All pass (no regressions).

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): cache BM25 tier metadata and token budget utilization in scoring pipeline"`

---

### Task 4: Add pure helpers to export-debug.js

**Goal:** Add `r2`, `truncateSummary`, `diffSettings` as internal helpers with tests.

**Step 1: Write the Failing Test**
- File: `tests/ui/export-debug.test.js`
- These helpers are not exported, so test them indirectly through `buildExportPayload`. But first let's add the helpers and test the settings diff via the payload.

Add these tests at the end of the `describe('buildExportPayload')` block:

```javascript
    it('settings contains only values that differ from defaults', () => {
        const payload = buildExportPayload();
        // Mock has alpha: 0.7 and enabled: true which match defaults
        // debugMode: false also matches default
        // So settings should be empty (or contain only truly different values)
        // Since all mock values match defaultSettings, settings should be {}
        expect(payload.settings).toEqual({});
    });
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: Fails — current code dumps all ~40 settings.

**Step 3: Implementation (Green)**
- File: `src/ui/export-debug.js`

Add helpers after the `_RECENT_CONTEXT_CAP` constant:

```javascript
/**
 * Round number to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function r2(n) {
    return Math.round(n * 100) / 100;
}

/**
 * Truncate string to limit with '...' suffix.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function truncateSummary(text, limit) {
    if (!text || text.length <= limit) return text || '';
    return text.slice(0, limit - 3) + '...';
}

/**
 * Return only settings that differ from defaults.
 * @param {Object} current - Current settings
 * @param {Object} defaults - Default settings
 * @returns {Object} Diff object (may be empty)
 */
function diffSettings(current, defaults) {
    const diff = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
        const currentVal = current[key];
        if (currentVal !== defaultVal) {
            diff[key === 'enabled' ? 'autoMode' : key] = currentVal;
        }
    }
    return diff;
}
```

Replace the settings construction in `buildExportPayload()`:

```javascript
        // Settings: only values that differ from defaults
        settings: diffSettings(settings, defaultSettings),
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: New test passes. Old `'includes all settings dynamically from defaultSettings'` test FAILS — update it.

**Step 5: Update broken test**
- File: `tests/ui/export-debug.test.js`
- Replace `'includes all settings dynamically from defaultSettings'` test:

```javascript
    it('settings contains only non-default values', () => {
        const payload = buildExportPayload();
        // All mock settings match defaults → empty diff
        expect(Object.keys(payload.settings).length).toBe(0);
    });
```

**Step 6: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: All PASS.

**Step 7: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): add r2/truncateSummary/diffSettings helpers; settings now diff-only"`

---

### Task 5: Add `compactScores` helper and zero-suppression

**Goal:** Build a helper that rounds scores to 2dp, omits default-value fields, and adds `decayPct`.

**Step 1: Write the Failing Test**
- File: `tests/ui/export-debug.test.js`
- Add a `describe('compactScores')` block. Since it's not exported, test via the scoring payload. First, set up scoring cache data and verify the output shape.

Add after existing tests in the `describe('buildExportPayload')`:

```javascript
    describe('scoring section', () => {
        const { cacheScoringDetails } = await import('../../src/retrieval/debug-cache.js');

        function setupScoringCache() {
            const results = [
                {
                    memory: { id: 's1', type: 'event', summary: 'Selected memory one', retrieval_hits: 3, mentions: 2, characters_involved: ['Alice'] },
                    score: 5.12345,
                    breakdown: { base: 2.34567, baseAfterFloor: 2.34567, recencyPenalty: 0, vectorSimilarity: 0.71234, vectorBonus: 1.56789, bm25Score: 0.45678, bm25Bonus: 1.23456, hitDamping: 0.67, frequencyFactor: 1.035, total: 5.12345, distance: 42, importance: 4 },
                },
                {
                    memory: { id: 'r1', type: 'event', summary: 'Rejected memory', retrieval_hits: 0, mentions: 1, characters_involved: ['Bob'] },
                    score: 1.0,
                    breakdown: { base: 0.98765, baseAfterFloor: 0.98765, recencyPenalty: 0, vectorSimilarity: 0, vectorBonus: 0, bm25Score: 0, bm25Bonus: 0, hitDamping: 1, frequencyFactor: 1, total: 1.0, distance: 150, importance: 2 },
                },
            ];
            cacheScoringDetails(results, new Set(['s1']));
        }

        it('rounds all floats to 2 decimal places', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.total).toBe(5.12);
            expect(selected.base).toBe(2.35);
        });

        it('omits zero/default scoring fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const rejected = payload.scoring.rejected[0];
            // Zero fields should be omitted
            expect(rejected.vectorSimilarity).toBeUndefined();
            expect(rejected.vectorBonus).toBeUndefined();
            expect(rejected.bm25Score).toBeUndefined();
            expect(rejected.bm25Bonus).toBeUndefined();
            expect(rejected.recencyPenalty).toBeUndefined();
            expect(rejected.hitDamping).toBeUndefined();
            expect(rejected.frequencyFactor).toBeUndefined();
            // Non-default fields should be present
            expect(rejected.total).toBeDefined();
            expect(rejected.base).toBeDefined();
            expect(rejected.distance).toBeDefined();
        });

        it('includes non-zero optional fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.vectorSimilarity).toBe(0.71);
            expect(selected.vectorBonus).toBe(1.57);
            expect(selected.hitDamping).toBe(0.67);
            expect(selected.frequencyFactor).toBe(1.04); // r2(1.035)
        });

        it('includes decayPct on all entries', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            // decayPct = base / importance = 2.34567 / 4 ≈ 0.59
            expect(selected.decayPct).toBe(0.59);
            const rejected = payload.scoring.rejected[0];
            // decayPct = 0.98765 / 2 ≈ 0.49
            expect(rejected.decayPct).toBe(0.49);
        });

        it('includes retrieval_hits, mentions, characters_involved', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.retrieval_hits).toBe(3);
            expect(selected.mentions).toBe(2);
            expect(selected.characters_involved).toEqual(['Alice']);
        });

        it('splits into selected and rejected arrays', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            expect(payload.scoring.selected).toHaveLength(1);
            expect(payload.scoring.rejected).toHaveLength(1);
            expect(payload.scoring.selected[0].id).toBe('s1');
            expect(payload.scoring.rejected[0].id).toBe('r1');
        });

        it('includes _note about omitted fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            expect(payload.scoring._note).toContain('Default-value');
        });
    });
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: Fails — current code has `scoring.details` (not `selected`/`rejected`), no rounding, no zero-suppression.

**Step 3: Implementation (Green)**
- File: `src/ui/export-debug.js`

Add `compactScores` helper:

```javascript
/**
 * Build compact score entry with zero-suppression and rounding.
 * @param {Object} detail - Cached scoring detail entry
 * @param {number} summaryLimit - Max summary length
 * @returns {Object} Compact entry
 */
function compactScores(detail, summaryLimit) {
    const { scores, memoryId, type, summary, distance, importance, retrieval_hits, mentions, characters_involved } = detail;
    const base = r2(scores.base);
    const entry = {
        id: memoryId,
        type,
        summary: truncateSummary(summary, summaryLimit),
        total: r2(scores.total),
        base,
        decayPct: importance > 0 ? r2(scores.base / importance) : 0,
        distance,
        importance,
        retrieval_hits: retrieval_hits ?? 0,
        mentions: mentions ?? 1,
        characters_involved: characters_involved || [],
    };

    // Optional fields — only include when non-default
    if (scores.baseAfterFloor !== scores.base) entry.baseAfterFloor = r2(scores.baseAfterFloor);
    if (scores.recencyPenalty) entry.recencyPenalty = r2(scores.recencyPenalty);
    if (scores.vectorSimilarity) entry.vectorSimilarity = r2(scores.vectorSimilarity);
    if (scores.vectorBonus) entry.vectorBonus = r2(scores.vectorBonus);
    if (scores.bm25Score) entry.bm25Score = r2(scores.bm25Score);
    if (scores.bm25Bonus) entry.bm25Bonus = r2(scores.bm25Bonus);
    if (scores.hitDamping !== 1) entry.hitDamping = r2(scores.hitDamping);
    if (scores.frequencyFactor !== 1) entry.frequencyFactor = r2(scores.frequencyFactor);

    return entry;
}
```

Restructure `buildScoringStats` — replace the `rejected` computation and flatten stats:

```javascript
function buildScoringStats(scoringDetails) {
    if (!scoringDetails || scoringDetails.length === 0) {
        return null;
    }

    const totalScored = scoringDetails.length;
    let reflectionsScored = 0, reflectionsSelected = 0;
    let eventsScored = 0, eventsSelected = 0;
    let totalReflectionScore = 0, totalEventScore = 0;
    let topScore = 0, cutoffScore = null, selectedCount = 0;

    for (const detail of scoringDetails) {
        const { scores, type, selected } = detail;
        if (scores.total > topScore) topScore = scores.total;
        if (selected) {
            selectedCount++;
            if (cutoffScore === null || scores.total < cutoffScore) {
                cutoffScore = scores.total;
            }
        }
        if (type === 'reflection') {
            reflectionsScored++;
            totalReflectionScore += scores.total;
            if (selected) reflectionsSelected++;
        } else {
            eventsScored++;
            totalEventScore += scores.total;
            if (selected) eventsSelected++;
        }
    }

    return {
        totalScored,
        selected: selectedCount,
        reflections: {
            scored: reflectionsScored,
            selected: reflectionsSelected,
            avgScore: reflectionsScored > 0 ? r2(totalReflectionScore / reflectionsScored) : 0,
        },
        events: {
            scored: eventsScored,
            selected: eventsSelected,
            avgScore: eventsScored > 0 ? r2(totalEventScore / eventsScored) : 0,
        },
        topScore: r2(topScore),
        cutoffScore: cutoffScore !== null ? r2(cutoffScore) : null,
    };
}
```

In `buildExportPayload()`, replace the scoring section:

```javascript
    const scoringDetails = getCachedScoringDetails();
    const scoringStats = buildScoringStats(scoringDetails);

    // Build selected + top-15-rejected scoring details
    let scoringSection = null;
    if (scoringStats && scoringDetails) {
        const REJECTED_LIMIT = 15;
        const SELECTED_SUMMARY_LIMIT = 200;
        const REJECTED_SUMMARY_LIMIT = 150;

        const selectedEntries = scoringDetails
            .filter((d) => d.selected)
            .map((d) => compactScores(d, SELECTED_SUMMARY_LIMIT));

        const rejectedEntries = scoringDetails
            .filter((d) => !d.selected)
            .sort((a, b) => b.scores.total - a.scores.total)
            .slice(0, REJECTED_LIMIT)
            .map((d) => compactScores(d, REJECTED_SUMMARY_LIMIT));

        scoringSection = {
            _note: 'Default-value fields omitted from entries. Defaults: recencyPenalty=0, hitDamping=1, frequencyFactor=1, vector/bm25 fields=0',
            stats: scoringStats,
            selected: selectedEntries,
            rejected: rejectedEntries,
        };
    }
```

And use `scoringSection` in the return:
```javascript
        scoring: scoringSection,
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: All PASS including new scoring tests.

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): add compactScores with zero-suppression, decayPct, selected/rejected split; restructure scoring stats"`

---

### Task 6: Add `filterGraphByEntities` helper

**Goal:** Replace raw graph dump with query-relevant subset filtered by retrieval entities.

**Step 1: Write the Failing Test**
- File: `tests/ui/export-debug.test.js`
- Add tests. The mock graph has nodes `alice` and `garden`. When entities contain `"Alice"`, only `alice` node and its edges should appear.

```javascript
    describe('graph filtering', () => {
        it('shows relevant section with matched entities when retrieval cached', () => {
            cacheRetrievalDebug({
                queryContext: { entities: ['Alice'], embeddingQuery: 'test', bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 } },
            });
            const payload = buildExportPayload();
            expect(payload.state.graph.relevant).toBeDefined();
            expect(payload.state.graph.relevant.matchedEntities).toEqual(['Alice']);
            expect(payload.state.graph.relevant.nodes.alice).toBeDefined();
            expect(payload.state.graph.relevant.nodes.alice.name).toBe('Alice');
            // alice__garden edge involves alice, so should be included
            expect(payload.state.graph.relevant.edges.alice__garden).toBeDefined();
        });

        it('omits graph.raw (replaced by relevant)', () => {
            cacheRetrievalDebug({
                queryContext: { entities: ['Alice'], embeddingQuery: 'test', bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 } },
            });
            const payload = buildExportPayload();
            expect(payload.state.graph.raw).toBeUndefined();
        });

        it('falls back to summary-only when no retrieval cached', () => {
            const payload = buildExportPayload();
            expect(payload.state.graph.summary.nodeCount).toBe(2);
            expect(payload.state.graph.relevant).toBeUndefined();
        });
    });
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: Fails — current code always has `graph.raw`, no `graph.relevant`.

**Step 3: Implementation (Green)**
- File: `src/ui/export-debug.js`

Add the `filterGraphByEntities` helper:

```javascript
/**
 * Filter graph to nodes/edges relevant to query entities.
 * @param {Object} graph - Full graph with nodes and edges
 * @param {string[]} entities - Query entity names from retrieval
 * @returns {{matchedEntities: string[], nodes: Object, edges: Object}|null}
 */
function filterGraphByEntities(graph, entities) {
    if (!entities || entities.length === 0 || !graph) return null;

    const nodes = graph.nodes || {};
    const edges = graph.edges || {};

    // Build set of matching node keys (case-insensitive)
    const entityLower = new Set(entities.map((e) => e.toLowerCase()));
    const matchedKeys = new Set();

    for (const [key, node] of Object.entries(nodes)) {
        if (entityLower.has(key.toLowerCase()) || entityLower.has((node.name || '').toLowerCase())) {
            matchedKeys.add(key);
        }
    }

    // Filter nodes
    const filteredNodes = {};
    for (const key of matchedKeys) {
        filteredNodes[key] = stripEmbedding(nodes[key]);
    }

    // Filter edges where source OR target is a matched node
    const filteredEdges = {};
    for (const [key, edge] of Object.entries(edges)) {
        if (matchedKeys.has(edge.source) || matchedKeys.has(edge.target)) {
            filteredEdges[key] = { ...edge };
        }
    }

    return { matchedEntities: entities, nodes: filteredNodes, edges: filteredEdges };
}
```

Modify `buildGraphExport` to accept entities and use the new helper:

```javascript
function buildGraphExport(graph, entities) {
    if (!graph)
        return {
            summary: { nodeCount: 0, edgeCount: 0, typeBreakdown: {}, topEntitiesByMentions: [] },
        };

    const nodes = graph.nodes || {};
    const edges = graph.edges || {};
    const nodeEntries = Object.values(nodes);

    // Type breakdown
    const typeBreakdown = {};
    for (const node of nodeEntries) {
        const t = node.type || 'UNKNOWN';
        typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }

    // Top entities by mentions
    const topEntities = nodeEntries
        .slice()
        .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
        .slice(0, 10)
        .map((n) => ({ name: n.name, type: n.type, mentions: n.mentions || 0 }));

    const result = {
        summary: {
            nodeCount: nodeEntries.length,
            edgeCount: Object.keys(edges).length,
            typeBreakdown,
            topEntitiesByMentions: topEntities,
        },
    };

    // Add relevant subgraph if entities available
    const relevant = filterGraphByEntities(graph, entities);
    if (relevant) {
        result.relevant = relevant;
    }

    return result;
}
```

Update the call in `buildExportPayload()`:
```javascript
    // Extract entities from last retrieval for graph filtering
    const queryEntities = cached?.queryContext?.entities || [];
    // ...
    graph: buildGraphExport(graph, queryEntities),
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: All PASS.

**Step 5: Update old graph test**
- The `'includes graph raw without embeddings'` test needs updating since `raw` no longer exists:

```javascript
    it('excludes embeddings from relevant graph nodes', () => {
        cacheRetrievalDebug({
            queryContext: { entities: ['Alice'], embeddingQuery: '', bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 } },
        });
        const payload = buildExportPayload();
        expect(payload.state.graph.relevant.nodes.alice).toBeDefined();
        expect(payload.state.graph.relevant.nodes.alice.embedding).toBeUndefined();
    });
```

**Step 6: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: All PASS.

**Step 7: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): replace raw graph dump with query-relevant filtered subset"`

---

### Task 7: Add runtime fields and perf metrics

**Goal:** Add `embeddingModelId`, `extractionProgress`, `reflectionState` to runtime; add perf metrics section.

**Step 1: Write the Failing Test**
- File: `tests/ui/export-debug.test.js`

```javascript
    it('includes extended runtime info', () => {
        const payload = buildExportPayload();
        expect(payload.runtime.embeddingsEnabled).toBe(true);
        expect(payload.runtime.embeddingModelId).toBeDefined();
        expect(payload.runtime.extractionProgress).toBeDefined();
        expect(payload.runtime.extractionProgress).toHaveProperty('processed');
        expect(payload.runtime.extractionProgress).toHaveProperty('chatLength');
    });

    it('includes perf section', () => {
        const payload = buildExportPayload();
        expect(payload.perf).toBeDefined();
        expect(payload.perf).toBeTypeOf('object');
    });
```

Note: The mock's `chatMetadata.openvault` doesn't have `embedding_model_id`, `processed_message_ids`, or `reflection_state`. These will be null/0/empty which is correct for testing default handling.

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: Fails — `runtime.embeddingModelId` and `runtime.extractionProgress` are undefined, `perf` doesn't exist.

**Step 3: Implementation (Green)**
- File: `src/ui/export-debug.js`

Add import for perf store:
```javascript
import { getAll as getPerfMetrics } from '../perf/store.js';
import { PERF_METRICS } from '../constants.js';
```

Note: Need to also mock `perf/store.js` in the test file. Add to test mock section:
```javascript
vi.mock('../../src/perf/store.js', () => ({
    getAll: () => ({}),
}));
```

Update the `runtime` section in `buildExportPayload()`:

```javascript
        runtime: {
            embeddingsEnabled: isEmbeddingsEnabled(),
            embeddingModelId: data.embedding_model_id || null,
            extractionProgress: {
                processed: (data.processed_message_ids || []).length,
                chatLength: deps.getContext()?.chat?.length || 0,
            },
            reflectionState: data.reflection_state || {},
        },
```

Add perf section to the return:

```javascript
        perf: buildPerfExport(),
```

Add `buildPerfExport` helper:

```javascript
/**
 * Build perf metrics export with rounded values.
 * @returns {Object}
 */
function buildPerfExport() {
    const metrics = getPerfMetrics();
    const result = {};
    for (const [id, entry] of Object.entries(metrics)) {
        const label = PERF_METRICS[id]?.label || id;
        result[label] = { ms: r2(entry.ms) };
        if (entry.size) result[label].size = entry.size;
    }
    return result;
}
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/ui/export-debug.test.js`
- Expect: All PASS.

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat(debug): add embeddingModelId, extractionProgress, reflectionState to runtime; add perf metrics section"`

---

### Task 8: Final cleanup — remove unused code and update ARCHITECTURE.md

**Goal:** Remove `_RECENT_CONTEXT_CAP` constant (unused after refactor), remove old `buildGraphExport` raw logic, update architecture docs.

**Step 1: Cleanup**
- File: `src/ui/export-debug.js`
- Remove `const _RECENT_CONTEXT_CAP = 2000;` (no longer referenced).

**Step 2: Update ARCHITECTURE.md**
- File: `include/ARCHITECTURE.md`
- In the **Performance Monitoring** paragraph, update the copy-to-clipboard description:

Replace:
```
Copy-to-clipboard generates plain text report for debugging.
```

With:
```
Debug export (`src/ui/export-debug.js`) copies JSON to clipboard with: scoring details (selected + top 15 rejected, 2dp precision, zero-suppressed), query-relevant graph subset, settings diff from defaults, perf timings, runtime state (embedding model, extraction progress, reflection state). Perf tab has separate plain-text copy.
```

**Step 3: Verify full test suite**
- Command: `npx vitest run`
- Expect: All PASS.

**Step 4: Git Commit**
- Command: `git add -A && git commit -m "chore(debug): remove unused constant, update ARCHITECTURE.md for debug export redesign"`

---

### Task 9: Full regression verification

**Goal:** Ensure all tests pass and no regressions.

**Step 1: Run full test suite**
- Command: `npx vitest run`
- Expect: All PASS.

**Step 2: Manual verification (optional)**
- Build and load extension in SillyTavern.
- Generate a message, then click "Copy Debug Info".
- Paste into a text editor and verify:
  - Floats are 2dp
  - Settings section is small (or empty)
  - Scoring has `selected` and `rejected` arrays (not `details`)
  - Graph has `relevant` (not `raw`)
  - `perf` section exists
  - `runtime` has `embeddingModelId`, `extractionProgress`, `reflectionState`
