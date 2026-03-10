# Shared Utilities

## MODULES (No Barrel File — Import Explicitly)

### `logging.js`

**Exported functions** (all auto-prefix `[OpenVault]`, all route through `getDeps().console`):

| Function | Visibility | Use for |
|---|---|---|
| `logDebug(msg, data?)` | `debugMode` only | Loop iterations, similarity scores, token math, sleep/wake cycles, per-item processing details |
| `logInfo(msg, data?)` | Always | Rare milestones that fire **at most once per user action**: init, backfill complete, model change, settings loaded |
| `logWarn(msg, data?)` | Always | Recovered errors, edge-case fallbacks (array-instead-of-object, stale lock cleared, unknown config key) |
| `logError(msg, error?, context?)` | Always | Unrecoverable failures. Pass the caught `Error` as second arg. Pass a context object (counts, model names, truncated inputs) as third arg for the 3 critical paths (JSON parse, embedding, extraction). |
| `logRequest(label, data)` | `requestLogging` only | Full LLM request/response payloads inside `groupCollapsed`. Already well-designed — do not change. |

**Rules:**
- **Never** use bare `console.*` or `getDeps().console.*` outside `logging.js` and `deps.js`.
- **Import what you need**: `import { logDebug, logError } from '../utils/logging.js';`
- **`logInfo` budget**: If a message could fire inside a loop or more than once per user action, it MUST be `logDebug`, not `logInfo`.
- **Error context**: On critical paths (JSON parse, embedding, extraction top-level), always pass a `context` object to `logError`. Truncate raw text to 100-2000 chars. Never include full chat messages or API keys.
- **AbortError**: Always re-throw `AbortError` before logging — it signals intentional cancellation, not a failure.

### `data.js`
- Lazy-initializes `chatMetadata.openvault`.
- **Chat-Switch Guard**: `saveOpenVaultData(expectedChatId)` aborts save if the user switched chats during an async operation. Prevents massive cross-chat data corruption.
- `updateMemory()`: Automatically invalidates/deletes the embedding if the `summary` string changes.

### `embedding-codec.js`
- Base64 Float32Array encode/decode for embeddings.
- `getEmbedding(obj)`, `setEmbedding(obj, vec)`, `hasEmbedding(obj)`, `deleteEmbedding(obj)`.
- Lazy migration: reads legacy `embedding: number[]` transparently, writes only `embedding_b64: string`.
- ~33% storage reduction vs JSON arrays.

### `tokens.js` (gpt-tokenizer)
- Exact token counting replacing old heuristic estimators.
- **Turn-Boundary Snapping** (`snapToTurnBoundary`): Trims message index arrays backward until it finds a valid `Bot -> User` transition or End-of-Chat. **CRITICAL**: Prevents auto-hide or batching from splitting a User message from its Bot response.

### `text.js`
- `stripThinkingTags()`: Strips `<think>`, `<reasoning>`, etc. (Case insensitive). Also handles orphaned closing tags (e.g., `</think>` without opening) from assistant prefill continuations — strips everything before and including the orphaned tag.
- `safeParseJSON()`: Multi-layer recovery. Extracts markdown codeblocks -> uses bracket-balancing to isolate JSON -> applies `jsonrepair`. Wraps bare arrays in an `{ events: [] }` object if the LLM forgot the root key.

### `st-helpers.js`
- `safeSetExtensionPrompt()`: Wraps ST's injection with try/catch.
- `yieldToMain()`: Polyfills `scheduler.yield()` with a `setTimeout(0)` fallback. Mandatory in heavy loops (communities, extraction dedup) to unfreeze the ST UI.

### `stemmer.js` & `stopwords.js`
- Language detection: Cyrillic -> Russian, Latin -> English.
- **Cyrillic Over-Stem Guard**: Snowball often over-strips Russian (e.g., `елена` -> `ел`). Guard limits stripping to max 3 chars, falling back to 1 char.
- **Entity Stemming**: `stemName()` intentionally DOES NOT filter stopwords (e.g., "The Castle" retains the "the" stem, because entity names are exact).
- **Stopwords**: Base EN+RU lists from `stopword` package only. No custom lists.