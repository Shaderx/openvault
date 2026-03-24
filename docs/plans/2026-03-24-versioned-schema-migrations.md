# Versioned Schema Migrations Implementation Plan

**Goal:** Establish a centralized, version-tracked migration pipeline that eagerly migrates legacy v1 data to v2 on chat load.
**Architecture:** Migration orchestrator runs on `onChatChanged`, applying sequential migrations with transactional rollback on failure. Session-scoped kill-switch disables OpenVault for the current chat if migration fails.
**Tech Stack:** Pure JavaScript, no new dependencies. Uses existing `structuredClone()`, `showToast()`, and logging utilities.

---

## File Structure

**New Files:**
- Create: `src/store/migrations/index.js` - Migration orchestrator: version check, migration loop
- Create: `src/store/migrations/v2.js` - v1 → v2 conversion logic
- Create: `tests/store/migrations.test.js` - Unit tests for migration pipeline

**Modified Files:**
- Modify: `src/store/chat-data.js` - New chats get complete v2 schema
- Modify: `src/state.js` - Add session kill-switch flag
- Modify: `src/events.js` - Wire migration pipeline with rollback
- Modify: `src/utils/embedding-codec.js` - Export `encode` as `_migrateEncodeBase64` for migrations only
- Modify: `src/extraction/scheduler.js` - Remove `migrateProcessedMessages` (moved to v2.js)
- Modify: `src/extraction/extract.js` - Remove `initGraphState` calls (repository guarantees shape)
- Modify: `src/graph/graph.js` - Remove `initGraphState` export (kept internal for now)
- Modify: `src/index.js` - Add session disabled guard to slash commands

**Deleted Code:**
- `scheduler.js`: `migrateProcessedMessages` function (moved to v2.js)
- `embedding-codec.js`: Legacy array fallback in `getEmbedding()` and `hasEmbedding()`
- `extract.js`: Calls to `initGraphState()`
- `graph.js`: Export of `initGraphState`

---

## Common Pitfalls

- Don't forget to import `MEMORIES_KEY`, `PROCESSED_MESSAGES_KEY` from `constants.js` in v2.js
- Export `encode` as `_migrateEncodeBase64` — the underscore prefix signals it's NOT part of the standard codec API
- `structuredClone()` throws for objects with non-cloneable properties (functions, DOM nodes) — only use on plain data objects
- Reset `_sessionDisabled` in `resetSessionController()` to ensure fresh state on chat change
- Migration must return `true` if changes were made, `false` otherwise (for toast display)
- Add `isSessionDisabled()` guards to slash commands (`/openvault-extract`, `/openvault-retrieve`) in `index.js`

---

### Task 1: Create Migration Orchestrator (index.js)

**Files:**
- Create: `src/store/migrations/index.js`
- Test: `tests/store/migrations.test.js`

- [ ] Step 1: Write the failing test for orchestrator

```javascript
// tests/store/migrations.test.js
import { beforeEach, describe, expect, it } from 'vitest';
import { MEMORIES_KEY, PROCESSED_MESSAGES_KEY } from '../../src/constants.js';
import { runSchemaMigrations, CURRENT_SCHEMA_VERSION } from '../../src/store/migrations/index.js';

describe('migration orchestrator', () => {
    describe('runSchemaMigrations', () => {
        it('returns false when no migration needed (already v2)', () => {
            const data = { schema_version: 2, memories: [] };
            const result = runSchemaMigrations(data, []);
            expect(result).toBe(false);
        });

        it('returns false when schema_version equals current', () => {
            const data = { schema_version: CURRENT_SCHEMA_VERSION };
            const result = runSchemaMigrations(data, []);
            expect(result).toBe(false);
        });

        it('treats missing schema_version as v1', () => {
            const data = { [PROCESSED_MESSAGES_KEY]: [0, 1, 2] };
            // Will fail until v2 migration is implemented
            expect(() => runSchemaMigrations(data, [])).not.toThrow();
        });
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/store/migrations.test.js`
Expected: FAIL — `runSchemaMigrations` not found

