# Agentic Reflection Engine

## WHAT
Synthesizes raw event memories into high-level psychological insights, adapting concepts from the Generative Agents (Smallville) paper.

## THE PIPELINE (`reflect.js`)
1. **Accumulate**: Each extracted event adds its `importance` to the involved characters' `importance_sum`.
2. **Trigger**: When `importance_sum >= 40`, reflection begins.
3. **Pre-flight Gate**: Aborts if top recent events are >85% similar to existing reflections (prevents wasting tokens on repetitive insights).
4. **Candidate Set**: Token-budgeted recent events (80% of `reflectionContextTokens`) + **old reflections** (20%, all levels). Enables synthesizing higher-level insights (level 2+).
5. **Generate**: Single unified LLM call (with configurable prefill from `resolveExtractionPrefill`) generates 1-3 question+insight pairs with evidence citations (`UNIFIED_REFLECTION_EXAMPLES` - 6 bilingual EN/RU).
6. **3-Tier Dedup & Embed**: (See below).
7. **Consume and retry**: Snapshot the triggering amount before generation. Failure or same-session cancellation restores that amount additively, preserving concurrent accumulation; chat/session changes cannot restore it into another session. Successful empty/deduplicated responses consume the trigger. Non-cancellation failures wait `reflectionRetryCooldownMs`; `reflectionRetryMaxFailures` bounds attempts for the session. Markers reset on chat change and clear on success.

**stChanges**: `generateReflections()` returns `{ reflections, stChanges }`. See `src/store/AGENTS.md` for the stChanges contract.

## PERFORMANCE
- **Unified Call**: Replaced old 4-call pipeline (questions + 3 parallel insights) with single unified call.
- **Threshold**: `llm_reflection` perf metric set to 20000ms (down from 45000ms).

## REFLECTION SCHEMA
- `type: 'reflection'` (distinguishes from events).
- `level`: Hierarchy depth (1 = from events, 2+ = from other reflections). Default: 1.
- `parent_ids`: Source reflection IDs for level 2+. Empty for level 1 (derived from events).
- `source_ids`: Event evidence IDs at every level. Reflection evidence belongs in `parent_ids`.
- `witnesses`: Only the reflecting character (internal thought).
- `importance`: Model value clamped to 1-5, with fallback 4.

## 3-TIER DEDUP LIFECYCLE
Compares new reflection embeddings vs existing ones for that character:
- **>= 90%**: **Reject**. Concept already exists.
- **80% - 89%**: **Replace**. Theme matches but evidence evolved. Old reflection marked `archived: true` (ignored by retrieval), new one added.
- **< 80%**: **Add**. Genuinely new insight.

## GOTCHAS & RULES
- **Recursive Linking**: Level 1 uses event evidence such as `source_ids: [event1]`, with empty `parent_ids`. Level 2+ separates event evidence `source_ids: [event2]` from direct reflection ancestors `parent_ids: [ref1]`.
- **Level-Aware Decay**: Higher-level reflections (level 2+) decay slower. `maxReflectionLevel=3`, `reflectionLevelMultiplier=2.0`. Each level doubles decay threshold divisor.
- **POV Strictness**: Uses `filterMemoriesByPOV()` before unified reflection call. A character can only reflect on things they know.

## CONTROLS AND INPUTS

`reflectionGenerationEnabled` controls generation; `reflectionInjectionEnabled` independently controls prompt injection. Filter candidates through POV before generation and exclude `coverage_fallback` records from evidence and semantic dedup. Existing archived reflections stay outside active retrieval.


Capacity and replacement archival return exact old vector hashes via `stChanges.toDelete` and clear stale embedding/sync flags. Capacity victims are chosen before generation but archived only after successful generation/enrichment so a failed call retains cleanup ownership.
