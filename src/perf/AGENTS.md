# Performance Monitoring

## WHAT
In-memory singleton store for tracking operation timings. Values are mirrored to `chatMetadata.openvault.perf` and become durable during the normal chat-save cycle. Renders in Settings → Perf tab.

## ARCHITECTURE
- **Store**: `{ [metricId]: { ms, size, ts } }` — last-value-wins per metric
- **Metadata update**: `record()` updates the in-memory store and the live `chatMetadata.openvault.perf` object. It does not call the durable chat-save API; the next normal save cycle persists the mutation.
- **Hydration**: `loadFromChat()` restores in-memory store on chat switch
- **Metrics**: The registry in `PERF_METRICS` (src/constants.js) is the source of truth for the current count and metadata. Keep thresholds in `PERF_THRESHOLDS` synchronized with that registry. Sync metrics block generation; async metrics run outside the critical path.

## EXPORTS
- `record(metricId, durationMs, size)` — store metric + mirror to live chat metadata
- `getAll()` — get in-memory snapshot
- `loadFromChat()` — hydrate from chat metadata
- `formatForClipboard()` — plain text report for copy-paste
- `_resetForTest()` — test-only reset

## CONSTANTS (src/constants.js)
- `PERF_THRESHOLDS`: health threshold (ms) for each metric — red if exceeded
- `PERF_METRICS`: `{ label, icon, sync }` metadata per metric

## SYNC vs ASYNC
- **Sync metrics** (`retrieval_injection`, `auto_hide`): run during `GENERATION_AFTER_COMMANDS`. Block chat generation. Red = bad UX.
- **Async metrics**: everything else (LLM calls, embedding, save, etc.)

## INSTRUMENTATION PATTERN
```javascript
const t0 = performance.now();
try {
    // ... operation ...
} finally {
    record('metric_id', performance.now() - t0, 'scale context');
}
```
Use `finally` to ensure timing is recorded even on early returns/exceptions.
