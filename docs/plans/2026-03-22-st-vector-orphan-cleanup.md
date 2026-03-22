# ST Vector Storage Orphan Cleanup Implementation Plan

**Goal:** Detect and clean orphaned ST Vector Storage collections when chats are deleted.
**Architecture:** Two-part cleanup: (1) Lazy detection during query with session cache, (2) Proactive purge when user clears chat data.
**Tech Stack:** ES Modules, Vitest for testing, ST Vector Storage API.

---

### File Structure Overview

- **Modify:** `src/utils/data.js` - Add `chatExists()`, `validatedChats` cache, modify `querySTVector()` and `deleteCurrentChatData()`
- **Test:** `tests/utils/data.test.js` - Add tests for orphan detection and ST purge on delete

---

### Common Pitfalls

- **ST API CSRF:** All `fetch()` calls to ST endpoints MUST use `getDeps().getRequestHeaders()` — never manual headers.
- **Session Cache:** `validatedChats` Set prevents repeated validation API calls for the same chat during a session.
- **Fail-Safe:** On `chatExists()` error, assume chat exists to avoid false cleanup.
- **Don't Block:** ST purge errors during delete should not block OpenVault data clearing.

---

### Task 1: Add Chat Existence Check and Session Cache

**Files:**
- Modify: `src/utils/data.js`
- Test: `tests/utils/data.test.js`

#### Step 1: Write the failing test

Add to `tests/utils/data.test.js` at the end of the file (before the last closing brace):

```javascript
import { querySTVector } from '../../src/utils/data.js';

describe('querySTVector — orphan detection', () => {
    beforeEach(() => {
        // Reset validatedChats cache between tests
        vi.resetModules();
    });

    it('detects orphaned collection and purges it', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ file_name: 'other-chat.jsonl' }]),
            })
            .mockResolvedValueOnce({ ok: true }); // purge response

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        // Re-import to get fresh validatedChats cache
        const { querySTVector: freshQuery } = await import('../../src/utils/data.js');
        const result = await freshQuery('test query', 5, 0.5, 'deleted-chat-id');

        expect(result).toEqual([]);
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/characters/chats',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'X-CSRF-Token': 'test-token' }),
                body: JSON.stringify({ character_id: 123 }),
            })
        );
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/vector/purge',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('returns empty and shows toast when collection is orphaned', async () => {
        const mockShowToast = vi.fn();
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ file_name: 'existing-chat.jsonl' }]),
            });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: mockShowToast,
        });

        const { querySTVector: freshQuery } = await import('../../src/utils/data.js');
        const result = await freshQuery('test', 5, 0.5, 'existing-chat');

        // Should proceed to query (returns empty since no query mock)
        expect(result).toEqual([]);
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('validates group chats via /api/groups/get', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ chats: ['group-chat-1'] }),
            });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                characterId: undefined,
                groupId: 'group-123',
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/utils/data.js');
        await freshQuery('test', 5, 0.5, 'group-chat-1');

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/groups/get',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ id: 'group-123' }),
            })
        );
    });

    it('caches validation result for the session', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ file_name: 'cached-chat.jsonl' }]),
            });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/utils/data.js');

        // First call should validate
        await freshQuery('query1', 5, 0.5, 'cached-chat');
        // Second call should use cache
        await freshQuery('query2', 5, 0.5, 'cached-chat');

        expect(mockFetch).toHaveBeenCalledTimes(1); // Only one validation call
    });

    it('assumes chat exists on validation error (fail-safe)', async () => {
        const mockFetch = vi.fn()
            .mockRejectedValueOnce(new Error('Network error'));

        setDeps({
            console: mockConsole,
            getContext: () => ({
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/utils/data.js');
        const result = await freshQuery('test', 5, 0.5, 'error-chat');

        // Should not throw, should attempt query (returns empty since no query mock)
        expect(result).toEqual([]);
        expect(mockConsole.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to validate chat existence'),
            expect.any(Error)
        );
    });
});
```

#### Step 2: Run test to verify it fails

