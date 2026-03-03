# Memory Retrieval & Scoring Subsystem

## WHAT
Finds relevant memories (events + reflections) and community summaries. Formats for prompt injection via named slots: `openvault_memory` and `openvault_world`.

## HOW: The Math (`math.js` & `scoring.js`)
Hybrid **Alpha-Blend** scoring:
1. **Forgetfulness Curve**: Exponential decay by message distance. Importance 5 = floor.
2. **BM25**: IDF-aware term frequency via `query-context.js`.
3. **Vector**: Cosine similarity via WebGPU/Ollama.
- **Formula**: `Total = Base + (Alpha * Vector) + ((1 - Alpha) * BM25)`

## HOW: World Context (`world-context.js`)
- **Source**: GraphRAG community summaries from `src/graph/communities.js`.
- **Retrieval**: Cosine similarity on community embeddings, token budget 2000.
- **Format**: `<world_context>` XML tag with title/summary/findings.
- **Injection**: Named slot `openvault_world` (higher in prompt than memories).

## GOTCHAS & RULES
- **Pure Functions**: `math.js` ONLY. No `deps.js`, no DOM. Worker-safe.
- **Named Slots**: Use `safeSetExtensionPrompt(content, name)` — `openvault_memory` or `openvault_world`.
- **Formatting Buckets**: `formatting.js` divides into `Old`, `Mid`, `Recent` buckets.
- **POV Filtering**: Filter through `src/pov.js` before scoring. Only inject witnessed/known memories.