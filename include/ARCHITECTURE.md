# OpenVault Architecture

Decoupled two-path architecture operating entirely within SillyTavern's `chatMetadata.openvault`.

## 1. DATA FLOW PIPELINES

### Critical Path (Synchronous, on `GENERATION_AFTER_COMMANDS`)
1. `autoHideOldMessages()`: Marks extracted messages as `is_system=true` if visible tokens > budget. Turn-boundary snapped.
2. `retrieveAndInjectContext()`: Scores memories -> Injects via `safeSetExtensionPrompt` (`openvault_memory` & `openvault_world`).

### Background Path (Async worker, on `MESSAGE_RECEIVED`)
Worker (`src/extraction/worker.js`) is single-instance, interruptible (checks `wakeGeneration` every 500ms), fast-fails on chat switch, and uses exponential backoff.

**Phase 1: Critical (Gates Auto-hide)**
- **Stage A (Events)**: LLM extracts events using configurable assistant prefill (default: `<think>` tag) and preamble language (CN/EN) -> JSON. Mirror Language Rule auto-detects input language and mirrors it in output values. Bilingual few-shot examples (EN/RU) calibrate model compliance.
- **Stage B (Graph)**: LLM extracts entities/relationships using Stage A output.
- **Graph Update**: Upsert nodes/edges. Semantic Merge (Cosine >0.94 + Token Overlap guard filtering stopwords).
- **INTERMEDIATE SAVE**: Events, graph, and `processed_message_ids` persisted.

**Phase 2: Enrichment (Errors swallowed, non-blocking)**
- **Reflection**: If character `importance_sum >= 40` -> Generate questions -> Insights -> 3-Tier dedup -> Embed.
- **Communities**: Every 50 msgs -> Louvain GraphRAG -> LLM Summaries.
- **FINAL SAVE**: Reflections and Communities persisted.

## 2. DATA SCHEMA (`chatMetadata.openvault`)
```typescript
{
  memories: [{ // Both events and reflections
    id: string, type: "event"|"reflection", summary: string, importance: 1-5,
    tokens: string[], message_ids?: number[], source_ids?: string[], // source_ids for reflections
    characters_involved: string[], embedding: number[], archived: boolean
  }],
  graph: {
    nodes: { [normKey]: { name, type, description, mentions, embedding, aliases? } },
    edges: { "src__tgt": { source, target, description, weight } }
  },
  communities: { "C0": { title, summary, findings: string[], nodeKeys: string[], embedding: number[] } },
  character_states: { "Name": { current_emotion, emotion_intensity, known_events: string[] } },
  reflection_state: { "Name": { importance_sum: number } },
  processed_message_ids: number[]
}
```

## 3. CORE SYSTEMS SAUCE

**Retrieval Math (Alpha-Blend)**: `Score = Base + (Alpha * VectorBonus) + ((1 - Alpha) * BM25Bonus)`
- *Base (Forgetfulness)*: `Importance * e^(-Lambda * Distance)`. Imp 5 has soft floor of 1.0. Reflections > 750 msgs decay linearly to 0.25x.
- *BM25*: IDF-aware. Dynamic Character Stopwords (names filtered out to prevent score inflation).

**Entity Semantic Merging**: Prevents duplicates ("The King" vs "King Aldric").
- *Guard 1*: Embeddings (type + name + description) cosine sim >= `0.94`.
- *Guard 2*: Token Overlap >= 50% (prevents "Burgundy panties" merging with "Burgundy candle"). Old names saved to `aliases`.
- *Guard 3 (LCS)*: Longest Common Substring ratio >= 60% for keys longer than 2 chars (lowered from 3 to catch short names like "Кай"/"Каю").
- *Guard 4 (Stems)*: `stemWord()`-based token overlap catches Russian morphological variants (e.g., "ошейник"/"ошейником").

**Reflection Lifecycle (3-Tier)**:
- *Pre-flight*: Aborts if recent events >85% similar to existing insights.
- *Tier 1 (Reject >=90%)*: Duplicate, discard.
- *Tier 2 (Replace 80-89%)*: Same theme. Old set to `archived: true`, new added.
- *Tier 3 (Add <80%)*: Genuinely new.

**GraphRAG Communities**:
- *Pruning*: Edges involving User/Char temporarily removed before Louvain to prevent "hairball" clusters. Re-assigned after.
- *Injection*: Pure vector search injected into `openvault_world` slot.

**Embeddings**: True LRU cache (max 500). WebGPU attempts first -> falls back to WASM. `device.lost` not monitored (implicitly retries pipeline on next call). Failures degrade gracefully to BM25.

**Multilingual Prompt Architecture**:
- *Mirror Language Rule*: All prompts auto-detect input language and mirror it in output string values. JSON keys remain English.
- *Bilingual Examples*: Every prompt includes paired EN/RU few-shot examples (events: 10, graph: 8, questions: 6, insights: 6, communities: 6).
- *SFW→Kink Gradient*: Examples progress from safe to explicit content, calibrating model compliance.
- *Graph Normalization*: Entity names extracted in nominative/base form to prevent morphological duplicates.
- *Stem-Augmented Overlap*: `hasSufficientTokenOverlap()` uses `stemWord()` to catch Russian inflected variants (Check 4).
- *Prompt Modules*: `src/prompts/` contains `rules.js` (shared language rules), `roles.js` (role definitions), `examples/` (bilingual few-shots), `examples/format.js` (XML formatter).

**Testing Tiers**:
- *Tier 1*: Pure transforms (`math.js`, `helpers.js`). Unit tested.
- *Tier 2*: Orchestrators (`extract.js`, `retrieve.js`). Integration tested via `deps.js` boundary.
- *Invariant*: Messages MUST be extracted before hiding. Turn-boundary snapping prevents U/B pair splitting.