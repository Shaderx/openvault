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

        expect(getDocEmbSpy).toHaveBeenCalledWith(
            'Test memory',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(count).toBe(1);
        expect(hasEmbedding(memories[0])).toBe(true);
        expect(memories[0].embedding).toBeUndefined(); // no legacy key
        expect(memories[0].embedding_b64).toBeTypeOf('string');
        const decoded = getEmbedding(memories[0]);
        expect(decoded[0]).toBeCloseTo(0.1, 5);
    });
});

describe('getQueryEmbedding abort signal', () => {
    beforeEach(async () => {
        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                openvault: {
                    embeddingSource: 'ollama',
                    ollamaUrl: 'http://test:11434',
                    embeddingModel: 'test-model',
                },
            })),
            fetch: vi.fn(async () => ({
                ok: true,
                json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws AbortError with pre-aborted signal', async () => {
        const { getQueryEmbedding, clearEmbeddingCache } = await import('../src/embeddings.js');
        clearEmbeddingCache();
        const ctrl = new AbortController();
        ctrl.abort();

        await expect(getQueryEmbedding('test', { signal: ctrl.signal })).rejects.toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });

    it('throws AbortError with pre-aborted signal on getDocumentEmbedding', async () => {
        const { getDocumentEmbedding, clearEmbeddingCache } = await import('../src/embeddings.js');
        clearEmbeddingCache();
        const ctrl = new AbortController();
        ctrl.abort();

        await expect(getDocumentEmbedding('test', { signal: ctrl.signal })).rejects.toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });
});

describe('OllamaStrategy abort signal', () => {
    it('passes signal to fetch', async () => {
        const fetchSpy = vi.fn(async () => ({
            ok: true,
            json: async () => ({ embedding: [0.1, 0.2] }),
        }));

        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                openvault: {
                    embeddingSource: 'ollama',
                    ollamaUrl: 'http://test:11434',
                    embeddingModel: 'test-model',
                },
            })),
            fetch: fetchSpy,
        });

        const { getStrategy } = await import('../src/embeddings.js');
        const strategy = getStrategy('ollama');
        const ctrl = new AbortController();
        await strategy.getEmbedding('test text', { signal: ctrl.signal });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const fetchOptions = fetchSpy.mock.calls[0][1];
        expect(fetchOptions.signal).toBe(ctrl.signal);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
});

describe('STVectorsStrategy', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isEnabled', () => {
        it('returns true when extension_settings.vectors.source is set', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(true);
        });

        it('returns false when extension_settings.vectors is missing', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({})),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(false);
        });

        it('returns false when vectors.source is empty', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: '', openai_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('shows provider and model for openrouter source', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'text-embedding-3-small' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openrouter / text-embedding-3-small');
        });

        it('shows provider and model for openai source', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openai', openai_model: 'text-embedding-ada-002' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openai / text-embedding-ada-002');
        });

        it('shows "default" when model is empty', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openai', openai_model: '' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openai / default');
        });

        it('shows configure hint when not set up', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({})),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('Configure in Vector Storage');
        });
    });

    describe('getEmbedding', () => {
        it('calls /api/embeddings/generate with correct payload for openrouter', async () => {
            const fetchSpy = vi.fn(async () => ({
                ok: true,
                json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }),
            }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'qwen/qwen3-embedding-4b' },
                })),
                fetch: fetchSpy,
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const result = await strategy.getEmbedding('test text');

            expect(fetchSpy).toHaveBeenCalledWith(
                '/api/embeddings/generate',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'openrouter',
                        items: ['test text'],
                        model: 'qwen/qwen3-embedding-4b',
                    }),
                    signal: undefined,
                })
            );
            expect(result).toBeInstanceOf(Float32Array);
            expect(result[0]).toBeCloseTo(0.1, 5);
        });

        it('calls /api/embeddings/generate with correct payload for openai', async () => {
            const fetchSpy = vi.fn(async () => ({
                ok: true,
                json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }),
            }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openai', openai_model: 'text-embedding-ada-002' },
                })),
                fetch: fetchSpy,
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const result = await strategy.getEmbedding('test text');

            expect(fetchSpy).toHaveBeenCalledWith(
                '/api/embeddings/generate',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'openai',
                        items: ['test text'],
                        model: 'text-embedding-ada-002',
                    }),
                    signal: undefined,
                })
            );
            expect(result).toBeInstanceOf(Float32Array);
            expect(result[0]).toBeCloseTo(0.1, 5);
        });

        it('returns null when vector settings not configured', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({})),
                fetch: vi.fn(),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const result = await strategy.getEmbedding('test text');

            expect(result).toBeNull();
        });

        it('returns null when text is empty', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'text-embedding-3-small' },
                })),
                fetch: vi.fn(),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const result = await strategy.getEmbedding('');

            expect(result).toBeNull();
        });

        it('throws AbortError when signal is pre-aborted', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'text-embedding-3-small' },
                })),
                fetch: vi.fn(),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const ctrl = new AbortController();
            ctrl.abort();

            await expect(strategy.getEmbedding('test', { signal: ctrl.signal })).rejects.toThrow(
                expect.objectContaining({ name: 'AbortError' })
            );
        });

        it('passes signal to fetch', async () => {
            const fetchSpy = vi.fn(async () => ({
                ok: true,
                json: async () => ({ embeddings: [[0.1]] }),
            }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'text-embedding-3-small' },
                })),
                fetch: fetchSpy,
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');
            const ctrl = new AbortController();
            await strategy.getEmbedding('test', { signal: ctrl.signal });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ signal: ctrl.signal })
            );
        });
    });
});

describe('enrichEventsWithEmbeddings abort signal', () => {
    beforeEach(async () => {
        const depsModule = await import('../src/deps.js');
        vi.spyOn(depsModule, 'getDeps').mockReturnValue({
            getExtensionSettings: vi.fn(() => ({
                openvault: {
                    embeddingSource: 'ollama',
                    ollamaUrl: 'http://test:11434',
                    embeddingModel: 'test-model',
                },
            })),
            fetch: vi.fn(async () => ({
                ok: true,
                json: async () => ({ embedding: [0.1, 0.2] }),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws AbortError when signal is pre-aborted', async () => {
        const { enrichEventsWithEmbeddings } = await import('../src/embeddings.js');
        const ctrl = new AbortController();
        ctrl.abort();

        await expect(enrichEventsWithEmbeddings([{ summary: 'test' }], { signal: ctrl.signal })).rejects.toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });
});
