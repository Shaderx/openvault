# Test Creep Triage Part 2: Pyramid Enforcement & Fixture Isolation

**Goal:** Eliminate test overlap between orchestrator integration tests and unit tests, decouple test state via factory builders, and reduce `extract.test.js` and `retrieve.test.js` to pipeline-wiring-only assertions.

**Architecture:** Move pure-function tests (character states, event deduplication) out of orchestrator test files into dedicated unit test files. Create factory builder functions (`tests/factories.js`) that produce valid default objects, replacing reliance on shared `mockData`. Prune orchestrator tests to exactly 3 `extractMemories` variations + 2 `runPhase2Enrichment` tests and 3 `retrieve` tests.

**Tech Stack:** Vitest, JSDOM, ESM imports

---

### Task 1: Create `tests/factories.js`

**Files:**
- Create: `tests/factories.js`

Factory builder functions that return valid default objects. Every test that needs a memory or graph node can call these instead of constructing incomplete ad-hoc objects.

- [ ] Step 1: Write the factory file

```javascript
// tests/factories.js

let _counter = 0;

/**
 * Build a valid mock memory object with sensible defaults.
 * Override any field via the overrides parameter.
 * @param {Object} overrides - Fields to override
 * @returns {Object} A complete memory object
 */
export function buildMockMemory(overrides = {}) {
    _counter++;
    return {
        id: `mem_${_counter}`,
        type: 'event',
        summary: `Default memory summary ${_counter}`,
        importance: 3,
        sequence: _counter * 1000,
        characters_involved: ['Alice', 'Bob'],
        witnesses: ['Alice', 'Bob'],
        message_ids: [_counter],
        is_secret: false,
        ...overrides,
    };
}

/**
 * Build a valid mock graph node.
 * @param {Object} overrides - Fields to override
 * @returns {Object} A complete graph node
 */
export function buildMockGraphNode(overrides = {}) {
    return {
        name: 'Default Node',
        type: 'PERSON',
        description: 'Default description',
        mentions: 1,
        ...overrides,
    };
}

/**
 * Build a minimal OpenVault data structure.
 * @param {Object} overrides - Fields to override
 * @returns {Object} A valid openvault data object
 */
export function buildMockData(overrides = {}) {
    return {
        memories: [],
        character_states: {},
        last_processed_message_id: -1,
        processed_message_ids: [],
        ...overrides,
    };
}

/**
 * Reset the counter (call in afterEach if IDs must be deterministic).
 */
export function resetFactoryCounter() {
    _counter = 0;
}
```

- [ ] Step 2: Verify the module loads without errors

Run: `node -e "import('./tests/factories.js').then(m => { const mem = m.buildMockMemory({importance: 5}); console.log(JSON.stringify(mem)); process.exit(mem.importance === 5 ? 0 : 1) })"`

Expected: JSON output with `importance: 5` and all default fields present. Exit code 0.

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "feat(tests): add factory builder functions for test fixtures"
```

---

### Task 2: Create `tests/extraction/character-states.test.js`

**Files:**
- Create: `tests/extraction/character-states.test.js`

Move the `updateCharacterStatesFromEvents` (7 tests) and `cleanupCharacterStates` (4 tests) describe blocks out of `extract.test.js`. These are pure data-transformation functions — they take plain objects and mutate them. No `setupTestContext` or LLM mocks needed.

- [ ] Step 1: Write the test file

```javascript
import { describe, expect, it } from 'vitest';
import {
    cleanupCharacterStates,
    updateCharacterStatesFromEvents,
} from '../../src/extraction/extract.js';
import { buildMockData } from '../factories.js';

describe('updateCharacterStatesFromEvents', () => {
    it('creates character states for valid characters in emotional_impact', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                emotional_impact: { 'King Aldric': 'triumphant' },
                message_ids: [1, 2],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states['King Aldric'].current_emotion).toBe('triumphant');
    });

    it('skips invalid character names in emotional_impact', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                emotional_impact: {
                    'King Aldric': 'triumphant',
                    don: 'angry',
                },
                message_ids: [1, 2],
                characters_involved: ['King Aldric'],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.don).toBeUndefined();
    });

    it('creates character states for valid characters in witnesses', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                witnesses: ['King Aldric', 'User'],
                characters_involved: ['King Aldric', 'User'],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.User).toBeDefined();
        expect(data.character_states['King Aldric'].known_events).toContain('event_1');
    });

    it('skips invalid character names in witnesses', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                witnesses: ['King Aldric', 'Stranger'],
                characters_involved: ['King Aldric'],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.Stranger).toBeUndefined();
    });

    it('allows characters from characters_involved even if not in validCharNames', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                emotional_impact: { Queen: 'worried' },
                characters_involved: ['Queen'],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['King Aldric', 'User']);

        expect(data.character_states.Queen).toBeDefined();
        expect(data.character_states.Queen.current_emotion).toBe('worried');
    });

    it('accepts Cyrillic witness name matching Latin characters_involved via transliteration', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                characters_involved: ['Mina'],
                witnesses: ['\u041c\u0438\u043d\u0430'],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['Suzy', 'Vova']);

        expect(data.character_states['\u041c\u0438\u043d\u0430']).toBeDefined();
        expect(data.character_states['\u041c\u0438\u043d\u0430'].known_events).toContain('event_1');
    });

    it('accepts Cyrillic emotional_impact name matching Latin validCharNames via transliteration', () => {
        const data = buildMockData();
        const events = [
            {
                id: 'event_1',
                emotional_impact: { '\u041c\u0438\u043d\u0430': 'surprised' },
                characters_involved: ['Mina'],
                message_ids: [1],
            },
        ];

        updateCharacterStatesFromEvents(events, data, ['Suzy', 'Vova']);

        expect(data.character_states['\u041c\u0438\u043d\u0430']).toBeDefined();
        expect(data.character_states['\u041c\u0438\u043d\u0430'].current_emotion).toBe('surprised');
    });
});