```bash
npx vitest tests/utils/data.test.js -t "orphan detection" --run
```

Expected: FAIL with "querySTVector is not exported" or similar

#### Step 3: Write minimal implementation

Add to `src/utils/data.js` after the imports (around line 7):

```javascript
// Cache of validated chats for this session (module-level state)
const validatedChats = new Set();

/**
 * Clear the validated chats cache. Used for testing.
 */
export function _clearValidatedChatsCache() {
    validatedChats.clear();
}

/**
 * Check if a chat still exists in ST
 * @param {string} chatId
 * @returns {Promise<boolean>}
 */
async function chatExists(chatId) {
    try {
        const { getContext, getRequestHeaders } = getDeps();
        const context = getContext();

        // Get character ID for individual chats
        const characterId = context.characterId;
        if (characterId !== undefined) {
            const response = await getDeps().fetch('/api/characters/chats', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ character_id: characterId }),
            });
            if (!response.ok) {
                logWarn('Failed to fetch character chats list', { status: response.status });
                return true; // Fail-safe: assume exists on error
            }
            const chats = await response.json();
            return chats.some(chat => chat.file_name.replace('.jsonl', '') === chatId);
        }

        // For group chats - check group data
        const groupId = context.groupId;
        if (groupId) {
            const response = await getDeps().fetch('/api/groups/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ id: groupId }),
            });
            if (!response.ok) {
                logWarn('Failed to fetch group data', { status: response.status });
                return true; // Fail-safe: assume exists on error
            }
            const group = await response.json();
            return group?.chats?.includes(chatId);
        }

        // Neither character nor group context - assume exists
        return true;
    } catch (err) {
        logWarn('Failed to validate chat existence', err);
        return true; // Assume exists on error to avoid false cleanup
    }
}
```

Now modify the existing `querySTVector` function to add orphan detection at the beginning:

Find the existing `querySTVector` function (around line 150) and replace it:

