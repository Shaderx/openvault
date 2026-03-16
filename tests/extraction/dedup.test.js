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
