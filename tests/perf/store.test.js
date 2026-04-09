import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { _resetForTest, formatForClipboard, getAll, loadFromChat, record } from '../../src/perf/store.js';

describe('perf store', () => {
    let mockData;

    beforeEach(() => {
        mockData = { memories: [] };
        setupTestContext({
            context: { chatMetadata: { openvault: mockData } },
            settings: { debugMode: true },
        });
        _resetForTest();
    });

    afterEach(() => {
        resetDeps();
    });

    it('record() stores a metric and getAll() returns it', () => {
        record('memory_scoring', 42.5, '100 memories');
        const all = getAll();
        expect(all.memory_scoring.ms).toBe(42.5);
        expect(all.memory_scoring.size).toBe('100 memories');
        expect(all.memory_scoring.ts).toBeTypeOf('number');
    });

    it('record() overwrites previous value for same metric', () => {
        record('memory_scoring', 10);
        record('memory_scoring', 99);
        expect(getAll().memory_scoring.ms).toBe(99);
    });

    it('record() persists to chatMetadata.openvault.perf', () => {
        record('chat_save', 150);
        expect(mockData.perf.chat_save.ms).toBe(150);
    });

    it('getAll() returns empty object when nothing recorded', () => {
        expect(getAll()).toEqual({});
    });

    it('loadFromChat() hydrates in-memory store from chat metadata', () => {
        mockData.perf = { louvain_detection: { ms: 500, size: '50 edges', ts: 1000 } };
        loadFromChat();
        expect(getAll().louvain_detection.ms).toBe(500);
    });

    it('loadFromChat() clears previous in-memory data', () => {
        record('chat_save', 100);
        mockData.perf = { memory_scoring: { ms: 20, size: null, ts: 2000 } };
        loadFromChat();
        const all = getAll();
        expect(all.chat_save).toBeUndefined();
        expect(all.memory_scoring.ms).toBe(20);
    });

    it('formatForClipboard() produces readable text with all recorded metrics', () => {
        record('memory_scoring', 12.34, '450 memories');
        record('llm_events', 5200);
        const text = formatForClipboard();
        expect(text).toContain('Memory scoring');
        expect(text).toContain('12.34ms');
        expect(text).toContain('450 memories');
        expect(text).toContain('LLM: Events');
        expect(text).toContain('5200');
    });

    it('formatForClipboard() returns placeholder when empty', () => {
        const text = formatForClipboard();
        expect(text).toContain('No perf data');
    });

    it('record() ignores unknown metric IDs', () => {
        record('bogus_metric', 100);
        expect(getAll().bogus_metric).toBeUndefined();
    });
});
