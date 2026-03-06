# Design: Extraction Robustness & Memory Quality Pass

## 1. Problem Statement

Five interconnected weak points degrade memory quality and extraction reliability, particularly for Cyrillic-language roleplay using Chinese LLM providers:

1. **Importance Inflation** — Continuous intimate scenes generate floods of ★4–5 memories that never decay, saturating the context window with micro-actions instead of narrative milestones.
2. **JSON/API Instability** — Chinese LLMs wrap output in markdown fences that aren't always closed; free API providers return 502s when Event→Graph calls fire back-to-back with no inter-call delay.
3. **Cyrillic Truncation** — `multilingual-e5-small` uses `optimalChunkSize: 500` chars, but Cyrillic tokenizes at ~1.5 tokens/char, causing silent truncation beyond the model's 512-token window.
4. **Alias Blindness in Community Detection** — `detectCommunities` prunes edges for main character keys but doesn't expand aliases, so alter-egos form false secondary communities.
5. **`<reasoning>` Tag Conflict** — Modern Chinese models trained post-DeepSeek-R1 use native `<think>` tokens; our custom `<reasoning>` tag confuses their CoT pipeline.

## 2. Goals & Non-Goals

### Must do
- Reduce ★4+ memory density during continuous scenes by ~60–80% via prompt changes
- Eliminate JSON parse failures from unclosed markdown fences
- Add RPM-aware delay between Event and Graph API calls (DRY, reusing existing RPM logic)
- Fix Cyrillic embedding truncation for `multilingual-e5-small`
- Expand `mainCharacterKeys` with graph-discovered aliases before community pruning
- Replace `<reasoning>` with `<think>` in all LLM prompt templates

### Won't do
- Code-side post-processing filters for importance (prompt-only approach)
- User-configurable alias lists (pull from graph nodes only)
- Retry/circuit-breaker patterns beyond existing backoff schedule
- Changing embedding models (e5-small remains primary)

## 3. Proposed Architecture

Five targeted changes across 5 files. No new files or dependencies.

```
prompts.js        ← #1 scene-chunking dedup rules, importance recalibration
                  ← #5 <reasoning> → <think> in all templates
structured.js     ← #2 robust markdown fence stripping
extract.js        ← #2 shared RPM rate-limit utility, intra-batch delay
                  ← #4 alias expansion before detectCommunities call
embeddings.js     ← #3 e5-small chunk size 500 → 250
```

### Dependency order
Changes are independent — can be implemented and tested in any order. No cross-change dependencies.

## 4. Detailed Changes

### 4.1 Importance Inflation (prompts.js)

**Current behavior:** `<importance_scale>` sets `MANDATORY MINIMUM of 4` for "any first sexual act", causing every kink interaction in a continuous scene to rate ★4.

**Change:** Update `<dedup_rules>` and `<importance_scale>` in `buildEventExtractionPrompt`:

```xml
<dedup_rules>
If an intimate, combat, or BDSM scene is ALREADY recorded in <established_memories>,
DO NOT extract every new physical action (e.g., position changes, new implements,
individual gestures). ONLY create a new event if:
1. The scene concludes (e.g., climax, falling asleep, location change).
2. The power dynamic fundamentally reverses (e.g., sub takes control).
3. A safeword is explicitly used to halt the scene.
Otherwise, output "events": [].
</dedup_rules>

<importance_scale>
1 — Trivial: Routine actions with no narrative weight. (Skip.)
2 — Minor: Standard continuation of an established dynamic. A known couple
     being intimate in a familiar way. (Skip if continuation of existing memory.)
3 — Notable: New emotional context, a meaningful conversation, a change of scene.
4 — Significant: A major narrative shift, deep emotional vulnerability, first use
     of a safeword, establishing a new relationship dynamic.
     (Do NOT rate every intimate act as 4. If characters are already in an
     established intimate relationship, routine acts are 2 or 3. Reserve 4
     for narrative milestones.)
5 — Critical: Life-changing events — first "I love you", pregnancy, major
     betrayal, permanent relationship change.
</importance_scale>
```

