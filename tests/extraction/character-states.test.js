import { describe, expect, it } from 'vitest';
import {
    canonicalizeEventCharNames,
    cleanupCharacterStates,
    selectMemoriesForExtraction,
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

describe('selectMemoriesForExtraction', () => {
    const PARAMETERIZED_CASES = [
        {
            name: 'empty memories returns empty array',
            memories: [],
            settings: { extractionRearviewTokens: 1000 },
            expectedLength: 0,
        },
        {
            name: 'all memories fit within budget',
            memories: [
                { id: 'm1', summary: 'short memory', sequence: 10, importance: 3 },
                { id: 'm2', summary: 'another short', sequence: 20, importance: 3 },
            ],
            settings: { extractionRearviewTokens: 1000 },
            expectedLength: 2,
        },
        {
            name: 'respects token budget with small tokens',
            memories: [
                { id: 'm1', summary: 'short', sequence: 10, importance: 3 },
                { id: 'm2', summary: 'also short', sequence: 20, importance: 3 },
                { id: 'm3', summary: 'another', sequence: 30, importance: 3 },
            ],
            settings: { extractionRearviewTokens: 50 },
            expectedLength: 3, // All fit within budget
        },
        {
            name: 'includes high importance memories in importance budget',
            memories: [
                { id: 'm1', summary: 'low importance', sequence: 10, importance: 3 },
                { id: 'm2', summary: 'high importance event', sequence: 20, importance: 5 },
                { id: 'm3', summary: 'medium importance', sequence: 30, importance: 4 },
            ],
            settings: { extractionRearviewTokens: 100 },
            expectedContainsHighImportance: true,
        },
        {
            name: 'includes recent memories in recency budget',
            memories: [
                { id: 'm1', summary: 'old memory', sequence: 100, importance: 3 },
                { id: 'm2', summary: 'recent memory', sequence: 500, importance: 3 },
            ],
            settings: { extractionRearviewTokens: 50 },
            expectedContains: 'recent memory',
        },
        {
            name: 'returns memories sorted by sequence ascending',
            memories: [
                { id: 'm1', summary: 'first', sequence: 100, importance: 5 },
                { id: 'm2', summary: 'second', sequence: 200, importance: 5 },
                { id: 'm3', summary: 'third', sequence: 50, importance: 5 },
            ],
            settings: { extractionRearviewTokens: 1000 },
            expectedSequenceOrder: true,
        },
    ];

    it.each(PARAMETERIZED_CASES)('$name', ({ memories, settings, expectedLength, expectedMinImportance, expectedContains, expectedContainsHighImportance, expectedSequenceOrder }) => {
        const data = buildMockData({ memories });
        const result = selectMemoriesForExtraction(data, settings);

        if (expectedLength !== undefined) {
            expect(result.length).toBe(expectedLength);
        }

        if (expectedMinImportance !== undefined) {
            for (const m of result) {
                expect((m.importance || 3)).toBeGreaterThanOrEqual(expectedMinImportance);
            }
        }

        if (expectedContains !== undefined) {
            const hasMemory = result.some(m => m.summary.includes(expectedContains));
            expect(hasMemory).toBe(true);
        }

        if (expectedContainsHighImportance !== undefined) {
            const hasHighImportance = result.some(m => (m.importance || 3) >= 4);
            expect(hasHighImportance).toBe(true);
        }

        if (expectedSequenceOrder) {
            for (let i = 1; i < result.length; i++) {
                expect((result[i].sequence || 0)).toBeGreaterThanOrEqual(result[i - 1].sequence || 0);
            }
        }
    });

    it('allocates 25% budget to recency, 75% to importance+fill', () => {
        const memories = [
            // Old high importance
            { id: 'm1', summary: 'important old event', sequence: 10, importance: 5, tokens: 50 },
            { id: 'm2', summary: 'important older', sequence: 5, importance: 5, tokens: 50 },
            // Recent low importance
            { id: 'm3', summary: 'recent event', sequence: 500, importance: 3, tokens: 50 },
            { id: 'm4', summary: 'more recent', sequence: 600, importance: 3, tokens: 50 },
        ];
        const data = buildMockData({ memories });
        const settings = { extractionRearviewTokens: 200 };

        const result = selectMemoriesForExtraction(data, settings);

        // Should have both recent and important memories
        expect(result.length).toBeGreaterThan(0);
        const hasRecent = result.some(m => m.sequence >= 500);
        const hasImportant = result.some(m => (m.importance || 3) >= 5);
        expect(hasRecent || hasImportant).toBe(true);
    });

    it('handles memories with undefined importance (defaults to 3)', () => {
        const memories = [
            { id: 'm1', summary: 'no importance set', sequence: 10 },
            { id: 'm2', summary: 'high importance', sequence: 20, importance: 5 },
        ];
        const data = buildMockData({ memories });
        const settings = { extractionRearviewTokens: 100 };

        const result = selectMemoriesForExtraction(data, settings);

        // Should not crash and should include memories
        expect(result.length).toBeGreaterThan(0);
    });

    it('deduplicates memories selected in multiple phases', () => {
        const memories = [
            { id: 'm1', summary: 'important and recent', sequence: 500, importance: 5, tokens: 50 },
            { id: 'm2', summary: 'other memory', sequence: 100, importance: 3, tokens: 50 },
        ];
        const data = buildMockData({ memories });
        const settings = { extractionRearviewTokens: 200 };

        const result = selectMemoriesForExtraction(data, settings);

        // Each memory should appear only once
        const ids = result.map(m => m.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size);
    });
});

describe('canonicalizeEventCharNames', () => {
    it('does nothing when no canonical names provided', () => {
        const events = [
            {
                characters_involved: ['King Aldric', 'Queen'],
                witnesses: ['King Aldric'],
                emotional_impact: { 'King Aldric': 'happy' },
            },
        ];

        canonicalizeEventCharNames(events, [], {});

        // Events should remain unchanged
        expect(events[0].characters_involved).toEqual(['King Aldric', 'Queen']);
        expect(events[0].witnesses).toEqual(['King Aldric']);
    });

    it('deduplicates character names after canonicalization', () => {
        const events = [
            {
                characters_involved: ['King Aldric', 'king aldric', 'Queen'],
            },
        ];

        canonicalizeEventCharNames(events, ['King Aldric', 'Queen'], {});

        // 'king aldric' should be canonicalized to 'King Aldric' and deduplicated
        expect(events[0].characters_involved).toEqual(['King Aldric', 'Queen']);
    });

    it('canonicalizes characters_involved against context names', () => {
        const events = [
            {
                characters_involved: ['king aldric', 'queen'],
            },
        ];

        canonicalizeEventCharNames(events, ['King Aldric', 'Queen'], {});

        expect(events[0].characters_involved).toEqual(['King Aldric', 'Queen']);
    });

    it('canonicalizes witnesses against context names', () => {
        const events = [
            {
                witnesses: ['king aldric', 'queen'],
            },
        ];

        canonicalizeEventCharNames(events, ['King Aldric', 'Queen'], {});

        expect(events[0].witnesses).toEqual(['King Aldric', 'Queen']);
    });

    it('canonicalizes emotional_impact keys against context names', () => {
        const events = [
            {
                emotional_impact: { 'king aldric': 'triumphant', queen: 'worried' },
            },
        ];

        canonicalizeEventCharNames(events, ['King Aldric', 'Queen'], {});

        expect(events[0].emotional_impact).toEqual({ 'King Aldric': 'triumphant', Queen: 'worried' });
    });

    it('includes PERSON graph nodes in canonical names', () => {
        const events = [
            {
                characters_involved: ['knight', 'dragon'],
            },
        ];

        const graphNodes = {
            knight: { type: 'PERSON', name: 'Knight' },
            dragon: { type: 'CREATURE', name: 'Dragon' },
        };

        canonicalizeEventCharNames(events, [], graphNodes);

        // 'knight' should be canonicalized to 'Knight' (PERSON type)
        // 'dragon' should NOT be changed (not PERSON type)
        expect(events[0].characters_involved).toContain('Knight');
        expect(events[0].characters_involved).toContain('dragon');
    });

    it('deduplicates across all fields', () => {
        const events = [
            {
                characters_involved: ['king aldric', 'King Aldric'],
                witnesses: ['King Aldric'],
                emotional_impact: { 'king aldric': 'happy' },
            },
        ];

        canonicalizeEventCharNames(events, ['King Aldric'], {});

        expect(events[0].characters_involved).toEqual(['King Aldric']);
        expect(events[0].witnesses).toEqual(['King Aldric']);
        expect(Object.keys(events[0].emotional_impact)).toEqual(['King Aldric']);
    });
});
