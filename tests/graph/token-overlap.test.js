import { describe, expect, it } from 'vitest';
import { hasSufficientTokenOverlap } from '../../src/graph/graph.js';

describe('hasSufficientTokenOverlap', () => {
    it('should reject single adjective overlap (e.g., "Burgundy")', () => {
        const tokensA = new Set(['burgundy', 'panties']);
        const tokensB = new Set(['burgundy', 'soy-wax', 'candle']);

        expect(hasSufficientTokenOverlap(tokensA, tokensB, 0.5)).toBe(false);
    });

    it('should accept 50%+ token overlap', () => {
        const tokensA = new Set(['king', 'aldric', 'northern']);
        const tokensB = new Set(['king', 'aldric', 'southern']);

        expect(hasSufficientTokenOverlap(tokensA, tokensB, 0.5)).toBe(true);
    });

    it('should handle substring containment separately', () => {
        const keyA = 'alice';
        const keyB = 'alicia';

        expect(hasSufficientTokenOverlap(new Set([keyA]), new Set([keyB]), 0.5, keyA, keyB)).toBe(true); // Substring containment
    });
});