- [ ] Step 3: Write minimal orchestrator implementation

```javascript
// src/store/migrations/index.js
import { migrateToV2 } from './v2.js';

export const CURRENT_SCHEMA_VERSION = 2;

const MIGRATIONS = [
    { version: 2, run: migrateToV2 },
];

/**
 * Run required schema migrations on OpenVault data.
 * @param {Object} data - OpenVault data object (mutated in place)
 * @param {Array} chat - Chat messages array (for fingerprint migration)
 * @returns {boolean} True if any migration was applied
 */
export function runSchemaMigrations(data, chat) {
    const currentVersion = data.schema_version || 1;

    // No migration needed
    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
        return false;
    }

    let migrated = false;
    for (const migration of MIGRATIONS) {
        if (currentVersion < migration.version) {
            if (migration.run(data, chat)) {
                migrated = true;
            }
            data.schema_version = migration.version;
        }
    }

    return migrated;
}
```

- [ ] Step 4: Run test to verify it still fails (v2.js missing)

Run: `npx vitest tests/store/migrations.test.js`
Expected: FAIL — `migrateToV2` not found

- [ ] Step 5: Create stub v2.js to make orchestrator test pass

```javascript
// src/store/migrations/v2.js
/**
 * Migrate v1 data to v2.
 * @param {Object} _data - OpenVault data object
 * @param {Array} _chat - Chat messages array
 * @returns {boolean} True if changes were made
 */
export function migrateToV2(_data, _chat) {
    // Stub - will implement in Task 2
    return false;
}
```

- [ ] Step 6: Run test to verify it passes

Run: `npx vitest tests/store/migrations.test.js`
Expected: PASS

- [ ] Step 7: Commit

```bash
git add -A && git commit -m "feat(migrations): add migration orchestrator scaffold"
```

---

### Task 2: Implement v2 Migration Logic

**Files:**
- Modify: `src/store/migrations/v2.js`
- Modify: `src/utils/embedding-codec.js` (export `encode`)
- Test: `tests/store/migrations.test.js`

- [ ] Step 1: Write failing tests for v2 migration

```javascript
// Add to tests/store/migrations.test.js
import { getFingerprint } from '../../src/extraction/scheduler.js';

describe('v2 migration', () => {
    let chat;

    beforeEach(() => {
        let ts = 1000000;
        chat = [
            { mes: 'Hello', is_user: true, send_date: String(ts++) },
            { mes: 'Hi', is_user: false, send_date: String(ts++) },
            { mes: 'Bye', is_user: true, send_date: String(ts++) },
        ];
    });

    it('migrates index-based processed_message_ids to fingerprints', () => {
        const data = {
            [PROCESSED_MESSAGES_KEY]: [0, 2],
        };
        runSchemaMigrations(data, chat);

        expect(data[PROCESSED_MESSAGES_KEY]).toContain(getFingerprint(chat[0]));
        expect(data[PROCESSED_MESSAGES_KEY]).toContain(getFingerprint(chat[2]));
        expect(data[PROCESSED_MESSAGES_KEY]).not.toContain(0);
        expect(data[PROCESSED_MESSAGES_KEY]).not.toContain(2);
    });

    it('converts embedding arrays to embedding_b64', () => {
        const data = {
            [MEMORIES_KEY]: [
                { id: 'm1', embedding: [0.1, 0.2, 0.3] },
                { id: 'm2', embedding_b64: 'existing' }, // already converted
            ],
            graph: {
                nodes: [{ name: 'Alice', embedding: [0.5, 0.6] }],
            },
            communities: {},
        };

        runSchemaMigrations(data, chat);

        expect(data[MEMORIES_KEY][0].embedding).toBeUndefined();
        expect(data[MEMORIES_KEY][0].embedding_b64).toBeTypeOf('string');
        expect(data[MEMORIES_KEY][1].embedding_b64).toBe('existing'); // unchanged
        expect(data.graph.nodes[0].embedding).toBeUndefined();
        expect(data.graph.nodes[0].embedding_b64).toBeTypeOf('string');
    });

    it('initializes missing graph/communities/graph_message_count', () => {
        const data = {};

        runSchemaMigrations(data, chat);

        expect(data.graph).toBeDefined();
        expect(data.communities).toBeDefined();
        expect(data.graph_message_count).toBe(0);
    });

    it('sets schema_version to 2', () => {
        const data = {};
        runSchemaMigrations(data, chat);
        expect(data.schema_version).toBe(2);
    });

    it('returns true when migrations applied', () => {
        const data = { [PROCESSED_MESSAGES_KEY]: [0] };
        const result = runSchemaMigrations(data, chat);
        expect(result).toBe(true);
    });

    it('returns false when no changes needed', () => {
        const data = { schema_version: 2 };
        const result = runSchemaMigrations(data, chat);
        expect(result).toBe(false);
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest tests/store/migrations.test.js`
Expected: FAIL — embeddings not converted, graph not initialized

