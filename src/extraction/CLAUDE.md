# Memory Extraction Subsystem

## WHAT
Background pipeline converting raw messages -> structured JSON -> Deduplicated Memories + Knowledge Graph -> Reflections + Communities.

## WORKER LIFECYCLE (`worker.js`)
- **Entry**: `wakeUpBackgroundWorker()` (Fire-and-forget, called by `onMessageReceived`).
- **Singleton**: Protected by `isRunning`. Multiple calls just increment `wakeGeneration`.
- **Interruptible Sleep**: Backoff sleep checks `wakeGeneration` every 500ms. New messages cut sleep short.
- **Guards**: Halts immediately on chat switch, disabled state, or `operationState.extractionInProgress` (manual backfill).
- **Backoff Schedule**: `[1, 2, 3, 10, 20, 30, 30, 60, 60]` sec. Caps at 15m. Only Phase 1 failures trigger retries.

## EXTRACTION PIPELINE (`extract.js`)
**Phase 1 (Critical - gates UI auto-hide):**
1. **Batching**: `scheduler.js` determines unextracted batches via token budget + turn boundaries.
2. **Stage A (Events)**: LLM uses configurable assistant prefill (default: `<think>`) -> returns `EventExtractionSchema`. Preamble language (CN/EN) and prefill preset resolved from `settings` via `resolveExtractionPreamble()`/`resolveExtractionPrefill()`. Validates events *individually* (one bad event drops itself, doesn't reject whole batch).
3. **RPM Delay**: Evaluates `lastApiCallTime` and sleeps remaining delta dynamically.
4. **Stage B (Graph)**: Contextualized by Stage A. Returns `GraphExtractionSchema` (Entities + Relationships).
5. **Graph Upsert**: `mergeOrInsertEntity()` (Semantic + Token overlap) and `upsertRelationship()`.
6. **Commit**: Pre-computes BM25 `tokens` (stemmed), updates `MEMORIES_KEY` & `PROCESSED_MESSAGES_KEY`.
7. **Intermediate Save**: Persists Phase 1 to disk.

**Phase 2 (Enrichment - Non-critical, errors swallowed):**
8. **Reflection**: Accumulates `importance_sum`. Triggers at 40.
9. **Communities**: Runs Louvain every 50 extracted messages.
10. **Final Save**.

## GOTCHAS & RULES
- **Split Schemas**: Events and Graph have separate Zod schemas. No unified schema. Lowers LLM cognitive load.
- **JSON Array Recovery**: If LLM forgets object wrapper and returns a bare array, `safeParseJSON` wraps it automatically.
- **Markdown Stripping**: `_testStripMarkdown` handles open/close orphans (````json\n{...}`).
- **Event Summary Min**: Enforced 30 characters in Zod.
- **Entity Keys**: Always pass through `normalizeKey()` (lowercase, strip possessives) before Graph CRUD.
- **Token Caching**: Events/Reflections store pre-computed `m.tokens` at creation.
- **Two-Phase Dedup**: `filterSimilarEvents` (async): 
  1. Cosine vs existing memories.
  2. Jaccard token overlap for intra-batch duplicates (requires `await yieldToMain()` every 10 loops).
- **Testing**: Worker tests MUST use `vi.resetModules()` to reset `isRunning` state. Heavily test parsers in `structured.test.js`.