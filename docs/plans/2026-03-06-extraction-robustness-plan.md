# Implementation Plan — Extraction Robustness & Memory Quality Pass

> **Reference:** `docs/designs/2026-03-06-extraction-robustness-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Harden `stripMarkdown` for unclosed fences

**Goal:** Make JSON parsing survive when the LLM forgets to close markdown code fences.

**Step 1: Write the Failing Tests**
- File: `tests/extraction/structured.test.js`
- Add to existing test file, new `describe('stripMarkdown edge cases')` block:
```javascript
import { _testStripMarkdown } from '../../src/extraction/structured.js';

describe('stripMarkdown edge cases', () => {
    it('strips unclosed opening fence', () => {
        const content = '```json\n{"events": []}';
        const result = _testStripMarkdown(content);
        expect(result).toBe('{"events": []}');
    });

    it('strips orphan closing fence', () => {
        const content = '{"events": []}\n```';
        const result = _testStripMarkdown(content);
        expect(result).toBe('{"events": []}');
    });

    it('strips opening fence without json label', () => {
        const content = '```\n{"events": []}';
        const result = _testStripMarkdown(content);
        expect(result).toBe('{"events": []}');
    });

    it('still strips complete fences', () => {
        const content = '```json\n{"events": []}\n```';
        const result = _testStripMarkdown(content);
        expect(result).toBe('{"events": []}');
    });

    it('passes through content without fences', () => {
        const content = '{"events": []}';
        const result = _testStripMarkdown(content);
        expect(result).toBe('{"events": []}');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/extraction/structured.test.js`
- Expect: `strips unclosed opening fence` and `strips orphan closing fence` FAIL (content returned with fences intact)

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
- Replace the `stripMarkdown` function (around line 85):

Old:
```javascript
function stripMarkdown(content) {
    const trimmed = content.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
}
```

New:
```javascript
function stripMarkdown(content) {
    const trimmed = content.trim();
    // Complete fences: ```json ... ```
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) return fenceMatch[1].trim();
    // Unclosed opening fence: ```json\n{...}
    let result = trimmed.replace(/^```(?:json)?\s*/i, '');
    // Orphan closing fence: {...}\n```
    result = result.replace(/\s*```\s*$/i, '');
    return result.trim();
}
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/extraction/structured.test.js`
- Expect: ALL PASS

**Step 5: Git Commit**
```
git add src/extraction/structured.js tests/extraction/structured.test.js && git commit -m "fix: handle unclosed markdown fences in LLM JSON responses"
```

---

### Task 2: Extract shared `rpmDelay` utility and add inter-call delay

**Goal:** DRY the RPM-based rate limiting and add a delay between Event→Graph LLM calls within a single extraction batch.

**Step 1: Write the Failing Test**
- File: `tests/extraction/extract.test.js`
- Add to existing test file, in the `extractMemories` describe block:
```javascript
it('applies RPM delay between event and graph LLM calls', async () => {
    const sendRequest = mockSendRequest();
    const callTimestamps = [];
    sendRequest.mockImplementation(async () => {
        callTimestamps.push(Date.now());
        if (callTimestamps.length === 1) {
            return { content: EXTRACTION_RESPONSES.events };
        }
        return { content: EXTRACTION_RESPONSES.graph };
    });

    resetDeps({
        getContext: () => ({ ...getTestContext() }),
        getExtensionSettings: () => ({
            openvault: { ...getExtractionSettings(), backfillMaxRPM: 60 },
        }),
        sendRequest,
        Date: { now: () => Date.now() },
        console: { error: vi.fn(), warn: vi.fn() },
        fetch: vi.fn(),
        saveChatDebounced: vi.fn(),
    });

    await extractMemories([0, 1, 2, 3, 4]);

    expect(sendRequest).toHaveBeenCalledTimes(2);
    // With 60 RPM, delay is ceil(60000/60) = 1000ms
    const gap = callTimestamps[1] - callTimestamps[0];
    expect(gap).toBeGreaterThanOrEqual(900); // Allow small timing variance
});
```

Note: This test requires `getTestContext` and `getExtractionSettings` helpers that already exist in extract.test.js. Adjust imports as needed.

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/extraction/extract.test.js`
- Expect: FAIL — gap between calls is near 0 (no delay currently exists between Event→Graph calls)

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`

Add the shared utility function near the top of the file (after the backoff constants, ~line 22):
```javascript
/**
 * Wait based on the configured RPM rate limit.
 * Reusable between inter-call and inter-batch delays.
 * @param {Object} settings - Extension settings containing backfillMaxRPM
 * @param {string} [label='Rate limit'] - Log label
 */
async function rpmDelay(settings, label = 'Rate limit') {
    const rpm = settings.backfillMaxRPM || 30;
    const delayMs = Math.ceil(60000 / rpm);
    log(`${label}: waiting ${delayMs}ms (${rpm} RPM)`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}
```

Insert the inter-call delay in `extractMemories` — after Stage 3A, before Stage 3B (between the eventResult parse and the graph prompt call):

Old (around line 378-395):
```javascript
        // Stage 3A: Event Extraction (LLM Call 1)
        const eventJson = await callLLM(prompt, LLM_CONFIGS.extraction_events, { structured: true });
        const eventResult = parseEventExtractionResponse(eventJson);
        let events = eventResult.events;

        // Stage 3B: Graph Extraction (LLM Call 2) — skip if no events
        let graphResult = { entities: [], relationships: [] };
        if (events.length > 0) {
```

New:
```javascript
        // Stage 3A: Event Extraction (LLM Call 1)
        const eventJson = await callLLM(prompt, LLM_CONFIGS.extraction_events, { structured: true });
        const eventResult = parseEventExtractionResponse(eventJson);
        let events = eventResult.events;

        // Stage 3B: Graph Extraction (LLM Call 2) — skip if no events
        let graphResult = { entities: [], relationships: [] };
        if (events.length > 0) {
            await rpmDelay(settings, 'Inter-call rate limit');
```

Replace the inline delay in `extractAllMessages` backfill loop. Old (around line 601-604):
```javascript
            // Delay between batches based on rate limit setting
            const rpm = settings.backfillMaxRPM || 30;
            const delayMs = Math.ceil(60000 / rpm);
            log(`Rate limiting: waiting ${delayMs}ms (${rpm} RPM)`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
```

New:
```javascript
            await rpmDelay(settings, 'Batch rate limit');
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/extraction/extract.test.js`
- Expect: ALL PASS (including the new timing test)

**Step 5: Git Commit**
```
git add src/extraction/extract.js tests/extraction/extract.test.js && git commit -m "feat: shared rpmDelay utility with inter-call rate limiting"
```

---

### Task 3: Reduce Cyrillic embedding chunk size

**Goal:** Prevent silent truncation of Russian text by reducing `multilingual-e5-small` chunk size from 500 to 250.

**Step 1: Write the Failing Test**
- File: `tests/embeddings.test.js` (create if not exists, or add to existing)
```javascript
import { describe, expect, it } from 'vitest';
import { TRANSFORMERS_MODELS } from '../src/embeddings.js';

describe('TRANSFORMERS_MODELS config', () => {
    it('multilingual-e5-small has Cyrillic-safe chunk size', () => {
        const config = TRANSFORMERS_MODELS['multilingual-e5-small'];
        // 250 chars × ~1.5 tokens/Cyrillic char ≈ 375 tokens (within 512 limit)
        expect(config.optimalChunkSize).toBeLessThanOrEqual(250);
    });

    it('embeddinggemma-300m retains large chunk size', () => {
        const config = TRANSFORMERS_MODELS['embeddinggemma-300m'];
        expect(config.optimalChunkSize).toBe(1800);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/embeddings.test.js`
- Expect: FAIL — `multilingual-e5-small` chunk size is 500, not ≤250

**Step 3: Implementation (Green)**
- File: `src/embeddings.js`
- Change `optimalChunkSize` for `multilingual-e5-small` (line ~100):

Old:
```javascript
    'multilingual-e5-small': {
        name: 'Xenova/multilingual-e5-small',
        dtypeWebGPU: 'fp16',
        dtypeWASM: 'q8',
        dimensions: 384,
        description: '384d · 118M params · 100+ langs · MTEB: 55.8',
        optimalChunkSize: 500, // chars, conservative for 512 tokens
    },
```

New:
```javascript
    'multilingual-e5-small': {
        name: 'Xenova/multilingual-e5-small',
        dtypeWebGPU: 'fp16',
        dtypeWASM: 'q8',
        dimensions: 384,
        description: '384d · 118M params · 100+ langs · MTEB: 55.8',
        optimalChunkSize: 250, // Cyrillic-safe: 250 × ~1.5 tok/char ≈ 375 tokens (within 512 limit)
    },
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/embeddings.test.js`
- Expect: ALL PASS

**Step 5: Git Commit**
```
git add src/embeddings.js tests/embeddings.test.js && git commit -m "fix: reduce e5-small chunk size for Cyrillic tokenization safety"
```

---

### Task 4: Expand main character aliases in community detection

**Goal:** Prevent alter-ego nodes from forming false secondary communities by expanding `mainCharacterKeys` with aliases from graph node data.

**Step 1: Write the Failing Test**
- File: `tests/graph/graph.test.js`
- Add to existing test file:
```javascript
import { expandMainCharacterKeys, normalizeKey } from '../../src/graph/graph.js';

describe('expandMainCharacterKeys', () => {
    it('expands aliases from graph nodes', () => {
        const graphNodes = {
            'main user': {
                name: 'Main User',
                type: 'PERSON',
                aliases: ['Alt Persona', 'Nickname'],
            },
            'character': {
                name: 'Character',
                type: 'PERSON',
                aliases: ['Char Alias'],
            },
        };
        const baseKeys = [normalizeKey('Main User'), normalizeKey('Character')];
        const expanded = expandMainCharacterKeys(baseKeys, graphNodes);

        expect(expanded).toContain('main user');
        expect(expanded).toContain('character');
        expect(expanded).toContain('alt persona');
        expect(expanded).toContain('nickname');
        expect(expanded).toContain('char alias');
        expect(expanded).toHaveLength(5);
    });

    it('handles nodes without aliases', () => {
        const graphNodes = {
            'user': { name: 'User', type: 'PERSON' },
        };
        const baseKeys = [normalizeKey('User')];
        const expanded = expandMainCharacterKeys(baseKeys, graphNodes);

        expect(expanded).toEqual(['user']);
    });

    it('deduplicates alias keys', () => {
        const graphNodes = {
            'user': {
                name: 'User',
                type: 'PERSON',
                aliases: ['User'], // Alias same as name
            },
        };
        const baseKeys = [normalizeKey('User')];
        const expanded = expandMainCharacterKeys(baseKeys, graphNodes);

        expect(expanded).toEqual(['user']);
    });

    it('handles missing nodes gracefully', () => {
        const graphNodes = {};
        const baseKeys = ['nonexistent'];
        const expanded = expandMainCharacterKeys(baseKeys, graphNodes);

        expect(expanded).toEqual(['nonexistent']);
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/graph/graph.test.js`
- Expect: FAIL — `expandMainCharacterKeys` is not exported from `graph.js`

**Step 3: Implementation (Green)**

**File: `src/graph/graph.js`** — Add the helper function after `normalizeKey`:
```javascript
/**
 * Expand main character keys with aliases discovered in the graph.
 * Prevents alter-ego nodes from forming false secondary communities.
 * @param {string[]} baseKeys - Normalized main character keys
 * @param {Object} graphNodes - Graph nodes keyed by normalized name
 * @returns {string[]} Expanded array including alias keys
 */
export function expandMainCharacterKeys(baseKeys, graphNodes) {
    const expanded = [...baseKeys];
    for (const baseKey of baseKeys) {
        const node = graphNodes[baseKey];
        if (node?.aliases) {
            for (const alias of node.aliases) {
                const aliasKey = normalizeKey(alias);
                if (!expanded.includes(aliasKey)) {
                    expanded.push(aliasKey);
                }
            }
        }
    }
    return expanded;
}
```

**File: `src/extraction/extract.js`** — Use the helper in Phase 2 community detection.

Add to imports (line ~28):
```javascript
import { initGraphState, mergeOrInsertEntity, normalizeKey, upsertRelationship, expandMainCharacterKeys } from '../graph/graph.js';
```

Replace in community detection section (around line 516):

Old:
```javascript
                    const mainCharacterKeys = [normalizeKey(characterName), normalizeKey(userName)];
                    const communityResult = detectCommunities(data.graph, mainCharacterKeys);
```

New:
```javascript
                    const baseKeys = [normalizeKey(characterName), normalizeKey(userName)];
                    const mainCharacterKeys = expandMainCharacterKeys(baseKeys, data.graph.nodes || {});
                    const communityResult = detectCommunities(data.graph, mainCharacterKeys);
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/graph/graph.test.js tests/extraction/extract.test.js`
- Expect: ALL PASS

**Step 5: Git Commit**
```
git add src/graph/graph.js src/extraction/extract.js tests/graph/graph.test.js && git commit -m "feat: expand main character aliases for community detection pruning"
```

---

### Task 5: Update prompts — importance scale, dedup rules, `<think>` tags, raw JSON instruction

**Goal:** Reduce importance inflation via prompt-only changes, align with `<think>` tag convention, and add explicit raw-JSON instruction.

This task is prompt-only — no behavioral code changes.

**Step 1: Write the Failing Tests**
- File: `tests/prompts.test.js`
- Add to existing test file:
```javascript
describe('buildEventExtractionPrompt output conventions', () => {
    const baseArgs = {
        messages: '[TestUser]: Hello world',
        names: { char: 'TestChar', user: 'TestUser' },
        context: {},
    };

    it('uses <think> tags instead of <reasoning>', () => {
        const result = buildEventExtractionPrompt(baseArgs);
        const sys = result[0].content;
        expect(sys).toContain('<think>');
        expect(sys).not.toMatch(/<reasoning>/);
    });

    it('instructs scene continuation suppression in dedup rules', () => {
        const result = buildEventExtractionPrompt(baseArgs);
        const sys = result[0].content;
        expect(sys).toContain('scene concludes');
        expect(sys).toContain('power dynamic fundamentally reverses');
        expect(sys).toContain('safeword is explicitly used');
    });

    it('does not mandate minimum importance of 4 for routine intimate acts', () => {
        const result = buildEventExtractionPrompt(baseArgs);
        const sys = result[0].content;
        // Old: "MANDATORY MINIMUM of 4 for: any first sexual act"
        expect(sys).not.toContain('MANDATORY MINIMUM');
    });

    it('instructs raw JSON output without markdown', () => {
        const result = buildEventExtractionPrompt(baseArgs);
        const sys = result[0].content;
        expect(sys).toContain('Start your response with {');
    });
});

describe('all prompts use raw JSON instruction', () => {
    it('graph extraction prompt forbids markdown wrapping', () => {
        const result = buildGraphExtractionPrompt({
            messages: '[TestUser]: Hello',
            names: { char: 'TestChar', user: 'TestUser' },
        });
        const sys = result[0].content;
        expect(sys).toContain('Do NOT wrap output in markdown code blocks');
    });

    it('salient questions prompt forbids markdown wrapping', () => {
        const result = buildSalientQuestionsPrompt('TestChar', [{ summary: 'test', importance: 3 }]);
        const sys = result[0].content;
        expect(sys).toContain('Do NOT wrap output in markdown code blocks');
    });

    it('insight extraction prompt forbids markdown wrapping', () => {
        const result = buildInsightExtractionPrompt('TestChar', 'test?', [{ id: 'ev_1', summary: 'test' }]);
        const sys = result[0].content;
        expect(sys).toContain('Do NOT wrap output in markdown code blocks');
    });

    it('community summary prompt forbids markdown wrapping', () => {
        const result = buildCommunitySummaryPrompt(['Node A'], ['A -> B']);
        const sys = result[0].content;
        expect(sys).toContain('Do NOT wrap output in markdown code blocks');
    });
});
```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/prompts.test.js`
- Expect: FAIL — prompt still contains `<reasoning>`, `MANDATORY MINIMUM`, and doesn't contain `<think>` or `Start your response with {`

**Step 3: Implementation (Green)**
- File: `src/prompts.js`

**3a. Replace `<reasoning>` with `<think>` in `buildEventExtractionPrompt`:**

In the `<output_schema>` section, replace:
```
You MUST respond with your reasoning FIRST inside <reasoning> tags, THEN EXACTLY ONE JSON object. Nothing else — no markdown fences, no commentary.

First, output your analysis inside <reasoning> tags.
THEN, output EXACTLY ONE JSON object with this structure:
```
with:
```
You MUST respond with your analysis FIRST inside <think> tags, THEN EXACTLY ONE JSON object.

First, output your analysis inside <think> tags.
THEN, output EXACTLY ONE JSON object with this structure:
```

Add after the existing "Do NOT wrap output in markdown code blocks" line:
```
7. Start your response with { after the </think> close tag. No other wrapping.
```

In the `<thinking_process>` section, replace:
```
Follow these steps IN ORDER. Write your work inside <reasoning> tags BEFORE outputting the JSON:
```
with:
```
Follow these steps IN ORDER. Write your work inside <think> tags BEFORE outputting the JSON:
```

In the examples section, replace all `<reasoning>` opening/closing tags with `<think>`/`</think>`:
- `<reasoning>` → `<think>` (5 opening tags)
- `</reasoning>` → `</think>` (5 closing tags)

In the user message, replace:
```
Write your analysis inside <reasoning> tags FIRST, then output the JSON object with "events" key. No other text.
```
with:
```
Write your analysis inside <think> tags FIRST, then output the JSON object with "events" key. No other text.
```

**3b. Update `<dedup_rules>` in `buildEventExtractionPrompt`:**

Replace the existing `<dedup_rules>` block:
```xml
<dedup_rules>
This is the MOST IMPORTANT rule. Duplicating memories already in established_memories is the worst error.

BEFORE creating ANY event, you MUST check the <established_memories> section in the user message.

If a scene is ALREADY recorded there, ONLY create a new event if ONE of these conditions is true:
1. A fundamentally NEW type of action begins (e.g., conversation → combat, foreplay → penetration)
2. A major outcome occurs (climax, death, unconsciousness, escape, capture)
3. A new element is introduced that changes the scene's nature (new character arrives, weapon drawn, secret revealed, new kink/toy introduced)
4. An explicit boundary is set or broken (safeword, surrender, betrayal, promise)

If NONE of those conditions apply, the current messages are continuing an existing scene.
In that case, you MUST set "events" to an empty array [].

When in doubt, output fewer events rather than duplicate existing memories.
</dedup_rules>
```
with:
```xml
<dedup_rules>
This is the MOST IMPORTANT rule. Duplicating memories already in established_memories is the worst error.

BEFORE creating ANY event, you MUST check the <established_memories> section in the user message.

If an intimate, combat, or social scene is ALREADY recorded there, DO NOT extract every new physical action (e.g., position changes, new implements, individual gestures, routine dialogue). ONLY create a new event if ONE of these conditions is true:
1. The scene concludes (e.g., climax, falling asleep, location change, combat ends).
2. The power dynamic fundamentally reverses (e.g., submissive takes control, ambush turns into retreat).
3. A safeword is explicitly used to halt the scene.
4. A fundamentally NEW type of action begins (e.g., conversation → combat, foreplay → penetration).
5. A new element changes the scene's nature (new character arrives, weapon drawn, secret revealed).

If NONE of those conditions apply, the current messages are continuing an existing scene.
In that case, you MUST set "events" to an empty array [].

When in doubt, output fewer events rather than duplicate existing memories.
</dedup_rules>
```

**3c. Update `<importance_scale>` in `buildEventExtractionPrompt`:**

Replace:
```xml
<importance_scale>
Rate each event from 1 (trivial) to 5 (critical):

1 — Trivial: Quick greeting, passing touch, mundane small talk. Usually skip these entirely.
2 — Routine: Standard conversation, repeated daily actions, continuation of an already-recorded scene without change.
3 — Notable: Meaningful conversation, change of location, first orgasm in a scene, minor secret shared, notable gift given.
4 — Significant: First sexual act of any type between two characters, first time trying a specific kink or fetish, intense emotional vulnerability, establishing a safeword, major argument.
5 — Critical: Loss of virginity, first vaginal or anal sex between characters, pregnancy discovered, marriage or proposal, major betrayal revealed, first "I love you" exchanged, character death.

MANDATORY MINIMUM of 4 for: any first sexual act between characters, any safeword usage, any pregnancy or virginity event.
</importance_scale>
```
with:
```xml
<importance_scale>
Rate each event from 1 (trivial) to 5 (critical):

1 — Trivial: Quick greeting, passing touch, mundane small talk. Usually skip these entirely.
2 — Minor: Standard continuation of an established dynamic. Routine intimate acts between characters already in a sexual relationship. Repeated daily actions.
3 — Notable: Meaningful conversation, change of location or scene, new emotional context, minor secret shared, notable gift.
4 — Significant: A major narrative shift, deep emotional vulnerability, first use of a safeword, establishing a new relationship dynamic, a major argument or confrontation.
     Do NOT rate every intimate act as 4. If characters already have an established intimate relationship, routine acts are 2 or 3. Reserve 4 for narrative milestones.
5 — Critical: Life-changing events — first "I love you", pregnancy discovery, major betrayal revealed, permanent relationship change, character death.
</importance_scale>
```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/prompts.test.js`
- Expect: ALL PASS

**Step 5: Full Suite Verify**
- Command: `npx vitest run`
- Expect: ALL PASS — no regressions across any test file

**Step 6: Git Commit**
```
git add src/prompts.js tests/prompts.test.js && git commit -m "feat: recalibrate importance scale, add scene chunking, align think tags"
```