- [ ] Step 3: Export `encode` as `_migrateEncodeBase64` from embedding-codec.js

```javascript
// In src/utils/embedding-codec.js, keep encode as private but export with underscore prefix:
// Keep the original function private
function encode(vec) {
    const f32 = vec instanceof Float32Array ? vec : new Float32Array(vec);
    const bytes = new Uint8Array(f32.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Export with underscore prefix to signal it's for migrations only
export { encode as _migrateEncodeBase64 };
```

- [ ] Step 4: Implement full v2 migration logic

```javascript
// src/store/migrations/v2.js
import { MEMORIES_KEY, PROCESSED_MESSAGES_KEY } from '../../constants.js';
import { getFingerprint } from '../../extraction/scheduler.js';
import { _migrateEncodeBase64 } from '../../utils/embedding-codec.js';
import { createEmptyGraph } from '../../graph/graph.js';

/**
 * Parse ST's send_date into ms timestamp.
 * @param {string|number} sendDate
 * @returns {number}
 */
function parseSendDate(sendDate) {
    const val = String(sendDate);
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    return Date.parse(val) || 0;
}

/**
 * Migrate processed_message_ids from indices to fingerprints.
 * @param {Object} data - OpenVault data
 * @param {Array} chat - Chat messages
 * @returns {boolean} True if migrated
 */
function migrateProcessedMessages(data, chat) {
    const processed = data[PROCESSED_MESSAGES_KEY];
    if (!processed?.length || typeof processed[0] !== 'number') return false;

    const fps = new Set();

    // Temporal boundary: messages sent after last extraction are new
    const lastMemoryTime = Math.max(0, ...(data[MEMORIES_KEY] || []).map((m) => m.created_at || 0));

    // Migrate processed_message_ids indices
    for (const idx of processed) {
        const msg = chat[idx];
        if (!msg) continue;
        if (lastMemoryTime > 0 && msg.send_date) {
            const sendTime = parseSendDate(msg.send_date);
            if (sendTime && sendTime > lastMemoryTime) continue;
        }
        fps.add(getFingerprint(msg));
    }

    // Migrate memory.message_ids as safety net
    for (const memory of data[MEMORIES_KEY] || []) {
        for (const idx of memory.message_ids || []) {
            const msg = chat[idx];
            if (!msg) continue;
            if (lastMemoryTime > 0 && msg.send_date) {
                const sendTime = parseSendDate(msg.send_date);
                if (sendTime && sendTime > lastMemoryTime) continue;
            }
            fps.add(getFingerprint(msg));
        }
    }

    data[PROCESSED_MESSAGES_KEY] = Array.from(fps);
    delete data.last_processed_message_id;
    return true;
}

/**
 * Convert embedding arrays to Base64 strings.
 * @param {Object} data - OpenVault data
 * @returns {boolean} True if any conversion happened
 */
function migrateEmbeddings(data) {
    let converted = false;

    // Memories
    for (const mem of data[MEMORIES_KEY] || []) {
        if (mem.embedding && Array.isArray(mem.embedding)) {
            mem.embedding_b64 = _migrateEncodeBase64(mem.embedding);
            delete mem.embedding;
            converted = true;
        }
    }

    // Graph nodes
    for (const node of data.graph?.nodes || []) {
        if (node.embedding && Array.isArray(node.embedding)) {
            node.embedding_b64 = _migrateEncodeBase64(node.embedding);
            delete node.embedding;
            converted = true;
        }
    }

    // Communities (summaries may have embeddings)
    for (const key of Object.keys(data.communities || {})) {
        const comm = data.communities[key];
        if (comm?.summary_embedding && Array.isArray(comm.summary_embedding)) {
            comm.summary_embedding_b64 = _migrateEncodeBase64(comm.summary_embedding);
            delete comm.summary_embedding;
            converted = true;
        }
    }

    return converted;
}

/**
 * Ensure graph state exists (legacy backfill).
 * @param {Object} data - OpenVault data
 */
function initGraphState(data) {
    if (!data.graph) data.graph = createEmptyGraph();
    if (!data.communities) data.communities = {};
    if (data.graph_message_count == null) data.graph_message_count = 0;
}

/**
 * Run full v2 migration.
 * @param {Object} data - OpenVault data (mutated)
 * @param {Array} chat - Chat messages
 * @returns {boolean} True if any changes made
 */
export function migrateToV2(data, chat) {
    let changed = false;

    // 1. Migrate processed_message_ids
    if (migrateProcessedMessages(data, chat)) {
        changed = true;
    }

    // 2. Convert embeddings
    if (migrateEmbeddings(data)) {
        changed = true;
    }

    // 3. Initialize graph state
    initGraphState(data);

    return changed;
}
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/store/migrations.test.js`
Expected: PASS

