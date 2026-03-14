# Post-Review Improvements Implementation Plan

**Goal:** Implement 6 validated improvements from two LLM reviews: strip `<tool_call>` tags, soften dedup prompt, lower edge consolidation threshold, add map-reduce global synthesis, reduce reflection candidate limit, reorder entity merge checks.

**Architecture:** Each item is independent and can be implemented in any order. Items 1/3/5 are single-file value changes. Item 2 is prompt text (no unit tests). Item 4 adds a private function to `communities.js`. Item 7 extracts a DRY helper in `graph.js` and reverses the check order in two call sites.

**Tech Stack:** Vitest (test runner), ES modules, no external dependencies added.

---

### Task 1: Write failing tests for `<tool_call>` tag stripping

**Files:**
- Test: `tests/utils/text.test.js`

- [ ] Step 1: Add 4 failing test cases to the existing `stripThinkingTags` describe block

```javascript
// Add these inside the existing describe('stripThinkingTags', () => { ... }) block,
// after the last existing test ('does not strip content when no orphaned closing tag exists')

it('strips <tool_call> paired tags', () => {
    const input = '<tool_call>{"name":"extract"}</tool_call>{"events": []}';
    expect(stripThinkingTags(input)).toBe('{"events": []}');
});

it('strips <tool_call> tags with attributes', () => {
    const input = '<tool_call name="extract_events">{"name":"extract"}</tool_call>{"events": []}';
    expect(stripThinkingTags(input)).toBe('{"events": []}');
});

it('strips orphaned </tool_call> closing tag', () => {
    const input = 'calling the tool now\n</tool_call>\n{"events": []}';
    expect(stripThinkingTags(input)).toBe('{"events": []}');
});

it('strips [TOOL_CALL] bracket tags', () => {
    const input = '[TOOL_CALL]function call here[/TOOL_CALL]{"result": true}';
    expect(stripThinkingTags(input)).toBe('{"result": true}');
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npm test -- --reporter verbose tests/utils/text.test.js`
Expected: 4 FAIL — `stripThinkingTags` does not yet handle `tool_call` tags

---

### Task 2: Implement `<tool_call>` tag stripping

**Files:**
- Modify: `src/utils/text.js`

- [ ] Step 3: Update `stripThinkingTags` to handle `tool_call` and `search` tags

In `src/utils/text.js`, replace the `stripThinkingTags` function body (lines 37-49):

```javascript
export function stripThinkingTags(text) {
    if (typeof text !== 'string') return text;
    return (
        text
            // Paired XML tags: <think>...</think>, <tool_call>...</tool_call>, etc.
            // (?:\s+[^>]*)? matches optional attributes like <tool_call name="extract_events">
            .replace(/<(think|thinking|thought|reasoning|reflection|tool_call|search)(?:\s+[^>]*)?>\s*[\s\S]*?<\/\1>/gi, '')
            // Paired bracket tags: [THINK]...[/THINK], [TOOL_CALL]...[/TOOL_CALL], etc.
            .replace(/\[(THINK|THOUGHT|REASONING|TOOL_CALL)\][\s\S]*?\[\/\1\]/gi, '')
            .replace(/\*thinks?:[\s\S]*?\*/gi, '')
            .replace(/\(thinking:[\s\S]*?\)/gi, '')
            // Orphaned closing tags (opening tag was in assistant prefill)
            .replace(/^[\s\S]*?<\/(think|thinking|thought|reasoning|tool_call|search)>\s*/i, '')
            .trim()
    );
}
```

- [ ] Step 4: Run tests to verify they pass

Run: `npm test -- --reporter verbose tests/utils/text.test.js`
Expected: ALL PASS (including 4 new tests)

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat: strip <tool_call> and <search> tags from LLM responses

