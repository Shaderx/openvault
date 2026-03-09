import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSFORMERS_MODELS } from '../src/embeddings.js';

describe('TRANSFORMERS_MODELS config', () => {
    it('multilingual-e5-small has Cyrillic-safe chunk size', () => {
        const config = TRANSFORMERS_MODELS['multilingual-e5-small'];
        // 250 chars × ~1.5 tokens/Cyrillic char ≈ 375 tokens (within 512 limit)
        expect(config.optimalChunkSize).toBeLessThanOrEqual(250);
    });

    it('embeddinggemma-300m retains large chunk size', () => {
        const config = TRANSFORMERS_MODELS['embeddinggemma-300m'];
        expect(config.optimalChunkSize).toBe(1800);
    });
});

describe('generateEmbeddingsForMemories', () => {
    let _originalGetDeps;

    beforeEach(async () => {
        // Import and save original getDeps
        const depsModule = await import('../src/deps.js');
        _originalGetDeps = depsModule.getDeps;

        // Mock getDeps to return enabled settings
        const mockDeps = {
            getExtensionSettings: vi.fn(() => ({
                openvault: {
                    embeddingSource: 'multilingual-e5-small',
                    embeddingQueryPrefix: 'query: ',
                    embeddingDocPrefix: 'passage: ',
                },
            })),
        };
        vi.spyOn(depsModule, 'getDeps').mockReturnValue(mockDeps);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('generateEmbeddingsForMemories stores embedding as Base64 via setEmbedding', async () => {
        const { hasEmbedding, getEmbedding } = await import('../src/utils/embedding-codec.js');
        const { generateEmbeddingsForMemories, getStrategy } = await import('../src/embeddings.js');

        const memories = [{ summary: 'Test memory', id: 'test1' }];

        // Spy on the strategy's getDocumentEmbedding method
        const strategy = getStrategy('multilingual-e5-small');
        const getDocEmbSpy = vi.spyOn(strategy, 'getDocumentEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);

        const count = await generateEmbeddingsForMemories(memories);

        expect(getDocEmbSpy).toHaveBeenCalledWith('Test memory');
        expect(count).toBe(1);
        expect(hasEmbedding(memories[0])).toBe(true);
        expect(memories[0].embedding).toBeUndefined(); // no legacy key
        expect(memories[0].embedding_b64).toBeTypeOf('string');
        const decoded = getEmbedding(memories[0]);
        expect(decoded[0]).toBeCloseTo(0.1, 5);
    });
});