- [ ] Step 6: Commit

```bash
git add -A && git commit -m "feat(migrations): implement v2 migration logic"
```

---

### Task 3: Add Session Kill-Switch to State

**Files:**
- Modify: `src/state.js`
- Test: `tests/state.test.js`

- [ ] Step 1: Write failing tests for session kill-switch

```javascript
// Add to tests/state.test.js
import { isSessionDisabled, setSessionDisabled } from '../src/state.js';

describe('Session Kill-Switch', () => {
    afterEach(() => {
        setSessionDisabled(false);
    });

    it('isSessionDisabled returns false by default', () => {
        expect(isSessionDisabled()).toBe(false);
    });

    it('setSessionDisabled toggles the flag', () => {
        setSessionDisabled(true);
        expect(isSessionDisabled()).toBe(true);
        setSessionDisabled(false);
        expect(isSessionDisabled()).toBe(false);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/state.test.js`
Expected: FAIL — `isSessionDisabled` not exported

- [ ] Step 3: Add session kill-switch to state.js

```javascript
// In src/state.js, add after the existing let declarations:

// Session-scoped disable flag for migration failures
// Unlike global settings, this only affects the current chat session
let _sessionDisabled = false;

/**
 * Check if OpenVault is disabled for the current session.
 * Used when schema migration fails to prevent further damage.
 * @returns {boolean}
 */
export function isSessionDisabled() {
    return _sessionDisabled;
}

/**
 * Set the session-scoped disabled flag.
 * @param {boolean} value
 */
export function setSessionDisabled(value) {
    _sessionDisabled = value;
}
```

- [ ] Step 4: Update resetSessionController to clear the flag

```javascript
// In src/state.js, modify resetSessionController:
export function resetSessionController() {
    _sessionController.abort();
    _sessionController = new AbortController();
    _sessionDisabled = false; // Reset kill-switch on chat change
}
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/state.test.js`
Expected: PASS

- [ ] Step 6: Commit

```bash
git add -A && git commit -m "feat(state): add session kill-switch for migration failures"
```

---

### Task 4: Update getOpenVaultData for v2 Schema

**Files:**
- Modify: `src/store/chat-data.js`
- Test: `tests/store/chat-data.test.js`

