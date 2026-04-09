import { describe, expect, it } from 'vitest';
import { calculateScore } from '../../src/retrieval/math.js';

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
