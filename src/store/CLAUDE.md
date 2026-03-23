# Chat Data Repository

## WHAT
Repository pattern for local chat metadata mutations. Encapsulates all CRUD operations on `context.chatMetadata.openvault`. Provides a clean boundary between domain logic and SillyTavern's state storage.

## CORE OPERATIONS

### Read Operations
- `getOpenVaultData()` - Get the full OpenVault data object from chat metadata. Returns null if context unavailable.
- `getCurrentChatId()` - Get current chat ID for tracking across async operations.

### Write Operations (Repository Pattern)
- `saveOpenVaultData(expectedChatId?)` - Persist changes to chat metadata. Includes chat-change guard.
- `addMemories(newMemories)` - Append new memories to the store (PR6).
- `markMessagesProcessed(fingerprints)` - Record message fingerprints as processed (PR6).
- `incrementGraphMessageCount(count)` - Increment the graph message count (PR6).

### CRUD Operations
- `updateMemory(id, updates)` - Update a memory by ID. Allowed fields: summary, importance, tags, is_secret. Invalidates embedding if summary changed.
- `deleteMemory(id)` - Delete a memory by ID.
- `deleteCurrentChatData()` - Delete all OpenVault data for current chat. Unhides all hidden messages. Purges ST Vector collection if using st_vector.
- `generateId()` - Generate a unique ID (timestamp + random).

## GOTCHAS & RULES
- **Chat Change Guard**: `saveOpenVaultData(expectedChatId)` checks if chat changed before saving. Prevents data corruption from async operations.
- **ST Vector Purge**: `deleteCurrentChatData()` calls `purgeSTCollection()` from `services/st-vector.js` to clean up remote embeddings.
- **Embedding Invalidation**: `updateMemory()` calls `deleteEmbedding()` from `utils/embedding-codec.js` when summary changes, forcing re-embed on next retrieval.
- **Message Unhiding**: `deleteCurrentChatData()` unhides all `is_system` messages to prevent permanently unextractable messages.
- **Repository Methods**: PR6 added `addMemories`, `markMessagesProcessed`, `incrementGraphMessageCount` to eliminate direct array pushes from domain code.
