import { describe, expect, it } from 'vitest';
import { calculateScore, scoreMemories } from '../../src/retrieval/math.js';

const BASE_CONSTANTS = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 5, reflectionDecayThreshold: 750 };

function makeMemory(overrides = {}) {
    return {
        id: 'test-1',
        summary: 'A test memory about something important',
        importance: 3,
        message_ids: [50],
        tokens: ['test', 'memori'],
        ...overrides,
    };
}

describe('calculateScore - settings clamping defense', () => {
    it('should not produce NaN when vectorSimilarityThreshold is 1.0', () => {
        const memory = makeMemory({ embedding: [1, 0, 0], _proxyVectorScore: 0.95 });
        const settings = {
            vectorSimilarityThreshold: 1.0, // Dangerous: causes division by zero
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
        expect(breakdown.vectorBonus).toBe(0); // Threshold clamped to 0.99, so 0.95 < 0.99
    });

    it('should not produce NaN when vectorSimilarityThreshold is -0.5', () => {
        const memory = makeMemory({ _proxyVectorScore: 0.3 });
        const settings = {
            vectorSimilarityThreshold: -0.5, // Negative threshold
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
    });

    it('should not produce Infinity when transientDecayMultiplier is negative', () => {
        const memory = makeMemory({ is_transient: true });
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: -5.0, // Negative = exponential growth instead of decay
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
    });

    it('should not produce Infinity when alpha is 999', () => {
        const memory = makeMemory({ _proxyVectorScore: 0.8 });
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: 999,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
    });

    it('should not produce NaN when alpha is NaN', () => {
        const memory = makeMemory();
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: NaN,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
    });

    it('should not produce Infinity when forgetfulnessBaseLambda is negative', () => {
        const memory = makeMemory({ importance: 1, message_ids: [10] });
        const constants = { ...BASE_CONSTANTS, BASE_LAMBDA: -0.05 };
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: 0.7,
            combinedBoostWeight: 15,
        };
        const breakdown = calculateScore(memory, null, 1000, constants, settings, 0);
        expect(Number.isFinite(breakdown.total)).toBe(true);
    });

    it('should clamp alpha outside [0, 1] and produce correct blend weights', () => {
        const memory = makeMemory({ _proxyVectorScore: 0.8 });
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: 2.0, // Should be clamped to 1.0
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        // With alpha clamped to 1.0, BM25 bonus should be (1 - 1.0) * weight = 0
        expect(breakdown.bm25Bonus).toBe(0);
    });

    it('should produce valid scores with all normal settings (regression)', () => {
        const memory = makeMemory({ importance: 3, message_ids: [80] });
        const settings = {
            vectorSimilarityThreshold: 0.5,
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };
        const breakdown = calculateScore(memory, null, 100, BASE_CONSTANTS, settings, 0);
        expect(breakdown.total).toBeGreaterThan(0);
        expect(breakdown.base).toBeGreaterThan(0);
    });
});

describe('calculateScore - slow-pass vector override clamping', () => {
    it('should not produce NaN in the two-pass vector re-scoring path', async () => {
        const memories = [
            {
                id: 'm1',
                summary: 'A memory about a forest',
                importance: 3,
                message_ids: [50],
                tokens: ['memori', 'forest'],
                embedding: new Float32Array([1, 0, 0]),
            },
            {
                id: 'm2',
                summary: 'A memory about the ocean',
                importance: 3,
                message_ids: [60],
                tokens: ['memori', 'ocean'],
                embedding: new Float32Array([0, 1, 0]),
            },
        ];

        const contextEmbedding = new Float32Array([1, 0, 0]);
        const constants = { ...BASE_CONSTANTS };
        const settings = {
            vectorSimilarityThreshold: 0.999, // Just below 1.0, similarity can exceed this
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };

        const result = await scoreMemories(memories, contextEmbedding, 100, constants, settings, 'forest');
        for (const scored of result) {
            expect(Number.isFinite(scored.score)).toBe(true);
            expect(Number.isFinite(scored.breakdown.vectorBonus)).toBe(true);
        }
    });

    it('should clamp settings to prevent NaN when threshold is exactly 1.0', async () => {
        const memories = [
            {
                id: 'm1',
                summary: 'A memory about a forest',
                importance: 3,
                message_ids: [50],
                tokens: ['memori', 'forest'],
                embedding: new Float32Array([1, 0, 0]),
            },
        ];

        const contextEmbedding = new Float32Array([1, 0, 0]);
        const constants = { ...BASE_CONSTANTS };
        const settings = {
            vectorSimilarityThreshold: 1.0, // Division by zero
            alpha: 0.7,
            combinedBoostWeight: 15,
            transientDecayMultiplier: 5.0,
        };

        // Manually compute similarity to be > threshold (which would be clamped)
        // Since threshold is 1.0, and cosine similarity is at most 1.0,
        // with exact match we'd get similarity=1.0, threshold=1.0, so 1.0 > 1.0 is false
        // Let's test that the clamping prevents issues when similarity equals threshold
        const result = await scoreMemories(memories, contextEmbedding, 100, constants, settings, 'forest');
        for (const scored of result) {
            expect(Number.isFinite(scored.score)).toBe(true);
            expect(Number.isFinite(scored.breakdown.vectorBonus)).toBe(true);
        }
    });
});