describe('cleanupCharacterStates', () => {
    it('removes character states not in validCharNames or memories', () => {
        const data = buildMockData({
            character_states: {
                'King Aldric': { name: 'King Aldric', current_emotion: 'neutral' },
                User: { name: 'User', current_emotion: 'neutral' },
                Stranger: { name: 'Stranger', current_emotion: 'angry' },
            },
        });

        cleanupCharacterStates(data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.User).toBeDefined();
        expect(data.character_states.Stranger).toBeUndefined();
    });

    it('keeps character states found in memories characters_involved', () => {
        const data = buildMockData({
            character_states: {
                'King Aldric': { name: 'King Aldric', current_emotion: 'neutral' },
                Queen: { name: 'Queen', current_emotion: 'worried' },
                Stranger: { name: 'Stranger', current_emotion: 'angry' },
            },
            memories: [{ characters_involved: ['King Aldric', 'Queen'] }],
        });

        cleanupCharacterStates(data, ['King Aldric', 'User']);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.Queen).toBeDefined();
        expect(data.character_states.Stranger).toBeUndefined();
    });

    it('handles empty character_states gracefully', () => {
        const data = buildMockData();

        expect(() => cleanupCharacterStates(data, ['King Aldric', 'User'])).not.toThrow();
    });

    it('handles missing validCharNames', () => {
        const data = buildMockData({
            character_states: {
                'King Aldric': { name: 'King Aldric', current_emotion: 'neutral' },
                Queen: { name: 'Queen', current_emotion: 'worried' },
            },
            memories: [{ characters_involved: ['King Aldric'] }],
        });

        cleanupCharacterStates(data, []);

        expect(data.character_states['King Aldric']).toBeDefined();
        expect(data.character_states.Queen).toBeUndefined();
    });
});
```

- [ ] Step 2: Run to verify all 11 tests pass

Run: `npx vitest run tests/extraction/character-states.test.js -v`

Expected: 11 tests PASS (7 for updateCharacterStatesFromEvents + 4 for cleanupCharacterStates)

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "test: move character-state tests to dedicated unit test file"
```

---

### Task 3: Create `tests/extraction/dedup.test.js`

**Files:**
- Create: `tests/extraction/dedup.test.js`

Move the `filterSimilarEvents` describe blocks (8 tests across 3 suites) out of `extract.test.js`. These are pure async functions that take arrays of event objects — no `setupTestContext` or LLM mocks needed.

- [ ] Step 1: Write the test file

```javascript
import { describe, expect, it } from 'vitest';
import { filterSimilarEvents } from '../../src/extraction/extract.js';

describe('filterSimilarEvents - intra-batch Jaccard dedup', () => {
    it('deduplicates semantically similar events within the same batch using Jaccard similarity', async () => {
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
            },
            {
                summary: 'Suzy proposed daily morning training sessions with warmup drills for Vova',
                embedding: [0.1, 0.9],
            },
            { summary: 'Vova went to the store to buy groceries', embedding: [0.5, 0.5] },
        ];
        const existingMemories = [];

        const result = await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);

        expect(result).toHaveLength(2);
        expect(result[0].summary).toContain('starting at seven');
        expect(result[1].summary).toContain('groceries');
    });

    it('does not Jaccard-dedup events with low token overlap', async () => {
        const newEvents = [
            { summary: 'Suzy proposed training sessions for morning warmup', embedding: [0.9, 0.1] },
            { summary: 'Vova cooked dinner for the family at home', embedding: [0.1, 0.9] },
        ];

        const result = await filterSimilarEvents(newEvents, [], 0.85, 0.6);

        expect(result).toHaveLength(2);
    });
});

describe('filterSimilarEvents - CPU yielding', () => {
    it('still correctly filters events (yielding does not break logic)', async () => {
        const events = [
            { summary: 'King Aldric declared war on the rebels', embedding: [1, 0, 0] },
            { summary: 'Sera secretly met with the rebel leader', embedding: [0, 1, 0] },
            { summary: 'King Aldric declared war on the rebels today', embedding: [0.99, 0.01, 0] },
        ];
        const existing = [{ summary: 'Old memory about something else', embedding: [0, 0, 1] }];

        const result = await filterSimilarEvents(events, existing, 0.92, 0.6);

        expect(result.length).toBeLessThanOrEqual(2);
    });
});

describe('filterSimilarEvents - mentions increment on dedup', () => {
    it('increments mentions on existing memory during cross-batch dedup', async () => {
        const existingMemories = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
                mentions: 1,
            },
        ];
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.91, 0.11],
            },
        ];

        await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);

        expect(existingMemories[0].mentions).toBe(2);
    });

    it('increments mentions from undefined (defaults to 1, then becomes 2)', async () => {
        const existingMemories = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
            },
        ];
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.91, 0.11],
            },
        ];

        await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);

        expect(existingMemories[0].mentions).toBe(2);
    });

    it('increments mentions on kept event during intra-batch dedup', async () => {
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
            },
            {
                summary: 'Suzy proposed daily morning training sessions with warmup drills for Vova',
                embedding: [0.1, 0.9],
            },
        ];

        const result = await filterSimilarEvents(newEvents, [], 0.85, 0.6);

        expect(result).toHaveLength(1);
        expect(result[0].mentions).toBe(2);
    });

    it('accumulates mentions across multiple cross-batch dedup matches', async () => {
        const existingMemories = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
                mentions: 3,
            },
        ];
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.91, 0.11],
            },
        ];

        await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);

        expect(existingMemories[0].mentions).toBe(4);
    });

    it('does not change mentions when no duplicates found', async () => {
        const existingMemories = [
            {
                summary: 'Vova went shopping for food at the market',
                embedding: [0.1, 0.9],
                mentions: 1,
            },
        ];
        const newEvents = [
            {
                summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                embedding: [0.9, 0.1],
            },
        ];

        await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);

        expect(existingMemories[0].mentions).toBe(1);
    });
});
```

