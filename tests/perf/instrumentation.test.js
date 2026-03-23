import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { _resetForTest, getAll } from '../../src/perf/store.js';

describe('perf instrumentation - events.js', () => {
    beforeEach(() => {
        _resetForTest();
    });
    afterEach(() => {
        resetDeps();
        vi.restoreAllMocks();
    });

    it('autoHideOldMessages records auto_hide metric', async () => {
        setupTestContext({
            context: {
                chat: [
                    { mes: 'hi', is_user: true, is_system: false },
                    { mes: 'hello', is_user: false, is_system: false },
                ],
                chatMetadata: { openvault: { memories: [], processed_message_ids: [0, 1] } },
            },
            settings: { autoHideEnabled: true, visibleChatBudget: 999999 },
            deps: { saveChatConditional: vi.fn(async () => true) },
        });

        const { autoHideOldMessages } = await import('../../src/events.js');
        await autoHideOldMessages();

        // Even if nothing was hidden (under budget), the timing should be recorded
        const all = getAll();
        expect(all.auto_hide).toBeDefined();
        expect(all.auto_hide.ms).toBeGreaterThanOrEqual(0);
    });
});

describe('perf instrumentation - math.js', () => {
    it('scoreMemories records memory_scoring metric with memory count', async () => {
        _resetForTest();
        setupTestContext({ settings: { debugMode: true } });

        const { scoreMemories } = await import('../../src/retrieval/math.js');
        const memories = [
            { summary: 'test event', importance: 3, sequence: 100, tokens: ['test'], archived: false },
            { summary: 'another event', importance: 5, sequence: 200, tokens: ['another'], archived: false },
        ];

        // Minimal constants for scoring
        const constants = { lambda: 0.05, imp5Floor: 5, combinedWeight: 15, alpha: 0.7, vectorThreshold: 0.5 };
        await scoreMemories(memories, null, 300, constants, {}, ['test', 'query']);

        const all = getAll();
        expect(all.memory_scoring).toBeDefined();
        expect(all.memory_scoring.ms).toBeGreaterThanOrEqual(0);
        expect(all.memory_scoring.size).toContain('2');
    });
});

describe('perf instrumentation - extract.js dedup', () => {
    it('filterSimilarEvents records event_dedup metric with size context', async () => {
        _resetForTest();
        setupTestContext({ settings: { debugMode: true } });

        const { filterSimilarEvents } = await import('../../src/extraction/extract.js');
        const newEvents = [{ summary: 'event A', tokens: ['event', 'a'], embedding: [1, 0, 0] }];
        const existing = [{ summary: 'event B', tokens: ['event', 'b'], embedding: [0, 1, 0] }];

        await filterSimilarEvents(newEvents, existing);

        const all = getAll();
        expect(all.event_dedup).toBeDefined();
        expect(all.event_dedup.size).toContain('1'); // new count
    });
});

describe('perf instrumentation - data.js', () => {
    it('saveOpenVaultData records chat_save metric', async () => {
        _resetForTest();
        setupTestContext({
            context: { chatMetadata: { openvault: { memories: [] } } },
            deps: { saveChatConditional: vi.fn(async () => true) },
            settings: { debugMode: true },
        });

        const { saveOpenVaultData } = await import('../../src/store/chat-data.js');
        await saveOpenVaultData();

        const all = getAll();
        expect(all.chat_save).toBeDefined();
        expect(all.chat_save.ms).toBeGreaterThanOrEqual(0);
    });
});
