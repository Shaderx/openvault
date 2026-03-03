# Reflection Engine

## WHAT
Per-character synthesis of raw events into high-level insights (Smallville paper). Reflections are stored as memories with `type: 'reflection'`.

## HOW: The Pipeline (`reflect.js`)
1. **Accumulate**: After each extraction, add event importance to per-character accumulators.
2. **Trigger Check**: `shouldReflect()` returns true when `importance_sum >= 30`.
3. **Generate** (3 steps):
   - Step 1: LLM generates 3 salient questions from recent memories.
   - Step 2: For each question, retrieve relevant memories via cosine similarity, extract insights (3 parallel LLM calls).
   - Step 3: Store reflections as memory objects with embeddings.
4. **Reset**: Clear accumulator after reflection.

## HOW: Reflections Differ from Events
- `type: 'reflection'` — distinguishes from `type: 'event'`.
- `character: string` — which character generated this.
- `source_ids: string[]` — evidence memory IDs.
- `witnesses: [characterName]` — only the reflecting character.
- `importance: 4` — fixed default (retrievable like events).
- Retrieved and injected alongside events via same pipeline.

## GOTCHAS & RULES
- **POV Filtering**: Use `filterMemoriesByPOV()` at generation time. Character only reflects on accessible memories.
- **Parallel Step 2**: The 3 insight-extraction calls MUST use `Promise.all()`. Critical for performance.
- **Recursive Reflections**: Reflections can cite other reflections as evidence. This is intentional (hierarchical abstraction).
- **LLM Configs**: Uses `extractionProfile` (reuses user's extraction API settings).
