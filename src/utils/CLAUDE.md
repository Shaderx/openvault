# Utility Modules

Shared utilities used across extraction, retrieval, and graph subsystems.
All utilities live in `src/utils/` — there is no monolithic `src/utils.js`.

## `logging.js` — Debug & Request Logging
**Functions**: `log(message)`, `logRequest(label, data)`
- **`log()`**: Guarded by `settings.debugMode`. Prefixes all messages with `[OpenVault]`.
- **`logRequest()`**: Guarded by `settings.requestLogging`. Uses `console.groupCollapsed` for clean F12 experience. Logs full LLM request/response including profile, max tokens, messages, and errors with cause chains.
- **Usage**: Most-imported utility (~11 files). Every subsystem uses `log()`.

## `data.js` — Data Access & Mutations
**Functions**: `getOpenVaultData()`, `getCurrentChatId()`, `saveOpenVaultData(expectedChatId?)`, `generateId()`, `updateMemory(id, updates)`, `deleteMemory(id)`, `deleteCurrentChatData()`, `deleteCurrentChatEmbeddings()`
- **`getOpenVaultData()`**: Lazy-initializes `chatMetadata.openvault` with empty memories/characters/lastProcessed. Returns `null` if context unavailable.
- **`saveOpenVaultData()`**: Chat-switch guard — if `expectedChatId` is provided and doesn't match current chat, save is aborted. Prevents cross-chat data corruption during async operations.
- **`generateId()`**: Uses `getDeps().Date.now()` (mockable in tests) + random suffix.
- **Data mutations** (`updateMemory`, `deleteMemory`, etc.): Previously in a separate `src/data/actions.js`, now consolidated here. `updateMemory` invalidates embeddings when summary changes.
- **Dependencies**: Imports `log` from `logging.js`, `showToast` from `dom.js`.

## `tokens.js` — Token Counting (gpt-tokenizer)
**Functions**: `countTokens(text)`, `getMessageTokenCount(chat, index, data)`, `getTokenSum(chat, indices, data)`, `snapToTurnBoundary(chat, messageIds)`
- **`countTokens()`**: Wraps `gpt-tokenizer` (o200k_base). Accurate token counting for any text. Empty string returns 0.
- **`getMessageTokenCount()`**: Counts tokens for a chat message with caching in `data.message_tokens`. Cache key is stringified index.
- **`getTokenSum()`**: Sums token counts for multiple message indices. Uses cached values when available.
- **`snapToTurnBoundary()`**: Trims message index list to valid turn boundary. Split is valid when next message is User, or at end-of-chat. Prevents orphaned User messages from being separated from Bot responses.
- **Usage**: Extraction batching, auto-hide, retrieval formatting. Replaces old `estimateTokens()` heuristic.

## `text.js` — Text Processing & JSON Parsing
**Functions**: `sliceToTokenBudget(memories, budget)`, `stripThinkingTags(text)`, `safeParseJSON(input)`, `sortMemoriesBySequence(memories, ascending?)`
- **`sliceToTokenBudget()`**: Greedy fill — iterates memories, accumulates token counts via `countTokens()` from `tokens.js`, stops at budget. Used by extraction (context window for LLM) and retrieval (final output budget).
- **`stripThinkingTags()`**: Removes `<think>`, `<thinking>`, `<thought>`, `<reasoning>`, `<reflection>`, `[THINK]`, `[THOUGHT]`, `[REASONING]`, `*thinks:*`, `(thinking:)` patterns. Case-insensitive.
- **`safeParseJSON()`**: Multi-layer recovery: strip thinking tags → extract markdown code blocks → bracket-balanced extraction (private `extractBalancedJSON`) → `jsonrepair` → parse. Array results get wrapped in `{ events, entities, relationships, reasoning }` recovery object.
- **`sortMemoriesBySequence()`**: Non-mutating sort. Falls back to `created_at` when `sequence` is missing.

## `dom.js` — DOM & Toast Notifications
**Functions**: `escapeHtml(str)`, `showToast(type, message, title?, options?)`
- **`escapeHtml()`**: Standard XSS prevention — escapes `& < > " '`. Returns empty string for falsy input.
- **`showToast()`**: Delegates to `getDeps().showToast()`. Wraps SillyTavern's toastr.

## `st-helpers.js` — SillyTavern Integration & Async
**Functions**: `safeSetExtensionPrompt(content, name?)`, `isExtensionEnabled()`, `withTimeout(promise, ms, operation?)`, `yieldToMain()`
- **`safeSetExtensionPrompt()`**: Wraps `setExtensionPrompt` with try/catch. Defaults slot name to `extensionName`. Returns boolean success.
- **`isExtensionEnabled()`**: Single source of truth for enabled check. `isAutomaticMode()` was collapsed into this (they were identical).
- **`withTimeout()`**: `Promise.race` with a timeout reject. Pure — no external deps.
- **`yieldToMain()`**: Uses `scheduler.yield()` when available, falls back to `setTimeout(0)`. Used in heavy loops (communities, extraction) to prevent UI freezing.

## `stemmer.js` — Shared Stemming
**Functions**: `stemWord(word)`, `stemName(name)`
- **Language Detection**: Cyrillic → Russian stemmer, Latin → English, other → pass-through.
- **Cyrillic Over-Stem Guard**: Snowball multi-pass can over-strip (e.g., `елена` → `ел`). Guard limits stripping to max 3 chars; falls back to single-char removal.
- **`stemName()`**: Multi-word names → Set of stems, no stopword filtering (entity names are sacred).
- **Usage**: Graph-anchored entity detection in `query-context.js`, graph merge token overlap.

## `stopwords.js` — Unified Stopword Filtering
**Exports**: `ALL_STOPWORDS` (Set), `removeStopwords()` (from package)
- **Base**: EN + RU from `stopword` package.
- **GRAPH_CUSTOM**: Generic terms that shouldn't block entity merging ("the", "red", "large", "burgundy").
- **QUERY_STARTERS**: Sentence starters and discourse markers ("The", "Запомни", "Короче").
- **Usage**: Graph token overlap guard, query context filtering.

## `russian-imperatives.js` — Imperative Verb Detection
**Exports**: `isLikelyImperative(word)`, `RUSSIAN_IMPERATIVES` (Set)
- **Purpose**: Prevents capitalized imperative verbs from being extracted as entities in Cyrillic text.
- **Two-Layer**: Known imperatives set (O(1)) + suffix heuristic for unlisted verbs.
- **Suffixes**: `айте`, `яйте`, `ейте`, `ойте`, `ите`, `ись`, `ай`, `яй`, `ей`, `ой`.
- **Usage**: Query context entity filtering (via stopwords integration).

## GOTCHAS
- **No barrel file**: Import directly from sub-modules (`../utils/logging.js`, not `../utils.js`).
- **No Stopwords in `stemName()`**: Entity names like "The Castle" should keep "castl" stem even though "the" is a stopword.
- **Over-Stem Guard Only for Cyrillic**: English stemming doesn't get the guard — Snowball is well-behaved for Latin.
- **`data.js` depends on `logging.js` and `dom.js`**: One-directional. No circular imports.
- **`isAutomaticMode` was deleted**: Use `isExtensionEnabled()` instead. They were identical.
