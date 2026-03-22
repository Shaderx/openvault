import { describe, expect, it } from 'vitest';
import { calculateScore, rankToProxyScore } from '../../src/retrieval/math.js';

const BASE_CONSTANTS = {
    BASE_LAMBDA: 0.05,
    IMPORTANCE_5_FLOOR: 1.0,
    reflectionDecayThreshold: 750,
    reflectionLevelMultiplier: 2.0,
};

const BASE_SETTINGS = {
    vectorSimilarityThreshold: 0.5,
    alpha: 0.7,
    combinedBoostWeight: 3.0,
};

describe('rankToProxyScore', () => {
    it('returns 1.0 for single result', () => {
        expect(rankToProxyScore(0, 1)).toBe(1.0);
    });

    it('assigns correct proxy scores for multiple results', () => {
        // Rank 0 of 2 -> proxy = 1.0
        // Rank 1 of 2 -> proxy = 0.5
        expect(rankToProxyScore(0, 2)).toBe(1.0);
        expect(rankToProxyScore(1, 2)).toBe(0.5);
    });

    it('distributes proxy scores linearly in [0.5, 1.0] range', () => {
        // With 3 results: rank 0 -> 1.0, rank 1 -> 0.75, rank 2 -> 0.5
        expect(rankToProxyScore(0, 3)).toBe(1.0);
        expect(rankToProxyScore(1, 3)).toBe(0.75);
        expect(rankToProxyScore(2, 3)).toBe(0.5);
    });

    it('handles larger result sets', () => {
        // With 10 results, top gets 1.0, bottom gets 0.5
        expect(rankToProxyScore(0, 10)).toBe(1.0);
        expect(rankToProxyScore(9, 10)).toBe(0.5);
        // Middle rank gets middle score
        expect(rankToProxyScore(5, 10)).toBeCloseTo(0.722, 2);
    });
});

describe('calculateScore with _proxyVectorScore', () => {
    it('uses _proxyVectorScore when present instead of cosine similarity', () => {
        const memory = {
            id: 'test1',
            summary: 'Test memory',
            importance: 3,
            message_ids: [50],
            _proxyVectorScore: 0.85,
        };

        // Pass null contextEmbedding — proxy score should be used instead
        const result = calculateScore(memory, null, 100, BASE_CONSTANTS, BASE_SETTINGS, 0);

        // Proxy score of 0.85 > threshold 0.5, so vectorBonus should be non-zero
        expect(result.vectorBonus).toBeGreaterThan(0);
        expect(result.vectorSimilarity).toBe(0.85);
    });

    it('does NOT use proxy score when contextEmbedding is provided (local strategy)', () => {
        const memory = {
            id: 'test1',
            summary: 'Test memory',
            importance: 3,
            message_ids: [50],
            _proxyVectorScore: 0.85,
            // No embedding on the memory, so cosine would be 0
        };

        // When contextEmbedding is provided, proxy should be ignored
        const fakeEmbedding = new Float32Array([1, 0, 0]);
        const result = calculateScore(memory, fakeEmbedding, 100, BASE_CONSTANTS, BASE_SETTINGS, 0);

        // No embedding on memory => cosine = 0, proxy should NOT be used
        expect(result.vectorSimilarity).toBe(0);
        expect(result.vectorBonus).toBe(0);
    });

    it('proxy score below threshold yields zero vectorBonus', () => {
        const memory = {
            id: 'test1',
            summary: 'Test memory',
            importance: 3,
            message_ids: [50],
            _proxyVectorScore: 0.3, // Below threshold 0.5
        };

        const result = calculateScore(memory, null, 100, BASE_CONSTANTS, BASE_SETTINGS, 0);
        expect(result.vectorBonus).toBe(0);
    });

    it('proxy score integrates with BM25 and forgetfulness in total', () => {
        const memory = {
            id: 'test1',
            summary: 'Test memory',
            importance: 3,
            message_ids: [90],
            _proxyVectorScore: 0.9,
        };

        const bm25 = 0.5;
        const result = calculateScore(memory, null, 100, BASE_CONSTANTS, BASE_SETTINGS, bm25);

        // Total should include base + vectorBonus + bm25Bonus
        expect(result.vectorBonus).toBeGreaterThan(0);
        expect(result.bm25Bonus).toBeGreaterThan(0);
        expect(result.total).toBeGreaterThan(result.baseAfterFloor);
    });
});

describe('world-context ST branch', () => {
    it('retrieveWorldContext still works with local embeddings (no regression)', async () => {
        const { retrieveWorldContext } = await import('../../src/retrieval/world-context.js');
        const { setEmbedding } = await import('../../src/utils/embedding-codec.js');

        const communities = {
            C0: { title: 'Town', summary: 'A small town', findings: ['peaceful'] },
        };
        setEmbedding(communities.C0, new Float32Array([1, 0, 0]));
        const queryEmb = new Float32Array([1, 0, 0]);

        const result = retrieveWorldContext(communities, null, 'test', queryEmb, 2000);
        expect(result.text).toContain('Town');
        expect(result.isMacroIntent).toBe(false);
    });
});
