# Shared Utilities

## LOGGING (`logging.js`)
- **Use domain-specific loggers.** Route all logs through `getDeps().console`. Never use raw `console.log`.
- **`logDebug(msg, data)`:** Use inside loops, similarity scoring, or token math. (Only visible if `debugMode` is true).
- **`logInfo(msg, data)`:** Use for milestones that fire *once* per user action (e.g., Backfill complete).
- **`logWarn(msg, data)`:** Use for recovered errors and edge-case fallbacks.
- **`logError(msg, err, context)`:** Use for unrecoverable failures. Always pass a truncated context object for the 3 critical paths (JSON parse, embedding, extraction).

## JSON PARSING (`text.js`)
- **Execute the 5-Tier `safeParseJSON` waterfall:**
  1. Native `JSON.parse`.
  2. `extractJsonBlocks` + `jsonrepair`.
  3. Smart quote normalization + `extractJsonBlocks` + `jsonrepair`.
  4. `scrubConcatenation` (Fixes hallucinated `"a" + "b"` strings).
  5. Fatal Error.
- **Return Zod-style results.** Always return `{ success, data?, error?, errorContext? }`.

## EMBEDDING CODEC (`embedding-codec.js`)
- **Store as Base64 strings.** Convert `Float32Array` to `embedding_b64` to cut JSON storage size by 33%.
- **Read legacy arrays transparently.** Fall back to parsing `number[]` if `embedding_b64` is missing.

## TOKEN BOUNDARIES (`tokens.js`)
- **Snap arrays to turn boundaries.** Use `snapToTurnBoundary()` to trim message indices backward until reaching a valid `Bot -> User` transition. Never orphan a User message from its Bot response during auto-hide or batching.

## AIMD LADDER QUEUE (`queue.js`)
- **Manage Phase 2 parallelism.** Use `createLadderQueue()` for LLM tasks.
- **Decrease multiplicatively.** On 429 or Timeout, halve concurrency and pause for 4 seconds.
- **Increase additively.** On success, slowly add 0.5 to the concurrency ceiling.