```javascript
/**
 * Query ST Vector Storage for similar items.
 * @param {string} searchText - Query text
 * @param {number} topK - Number of results
 * @param {number} threshold - Similarity threshold
 * @param {string} chatId - Current chat ID
 * @returns {Promise<Array<{id: string, hash: number, text: string}>>} Results with extracted OV IDs
 */
export async function querySTVector(searchText, topK, threshold, chatId) {
    // Check for orphans (with session cache)
    if (!validatedChats.has(chatId)) {
        const exists = await chatExists(chatId);
        if (!exists) {
            logWarn(`Detected orphaned ST collection for deleted chat: ${chatId}`);
            await purgeSTCollection(chatId);
            showToast('info', 'Cleaned up orphaned vector storage for deleted chat');
            return [];
        }
        validatedChats.add(chatId);
    }

    try {
        const collectionId = getSTCollectionId(chatId);
        const source = getSTVectorSource();
        const body = {
            collectionId,
            searchText,
            topK,
            threshold,
            source,
            ...getSTVectorRequestBody(source),
        };

        const response = await getDeps().fetch('/api/vector/query', {
            method: 'POST',
            headers: getDeps().getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            logWarn(`ST Vector query failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        if (!data?.metadata || !Array.isArray(data.metadata)) return [];

        return data.metadata.map((item) => ({
            id: extractOvId(item.text) || String(item.hash),
            hash: item.hash,
            text: item.text,
        }));
    } catch (error) {
        logError('ST Vector query error', error);
        return [];
    }
}
```

Also need to add `showToast` to the imports at the top if not already there (check line 3):

```javascript
import { showToast } from './dom.js';
```

This import should already exist.

#### Step 4: Run test to verify it passes

```bash
npx vitest tests/utils/data.test.js -t "orphan detection" --run
```

Expected: PASS (6 tests passing)

#### Step 5: Commit

```bash
git add -A && git commit -m "feat: lazy orphan detection for ST Vector Storage collections"
```

---

### Task 2: Purge ST Collection When Clearing Chat Data

**Files:**
- Modify: `src/utils/data.js`
- Test: `tests/utils/data.test.js`

#### Step 1: Write the failing test

Add to `tests/utils/data.test.js` inside the existing `describe('deleteCurrentChatData', () => { ... })` block:

```javascript
    it('purges ST Vector collection when using st_vector', async () => {
        const mockPurge = vi.fn().mockResolvedValue(true);
        mockContext.chatMetadata[METADATA_KEY] = {
            [MEMORIES_KEY]: [{ id: '1' }],
        };
        mockContext.chatId = 'test-chat-456';

        // Mock purgeSTCollection by exporting it
        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: {
                    debugMode: true,
                    embeddingSource: 'st_vector',
                },
            }),
            saveChatConditional: vi.fn().mockResolvedValue(undefined),
            fetch: vi.fn().mockResolvedValue({ ok: true }), // For purgeSTCollection
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
        });

        await deleteCurrentChatData();

        // Verify purge was called via fetch
        const fetchCalls = getDeps().fetch.mock.calls;
        const purgeCall = fetchCalls.find(call => call[0] === '/api/vector/purge');
        expect(purgeCall).toBeDefined();
        expect(JSON.parse(purgeCall[1].body)).toMatchObject({
            collectionId: expect.stringContaining('test-chat-456'),
        });
    });

    it('does not purge ST collection when using local embeddings', async () => {
        mockContext.chatMetadata[METADATA_KEY] = {
            [MEMORIES_KEY]: [{ id: '1' }],
        };
        mockContext.chatId = 'test-chat-789';

        const mockFetch = vi.fn().mockResolvedValue({ ok: true });

        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: {
                    debugMode: true,
                    embeddingSource: 'multilingual-e5-small',
                },
            }),
            saveChatConditional: vi.fn().mockResolvedValue(undefined),
            fetch: mockFetch,
        });

        await deleteCurrentChatData();

        // Verify no purge call was made
        const purgeCalls = mockFetch.mock.calls.filter(call => call[0] === '/api/vector/purge');
        expect(purgeCalls).toHaveLength(0);
    });

    it('continues with OpenVault data clearing even if ST purge fails', async () => {
        mockContext.chatMetadata[METADATA_KEY] = {
            [MEMORIES_KEY]: [{ id: '1' }],
        };
        mockContext.chatId = 'test-chat-fail';

        const mockSave = vi.fn().mockResolvedValue(undefined);

        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: {
                    debugMode: true,
                    embeddingSource: 'st_vector',
                },
            }),
            saveChatConditional: mockSave,
            fetch: vi.fn().mockRejectedValue(new Error('Network error')),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
        });

        // Should not throw
        const result = await deleteCurrentChatData();
        expect(result).toBe(true);

        // Verify OpenVault data was still cleared
        expect(mockContext.chatMetadata[METADATA_KEY]).toBeUndefined();

        // Verify warning was logged
        expect(mockConsole.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to purge ST collection'),
            expect.any(Error)
        );
    });
