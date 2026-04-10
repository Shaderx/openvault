import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { _resetForTest, formatForClipboard, getAll, record } from '../../src/perf/store.js';

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
});
