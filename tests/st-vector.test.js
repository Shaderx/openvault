import { describe, expect, it } from 'vitest';

describe('ST sync flag helpers', () => {
    it('markStSynced sets flag, isStSynced reads it', async () => {
        const { markStSynced, isStSynced } = await import('../src/utils/embedding-codec.js');
        const obj = {};
        expect(isStSynced(obj)).toBe(false);
        markStSynced(obj);
        expect(isStSynced(obj)).toBe(true);
    });

    it('clearStSynced removes flag', async () => {
        const { markStSynced, isStSynced, clearStSynced } = await import('../src/utils/embedding-codec.js');
        const obj = {};
        markStSynced(obj);
        clearStSynced(obj);
        expect(isStSynced(obj)).toBe(false);
    });

    it('deleteEmbedding also clears _st_synced', async () => {
        const { markStSynced, isStSynced, deleteEmbedding, setEmbedding } = await import('../src/utils/embedding-codec.js');
        const obj = {};
        setEmbedding(obj, new Float32Array([1, 2, 3]));
        markStSynced(obj);
        deleteEmbedding(obj);
        expect(isStSynced(obj)).toBe(false);
    });

    it('isStSynced returns false for null/undefined', async () => {
        const { isStSynced } = await import('../src/utils/embedding-codec.js');
        expect(isStSynced(null)).toBe(false);
        expect(isStSynced(undefined)).toBe(false);
    });
});

describe('cyrb53 hash', () => {
    it('returns a positive integer for any string', async () => {
        const { cyrb53 } = await import('../src/utils/embedding-codec.js');
        const hash = cyrb53('hello world');
        expect(typeof hash).toBe('number');
        expect(Number.isInteger(hash)).toBe(true);
        expect(hash).toBeGreaterThan(0);
    });

    it('returns deterministic results', async () => {
        const { cyrb53 } = await import('../src/utils/embedding-codec.js');
        expect(cyrb53('test input')).toBe(cyrb53('test input'));
    });

    it('returns different hashes for different inputs', async () => {
        const { cyrb53 } = await import('../src/utils/embedding-codec.js');
        expect(cyrb53('alice')).not.toBe(cyrb53('bob'));
    });

    it('handles empty string', async () => {
        const { cyrb53 } = await import('../src/utils/embedding-codec.js');
        const hash = cyrb53('');
        expect(typeof hash).toBe('number');
    });

    it('handles unicode/cyrillic text', async () => {
        const { cyrb53 } = await import('../src/utils/embedding-codec.js');
        const hash = cyrb53('Привет мир');
        expect(typeof hash).toBe('number');
        expect(Number.isInteger(hash)).toBe(true);
    });
});

describe('rankToProxyScore', () => {
    it('returns 1.0 for rank 0 (best match)', async () => {
        const { rankToProxyScore } = await import('../src/retrieval/math.js');
        expect(rankToProxyScore(0, 10)).toBe(1.0);
    });

    it('returns 0.5 for last rank', async () => {
        const { rankToProxyScore } = await import('../src/retrieval/math.js');
        expect(rankToProxyScore(9, 10)).toBe(0.5);
    });

    it('returns 1.0 when totalResults is 1', async () => {
        const { rankToProxyScore } = await import('../src/retrieval/math.js');
        expect(rankToProxyScore(0, 1)).toBe(1.0);
    });

    it('returns 1.0 when totalResults is 0', async () => {
        const { rankToProxyScore } = await import('../src/retrieval/math.js');
        expect(rankToProxyScore(0, 0)).toBe(1.0);
    });

    it('returns linearly interpolated values', async () => {
        const { rankToProxyScore } = await import('../src/retrieval/math.js');
        // Rank 4 of 9 total (0-indexed): 1.0 - (4/8) * 0.5 = 0.75
        expect(rankToProxyScore(4, 9)).toBe(0.75);
    });
});