Add tool_call|search to paired-tag regex, orphaned-closing-tag regex,
and bracket-tag regex in stripThinkingTags().
Include (?:\\s+[^>]*)? to handle tag attributes (Qwen models emit
<tool_call name=\"extract_events\">)."
```

---

### Task 3: Lower edge consolidation threshold

**Files:**
- Modify: `src/constants.js`

- [ ] Step 6: Change `TOKEN_THRESHOLD` from 500 to 250

In `src/constants.js`, find the `CONSOLIDATION` object (line 228) and change:

```javascript
export const CONSOLIDATION = {
    TOKEN_THRESHOLD: 250,           // Trigger consolidation when description exceeds this
    MAX_CONSOLIDATION_BATCH: 10,    // Max edges to consolidate per community detection run
    CONSOLIDATED_DESCRIPTION_CAP: 2, // After consolidation, cap future additions to 2 segments
};
```

- [ ] Step 7: Run consolidation tests to verify nothing breaks

Run: `npm test -- --reporter verbose tests/graph/consolidation.test.js`
Expected: ALL PASS (tests assert on logic, not threshold values)

- [ ] Step 8: Commit

```bash
git add -A && git commit -m "tune: lower edge consolidation threshold from 500 to 250 tokens

Russian text at 500 tokens is ~300-400 words, causing context noise.
250 triggers consolidation sooner, keeping edge descriptions leaner."
```

---

### Task 4: Extract reflection candidate limit to constant

**Files:**
- Modify: `src/constants.js`
- Modify: `src/reflection/reflect.js`

- [ ] Step 9: Add `REFLECTION_CANDIDATE_LIMIT` constant to `src/constants.js`

Add this line after the `CONSOLIDATION` block (after line 231):

```javascript
// Maximum number of recent memories to consider as reflection candidates.
// Reducing from 100 to 50 cuts reflection prompt size without losing signal quality.
export const REFLECTION_CANDIDATE_LIMIT = 50;
```

- [ ] Step 10: Update `reflect.js` to use the new constant

In `src/reflection/reflect.js`, add the import at the top (alongside the existing `extensionName` import on line 17):

Change:
```javascript
import { extensionName } from '../constants.js';
```
To:
```javascript
import { extensionName, REFLECTION_CANDIDATE_LIMIT } from '../constants.js';
```

Then change line 217 from:
```javascript
const recentMemories = sortMemoriesBySequence(accessibleMemories, false).slice(0, 100);
```
To:
```javascript
const recentMemories = sortMemoriesBySequence(accessibleMemories, false).slice(0, REFLECTION_CANDIDATE_LIMIT);
```

- [ ] Step 11: Run reflection tests to verify nothing breaks

Run: `npm test -- --reporter verbose tests/reflection/reflect.test.js`
Expected: ALL PASS

- [ ] Step 12: Commit

```bash
git add -A && git commit -m "tune: reduce reflection candidate limit from 100 to 50

Extract hardcoded .slice(0, 100) to named constant REFLECTION_CANDIDATE_LIMIT.
50 candidates still provides sufficient signal for 1-3 insights while halving
prompt size and LLM latency."
```

---

### Task 5: Write failing tests for `shouldMergeEntities` helper

**Files:**
- Test: `tests/graph/graph.test.js`

This task adds unit tests for the new `shouldMergeEntities()` DRY helper that will replace the duplicated token-overlap → cosine logic in both `mergeOrInsertEntity` and `consolidateGraph`.

- [ ] Step 13: Add the `shouldMergeEntities` import to the existing imports at the top of `tests/graph/graph.test.js`

Change line 4-13 imports to include `shouldMergeEntities`:
```javascript
import {
    consolidateEdges,
    consolidateGraph,
    createEmptyGraph,
    expandMainCharacterKeys,
    initGraphState,
    markEdgeForConsolidation,
    mergeOrInsertEntity,
    normalizeKey,
    redirectEdges,
    shouldMergeEntities,
    upsertEntity,
    upsertRelationship,
} from '../../src/graph/graph.js';
```

- [ ] Step 14: Add `shouldMergeEntities` test suite at the end of the file

```javascript
describe('shouldMergeEntities', () => {
    it('returns true when cosine is above threshold (token overlap skipped)', () => {
        // cosine=0.96, threshold=0.94 → above threshold → merge directly
        const tokensA = new Set(['king', 'aldric']);
        expect(shouldMergeEntities(0.96, 0.94, tokensA, 'king aldric', 'completely different')).toBe(true);
    });

    it('returns true when cosine is exactly at threshold', () => {
        const tokensA = new Set(['king']);
        expect(shouldMergeEntities(0.94, 0.94, tokensA, 'king', 'queen')).toBe(true);
    });

    it('returns true in grey zone when token overlap passes', () => {
        // cosine=0.90, threshold=0.94, greyZoneFloor=0.84 → grey zone
        // tokensA='vova house', keyB='vova apartment' → 'vova' overlaps → pass
        const tokensA = new Set(['vova', 'house']);
        expect(shouldMergeEntities(0.90, 0.94, tokensA, 'vova house', 'vova apartment')).toBe(true);
    });

    it('returns false in grey zone when token overlap fails', () => {
        // cosine=0.90, threshold=0.94, greyZoneFloor=0.84 → grey zone
        // tokensA='alpha', keyB='omega' → no overlap → fail
        const tokensA = new Set(['alpha']);
        expect(shouldMergeEntities(0.90, 0.94, tokensA, 'alpha', 'omega')).toBe(false);
    });

    it('returns false when cosine is below grey zone', () => {
        // cosine=0.80, threshold=0.94, greyZoneFloor=0.84 → below grey zone
        const tokensA = new Set(['king', 'aldric']);
        expect(shouldMergeEntities(0.80, 0.94, tokensA, 'king aldric', 'king aldric')).toBe(false);
    });

    it('does not construct tokensB when cosine is above threshold', () => {
        // Even with completely non-overlapping keys, cosine >= threshold means merge
        const tokensA = new Set(['абсолютно']);
        expect(shouldMergeEntities(0.95, 0.94, tokensA, 'абсолютно', 'совершенно другое')).toBe(true);
    });

    it('does not construct tokensB when cosine is below grey zone', () => {
        // cosine=0.70, threshold=0.94 → below 0.84 floor → skip
        const tokensA = new Set(['king']);
        expect(shouldMergeEntities(0.70, 0.94, tokensA, 'king', 'king')).toBe(false);
    });

    it('respects custom threshold values', () => {
        // threshold=0.80, greyZoneFloor=0.70
        const tokensA = new Set(['castle']);
        // cosine=0.82 → above 0.80 threshold → true
        expect(shouldMergeEntities(0.82, 0.80, tokensA, 'castle', 'fortress')).toBe(true);
        // cosine=0.75 → grey zone (0.70-0.80) → depends on token overlap
        expect(shouldMergeEntities(0.75, 0.80, tokensA, 'castle', 'fortress')).toBe(false); // no overlap
        // cosine=0.65 → below 0.70 floor → false
        expect(shouldMergeEntities(0.65, 0.80, tokensA, 'castle', 'castle')).toBe(false);
    });
});
```

- [ ] Step 15: Run tests to verify they fail

Run: `npm test -- --reporter verbose tests/graph/graph.test.js`
Expected: FAIL — `shouldMergeEntities` is not exported from `graph.js`

---

### Task 6: Implement `shouldMergeEntities` and refactor merge sites

**Files:**
- Modify: `src/graph/graph.js`

- [ ] Step 16: Add `shouldMergeEntities` function to `src/graph/graph.js`

Add this function after the existing `hasSufficientTokenOverlap` function (after line 298):

```javascript
/**
 * Determine if two entities should merge based on cosine similarity
 * and optional token overlap confirmation.
 *
 * Above threshold: cosine alone is sufficient (catches true synonyms).
 * Grey zone (threshold - 0.10 to threshold): requires token overlap confirmation.
 * Below grey zone: no merge.
 *
 * tokensA is pre-computed by the caller (outer loop). tokensB is constructed
 * lazily from keyB only when cosine lands in the grey zone, avoiding
 * Set allocation on every iteration of the tight inner loop.
 *
 * @param {number} cosine - Cosine similarity between embeddings
 * @param {number} threshold - entityMergeSimilarityThreshold from settings
 * @param {Set<string>} tokensA - Word tokens from entity A's key (pre-computed)
 * @param {string} keyA - Entity A's normalized key (for LCS/substring checks)
 * @param {string} keyB - Entity B's normalized key
 * @returns {boolean}
 */
export function shouldMergeEntities(cosine, threshold, tokensA, keyA, keyB) {
    if (cosine >= threshold) return true;
    const greyZoneFloor = threshold - 0.10;
    if (cosine >= greyZoneFloor) {
        const tokensB = new Set(keyB.split(/\s+/));
        return hasSufficientTokenOverlap(tokensA, tokensB, 0.5, keyA, keyB);
    }
    return false;
}
```

- [ ] Step 17: Refactor `mergeOrInsertEntity` to use `shouldMergeEntities`

In `src/graph/graph.js`, find the loop in `mergeOrInsertEntity` (around line 340-350). Replace:

```javascript
    for (const [existingKey, existingEmbedding] of existingEmbeddings) {
        const node = graphData.nodes[existingKey];
        const existingTokens = new Set(existingKey.split(/\s+/));

        // Use improved token overlap guard
        if (!hasSufficientTokenOverlap(newTokens, existingTokens, 0.5, key, existingKey)) {
            continue;
        }

        const sim = cosineSimilarity(newEmbedding, existingEmbedding);
        if (sim >= threshold && sim > bestScore) {
            bestMatch = existingKey;
            bestScore = sim;
        }
    }
```

With:

```javascript
    for (const [existingKey, existingEmbedding] of existingEmbeddings) {
        const sim = cosineSimilarity(newEmbedding, existingEmbedding);
        if (!shouldMergeEntities(sim, threshold, newTokens, key, existingKey)) {
            continue;
        }
        if (sim > bestScore) {
            bestMatch = existingKey;
            bestScore = sim;
        }
    }
```

- [ ] Step 18: Refactor `consolidateGraph` to use `shouldMergeEntities`

In `src/graph/graph.js`, find the inner loop in `consolidateGraph` (around line 484-500). Replace:

```javascript
            for (let j = i + 1; j < keys.length; j++) {
                if (mergeMap.has(keys[j])) continue;

                const tokensJ = new Set(keys[j].split(/\s+/));

                // Use improved token overlap guard
                if (!hasSufficientTokenOverlap(tokensI, tokensJ, 0.5, keys[i], keys[j])) {
                    continue;
                }

                const nodeA = graphData.nodes[keys[i]];
                const nodeB = graphData.nodes[keys[j]];
                const sim = cosineSimilarity(getEmbedding(nodeA), getEmbedding(nodeB));

                if (sim >= threshold) {
```

With:

```javascript
            for (let j = i + 1; j < keys.length; j++) {
                if (mergeMap.has(keys[j])) continue;

                const nodeA = graphData.nodes[keys[i]];
                const nodeB = graphData.nodes[keys[j]];
                const sim = cosineSimilarity(getEmbedding(nodeA), getEmbedding(nodeB));

                if (!shouldMergeEntities(sim, threshold, tokensI, keys[i], keys[j])) {
                    continue;
                }

                {
```

Note: The opening `{` replaces the old `if (sim >= threshold) {` since `shouldMergeEntities` already handles the threshold check. The merge logic inside (choosing keepKey/removeKey) stays unchanged, but you need to remove the closing `}` of the old `if` block as well. The simplest approach: remove the `if (sim >= threshold) {` line and its corresponding closing `}` (which is the one right before the outer `for` loop's closing `}`), keeping all the code between them at the same indentation level.

- [ ] Step 19: Run all graph tests to verify they pass

Run: `npm test -- --reporter verbose tests/graph/graph.test.js tests/graph/token-overlap.test.js`
Expected: ALL PASS (including 8 new `shouldMergeEntities` tests)

- [ ] Step 20: Commit

```bash
git add -A && git commit -m "refactor: extract shouldMergeEntities() DRY helper, cosine-first check order

Reverses the check order in mergeOrInsertEntity and consolidateGraph:
- Above threshold: cosine alone → merge (catches true synonyms)
- Grey zone (threshold - 0.10): cosine + token overlap → merge
- Below grey zone: skip

tokensB is lazily constructed only in the grey zone, avoiding
Set allocation on every iteration of the tight inner loop."
```

---

### Task 7: Write failing tests for map-reduce global synthesis

**Files:**
- Test: `tests/graph/communities.test.js`

- [ ] Step 21: Add `synthesizeInChunks` to the test imports

At the top of `tests/graph/communities.test.js`, update the import (line 5-8):

```javascript
import {
    buildCommunityGroups,
    detectCommunities,
    generateGlobalWorldState,
    synthesizeInChunks,
    toGraphology,
    updateCommunitySummaries,
} from '../../src/graph/communities.js';
```

- [ ] Step 22: Add `synthesizeInChunks` test suite after the existing `generateGlobalWorldState` tests

```javascript
describe('synthesizeInChunks', () => {
    beforeEach(() => {
        setupTestContext();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetDeps();
        vi.clearAllMocks();
    });

    it('uses single-pass for <= 10 communities', async () => {
        mockCallLLM.mockResolvedValue('{"global_summary": "Single pass result"}');

        const communities = Array.from({ length: 8 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBe('Single pass result');
        // Single-pass: exactly 1 LLM call
        expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('uses map-reduce for > 10 communities', async () => {
        let callCount = 0;
        mockCallLLM.mockImplementation(() => {
            callCount++;
            if (callCount <= 3) {
                // Map phase: 3 regional summaries
                return Promise.resolve(`{"global_summary": "Regional summary ${callCount}"}`);
            }
            // Reduce phase: final synthesis
            return Promise.resolve('{"global_summary": "Final synthesized narrative"}');
        });

        const communities = Array.from({ length: 25 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBe('Final synthesized narrative');
        // 25 communities / 10 per chunk = 3 map calls + 1 reduce call = 4
        expect(mockCallLLM).toHaveBeenCalledTimes(4);
    });

    it('continues when one chunk fails (partial results)', async () => {
        let callCount = 0;
        mockCallLLM.mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
                // Second chunk fails
                return Promise.reject(new Error('LLM timeout'));
            }
            if (callCount <= 3) {
                return Promise.resolve(`{"global_summary": "Regional summary ${callCount}"}`);
            }
            return Promise.resolve('{"global_summary": "Final from 2 regions"}');
        });

        const communities = Array.from({ length: 25 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBe('Final from 2 regions');
        // 3 map calls (1 failed) + 1 reduce call = 4 total
        expect(mockCallLLM).toHaveBeenCalledTimes(4);
    });

    it('returns null when all chunks fail', async () => {
        mockCallLLM.mockRejectedValue(new Error('LLM down'));

        const communities = Array.from({ length: 25 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBeNull();
        // 3 map calls, all failed, no reduce call
        expect(mockCallLLM).toHaveBeenCalledTimes(3);
    });

    it('handles exactly 10 communities as single-pass', async () => {
        mockCallLLM.mockResolvedValue('{"global_summary": "Boundary test"}');

        const communities = Array.from({ length: 10 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBe('Boundary test');
        expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });

    it('handles exactly 11 communities as map-reduce', async () => {
        let callCount = 0;
        mockCallLLM.mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return Promise.resolve(`{"global_summary": "Regional ${callCount}"}`);
            }
            return Promise.resolve('{"global_summary": "Final 11"}');
        });

        const communities = Array.from({ length: 11 }, (_, i) => ({
            title: `Community ${i}`,
            summary: `Summary ${i}`,
            findings: [`finding ${i}`],
        }));

        const result = await synthesizeInChunks(communities, 'auto', 'auto');
        expect(result).toBe('Final 11');
        // 11 communities / 10 per chunk = 2 map calls + 1 reduce call = 3
        expect(mockCallLLM).toHaveBeenCalledTimes(3);
    });
});
```

- [ ] Step 23: Run tests to verify they fail

Run: `npm test -- --reporter verbose tests/graph/communities.test.js`
Expected: FAIL — `synthesizeInChunks` is not exported from `communities.js`

---

### Task 8: Implement map-reduce global synthesis

**Files:**
- Modify: `src/graph/communities.js`
- Modify: `src/constants.js`

- [ ] Step 24: Add `GLOBAL_SYNTHESIS_CHUNK_SIZE` constant to `src/constants.js`

Add after the `REFLECTION_CANDIDATE_LIMIT` constant:

```javascript
// Maximum number of communities per chunk in map-reduce global synthesis.
// Sets larger than this are chunked into regional summaries before final reduction.
export const GLOBAL_SYNTHESIS_CHUNK_SIZE = 10;
```

- [ ] Step 25: Add `synthesizeInChunks` function and update `generateGlobalWorldState` in `src/graph/communities.js`

First, update the import from `../constants.js` at the top of `communities.js` (line 15):

Change:
```javascript
import { extensionName } from '../constants.js';
```
To:
```javascript
import { extensionName, GLOBAL_SYNTHESIS_CHUNK_SIZE } from '../constants.js';
```

Then add `synthesizeInChunks` as a new exported function before `generateGlobalWorldState`:

```javascript
/**
 * Synthesize community summaries into a global narrative.
 * Uses single-pass for small sets, map-reduce for larger sets.
 *
 * @param {Object[]} communityList - Array of community objects with { title, summary, findings }
 * @param {string} preamble - Extraction preamble
 * @param {string} outputLanguage - Output language setting
 * @returns {Promise<string|null>} Global summary string, or null if all chunks fail
 */
export async function synthesizeInChunks(communityList, preamble, outputLanguage) {
    if (communityList.length <= GLOBAL_SYNTHESIS_CHUNK_SIZE) {
        // Small set: single-pass (current behavior)
        const prompt = buildGlobalSynthesisPrompt(communityList, preamble, outputLanguage);
        const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
        return parseGlobalSynthesisResponse(response).global_summary;
    }

    // Map phase: chunk communities, get regional summaries
    const chunks = [];
    for (let i = 0; i < communityList.length; i += GLOBAL_SYNTHESIS_CHUNK_SIZE) {
        chunks.push(communityList.slice(i, i + GLOBAL_SYNTHESIS_CHUNK_SIZE));
    }

    const regionalSummaries = [];
    for (const chunk of chunks) {
        try {
            const prompt = buildGlobalSynthesisPrompt(chunk, preamble, outputLanguage);
            const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
            const parsed = parseGlobalSynthesisResponse(response);
            regionalSummaries.push(parsed.global_summary);
        } catch (err) {
            logDebug(`Regional synthesis chunk failed, skipping: ${err.message}`);
        }
    }

    if (regionalSummaries.length === 0) return null;

    // Reduce phase: synthesize regional summaries into final global summary
    const pseudoCommunities = regionalSummaries.map((summary, i) => ({
        title: `Region ${i + 1}`,
        summary,
        findings: [],
    }));
    const reducePrompt = buildGlobalSynthesisPrompt(pseudoCommunities, preamble, outputLanguage);
    const reduceResponse = await callLLM(reducePrompt, LLM_CONFIGS.community, { structured: true });
    return parseGlobalSynthesisResponse(reduceResponse).global_summary;
}
```

Then replace the body of `generateGlobalWorldState` to delegate to `synthesizeInChunks`:

```javascript
export async function generateGlobalWorldState(communities, preamble, outputLanguage) {
    const communityList = Object.values(communities || {});
    if (communityList.length === 0) {
        return null;
    }

    const t0 = performance.now();
    const deps = getDeps();

    try {
        const summary = await synthesizeInChunks(communityList, preamble, outputLanguage);

        const result = {
            summary,
            last_updated: deps.Date.now(),
            community_count: communityList.length,
        };

        logDebug(`Global world state synthesized from ${communityList.length} communities`);
        record('global_synthesis', performance.now() - t0, `${communityList.length} communities`);
        return result;
    } catch (error) {
        logDebug(`Global world state synthesis failed: ${error.message}`);
        return null;
    }
}
```

- [ ] Step 26: Run community tests to verify all pass

Run: `npm test -- --reporter verbose tests/graph/communities.test.js`
Expected: ALL PASS (including 6 new `synthesizeInChunks` tests + existing `generateGlobalWorldState` tests)

- [ ] Step 27: Commit

```bash
git add -A && git commit -m "feat: map-reduce global synthesis for large community sets

When community count > 10, chunk into groups of 10, run regional
synthesis per chunk (with per-chunk try/catch for resiliency), then
reduce regional summaries into a final global narrative.

Prevents 502 gateway timeouts from oversized single-prompt synthesis."
```

---

### Task 9: Soften dedup prompt and rewrite few-shot examples

**Files:**
- Modify: `src/prompts/index.js`
- Modify: `src/prompts/examples/events.js`

This is prompt text — no unit tests. Verified by manual extraction run.

- [ ] Step 28: Replace the `<dedup>` block in `src/prompts/index.js`

In `src/prompts/index.js`, find the `EVENT_RULES` constant string. Locate the `<dedup>` block (lines 223-239 approximately). Replace the entire `<dedup>...</dedup>` section with:

```
<dedup>
This is the MOST IMPORTANT rule. Duplicating memories already in established_memories is the worst error.

BEFORE creating ANY event, you MUST check the <established_memories> section in the user message.

If a scene is already recorded there, DO NOT repeat the same actions. Instead, look for the NEWEST change within that scene:
1. A shift in emotional state (e.g., confidence → vulnerability, pleasure → discomfort).
2. A new phase or escalation (e.g., foreplay → penetration, sparring → real fight).
3. The scene concluding (e.g., climax, falling asleep, location change, combat ends).
4. A power dynamic reversal (e.g., submissive takes control, ambush turns into retreat).
5. A new element changing the scene's nature (new character arrives, weapon drawn, secret revealed).
6. A safeword explicitly used to halt the scene.

If the messages contain ONLY a continuation of the exact same action with no shift, escalation, or conclusion — then output "events": [].

When in doubt, extract a brief progression event rather than output nothing. The system will automatically filter true duplicates.
</dedup>
```

- [ ] Step 29: Update thinking process Step 3

In the same `EVENT_RULES` constant, find Step 3 in the `<thinking_process>` block. Change:

```
Step 3: Apply dedup rules. If this is a continuation with no escalation, plan to output "events": [].
```

To:

```
Step 3: Apply dedup rules. If this is a continuation, look for the newest progression. If there is none at all, plan to output "events": [].
```

- [ ] Step 30: Rewrite first dedup example in `src/prompts/examples/events.js`

In `src/prompts/examples/events.js`, find the example labeled `'Dedup - continuation (EN/Edge)'` (around line 185). Replace it entirely with:

```javascript
    {
        label: 'Dedup - progression extraction (EN/Edge)',
        input: `The crop came down again — three, four, five. His thighs were crisscrossed with welts now. "Color?" she asked. "Green," he whispered, voice shaking.
She traced a welt with her fingertip, watching him shiver.

<established_memories>
[★★★★] She restrained him with leather cuffs and struck him with a riding crop after a green-light color check
</established_memories>`,
        thinking: `Step 1: More crop strikes, welts accumulating, another color check, aftercare touch (tracing welt).
Step 2: Existing memory covers: restraints, crop strikes, initial color check.
Step 3: The scene is intensifying — welts accumulating, his voice is shaking (emotional shift from composure to strain). But the core action (crop impact) is the same type. Borderline.
Step 4: The emotional shift (shaking voice) and physical escalation (welts accumulating) are a genuine progression from the initial strike.`,
        output: `{ "events": [{ "summary": "His thighs became crisscrossed with welts from repeated crop strikes; his voice shook during the color check", "importance": 2, "characters_involved": ["She", "He"], "witnesses": [], "location": null, "is_secret": false, "emotional_impact": { "He": "strained but consenting" }, "relationship_impact": {} }] }`,
    },
```

- [ ] Step 31: Keep the second dedup example (RU/Edge) but update its thinking to match new rules

Find the example labeled `'Dedup - continuation (RU/Edge)'` (around line 199). Replace its `thinking` field:

```javascript
        thinking: `Step 1: Input is Russian. Continuation of sex in same position. Rhythm acceleration.
Step 2: Existing memory: cowgirl sex, near-orgasm — already recorded.
Step 3: Same position, same act. The rhythm acceleration and mutual intensity are continuation, not a new phase. No dynamic shift, no new element.
Step 4: This is a continuation of the exact same action with no shift, escalation, or conclusion. Output empty.`,
```

- [ ] Step 32: Run prompt example tests to verify structure is still valid

Run: `npm test -- --reporter verbose tests/prompts/examples/events.test.js`
Expected: ALL PASS (tests validate structure/format, not prompt wording)

- [ ] Step 33: Commit

```bash
git add -A && git commit -m "prompt: soften dedup rules, rewrite first dedup example for progression

Replace binary 'MUST set events to empty' with progression-oriented
guidance. First EN/Edge example now shows extracting a micro-progression
(emotional shift + physical escalation). Second RU/Edge example kept
as empty output for truly static continuation — balanced calibration."
```

---

### Task 10: Run full test suite and verify

- [ ] Step 34: Run the complete test suite

Run: `npm test`
Expected: ALL PASS — no regressions across any test file.

- [ ] Step 35: Final commit (if any lint/format fixes needed)

```bash
git add -A && git commit -m "chore: post-review improvements complete (6 items)"
```

---

## Summary Table

| Task | Item | Files Modified | Type |
|------|------|----------------|------|
| 1-2 | Strip `<tool_call>` tags | `text.js`, `text.test.js` | TDD |
| 3 | Lower consolidation threshold | `constants.js` | Value change |
| 4 | Reflection candidate limit | `constants.js`, `reflect.js` | Extract constant |
| 5-6 | Entity merge reorder | `graph.js`, `graph.test.js` | TDD + refactor |
| 7-8 | Map-reduce synthesis | `communities.js`, `constants.js`, `communities.test.js` | TDD + new function |
| 9 | Soften dedup prompt | `index.js`, `events.js` | Prompt text |
| 10 | Full test suite verification | — | Verification |