- [ ] Step 2: Run to verify all 8 tests pass

Run: `npx vitest run tests/extraction/dedup.test.js -v`

Expected: 8 tests PASS (2 + 1 + 5)

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "test: move filterSimilarEvents tests to dedicated unit test file"
```

---

### Task 4: Take coverage baseline

**Files:**
- None (measurement only)

Before deleting any tests, record the current coverage to compare against after pruning.

- [ ] Step 1: Run coverage and save baseline

Run: `npx vitest run --coverage 2>&1 | tee /tmp/coverage-baseline.txt`

Expected: Coverage report generated. Note the line coverage percentages for `src/extraction/extract.js` and `src/retrieval/retrieve.js`.

- [ ] Step 2: Record baseline numbers

Write down the coverage for:
- `src/extraction/extract.js` — lines, branches, functions
- `src/retrieval/retrieve.js` — lines, branches, functions

---

### Task 5: Prune `extract.test.js` to 5 pipeline integration tests

**Files:**
- Modify: `tests/extraction/extract.test.js`

Delete all moved tests (character states, dedup) and all redundant `extractMemories` permutation tests. Keep exactly 3 `extractMemories` tests (happy path, graceful degradation, fast-fail) + 2 `runPhase2Enrichment` tests.

**Tests to DELETE:**
- `describe('extractMemories graph integration')` — consolidated into happy path
- `describe('extractMemories reflection integration')` — consolidated into happy path
- `describe('extractMemories community detection')` — boundary logic tested at lower level
- `describe('updateCharacterStatesFromEvents')` — moved to character-states.test.js
- `describe('cleanupCharacterStates')` — moved to character-states.test.js
- `describe('filterSimilarEvents - intra-batch Jaccard dedup')` — moved to dedup.test.js
- `describe('CPU yielding in filterSimilarEvents')` — moved to dedup.test.js
- `describe('filterSimilarEvents — mentions increment on dedup')` — moved to dedup.test.js
- `describe('RPM delay between LLM calls')` — implementation detail
- `describe('extractMemories backfill mode integration')` — implementation detail
- From `describe('two-phase extraction')`: all except graceful degradation test
- From `describe('extractMemories AbortError propagation')`: keep only Phase 1 abort test

- [ ] Step 1: Replace the entire file with pruned content

Replace `tests/extraction/extract.test.js` with the following (the file retains the shared helpers at the top and 5 focused tests):

```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/constants.js';
import { resetDeps } from '../../src/deps.js';
import { extractMemories, runPhase2Enrichment } from '../../src/extraction/extract.js';

/**
 * Standard LLM response data for extraction tests.
 * Events stage returns 1 event; Graph stage returns 2 entities + 1 relationship.
 */
const EXTRACTION_RESPONSES = {
    events: JSON.stringify({
        reasoning: null,
        events: [
            {
                summary: 'King Aldric entered the Castle and surveyed the hall',
                importance: 3,
                characters_involved: ['King Aldric'],
                witnesses: ['King Aldric'],
                location: 'Castle',
                is_secret: false,
                emotional_impact: {},
                relationship_impact: {},
            },
        ],
    }),
    graph: JSON.stringify({
        entities: [
            { name: 'King Aldric', type: 'PERSON', description: 'The aging ruler' },
            { name: 'Castle', type: 'PLACE', description: 'An ancient fortress' },
        ],
        relationships: [{ source: 'King Aldric', target: 'Castle', description: 'Rules from' }],
    }),
};

/**
 * Create a sendRequest mock with sequential LLM responses.
 * @param  {...{content: string}} extraResponses - Additional responses after events+graph
 */
function mockSendRequest(...extraResponses) {
    const fn = vi
        .fn()
        .mockResolvedValueOnce({ content: EXTRACTION_RESPONSES.events })
        .mockResolvedValueOnce({ content: EXTRACTION_RESPONSES.graph });
    for (const resp of extraResponses) {
        fn.mockResolvedValueOnce(resp);
    }
    return fn;
}

/**
 * Standard test settings for extraction tests.
 */
function getExtractionSettings() {
    return {
        ...defaultSettings,
        extractionProfile: 'test-profile',
        embeddingSource: 'ollama',
        ollamaUrl: 'http://test:11434',
        embeddingModel: 'test-model',
        backfillMaxRPM: 99999,
    };
}

/**
 * Standard connection manager mock for extraction tests.
 */
function getMockConnectionManager(sendRequest) {
    return {
        selectedProfile: 'test-profile',
        profiles: [{ id: 'test-profile', name: 'Test' }],
        sendRequest,
    };
}

// ── extractMemories pipeline integration (3 tests) ──