**Effect on math.js:** With fewer ★4–5 memories, the forgetfulness curve (`λ = BASE_LAMBDA / importance²`) regains dynamic range. ★2–3 memories decay at reasonable rates (λ=0.0125–0.0056), while the rare ★4–5 events appropriately persist.

### 4.2 JSON Parsing & RPM-Aware Inter-Call Delay

#### 4.2a Prompt tweak (prompts.js)

Add to `<output_schema>` in all extraction/reflection prompts:

```xml
CRITICAL: Output raw JSON only. DO NOT use markdown code blocks (```json).
Start your response with { and end with }. No other wrapping.
```

#### 4.2b Markdown stripping (structured.js)

**Current:** `stripMarkdown` uses `^```(?:json)?\s*([\s\S]*?)\s*```$` which fails on unclosed fences.

**Change:** Add a fallback for unclosed fences before `jsonrepair`:

```javascript
function stripMarkdown(content) {
    // Existing: closed fences
    let result = content.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/gm, '$1');
    // Fallback: unclosed opening fence (model forgot to close)
    result = result.replace(/^```(?:json)?\s*/gm, '');
    // Fallback: trailing orphan fence
    result = result.replace(/\s*```\s*$/gm, '');
    return result.trim();
}
```

#### 4.2c Shared RPM utility (extract.js)

**Current:** RPM delay exists between batches (lines 601–609) but NOT between Event→Graph calls within a batch.

**Change:** Extract a shared utility and use it at both call sites:

```javascript
/**
 * Wait based on the configured RPM rate limit.
 * @param {object} settings - Extension settings containing backfillMaxRPM
 * @param {string} [label] - Optional label for logging
 */
