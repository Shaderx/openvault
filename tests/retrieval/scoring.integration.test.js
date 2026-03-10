import { describe, expect, it } from 'vitest';
import { scoreMemories } from '../../src/retrieval/math.js';

describe('BM25 retrieval with hidden memory IDF', () => {
    it('should rank rare terms higher than common terms using expanded corpus', async () => {
        // Setup: Create memories where "sword" is common, "excalibur" is rare
        const candidates = [
            { id: '1', summary: 'He drew his sword', message_ids: [1], importance: 3 },
            { id: '2', summary: 'The sword gleamed', message_ids: [2], importance: 3 },
            { id: '4', summary: 'He found Excalibur', message_ids: [4], importance: 3 },
        ];

        const hiddenMemories = [
            { id: '5', summary: 'His sword was heavy', message_ids: [5], importance: 3 },
            { id: '6', summary: 'Sword practice daily', message_ids: [6], importance: 3 },
        ];

        const queryTokens = ['sword', 'excalibur'];

        const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
        const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };

        // Score with hidden memories (expanded corpus)
        const withHidden = await scoreMemories(
            candidates,
            null, // no context embedding
            10, // chatLength
            constants,
            settings,
            queryTokens,
            [], // no character names
            hiddenMemories
        );

        // Score without hidden memories (candidates only)
        const withoutHidden = await scoreMemories(
            candidates,
            null,
            10,
            constants,
            settings,
            queryTokens,
            [],
            [] // no hidden memories
        );

        // Find the "excalibur" memory results
        const excaliburWithHidden = withHidden.find((r) => r.memory.id === '4');
        const excaliburWithoutHidden = withoutHidden.find((r) => r.memory.id === '4');

        // With expanded corpus, "excalibur" should score higher relative to "sword"
        // because "sword" is now recognized as common (lower IDF)
        const swordWithHidden = withHidden.find((r) => r.memory.id === '1');

        expect(excaliburWithHidden.breakdown.bm25Score).toBeGreaterThan(swordWithHidden.breakdown.bm25Score);

        // The relative advantage of "excalibur" over "sword" should be greater
        // with the expanded corpus
        const ratioWithHidden =
            excaliburWithHidden.breakdown.bm25Score / (swordWithHidden.breakdown.bm25Score || 0.001);
        const ratioWithoutHidden =
            excaliburWithoutHidden.breakdown.bm25Score /
            (withoutHidden.find((r) => r.memory.id === '1').breakdown.bm25Score || 0.001);

        expect(ratioWithHidden).toBeGreaterThan(ratioWithoutHidden);
    });

    it('should handle empty hidden memories gracefully', async () => {
        const memories = [{ id: '1', summary: 'Test memory one', message_ids: [1], importance: 3 }];

        const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
        const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };

        const result = await scoreMemories(
            memories,
            null,
            10,
            constants,
            settings,
            ['test'],
            [],
            [] // empty hidden memories
        );

        expect(result.length).toBe(1);
        expect(result[0].memory.id).toBe('1');
    });
});