describe('extractMemories pipeline', () => {
    let mockContext;
    let mockData;

    beforeEach(() => {
        mockData = {
            memories: [],
            character_states: {},
            last_processed_message_id: -1,
            processed_message_ids: [],
        };

        mockContext = {
            chat: [
                { mes: 'Hello', is_user: true, name: 'User' },
                { mes: 'Welcome to the Castle', is_user: false, name: 'King Aldric' },
            ],
            name1: 'User',
            name2: 'King Aldric',
            characterId: 'char1',
            characters: { char1: { description: '' } },
            chatMetadata: { openvault: mockData },
            chatId: 'test-chat',
            powerUserSettings: {},
        };

        setupTestContext({
            context: mockContext,
            settings: getExtractionSettings(),
            deps: {
                connectionManager: getMockConnectionManager(mockSendRequest()),
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.1, 0.2] }),
                })),
                saveChatConditional: vi.fn(async () => true),
            },
        });
    });

    afterEach(() => {
        resetDeps();
        vi.clearAllMocks();
    });

    it('happy path: events + graph + reflection state populated', async () => {
        const result = await extractMemories([0, 1]);

        expect(result.status).toBe('success');

        // Events created with correct type
        expect(mockData.memories.length).toBeGreaterThan(0);
        for (const memory of mockData.memories) {
            expect(memory.type).toBe('event');
        }

        // Graph populated
        expect(mockData.graph).toBeDefined();
        expect(mockData.graph.nodes['king aldric']).toBeDefined();
        expect(mockData.graph.nodes['king aldric'].type).toBe('PERSON');
        expect(mockData.graph.nodes.castle).toBeDefined();
        expect(mockData.graph.edges['king aldric__castle']).toBeDefined();
        expect(mockData.graph_message_count).toBeGreaterThan(0);

        // Reflection state accumulated
        expect(mockData.reflection_state).toBeDefined();
        expect(mockData.reflection_state['King Aldric']).toBeDefined();
        expect(mockData.reflection_state['King Aldric'].importance_sum).toBeGreaterThan(0);

        // Processed message IDs tracked
        expect(mockData.processed_message_ids.length).toBeGreaterThan(0);
    });

    it('graceful degradation: Phase 1 saves despite Phase 2 reflection failure', async () => {
        mockData.reflection_state = { 'King Aldric': { importance_sum: 100 } };

        const sendRequest = mockSendRequest();
        sendRequest.mockRejectedValueOnce(new Error('Reflection API down'));
        setupTestContext({
            context: mockContext,
            settings: getExtractionSettings(),
            deps: {
                connectionManager: getMockConnectionManager(sendRequest),
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.1, 0.2] }),
                })),
                saveChatConditional: vi.fn(async () => true),
            },
        });

        const result = await extractMemories([0, 1]);

        expect(result.status).toBe('success');
        expect(result.events_created).toBeGreaterThan(0);
        expect(mockData.memories.length).toBeGreaterThan(0);
        expect(mockData.processed_message_ids.length).toBeGreaterThan(0);
    });

    it('fast-fail: Phase 1 AbortError propagates without saving', async () => {
        const sendRequest = vi.fn().mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
        setupTestContext({
            context: mockContext,
            settings: getExtractionSettings(),
            deps: {
                connectionManager: getMockConnectionManager(sendRequest),
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.1, 0.2] }),
                })),
                saveChatConditional: vi.fn(async () => true),
            },
        });

        await expect(extractMemories([0, 1], 'test-chat')).rejects.toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });
});

// ── runPhase2Enrichment pipeline (2 tests) ──

describe('runPhase2Enrichment', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = {
            chat: [
                { mes: 'Hello', is_user: true, name: 'User' },
                { mes: 'Welcome to the Castle', is_user: false, name: 'King Aldric' },
            ],
            name1: 'User',
            name2: 'King Aldric',
            characterId: 'char1',
            characters: { char1: { description: '' } },
            chatId: 'test-chat',
            powerUserSettings: {},
        };
    });

    afterEach(() => {
        resetDeps();
        vi.clearAllMocks();
    });

    it('processes characters with accumulated importance', async () => {
        const reflectionResponse = JSON.stringify({
            reflections: [
                {
                    question: 'What defines King Aldric?',
                    insight: 'King Aldric has been ruling with wisdom',
                    evidence_ids: ['event_1', 'event_2'],
                },
            ],
        });
        const communityResponse = JSON.stringify({ communities: [] });

        const sendRequest = vi
            .fn()
            .mockResolvedValueOnce({ content: reflectionResponse })
            .mockResolvedValueOnce({ content: communityResponse });

        setupTestContext({
            context: mockContext,
            settings: { ...getExtractionSettings(), reflectionThreshold: 40 },
            deps: {
                connectionManager: getMockConnectionManager(sendRequest),
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.1, 0.2] }),
                })),
                saveChatConditional: vi.fn(async () => true),
            },
        });

        const mockDataWithState = {
            memories: [
                { id: 'event_1', type: 'event', summary: 'Test event 1', importance: 5, tokens: ['test'], message_ids: [0], sequence: 0, characters_involved: ['King Aldric'], witnesses: ['King Aldric'], embedding_b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
                { id: 'event_2', type: 'event', summary: 'Test event 2', importance: 5, tokens: ['test'], message_ids: [1], sequence: 1, characters_involved: ['King Aldric'], witnesses: ['King Aldric'], embedding_b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
                { id: 'event_3', type: 'event', summary: 'Test event 3', importance: 5, tokens: ['test'], message_ids: [2], sequence: 2, characters_involved: ['King Aldric'], witnesses: ['King Aldric'], embedding_b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
            ],
            reflection_state: { 'King Aldric': { importance_sum: 45 } },
            graph: { nodes: {}, edges: {}, _mergeRedirects: {} },
            graph_message_count: 100,
            character_states: {},
        };

        const initialLength = mockDataWithState.memories.length;
        await runPhase2Enrichment(mockDataWithState, getExtractionSettings(), null);

        expect(mockDataWithState.memories.length).toBeGreaterThan(initialLength);
        const reflection = mockDataWithState.memories.find((m) => m.type === 'reflection');
        expect(reflection).toBeDefined();
        expect(reflection.summary).toContain('King Aldric');
    });

    it('returns early if no memories exist', async () => {
        const sendRequest = vi.fn();
        setupTestContext({
            context: mockContext,
            settings: getExtractionSettings(),
            deps: {
                connectionManager: getMockConnectionManager(sendRequest),
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.1, 0.2] }),
                })),
                saveChatConditional: vi.fn(async () => true),
            },
        });

        const emptyData = {
            memories: [],
            reflection_state: {},
            graph: { nodes: {}, edges: {} },
        };

        await runPhase2Enrichment(emptyData, getExtractionSettings(), null);

        expect(sendRequest).not.toHaveBeenCalled();
    });
});
```

- [ ] Step 2: Run pruned tests to verify all 5 pass

Run: `npx vitest run tests/extraction/extract.test.js -v`

Expected: 5 tests PASS (3 extractMemories pipeline + 2 runPhase2Enrichment)

- [ ] Step 3: Run all extraction tests together to verify no broken imports

Run: `npx vitest run tests/extraction/ -v`

Expected: All tests pass across `extract.test.js`, `character-states.test.js`, `dedup.test.js`, `worker.test.js`, `structured.test.js`

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "refactor(tests): prune extract.test.js to 5 pipeline integration tests

Delete all character-state, dedup, community-detection, RPM-delay,
and backfill-mode permutation tests from the orchestrator suite.
These are now covered by dedicated unit test files."
```