- [ ] Step 1: Write failing test for v2 schema on new chats

```javascript
// Add to tests/store/chat-data.test.js
describe('getOpenVaultData v2 schema', () => {
    it('creates complete v2 schema for new chats', () => {
        const data = getOpenVaultData();
        expect(data.schema_version).toBe(2);
        expect(data.memories).toEqual([]);
        expect(data.character_states).toEqual({});
        expect(data.graph).toBeDefined();
        expect(data.communities).toEqual({});
        expect(data.graph_message_count).toBe(0);
        expect(data.processed_message_ids).toEqual([]);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/store/chat-data.test.js -t "v2 schema"`
Expected: FAIL — `schema_version` is undefined

- [ ] Step 3: Update getOpenVaultData to create v2 schema

```javascript
// In src/store/chat-data.js, update the getOpenVaultData function:
import { CHARACTERS_KEY, MEMORIES_KEY, METADATA_KEY, PROCESSED_MESSAGES_KEY } from '../constants.js';
import { createEmptyGraph } from '../graph/graph.js';

export function getOpenVaultData() {
    const context = getDeps().getContext();
    if (!context) {
        logWarn('getContext() returned null/undefined');
        return null;
    }
    if (!context.chatMetadata) {
        context.chatMetadata = {};
    }
    if (!context.chatMetadata[METADATA_KEY]) {
        context.chatMetadata[METADATA_KEY] = {
            schema_version: 2,
            [MEMORIES_KEY]: [],
            [CHARACTERS_KEY]: {},
            [PROCESSED_MESSAGES_KEY]: [],
            graph: createEmptyGraph(),
            communities: {},
            graph_message_count: 0,
        };
    }
    const data = context.chatMetadata[METADATA_KEY];

    return data;
}
```

- [ ] Step 4: Import createEmptyGraph at the top of chat-data.js

```javascript
// Add import at the top of src/store/chat-data.js:
import { createEmptyGraph } from '../graph/graph.js';
```

- [ ] Step 5: Run tests to verify they pass

Run: `npx vitest tests/store/chat-data.test.js -t "v2 schema"`
Expected: PASS

- [ ] Step 6: Run all chat-data tests to ensure no regressions

Run: `npx vitest tests/store/chat-data.test.js`
Expected: PASS

- [ ] Step 7: Commit

```bash
git add -A && git commit -m "feat(chat-data): create complete v2 schema for new chats"
```

---

### Task 5: Wire Migration Pipeline in events.js

**Files:**
- Modify: `src/events.js`
- Test: `tests/events.test.js`

- [ ] Step 1: Write integration test for migration wiring

