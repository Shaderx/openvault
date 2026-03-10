import { describe, expect, it } from 'vitest';

describe('calculateIDF with expanded corpus', () => {
    it('should calculate lower IDF for common terms when hidden memories included', async () => {
        const { tokenize, calculateIDF } = await import('../../src/retrieval/math.js');

        const candidates = [{ summary: 'The brave knight fought' }, { summary: 'The kingdom is at peace' }];
        const hidden = [
            { summary: 'The brave knight visited the castle' },
            { summary: 'The brave knight met the king' },
            { summary: 'The king declared war' },
        ];

        // Tokenize all memories
        const tokenizedCandidates = candidates.map((m, i) => [i, tokenize(m.summary)]);
        const tokenizedHidden = hidden.map((m, i) => [i + candidates.length, tokenize(m.summary)]);

        // Calculate IDF with expanded corpus (candidates + hidden)
        const { idfMap: expandedIdf } = calculateIDF(
            [...candidates, ...hidden],
            new Map([...tokenizedCandidates, ...tokenizedHidden])
        );

        // Calculate IDF with candidates only
        const { idfMap: candidatesOnlyIdf } = calculateIDF(candidates, new Map(tokenizedCandidates));

        // "knight" appears in 3/5 = 60% of expanded corpus vs 1/2 = 50% of candidates only
        // Expanded corpus should have LOWER IDF for "knight" (more common in broader context)
        const knightExpandedIdf = expandedIdf.get('knight') ?? 0;
        const knightCandidatesOnlyIdf = candidatesOnlyIdf.get('knight') ?? 0;

        // Both should exist and expanded should be lower
        expect(knightExpandedIdf).toBeGreaterThan(0);
        expect(knightCandidatesOnlyIdf).toBeGreaterThan(0);
        expect(knightExpandedIdf).toBeLessThan(knightCandidatesOnlyIdf);
    });

    it('should handle empty hidden memories array', async () => {
        const { tokenize, calculateIDF } = await import('../../src/retrieval/math.js');

        const candidates = [{ summary: 'Suzy fought bravely' }, { summary: 'The kingdom is at peace' }];

        const tokenized = new Map(candidates.map((m, i) => [i, tokenize(m.summary)]));
        const { idfMap } = calculateIDF(candidates, tokenized);

        expect(idfMap.size).toBeGreaterThan(0);
    });
});