---

### Task 6: Prune `retrieve.test.js` to 3 pipeline integration tests

**Files:**
- Modify: `tests/retrieval/retrieve.test.js`

Keep 3 tests: happy path (events + reflections injected), empty state (no memories), and macro intent routing. Delete the `updateInjection world context` suite (community-based world context is tested in `world-context.test.js`) and the extra macro-intent permutation tests.

- [ ] Step 1: Replace the entire file with pruned content

```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, extensionName } from '../../src/constants.js';
import { resetDeps } from '../../src/deps.js';
import { updateInjection } from '../../src/retrieval/retrieve.js';

describe('retrieve pipeline', () => {
    let mockSetPrompt;

    afterEach(() => {
        resetDeps();
        vi.clearAllMocks();
    });

    it('happy path: includes both events and reflections in injected context', async () => {
        mockSetPrompt = vi.fn();

        setupTestContext({
            deps: {
                getContext: () => ({
                    chat: [
                        { mes: 'Hello', is_user: true, is_system: true },
                        { mes: 'Hi', is_user: false, is_system: false },
                    ],
                    name1: 'User',
                    name2: 'Alice',
                    chatMetadata: {
                        openvault: {
                            memories: [
                                {
                                    id: 'ev1',
                                    type: 'event',
                                    summary: 'Alice explored the ancient library',
                                    importance: 3,
                                    message_ids: [0],
                                    characters_involved: ['Alice'],
                                    witnesses: ['Alice'],
                                    is_secret: false,
                                    embedding: [0.5, 0.5],
                                },
                                {
                                    id: 'ref1',
                                    type: 'reflection',
                                    summary: 'Alice fears abandonment deeply',
                                    importance: 4,
                                    characters_involved: ['Alice'],
                                    witnesses: ['Alice'],
                                    is_secret: false,
                                    character: 'Alice',
                                    source_ids: ['ev1'],
                                    embedding: [0.5, 0.5],
                                },
                            ],
                            character_states: { Alice: { name: 'Alice', known_events: ['ev1'] } },
                            graph: { nodes: {}, edges: {} },
                            communities: {},
                        },
                    },
                    chatId: 'test-chat',
                }),
                getExtensionSettings: () => ({
                    [extensionName]: {
                        ...defaultSettings,
                        enabled: true,
                        embeddingSource: 'ollama',
                        ollamaUrl: 'http://test:11434',
                        embeddingModel: 'test-model',
                    },
                }),
                setExtensionPrompt: mockSetPrompt,
                extension_prompt_types: { IN_PROMPT: 0 },
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.5, 0.5] }),
                })),
            },
        });

        await updateInjection();

        const memoryCall = mockSetPrompt.mock.calls.find((c) => c[0] === extensionName);
        expect(memoryCall).toBeDefined();
        const injectedText = memoryCall[1];
        expect(injectedText).toContain('ancient library');
        expect(injectedText).toContain('abandonment');
    });

    it('empty state: no memories produces empty injection', async () => {
        mockSetPrompt = vi.fn();

        setupTestContext({
            context: {
                chat: [
                    { mes: 'Hello', is_user: true, is_system: true },
                    { mes: 'Hi', is_user: false, is_system: false },
                ],
                chatMetadata: {
                    openvault: {
                        memories: [],
                        character_states: {},
                        communities: {},
                    },
                },
                chatId: 'test-chat',
            },
            settings: {
                enabled: true,
                embeddingSource: 'ollama',
                ollamaUrl: 'http://test:11434',
                embeddingModel: 'test-model',
            },
            deps: {
                setExtensionPrompt: mockSetPrompt,
                extension_prompt_types: { IN_PROMPT: 0 },
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.5, 0.5] }),
                })),
            },
        });

        await updateInjection();

        // With no memories, setExtensionPrompt is called with empty string
        const memoryCall = mockSetPrompt.mock.calls.find(
            (c) => c[0] === extensionName && c[1] === ''
        );
        expect(memoryCall).toBeDefined();
    });

    it('macro intent: summarize request uses global state injection', async () => {
        mockSetPrompt = vi.fn();

        setupTestContext({
            context: {
                chat: [
                    { mes: 'Previous context', is_user: true, is_system: true },
                    { mes: 'Summarize the story so far', is_user: true, is_system: false },
                ],
                chatMetadata: {
                    openvault: {
                        memories: [
                            {
                                id: 'ev1',
                                type: 'event',
                                summary: 'Test memory',
                                importance: 3,
                                message_ids: [0],
                                characters_involved: ['Alice'],
                                witnesses: ['Alice'],
                                is_secret: false,
                                embedding: [0.5, 0.5],
                            },
                        ],
                        character_states: { Alice: { name: 'Alice', known_events: ['ev1'] } },
                        global_world_state: {
                            summary: 'Test global state - the story has progressed through several chapters',
                            last_updated: Date.now(),
                            community_count: 2,
                        },
                        communities: {
                            C0: {
                                title: 'Royal Court',
                                summary: 'The seat of power',
                                findings: ['The king rules wisely'],
                                embedding: [0.5, 0.5],
                                nodeKeys: ['alice'],
                            },
                        },
                        graph: { nodes: {}, edges: {} },
                    },
                },
                chatId: 'test-chat',
                name2: 'Alice',
            },
            settings: {
                enabled: true,
                embeddingSource: 'ollama',
                ollamaUrl: 'http://test:11434',
                embeddingModel: 'test-model',
            },
            deps: {
                setExtensionPrompt: mockSetPrompt,
                extension_prompt_types: { IN_PROMPT: 0 },
                fetch: vi.fn(async () => ({
                    ok: true,
                    json: async () => ({ embedding: [0.5, 0.5] }),
                })),
            },
        });

        const { retrieveAndInjectContext } = await import('../../src/retrieval/retrieve.js');
        await retrieveAndInjectContext();

        const worldCall = mockSetPrompt.mock.calls.find((c) => c[0] === 'openvault_world');
        expect(worldCall).toBeDefined();
        expect(worldCall[1]).toContain('world_context');
        expect(worldCall[1]).toContain('Test global state');
    });
});
```

