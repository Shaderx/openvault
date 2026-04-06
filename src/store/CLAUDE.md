# Storage, State, and Migrations

## REPOSITORY PATTERN
- **Mutate chat data exclusively through repository methods.** Use `addMemories`, `markMessagesProcessed`, and `incrementGraphMessageCount` in `store/chat-data.js`. Never `push()` to arrays directly from domain code.
- **Protect async saves with chat-change guards.** Pass the `expectedChatId` to `saveOpenVaultData()`. Abort the save if the user switched chats mid-operation.

## STATE MANAGEMENT
- **Isolate background extraction from manual backfills.** `operationState.extractionInProgress` flags manual backfills. `isWorkerRunning()` flags the background worker. Ensure they mutually exclude.
- **Scope kill-switches to the current session.** Use `isSessionDisabled()` for catastrophic migration failures. Never mutate global extension settings to disable the extension entirely.

## SCHEMA MIGRATIONS (`src/store/migrations/`)
- **Apply migrations sequentially.** Loop `v1 -> v2 -> v3` on chat load based on `schema_version`.
- **Implement transactional rollbacks.** Wrap `runSchemaMigrations` in a `try/catch`. On error, restore the structured clone backup and invoke `setSessionDisabled(true)`.
- **Update three locations for every schema change:** 
  1. `getOpenVaultData()` for new chats.
  2. The migration backfill function.
  3. Zod schemas in `src/store/schemas.js`.
- **Do not write defensive domain checks.** Ensure migrations fully backfill missing fields so domain code can trust the schema shape.

## ST VECTOR EXTERNAL SERVICE
- **Pass CSRF headers to all ST Vector calls.** Inject `getDeps().getRequestHeaders()` into `fetch` to pass `X-CSRF-Token`.
- **Isolate collections by chat ID.** Format collection IDs as `openvault-{chatId}-{source}` to prevent data cross-contamination.
- **Purge orphans immediately.** On the first query of a session, call `/api/characters/chats`. If the chat no longer exists, trigger `/api/vector/purge`.