```

#### Step 2: Run test to verify it fails

```bash
npx vitest tests/utils/data.test.js -t "purges ST Vector" --run
```

Expected: FAIL - tests don't find expected behavior

#### Step 3: Write minimal implementation

Find the existing `deleteCurrentChatData` function (around line 320) and replace it:

```javascript
/**
 * Delete all OpenVault data for the current chat
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteCurrentChatData() {
    const context = getDeps().getContext();

    if (!context.chatMetadata) {
        logDebug('No chat metadata found');
        return false;
    }

    // Unhide all messages that were hidden by auto-hide
    // is_system flags persist even when memories are cleared, which would
    // leave those messages permanently unextractable
    const chat = context.chat || [];
    let unhiddenCount = 0;
    for (const msg of chat) {
        if (msg.is_system) {
            msg.is_system = false;
            unhiddenCount++;
        }
    }
    if (unhiddenCount > 0) {
        logDebug(`Unhid ${unhiddenCount} messages after memory clear`);
    }

    // NEW: Purge ST Vector Storage if using st_vector
    const settings = getDeps().getExtensionSettings()?.openvault;
    if (settings?.embeddingSource === 'st_vector') {
        const chatId = getCurrentChatId();
        if (chatId) {
            try {
                await purgeSTCollection(chatId);
                logInfo(`Purged ST Vector collection for cleared chat: ${chatId}`);
            } catch (err) {
                logWarn('Failed to purge ST collection during chat data deletion', err);
                // Don't fail the whole operation - OpenVault data is already cleared
            }
        }
    }

    delete context.chatMetadata[METADATA_KEY];
    await getDeps().saveChatConditional();
    logDebug('Deleted all chat data');
    return true;
}
```

Make sure `logInfo` is imported at the top (check existing imports on line 4):

```javascript
import { logDebug, logError, logInfo, logWarn } from './logging.js';
```

This import should already be present.

#### Step 4: Run test to verify it passes

```bash
npx vitest tests/utils/data.test.js -t "deleteCurrentChatData" --run
```

Expected: PASS (all 5 tests in the describe block)

Run full test suite to ensure no regressions:

```bash
npx vitest tests/utils/data.test.js --run
```

Expected: PASS (all tests in the file)

#### Step 5: Commit

```bash
git add -A && git commit -m "feat: purge ST Vector collection when clearing chat data"
```

---

### Task 3: Export querySTVector for Testing

**Files:**
- Modify: `src/utils/data.js` (already done in Task 1)

The `querySTVector` function is already exported. Verify this line exists in the file:

```javascript
export async function querySTVector(searchText, topK, threshold, chatId) {
```

It should already be exported from earlier changes.

---

### Task 4: Run Full Test Suite

**Files:**
- All test files

#### Step 1: Run all data.js tests

```bash
npx vitest tests/utils/data.test.js --run
```

Expected: PASS (all tests)

#### Step 2: Run related tests to ensure no regressions

```bash
npx vitest tests/st-vector.test.js --run
npx vitest tests/embeddings.test.js --run
```

Expected: PASS

#### Step 3: Run full test suite

```bash
npm run test:run
```

Expected: PASS (all tests in the project)

---

### Task 5: Final Verification and Commit

#### Step 1: Verify implementation against design

Check `src/utils/data.js` contains:
- [ ] `validatedChats` Set at module level
- [ ] `_clearValidatedChatsCache()` export for testing
- [ ] `chatExists()` function checking `/api/characters/chats` and `/api/groups/get`
- [ ] Orphan detection in `querySTVector()` with session caching
- [ ] ST purge in `deleteCurrentChatData()` when `embeddingSource === 'st_vector'`

#### Step 2: Verify tests cover

Check `tests/utils/data.test.js` contains:
- [ ] Test for detecting orphaned collection and purging
- [ ] Test for group chat validation
- [ ] Test for session cache
- [ ] Test for fail-safe behavior on validation error
- [ ] Test for purging on chat data delete with st_vector
- [ ] Test for NOT purging when using local embeddings
- [ ] Test for continuing despite ST purge failure

#### Step 3: Final commit

```bash
git add -A && git commit -m "test: add orphan detection and ST purge tests"
```

---

## Summary

This plan implements two-part ST Vector Storage orphan cleanup:

1. **Lazy Orphan Detection:** When `querySTVector` is called, it checks if the chat exists (with session caching). If the chat was deleted, it purges the orphaned collection and shows a toast.

2. **Delete Chat Data Purge:** When the user clears chat data while using `st_vector`, the ST collection is also purged.

**Behavior Summary:**

| Scenario | Old Behavior | New Behavior |
|----------|--------------|--------------|
| Query orphaned collection | Returns empty/error | Detects orphan, purges, shows toast, returns empty |
| Delete chat memories | OpenVault data cleared only | OpenVault data + ST vectors cleared |
| Chat deleted outside ST | Collection orphaned forever | Detected on next query, cleaned up |

**Testing:** All tests use the existing Vitest patterns with `setDeps()` for mocking and follow the project's test pyramid structure.