- [ ] Step 2: Run pruned tests to verify all 3 pass

Run: `npx vitest run tests/retrieval/retrieve.test.js -v`

Expected: 3 tests PASS

- [ ] Step 3: Run all retrieval tests together

Run: `npx vitest run tests/retrieval/ -v`

Expected: All tests pass across all retrieval test files

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "refactor(tests): prune retrieve.test.js to 3 pipeline integration tests

Delete world-context permutation tests (covered in world-context.test.js)
and extra macro-intent variations. Keep: happy path, empty state, macro intent."
```

---

### Task 7: Coverage gate — verify no regression

**Files:**
- None (measurement only)

Compare coverage against the baseline from Task 4. If line coverage drops for any source file, a test was deleted that covered code not reached by the remaining unit tests.

- [ ] Step 1: Run coverage

Run: `npx vitest run --coverage 2>&1 | tee /tmp/coverage-after.txt`

Expected: Coverage report generated.

- [ ] Step 2: Compare against baseline

Compare `src/extraction/extract.js` and `src/retrieval/retrieve.js` line/branch/function coverage against the numbers recorded in Task 4.

- If coverage is **equal or higher**: proceed to Task 8.
- If coverage **dropped**: identify the uncovered lines. Write a parameterized unit test in the appropriate unit test file (`character-states.test.js`, `dedup.test.js`, `math.test.js`, or `scoring.test.js`) to restore coverage. Then re-run coverage and confirm it matches baseline.

- [ ] Step 3: Commit any coverage-restoring tests (if needed)

```bash
git add -A && git commit -m "test: restore coverage for lines exposed by orchestrator pruning"
```

---

### Task 8: Refactor `pov.test.js` to eliminate `setupTestContext` for pure functions

**Files:**
- Modify: `tests/pov.test.js`

The `filterMemoriesByPOV` function is pure — it takes `(memories, povCharacters, data)` directly and never calls `getDeps()`. Currently it inherits a `setupTestContext` call from the parent `describe('pov')` `beforeEach`. Restructure the file so only the functions that actually need ST context mocking (`getActiveCharacters`, `detectPresentCharactersFromMessages`, `getPOVContext`) use `setupTestContext`.

- [ ] Step 1: Restructure `pov.test.js`

Move `filterMemoriesByPOV` tests to a top-level describe block that does NOT call `setupTestContext`. Keep the existing deps-requiring tests in their own describe block with the `beforeEach`/`afterEach`.

Replace the file's outer structure. The `filterMemoriesByPOV` describe block moves outside the `describe('pov')` wrapper and uses `buildMockMemory` from factories:

Replace the entire opening of the file (the outer `describe('pov')`, `beforeEach`, and `filterMemoriesByPOV` describe) with two separate top-level describe blocks.

First, replace the imports at the top:

Old:
```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS_KEY, MEMORIES_KEY } from '../src/constants.js';
import { resetDeps } from '../src/deps.js';
import {
    detectPresentCharactersFromMessages,
    filterMemoriesByPOV,
    getActiveCharacters,
    getPOVContext,
} from '../src/pov.js';
```

New:
```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS_KEY, MEMORIES_KEY } from '../src/constants.js';
import { resetDeps } from '../src/deps.js';
import {
    detectPresentCharactersFromMessages,
    filterMemoriesByPOV,
    getActiveCharacters,
    getPOVContext,
} from '../src/pov.js';
import { buildMockMemory } from './factories.js';
```

Then restructure the file into two top-level describe blocks:

1. `describe('filterMemoriesByPOV')` — NO `setupTestContext`, uses `buildMockMemory` for memory objects
2. `describe('pov (deps-requiring)')` — HAS `setupTestContext` in `beforeEach`, contains `getActiveCharacters`, `detectPresentCharactersFromMessages`, `getPOVContext`

The `filterMemoriesByPOV` tests use `buildMockMemory` for memory construction:

```javascript
describe('filterMemoriesByPOV', () => {
    it('returns all memories when no POV characters specified', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['Bob'] }),
            buildMockMemory({ id: '2', witnesses: ['Charlie'] }),
        ];
        const result = filterMemoriesByPOV(memories, [], {});
        expect(result).toHaveLength(2);
    });

    // ... (all other filterMemoriesByPOV tests, replacing inline objects
    // with buildMockMemory where the memory shape matters)
});
```

For tests where the memory objects need very specific fields (like `is_secret`, `witnesses`, `characters_involved`), pass them as overrides to `buildMockMemory`.

The deps-requiring describe block keeps its `beforeEach`/`afterEach`:
```javascript
describe('pov (deps-requiring)', () => {
    let mockConsole;
    let mockContext;

    beforeEach(() => {
        mockConsole = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
        mockContext = { /* ... same as before ... */ };
        setupTestContext({ deps: { console: mockConsole, getContext: () => mockContext } });
    });

    afterEach(() => {
        resetDeps();
    });

    describe('getActiveCharacters', () => { /* ... unchanged ... */ });
    describe('detectPresentCharactersFromMessages', () => { /* ... unchanged ... */ });
    describe('getPOVContext', () => { /* ... unchanged ... */ });
});
```

- [ ] Step 2: Run to verify all pov tests pass

Run: `npx vitest run tests/pov.test.js -v`

Expected: All existing tests PASS (same count as before — tests were restructured, not deleted)

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(tests): isolate filterMemoriesByPOV from setupTestContext

Pure function tests no longer inherit unnecessary dep mocking.
Uses factory builders for memory objects."
```