```javascript
// Add to tests/events.test.js (or create new describe block)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMORIES_KEY, METADATA_KEY, PROCESSED_MESSAGES_KEY, extensionName } from '../src/constants.js';
import { resetDeps, setDeps } from '../src/deps.js';
import { onChatChanged } from '../src/events.js';

describe('onChatChanged migration', () => {
    let mockContext;
    let mockConsole;

    beforeEach(() => {
        mockConsole = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
        mockContext = {
            chatMetadata: {},
            chat: [],
            chatId: 'test-chat',
            name1: 'User',
            name2: 'Assistant',
        };

        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: { enabled: true, embeddingSource: 'ollama' },
            }),
            saveChatConditional: vi.fn().mockResolvedValue(undefined),
            eventSource: { on: vi.fn(), removeListener: vi.fn(), makeFirst: vi.fn() },
            eventTypes: {},
            setTimeout: global.setTimeout,
            clearTimeout: global.clearTimeout,
            fetch: vi.fn().mockResolvedValue({ ok: true, json: () => ({ embedding: [0.1] }) }),
        });
    });

    afterEach(() => resetDeps());

    it('migrates v1 data and shows toast', async () => {
        // v1 data with index-based processed_message_ids
        mockContext.chatMetadata[METADATA_KEY] = {
            [PROCESSED_MESSAGES_KEY]: [0],
            [MEMORIES_KEY]: [],
        };
        mockContext.chat = [
            { mes: 'Hello', is_user: true, send_date: '1000000' },
        ];

        const mockToast = vi.fn();
        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: { enabled: true, embeddingSource: 'ollama' },
            }),
            saveChatConditional: vi.fn().mockResolvedValue(undefined),
            eventSource: { on: vi.fn(), removeListener: vi.fn(), makeFirst: vi.fn() },
            eventTypes: {},
            setTimeout: global.setTimeout,
            clearTimeout: global.clearTimeout,
            fetch: vi.fn().mockResolvedValue({ ok: true, json: () => ({ embedding: [0.1] }) }),
            showToast: mockToast,
        });

        await onChatChanged();

        // Should have migrated to fingerprint
        expect(mockContext.chatMetadata[METADATA_KEY].schema_version).toBe(2);
        expect(mockContext.chatMetadata[METADATA_KEY][PROCESSED_MESSAGES_KEY]).toContain('1000000');
        expect(mockToast).toHaveBeenCalledWith('info', expect.stringContaining('optimized'), expect.any(String));
    });

    it('rolls back on migration failure and sets session disabled', async () => {
        // Create malformed data that will fail migration
        mockContext.chatMetadata[METADATA_KEY] = {
            [PROCESSED_MESSAGES_KEY]: [0],
        };
        mockContext.chat = []; // Empty chat will cause issues

        const mockToast = vi.fn();
        setDeps({
            console: mockConsole,
            getContext: () => mockContext,
            getExtensionSettings: () => ({
                [extensionName]: { enabled: true, embeddingSource: 'ollama' },
            }),
            saveChatConditional: vi.fn().mockResolvedValue(undefined),
            eventSource: { on: vi.fn(), removeListener: vi.fn(), makeFirst: vi.fn() },
            eventTypes: {},
            setTimeout: global.setTimeout,
            clearTimeout: global.clearTimeout,
            fetch: vi.fn().mockResolvedValue({ ok: true, json: () => ({ embedding: [0.1] }) }),
            showToast: mockToast,
        });

        await onChatChanged();

        // Should NOT have schema_version (rolled back)
        expect(mockContext.chatMetadata[METADATA_KEY].schema_version).toBeUndefined();
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest tests/events.test.js -t "migration"`
Expected: FAIL — migration not wired yet

- [ ] Step 3: Wire migration pipeline in events.js

```javascript
// In src/events.js, update the imports:
import { runSchemaMigrations } from './store/migrations/index.js';
import { isSessionDisabled, setSessionDisabled } from './state.js';

// Remove the old migrateProcessedMessages import
// DELETE: import { migrateProcessedMessages } from './extraction/scheduler.js';

// In onChatChanged function, replace the migration block:
export async function onChatChanged() {
    if (!isExtensionEnabled()) return;

    // FIRST: abort all in-flight operations from previous chat
    resetSessionController();

    // ... existing cleanup code ...

    const data = getOpenVaultData();
    const context = getDeps().getContext();

    // Check session kill-switch
    if (isSessionDisabled()) {
        logDebug('OpenVault disabled for this session due to migration failure');
        return;
    }

    // Run schema migration if needed
    if (data && (!data.schema_version || data.schema_version < 2)) {
        const backup = structuredClone(data);

        try {
            const chat = context.chat || [];
            if (runSchemaMigrations(data, chat)) {
                showToast('info', 'OpenVault database optimized.', 'Data Migration');
                const { saveOpenVaultData } = await import('./store/chat-data.js');
                await saveOpenVaultData();
            }
        } catch (error) {
            // Rollback
            logError('Schema migration failed! Rolling back.', error);
            context.chatMetadata[METADATA_KEY] = backup;

            // Session kill-switch
            setSessionDisabled(true);
            showToast('error', 'Data migration failed. OpenVault disabled for this chat session.');
            return;
        }
    }

    // ... rest of onChatChanged (embedding migration, etc.) ...
}
```

