# Retrieval, Scoring, and World Context

For alpha-blend formula, 4-tier BM25, and decay math see `include/DATA_SCHEMA.md` Section 3.
For event dedup thresholds see `src/extraction/AGENTS.md`.

## IMPLEMENTATION GOTCHAS

### Narrative Distance
- **Resolve `message_fingerprints` via `chatFingerprintMap`** to find current positions, then `chat.length - max(resolvedPosition)`. Falls back to `message_ids` for unmigrated v2 data.

### Context Budgeting
- **Never spread large iterables into Math.max.** Use `for...of` loops with manual tracking — `Math.max(...array)` hits JS argument limits (~65K) with large IDF maps.
- **Score-First Soft Balancing:**
  - *Phase 1:* Reserve `minRepresentation` (20%) per chronological bucket (Old/Mid/Recent). Fill with highest-scoring memories from each.
  - *Phase 2:* Remaining 40% allocated purely by score regardless of bucket.

### ST Vector Retrieval
- **`selectRelevantMemoriesWithST` returns all item types.** Build lookup maps for memories, graph nodes (`graphNodes`), AND communities. Results include `communityIds` field for downstream world context injection.
- **Community retrieval uses scoring-layer IDs in ST Vector mode.** `retrieveWorldContext` accepts `stCommunityIds` parameter — communities pre-selected by the scoring layer. Returns empty when no IDs provided (avoids duplicate local embedding computation).

### Scoring Safety
- **Clamp at consumption, not storage.** `calculateScore()` applies `Math.min`/`Math.max` clamping at the top of the function as a runtime safety net. Don't rely solely on Zod constraints — settings can be corrupted or tampered with.
- **Guard vector normalization denominators.** The formula `(vectorSimilarity - threshold) / (1 - threshold)` appears in 3 locations. All use `denominator = 1 - threshold; denominator > 0 ? ... : 0` to prevent division-by-zero when `threshold >= 1.0`.

### Query Building
- **Prepend entity anchors before truncation.** In `buildEmbeddingQuery()`, prepend `topEntities` before slicing to `chunkSize`. Entities survive budget cuts; appended text gets chopped.

### Intent Routing
- **Route via multilingual intent.** `detectMacroIntent()` matches "recap", "вкратце", etc.
- **Macro queries:** Inject pre-computed `global_world_state`.
- **Local queries:** Execute vector similarity search against specific community summaries.

### Lifecycle, Archive, and POV Boundaries
- **Lifecycle gate:** `retrieveAndInjectContext()` and `updateInjection()` clear all OpenVault prompts while chat data is not in the `ready` lifecycle state. Do not score or inject partially rebuilt state.
- **Archive separation:** The sealed archive projection is injected independently at `TOP_OF_CHAT`; dynamic entities, communities, and recall remain late volatile context. Do not rebuild or POV-filter sealed archive bytes during ordinary retrieval.
- **POV filtering:** Apply `filterMemoriesByPOV()` to dynamic memory candidates before scoring. Community and entity retrieval is world context selected for the current query; stale, dissolved, and child communities are excluded at world-context selection.
- **ST orchestration:** In ST Vector mode, prefetch the shared collection once, pass matching community IDs to `retrieveWorldContext()`, then reuse the same results for memory reranking. A missing or empty ID set produces no local community injection.