---

### Task 9: Update `tests/CLAUDE.md` with pyramid rules, factory conventions, and file map

**Files:**
- Modify: `tests/CLAUDE.md`

Codify every structural decision from this refactor so future test authors don't recreate the mess. This is the single source of truth for "where does this test go?" and "how do I build test data?".

- [ ] Step 1: Replace `tests/CLAUDE.md` with the updated content

```markdown
# Testing Subsystem (Vitest + JSDOM)

## CORE RULES & CONSTRAINTS

1. **Zero `vi.mock()`**: NEVER use `vi.mock()` on internal or ST modules (except for minor `embeddings.js` edge cases if explicitly required).
2. **Single I/O Boundary**: All external ST/Browser boundaries are mocked through `setupTestContext({ deps: { ... } })` in `tests/setup.js`. This overrides the injection in `src/deps.js`.
3. **Data, Not Implementation**: Assert on output data (`mockData.memories`, `mockData.graph`, prompt slot content), not on spy call counts.
4. **Module-Level State**: Worker tests MUST use `vi.resetModules()` in `beforeEach` to reset mutable top-level variables (like `isRunning` in `worker.js`).
5. **No DOM Mocks for Math/Helpers**: Test pure functions (`helpers.js`, `math.js`) by passing objects directly.

---

## TEST PYRAMID — WHERE DOES THIS TEST GO?

Every test lives at exactly ONE level. Never test the same logic at two levels.

### Unit Tests (pure functions, no `setupTestContext`)

Test a single exported function by passing plain objects and asserting on return values / mutations.
**No LLM mocks, no `setupTestContext`, no `resetDeps`.**

| What | Test file | Source |
|------|-----------|--------|
| Alpha-blend scoring, BM25, cosine similarity, tokenization | `tests/math.test.js`, `tests/retrieval/math.test.js` | `src/retrieval/math.js` |
| Soft-balance memory selection | `tests/retrieval/scoring.test.js` | `src/retrieval/scoring.js` |
| Memory bucket assignment, injection formatting | `tests/formatting.test.js` | `src/retrieval/formatting.js` |
| POV filtering (`filterMemoriesByPOV`) | `tests/pov.test.js` (top-level describe) | `src/pov.js` |
| Character state updates & cleanup | `tests/extraction/character-states.test.js` | `src/extraction/extract.js` |
| Event dedup (Jaccard, cosine, mentions) | `tests/extraction/dedup.test.js` | `src/extraction/extract.js` |
| Graph structure, community detection, consolidation | `tests/graph/*.test.js` | `src/graph/*.js` |
| World context retrieval, macro intent detection | `tests/retrieval/world-context.test.js` | `src/retrieval/world-context.js` |
| Text utils, stemmer, transliteration, tokens | `tests/utils/*.test.js` | `src/utils/*.js` |
| Prompt builders, formatters, schemas | `tests/prompts/*.test.js` | `src/prompts/*.js` |
| Reflection filter, preflight gate | `tests/reflection/*.test.js` | `src/reflection/*.js` |
| Perf store, instrumentation | `tests/perf/*.test.js` | `src/perf/*.js` |

### Integration Tests (`setupTestContext` required — mock LLM, ST context, fetch)

Test pipeline wiring: "does the orchestrator call the right functions in the right order and save the right data?" Keep to 3–5 tests per orchestrator: happy path, graceful degradation, fast-fail.

| What | Test file | Source |
|------|-----------|--------|
| Extraction pipeline (events → graph → reflection) | `tests/extraction/extract.test.js` (≤5 tests) | `src/extraction/extract.js` |
| Retrieval pipeline (filter → score → inject) | `tests/retrieval/retrieve.test.js` (≤3 tests) | `src/retrieval/retrieve.js` |
| Background worker lifecycle | `tests/extraction/worker.test.js` | `src/extraction/worker.js` |
| POV context detection (`getActiveCharacters`, `getPOVContext`) | `tests/pov.test.js` (deps-requiring describe) | `src/pov.js` |
| Unified reflection pipeline | `tests/reflection/unified-reflection.integration.test.js` | `src/reflection/*.js` |

### Decision Rule

> **"Does my function call `getDeps()`?"**
> - **No** → Unit test. Pass data directly. No `setupTestContext`.
> - **Yes** → Integration test. Use `setupTestContext`. Keep test count minimal (3–5).
>
> **"Does a unit test already cover this edge case?"**
> - **Yes** → Do NOT add it to the integration test. Integration tests cover wiring, not permutations.
> - **No** → Write a unit test for the edge case. Only add to integration if it's a pipeline-level failure mode.

---

## FACTORY BUILDERS (`tests/factories.js`)

Use factory functions to build test data instead of ad-hoc inline objects or shared `mockData` globals.

```javascript
import { buildMockMemory, buildMockGraphNode, buildMockData } from '../factories.js';

// Override only what matters for this test — rest is sensible defaults
const memory = buildMockMemory({ importance: 5, is_secret: true });
const node = buildMockGraphNode({ name: 'Castle', type: 'PLACE' });
const data = buildMockData({ character_states: { Alice: { current_emotion: 'happy' } } });
```

### When to use factories
- Any test that creates memory objects, graph nodes, or OpenVault data structures.
- Especially in unit tests that don't have `setupTestContext` to inject data.

### When NOT to use factories
- Math tests where the specific numeric values (embeddings, importance, message_ids) ARE the test. Inline objects are clearer when every field is intentional.
- Tests that need only 1–2 fields on a throwaway object (e.g. `{ summary: 'test' }`).

---

## `setupTestContext` RULES

`setupTestContext` (from `tests/setup.js`) is the ONLY way to mock ST globals.

### WHEN to use it
- Tests for functions that call `getDeps()` internally (orchestrators, event handlers, UI code).
- Tests that need `getContext()`, `getExtensionSettings()`, `saveChatConditional`, `setExtensionPrompt`, etc.

### WHEN NOT to use it
- **Pure math/scoring functions** (`calculateScore`, `scoreMemories`, `cosineSimilarity`) — pass args directly.
- **Pure data transforms** (`filterMemoriesByPOV`, `updateCharacterStatesFromEvents`, `cleanupCharacterStates`, `filterSimilarEvents`) — pass args directly.
- **Formatting functions** (`formatContextForInjection`, `assignMemoriesToBuckets`) — pass args directly.
- **Any test where you can call the function with explicit arguments** — always prefer explicit over mocked globals.

### Anti-pattern: God `beforeEach`
```javascript
// BAD: Every test gets setupTestContext even if it doesn't need it
describe('myModule', () => {
    beforeEach(() => { setupTestContext({ ... }); });
    it('pure function test', () => { /* doesn't need deps */ });
    it('integration test', () => { /* needs deps */ });
});

