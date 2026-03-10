import { describe, expect, it } from 'vitest';

describe('buildCorpusVocab', () => {
    it('should collect memory tokens into the vocabulary set', async () => {
        const { buildCorpusVocab } = await import('../../src/retrieval/query-context.js');

        const memories = [
            { tokens: ['sword', 'fight', 'castl'] },
            { tokens: ['dragon', 'fire'] },
        ];
        const hiddenMemories = [
            { tokens: ['sword', 'shield'] },
        ];

        const vocab = buildCorpusVocab(memories, hiddenMemories, {}, {});

        expect(vocab).toBeInstanceOf(Set);
        expect(vocab.has('sword')).toBe(true);
        expect(vocab.has('fight')).toBe(true);
        expect(vocab.has('castl')).toBe(true);
        expect(vocab.has('dragon')).toBe(true);
        expect(vocab.has('fire')).toBe(true);
        expect(vocab.has('shield')).toBe(true);
        expect(vocab.size).toBe(6); // sword deduplicated, shield added from hidden
    });
});
