# Reflection Engine

> For the big picture of how this fits into the whole app, see `docs/ARCHITECTURE.md`.

## WHAT
Per-character synthesis of raw events into high-level insights (Smallville paper). Reflections are stored as memories with `type: 'reflection'`.

## HOW: The Pipeline (`reflect.js`)
1. **Accumulate**: After each extraction, add event importance to per-character accumulators.
2. **Trigger Check**: `shouldReflect()` returns true when `importance_sum >= 40` (configurable via `reflectionThreshold`).
3. **Generate** (3 steps):
   - Step 1: LLM generates 3 salient questions from recent memories.
   - Step 2: For each question, retrieve relevant memories via cosine similarity, extract insights (3 parallel LLM calls, max 3 insights per question).
   - Step 3: Store reflections as memory objects with embeddings. Dedup against existing reflections (threshold 0.9).
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

## RETRIEVAL SCORING
- Reflections included in retrieval alongside events (see `src/retrieval/retrieve.js`).
- **Reflection Decay**: In `math.js`, reflections older than 500 messages get linear decay (floor 0.25×). Prevents stale insights from dominating.

## LIFECYCLE & DEDUPLICATION
- **Pre-flight Gate**: Before spending 4 LLM calls, checks if top 3 recent events align (>85% cosine) with existing reflections. Aborts if no meaningful change detected.
- **3-Tier Replacement Strategy** (applied after generating new reflections):
  - `>= 90%`: **Reject** — Exact duplicate concept, discard new reflection.
  - `80% - 89%`: **Replace** — Same theme, updated evidence. Old reflection marked `archived: true`, new one added.
  - `< 80%`: **Add** — Genuinely new insight, append to memories.
