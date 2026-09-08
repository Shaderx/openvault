# ST Vector REST API Service

## WHAT
Network I/O boundary for SillyTavern's built-in Vectra DB (Vector Storage). Pure REST API wrappers with no knowledge of OpenVault data structures (except extracting the OV_ID from text).

## EXPORTS

### Configuration
- `getSTVectorSource()` - Get the configured vector source from ST settings (e.g., 'openrouter', 'openai', 'ollama').
- `getSTVectorRequestBody(source)` - Get additional request body parameters based on source (model, API URLs, auth).
- `isStVectorSource()` - Check if current embedding source is 'st_vector'.

### CRUD Operations
- `syncItemsToST(items, chatId)` - Insert items via `/api/vector/insert`. Items array contains `{ hash, text, index }`.
- `deleteItemsFromST(hashes, chatId)` - Delete items via `/api/vector/delete`. Hashes array contains cyrb53 hashes.
- `purgeSTCollection(chatId)` - Purge entire collection via `/api/vector/purge`.
- `querySTVector(searchText, topK, threshold, chatId)` - Query for similar items via `/api/vector/query`. Returns results with extracted OV IDs.

### Internal Helpers
- `chatExists(chatId)` - Validate chat still exists (with orphan detection and session cache).
- `getSTCollectionId(chatId)` - Get collection ID (includes chat ID to prevent cross-chat leakage).
- `extractOvId(text)` - Extract OpenVault ID from ST text field with OV_ID prefix.

## GOTCHAS & RULES
- **CSRF Headers**: All `fetch()` calls to ST endpoints MUST use `getDeps().getRequestHeaders()` — ST requires `X-CSRF-Token` header on POST requests.
- **Collection Isolation**: Collection ID includes chat ID (`openvault-${chatId}-${source}`) to prevent cross-chat data leakage.
- **Orphan Detection**: `querySTVector` validates chat existence on first call per session. Purges orphaned collections for deleted chats.
- **Session Cache**: `validatedChats` Set prevents duplicate `/api/characters/chats` calls within a session.
- **No Domain Knowledge**: This module knows nothing about OpenVault memory structures, graphs, or communities. It only handles raw `{ hash, text }` items.
- **stChanges Pattern**: Domain functions return `stChanges` objects. Orchestrator (`extract.js`) calls these methods to apply bulk network I/O at phase boundaries.