- [ ] Step 4: Add session disabled guard to onBeforeGeneration

```javascript
// In src/events.js, at the start of onBeforeGeneration:
export async function onBeforeGeneration(type, _options, dryRun = false) {
    // Skip if disabled, manual mode, or dry run
    if (!isExtensionEnabled() || dryRun) {
        return;
    }

    // Skip if session disabled (migration failure)
    if (isSessionDisabled()) {
        logDebug('Skipping retrieval - session disabled due to migration failure');
        return;
    }

    // ... rest of function ...
}
```

- [ ] Step 5: Add session disabled guard to onMessageReceived

```javascript
// In src/events.js, at the start of onMessageReceived:
export async function onMessageReceived(messageId) {
    if (!isExtensionEnabled()) return;

    // Skip if session disabled (migration failure)
    if (isSessionDisabled()) {
        logDebug('Skipping extraction - session disabled due to migration failure');
        return;
    }

    // ... rest of function ...
}
```

- [ ] Step 6: Run tests to verify they pass

Run: `npx vitest tests/events.test.js -t "migration"`
Expected: PASS (may need test adjustments based on actual behavior)

- [ ] Step 7: Run all events tests

Run: `npx vitest tests/events.test.js`
Expected: PASS

- [ ] Step 8: Commit

```bash
git add -A && git commit -m "feat(events): wire migration pipeline with rollback"
```

---

### Task 6: Add Session Disabled Guards to Slash Commands

**Files:**
- Modify: `src/index.js`
- Test: Manual verification

- [ ] Step 1: Check for slash commands in index.js

Run: `grep -n "registerSlashCommand" src/index.js` to find the slash command handlers.

- [ ] Step 2: Add session disabled guard to each slash command

Find the slash command handlers (`/openvault-extract`, `/openvault-retrieve`, etc.) and add guards:

```javascript
// In each slash command handler in src/index.js:
import { isSessionDisabled } from './state.js';

// Example for extraction command:
async function handleExtractCommand() {
    if (isSessionDisabled()) {
        showToast('warning', 'OpenVault is disabled for this chat due to a data migration failure.');
        return;
    }
    // ... rest of handler
}

// Example for retrieve command:
async function handleRetrieveCommand() {
    if (isSessionDisabled()) {
        showToast('warning', 'OpenVault is disabled for this chat due to a data migration failure.');
        return;
    }
    // ... rest of handler
}
```

- [ ] Step 3: Run full test suite

Run: `npm run test`
Expected: PASS

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "feat(slash-commands): add session disabled guard"
```

---

### Task 7: Remove migrateProcessedMessages from scheduler.js

**Files:**
- Modify: `src/extraction/scheduler.js`
- Modify: `tests/scheduler.test.js`

- [ ] Step 1: Remove migrateProcessedMessages function from scheduler.js

Delete the entire `migrateProcessedMessages` function (approximately lines 36-75).

- [ ] Step 2: Remove migrateProcessedMessages tests from scheduler.test.js

Delete the `describe('migrateProcessedMessages', ...)` block from tests/scheduler.test.js.

- [ ] Step 3: Run scheduler tests to verify no regressions

Run: `npx vitest tests/scheduler.test.js`
Expected: PASS

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "refactor(scheduler): remove migrateProcessedMessages (moved to migrations)"
```

---

### Task 8: Remove Legacy Embedding Fallbacks

**Files:**
- Modify: `src/utils/embedding-codec.js`
- Test: `tests/utils/embedding-codec.test.js`

- [ ] Step 1: Write tests for stricter behavior (no legacy fallback)

```javascript
// Add to tests/utils/embedding-codec.test.js
describe('post-migration behavior (no legacy fallback)', () => {
    it('getEmbedding returns null for legacy array after migration', () => {
        // After v2 migration, all arrays should be converted to b64
        // This test documents the expected behavior when legacy data is gone
        const obj = {};
        setEmbedding(obj, [0.1, 0.2, 0.3]);
        expect(getEmbedding(obj)).toBeInstanceOf(Float32Array);

        // Manually setting legacy array should still work during transition
        obj.embedding = [0.4, 0.5];
        expect(getEmbedding(obj)).toBeInstanceOf(Float32Array);
        expect(getEmbedding(obj)[0]).toBeCloseTo(0.1, 5); // Prefers b64
    });
});
```

