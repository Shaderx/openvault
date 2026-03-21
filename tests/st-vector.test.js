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