async function rpmDelay(settings, label = 'Rate limit') {
    const rpm = settings.backfillMaxRPM || 30;
    const delayMs = Math.ceil(60000 / rpm);
    log(`${label}: waiting ${delayMs}ms (${rpm} RPM)`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}
```

Usage — between Event and Graph calls (Stage 3A → 3B):
```javascript
const eventJson = await callLLM(prompt, LLM_CONFIGS.extraction_events, { structured: true });
const eventResult = parseEventExtractionResponse(eventJson);

if (events.length > 0) {
    await rpmDelay(settings, 'Inter-call rate limit');
    const graphJson = await callLLM(graphPrompt, LLM_CONFIGS.extraction_graph, { structured: true });
    // ...
}
```

Usage — between batches (replacing inline code at lines 601–609):
```javascript
await rpmDelay(settings, 'Batch rate limit');
```

### 4.3 Cyrillic Embedding Chunk Size (embeddings.js)

**Current:** `multilingual-e5-small` has `optimalChunkSize: 500`.

At ~1.5 tokens per Cyrillic character, 500 chars ≈ 750 tokens → silently truncated past the 512-token limit.

**Change:**
```javascript
'multilingual-e5-small': {
    name: 'Xenova/multilingual-e5-small',
    dimensions: 384,
    description: '384d · 118M params · 100+ langs · MTEB: 55.8',
    // Reduced from 500 for safe Cyrillic tokenization (~1.5 tokens/char)
    // 250 chars × 1.5 ≈ 375 tokens, within 512-token limit
    optimalChunkSize: 250,
},
```

**Impact:** Shorter summaries embedded per chunk. Since event summaries are 8–25 words (~40–150 chars), single-event embeddings remain unaffected. Only concatenated multi-event queries are impacted, which is the correct behavior (they should be split).

### 4.4 Alias Expansion in Community Detection (extract.js)

**Current:** `detectCommunities` receives `mainCharacterKeys` as `[normalizeKey(characterName), normalizeKey(userName)]`. Alter-egos discovered by graph extraction (stored as `node.aliases`) are not included.

**Change:** Before calling `detectCommunities`, expand `mainCharacterKeys` with aliases from the graph:

```javascript
// Build main character keys with alias expansion
const mainCharacterKeys = [normalizeKey(characterName), normalizeKey(userName)];
for (const baseKey of [...mainCharacterKeys]) {
    const node = data.graph.nodes[baseKey];
    if (node?.aliases) {
        for (const alias of node.aliases) {
            const aliasKey = normalizeKey(alias);
            if (!mainCharacterKeys.includes(aliasKey)) {
                mainCharacterKeys.push(aliasKey);
            }
        }
    }
}
const communityResult = detectCommunities(data.graph, mainCharacterKeys);
```

**Effect:** Alter-ego nodes (e.g., a character's femme persona) get pruned during community detection just like the main identity, preventing false secondary communities centered on the alias.

### 4.5 `<reasoning>` → `<think>` Tag Alignment (prompts.js)

**Current:** Prompts instruct models to output `<reasoning>...</reasoning>`.

**Change:** Replace all instances in all prompt templates:

```xml
<!-- Before -->
<output_schema>
First, output your reasoning inside <reasoning> tags.
THEN, output EXACTLY ONE JSON object...
</output_schema>

<!-- After -->
<output_schema>
You MUST respond with your reasoning FIRST inside <think> tags,
THEN EXACTLY ONE JSON object.
First, output your analysis inside <think> tags.
THEN, output EXACTLY ONE JSON object...
</output_schema>
```

**No code changes needed:** `stripThinkingTags` in `structured.js` already strips `<think>` tags. The `<reasoning>` pattern is also retained in the strip regex as a fallback.

## 5. Interface / API Design

No new public APIs. All changes are internal to existing functions:

| Function | File | Change |
|----------|------|--------|
| `buildEventExtractionPrompt()` | prompts.js | Updated dedup_rules, importance_scale, output_schema |
| `buildGraphExtractionPrompt()` | prompts.js | Updated output_schema, `<think>` tags |
| `buildSalientQuestionsPrompt()` | prompts.js | Updated output_schema, `<think>` tags |
| `buildInsightExtractionPrompt()` | prompts.js | Updated output_schema, `<think>` tags |
| `buildCommunitySummaryPrompt()` | prompts.js | Updated output_schema, `<think>` tags |
| `stripMarkdown()` | structured.js | Unclosed fence handling |
| `rpmDelay()` | extract.js | **New** shared utility (not exported) |
| `extractMemories()` | extract.js | Uses `rpmDelay` between calls |
| Backfill loop | extract.js | Uses `rpmDelay` between batches |
| Phase 2 community detection | extract.js | Alias expansion before `detectCommunities` |
| Model config | embeddings.js | `optimalChunkSize: 250` for e5-small |

## 6. Risks & Edge Cases

| Risk | Mitigation |
|------|-----------|
| **Under-extraction after prompt change** — LLM might stop logging important scene conclusions | The prompt explicitly lists 3 conditions when a new event SHOULD be created. Monitor extraction counts after deployment. |
| **RPM delay doubles extraction time** — A 30 RPM setting adds 2s between Event→Graph, plus 2s between batches = 4s overhead per batch | This is the correct trade-off: reliability > speed. Users can increase RPM if their provider allows. |
| **Chunk size 250 too aggressive** — Some Cyrillic text may tokenize more efficiently (e.g., common Russian words) | 250 × 1.5 = 375 tokens, leaving 137-token headroom. Conservative enough. If needed, can be tuned to 300. |
| **Alias key normalization mismatch** — Graph stores alias as "UserName (aka AltName)" but normalizeKey strips parentheticals | Verify `normalizeKey` behavior with alias strings containing parentheses. May need to split on "aka" before normalizing. |
| **`<think>` tag in model output** — Some models may not output `<think>` even when asked | `stripThinkingTags` handles both presence and absence gracefully. JSON parsing doesn't depend on thinking tags existing. |
| **Existing memories don't retroactively change** — Old ★4 memories remain in the database | Acceptable. The forgetfulness curve will naturally decay them over time. No migration needed. |