- [ ] Step 2: Verify tests pass (no changes needed yet)

Run: `npx vitest tests/utils/embedding-codec.test.js`
Expected: PASS

- [ ] Step 3: Document in comments that legacy fallback is for transition only

```javascript
// In src/utils/embedding-codec.js, update getEmbedding:
export function getEmbedding(obj) {
    if (!obj) return null;
    if (obj.embedding_b64) return decode(obj.embedding_b64);
    // Legacy fallback: only needed during transition from v1 to v2
    // After all chats are migrated, this branch can be removed
    if (obj.embedding && obj.embedding.length > 0) return new Float32Array(obj.embedding);
    return null;
}
```

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "docs(embedding-codec): document legacy fallback as transitional"
```

---

### Task 9: Remove initGraphState Calls from extract.js

**Files:**
- Modify: `src/extraction/extract.js`
- Modify: `src/graph/graph.js`
- Test: `tests/extraction/extract.test.js`

- [ ] Step 1: Remove initGraphState from extract.js imports

```javascript
// In src/extraction/extract.js, update the import from graph.js:
import {
    consolidateEdges,
    expandMainCharacterKeys,
    findCrossScriptCharacterKeys,
    normalizeKey,
    upsertRelationship,
    mergeOrInsertEntity,
} from '../graph/graph.js';

// Remove initGraphState from the import
```

- [ ] Step 2: Remove initGraphState calls from extract.js

Search for and delete all calls to `initGraphState(data)` in extract.js (should be 3 calls).

- [ ] Step 3: Remove export from graph.js (keep function internal)

```javascript
// In src/graph/graph.js, change:
// export function initGraphState(data) {
// TO:
function initGraphState(data) {
    if (!data.graph) data.graph = createEmptyGraph();
    if (!data.communities) data.communities = {};
    if (!data.reflection_state) data.reflection_state = {};
    if (data.graph_message_count == null) data.graph_message_count = 0;
}
```

- [ ] Step 4: Run extraction tests to verify no regressions

Run: `npx vitest tests/extraction/extract.test.js`
Expected: PASS

- [ ] Step 5: Run full test suite

Run: `npm run test`
Expected: All tests PASS

- [ ] Step 6: Commit

```bash
git add -A && git commit -m "refactor(extract): remove initGraphState calls (repository guarantees shape)"
```

---

### Task 10: Verification and Cleanup

- [ ] Step 1: Run verification searches

```bash
grep -r "obj.embedding &&" src/
# Expected: 2 matches in embedding-codec.js (transitional fallbacks)

grep -r "initGraphState" src/
# Expected: 0 matches (removed from extract.js, unexported in graph.js)
```

- [ ] Step 2: Run full test suite

Run: `npm run test`
Expected: All tests PASS

- [ ] Step 3: Manual verification (if possible)

1. Find old SillyTavern chat with v1 data (raw embedding arrays)
2. Load the chat
3. Verify "OpenVault database optimized" toast appears
4. Inspect `chatMetadata.openvault`:
   - `schema_version: 2`
   - `processed_message_ids` contains string fingerprints
   - Embeddings are `embedding_b64` strings

- [ ] Step 4: Commit any final fixes

```bash
git add -A && git commit -m "fix: address any remaining migration issues"
```

---

## Summary

After completing this plan:

1. **New chats** get complete v2 schema from `getOpenVaultData()`
2. **Legacy chats** are migrated on load with transactional rollback
3. **Migration failures** disable OpenVault for that chat session only
4. **Code is cleaner** — no scattered `initGraphState` calls, no lazy migration in codec
5. **Future migrations** follow the same pattern: create `v3.js`, add to `MIGRATIONS` array