// GOOD: Separate pure tests from integration tests
describe('pure functions', () => {
    it('pure function test', () => { /* no setup needed */ });
});
describe('integration (deps-requiring)', () => {
    beforeEach(() => { setupTestContext({ ... }); });
    afterEach(() => { resetDeps(); });
    it('integration test', () => { /* needs deps */ });
});
```

---

## ESM URL ALIASING
Production code uses bare URLs (e.g., `https://esm.sh/graphology`). Node/Vitest cannot resolve these natively.
- **Requirement**: Any CDN package MUST be aliased in `vitest.config.js` to a local `node_modules/` path.
- **Requirement**: You must `npm install --save-dev` the package to make it available to the alias.

## EMBEDDING MOCKS
Do not run real Transformers.js models in Vitest.
- Force the 'ollama' strategy in test settings (`embeddingSource: 'ollama'`).
- Mock `deps.fetch` to return `{ ok: true, json: () => ({ embedding: [0.1, 0.2] }) }`.

## UI RENDERING TESTS
`render.js` and `status.js` run real code. jQuery on empty JSDOM selections is a silent no-op. If you need to test DOM output, use string templates from `templates.js` directly, or mount standard HTML to the JSDOM document before running.

---

## Test Development Workflow

### Quick Development Loop (Use These)

```bash
# While working on specific module — watches only that file
npx vitest tests/math.test.js

# After making changes — runs only tests affected by uncommitted changes
npm run test:changed

# For rapid iteration — interactive filter mode
npm run test:watch
# Then press:
#   'p' → filter by filename pattern
#   't' → filter by test name pattern
#   'a' → run all tests
#   'q' → quit
```

### Module-Specific Shortcuts

```bash
# Math/scoring functions (fastest feedback)
npm run test:math

# Extraction pipeline
npm run test:extract

# With UI (for debugging parameterized tests)
npm run test:ui
```

### Pre-Commit (Full Suite)

```bash
npm run test:run  # Run all tests once
```

### Coverage Check

```bash
# Before and after refactoring, verify coverage unchanged
npm run test:coverage
```

### When to Run What

| Scenario | Command | Why |
|----------|---------|-----|
| Active TDD on math.js | `npx vitest tests/math.test.js` | <1s feedback |
| Finished feature | `npm run test:changed` | Catches regressions |
| Refactoring shared code | `npm run test:run` | Full coverage |
| Debugging parameterized test | `npm run test:ui` | Visual test explorer |
| CI/Pre-commit | `npm run test:run` | Gatekeeping |

### Parameterized Tests Best Practices

Use `it.each()` with object arrays for readability:

```javascript
const CASES = [
  { name: 'handles positive', input: 5, expected: 10 },
  { name: 'handles zero', input: 0, expected: 0 },
  { name: 'handles negative', input: -3, expected: -6 },
];

it.each(CASES)('$name', ({ input, expected }) => {
  expect(double(input)).toBe(expected);
});
```

**Warning:** If test functions mutate input objects, use `structuredClone()`:

```javascript
it.each(CASES)('$name', (caseData) => {
  const memory = structuredClone(caseData.memory);
  const result = processMemory(memory);
  expect(result).toBe(caseData.expected);
});
```

## PERF TEST SUITE (`tests/perf/`)
- **`store.test.js`**: Unit tests for perf store singleton — `record()`, `getAll()`, `loadFromChat()`, `formatForClipboard()`. Uses `_resetForTest()` for isolation.
- **`tab.test.js`**: HTML/CSS presence tests for Perf tab UI structure.
- **`instrumentation.test.js`**: Validates that `record()` is called in instrumented code paths (`autoHide`, memory scoring, event dedup, chat save).
- **`reflection.test.js`**: Perf metrics for reflection pipeline timing.
```

- [ ] Step 2: Verify the file renders correctly

Run: `head -5 tests/CLAUDE.md`

Expected: `# Testing Subsystem (Vitest + JSDOM)` header visible.

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "docs: update tests/CLAUDE.md with pyramid rules, factory conventions, and file map"
```

---

### Task 10: Final verification

**Files:**
- None (validation only)

- [ ] Step 1: Run the full test suite

Run: `npx vitest run -v`

Expected: All tests pass. Test count should be lower than before (moved tests replace deleted tests, net deletion of ~25 redundant tests).

- [ ] Step 2: Verify Definition of Done checklist

1. `extract.test.js` contains 5 tests (< 10) ✓
2. `retrieve.test.js` contains 3 tests (< 10) ✓
3. `setupTestContext` is NOT called in `filterMemoriesByPOV` tests ✓
4. `setupTestContext` is NOT called in `math.test.js` (already true) ✓
5. `setupTestContext` is NOT called in `formatting.test.js` (already true) ✓
6. `tests/factories.js` exists with `buildMockMemory`, `buildMockGraphNode`, `buildMockData` ✓
7. `tests/CLAUDE.md` contains pyramid rules, factory docs, and decision rule ✓

- [ ] Step 3: Commit (if any final fixups needed)

```bash
git add -A && git commit -m "chore: final verification — test pyramid enforcement complete"
```
