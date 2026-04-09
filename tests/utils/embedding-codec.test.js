import { describe, expect, it } from 'vitest';
import { getEmbedding, hasEmbedding, setEmbedding } from '../../src/utils/embedding-codec.js';

describe('setEmbedding + getEmbedding roundtrip', () => {
    it('encodes to Base64 and decodes back to Float32Array', () => {
        const vec = [0.1234, -0.5678, 0.9012, -0.3456];
        const obj = {};
        setEmbedding(obj, vec);

        expect(obj.embedding_b64).toBeTypeOf('string');
        expect(obj.embedding).toBeUndefined();

        const decoded = getEmbedding(obj);
        expect(decoded).toBeInstanceOf(Float32Array);
        expect(decoded).toHaveLength(4);
        // Float32 precision: ~7 significant digits
        for (let i = 0; i < vec.length; i++) {
            expect(decoded[i]).toBeCloseTo(vec[i], 5);
        }
    });

    it('roundtrips a realistic 384-dim normalized vector', () => {
        const raw = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
        const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
        const vec = raw.map((v) => v / norm);

        const obj = {};
        setEmbedding(obj, vec);
        const decoded = getEmbedding(obj);

        expect(decoded).toHaveLength(384);
        for (let i = 0; i < vec.length; i++) {
            expect(decoded[i]).toBeCloseTo(vec[i], 5);
        }
    });

    it('wraps legacy number[] in Float32Array', () => {
        const obj = { embedding: [0.1, 0.2, 0.3] };
        const result = getEmbedding(obj);
        expect(result).toBeInstanceOf(Float32Array);
        expect(result).toHaveLength(3);
        expect(result[0]).toBeCloseTo(0.1, 5);
        expect(result[1]).toBeCloseTo(0.2, 5);
        expect(result[2]).toBeCloseTo(0.3, 5);
    });
});

describe('hasEmbedding', () => {
    it('returns true for embedding_b64', () => {
        const obj = {};
        setEmbedding(obj, [0.1]);
        expect(hasEmbedding(obj)).toBe(true);
    });
});
