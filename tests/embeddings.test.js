import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSFORMERS_MODELS } from '../src/embeddings.js';
import {
    hasEmbedding,
    deleteEmbedding,
    isStSynced,
    markStSynced,
    clearStSynced,
} from '../src/utils/embedding-codec.js';

describe('embedding-codec: _st_synced flag', () => {
    it('hasEmbedding returns true for _st_synced items without local embedding', () => {
        const obj = { _st_synced: true };
        expect(hasEmbedding(obj)).toBe(true);
    });

    it('hasEmbedding returns false when no embedding and not synced', () => {
        const obj = { summary: 'test' };
        expect(hasEmbedding(obj)).toBe(false);
    });

    it('deleteEmbedding clears _st_synced flag', () => {
        const obj = { _st_synced: true, embedding_b64: 'AAAA' };
        deleteEmbedding(obj);
        expect(obj._st_synced).toBeUndefined();
        expect(obj.embedding_b64).toBeUndefined();
    });

    it('isStSynced returns true for synced items', () => {
        const obj = { _st_synced: true };
        expect(isStSynced(obj)).toBe(true);
    });

    it('isStSynced returns false for non-synced items', () => {
        const obj = { summary: 'test' };
        expect(isStSynced(obj)).toBe(false);
    });

    it('isStSynced returns false for null/undefined', () => {
        expect(isStSynced(null)).toBe(false);
        expect(isStSynced(undefined)).toBe(false);
    });

    it('markStSynced sets _st_synced to true', () => {
        const obj = { summary: 'test' };
        markStSynced(obj);
        expect(obj._st_synced).toBe(true);
    });

    it('markStSynced handles null/undefined gracefully', () => {
        expect(() => markStSynced(null)).not.toThrow();
        expect(() => markStSynced(undefined)).not.toThrow();
    });

    it('clearStSynced removes _st_synced flag', () => {
        const obj = { _st_synced: true, summary: 'test' };
        clearStSynced(obj);
        expect(obj._st_synced).toBeUndefined();
    });

    it('clearStSynced handles null/undefined gracefully', () => {
        expect(() => clearStSynced(null)).not.toThrow();
        expect(() => clearStSynced(undefined)).not.toThrow();
    });
});

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

describe('ST Vector ID Prefix Utilities', () => {
    it('creates and extracts ID from text', async () => {
        const { extractIdFromText } = await import('../src/embeddings.js');

        // Simulate what createTextWithId produces
        const textWithId = '[OV_ID:event_123456789_0] This is a memory summary';
        const result = extractIdFromText(textWithId);

        expect(result.id).toBe('event_123456789_0');
        expect(result.text).toBe('This is a memory summary');
    });

    it('handles text without ID prefix', async () => {
        const { extractIdFromText } = await import('../src/embeddings.js');

        const result = extractIdFromText('Plain text without prefix');

        expect(result.id).toBeNull();
        expect(result.text).toBe('Plain text without prefix');
    });

    it('handles IDs with special characters', async () => {
        const { extractIdFromText } = await import('../src/embeddings.js');

        const textWithId = '[OV_ID:ref_abc-123_xyz] Reflection summary';
        const result = extractIdFromText(textWithId);

        expect(result.id).toBe('ref_abc-123_xyz');
        expect(result.text).toBe('Reflection summary');
    });

    it('hashStringToNumber produces stable hashes', async () => {
        const { hashStringToNumber } = await import('../src/embeddings.js');

        const id1 = 'event_123456789_0';
        const id2 = 'ref_abc123-def456';

        expect(hashStringToNumber(id1)).toBe(hashStringToNumber(id1)); // Stable
        expect(hashStringToNumber(id2)).toBe(hashStringToNumber(id2)); // Stable
        expect(hashStringToNumber(id1)).not.toBe(hashStringToNumber(id2)); // Different
        expect(hashStringToNumber(id1)).toBeGreaterThan(0); // Positive
    });
});

describe('StVectorStrategy', () => {
    let _originalGetDeps;

    beforeEach(async () => {
        const depsModule = await import('../src/deps.js');
        _originalGetDeps = depsModule.getDeps;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isEnabled', () => {
        it('returns true when ST vectors source is configured', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'qwen/qwen3-embedding-4b' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(true);
        });

        it('returns false when ST vectors source is not configured', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: {} })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.isEnabled()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('shows source and model when configured', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'qwen/qwen3-embedding-4b' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: openrouter / qwen/qwen3-embedding-4b');
        });

        it('shows only source when model not set', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'ollama' },
                })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.getStatus()).toBe('ST: ollama');
        });
    });

    describe('usesExternalStorage', () => {
        it('returns true', async () => {
            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
            });

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            expect(strategy.usesExternalStorage()).toBe(true);
        });
    });

    describe('insertItems', () => {
        it('calls ST /api/vector/insert with ID prefix in text', async () => {
            const fetchSpy = vi.fn(async () => ({ ok: true }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter', openrouter_model: 'test-model' },
                })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const items = [
                { id: 'event_123', summary: 'First memory' },
                { id: 'ref_456', summary: 'Second memory' },
            ];

            const result = await strategy.insertItems(items);

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const callArgs = fetchSpy.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);

            // Verify collectionId includes chatId
            expect(body.collectionId).toBe('openvault-chat-123-openrouter');
            expect(body.source).toBe('openrouter');

            // Verify text contains ID prefix
            expect(body.items[0].text).toBe('[OV_ID:event_123] First memory');
            expect(body.items[1].text).toBe('[OV_ID:ref_456] Second memory');
        });

        it('returns false on fetch failure', async () => {
            const fetchSpy = vi.fn(async () => ({ ok: false }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const result = await strategy.insertItems([{ id: 'event_1', summary: 'test' }]);

            expect(result).toBe(false);
        });
    });

    describe('searchItems', () => {
        it('calls ST /api/vector/query and extracts IDs from text', async () => {
            const fetchSpy = vi.fn(async () => ({
                ok: true,
                json: async () => ({
                    hashes: [12345, 67890],
                    metadata: [
                        { text: '[OV_ID:event_123] First memory' },
                        { text: '[OV_ID:ref_456] Second memory' },
                    ],
                }),
            }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({
                    vectors: { source: 'openrouter' },
                })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const results = await strategy.searchItems('query text', 10, 0.5);

            expect(fetchSpy).toHaveBeenCalledWith('/api/vector/query', expect.objectContaining({
                method: 'POST',
            }));

            const callArgs = fetchSpy.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.collectionId).toBe('openvault-chat-123-openrouter');
            expect(body.searchText).toBe('query text');
            expect(body.threshold).toBe(0.5);

            // Verify IDs are extracted from text prefix
            expect(results).toEqual([
                { id: 'event_123', text: 'First memory', score: undefined },
                { id: 'ref_456', text: 'Second memory', score: undefined },
            ]);
        });

        it('handles items without ID prefix gracefully', async () => {
            const fetchSpy = vi.fn(async () => ({
                ok: true,
                json: async () => ({
                    hashes: [12345],
                    metadata: [{ text: 'Memory without ID prefix' }],
                }),
            }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const results = await strategy.searchItems('query', 10, 0.5);

            // Should return the hash as ID when no prefix found
            expect(results).toEqual([
                { id: '12345', text: 'Memory without ID prefix', score: undefined },
            ]);
        });

        it('returns empty array on fetch failure', async () => {
            const fetchSpy = vi.fn(async () => ({ ok: false }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const results = await strategy.searchItems('query', 10, 0.5);

            expect(results).toEqual([]);
        });
    });

    describe('deleteItems', () => {
        it('converts string IDs to numeric hashes for deletion', async () => {
            const fetchSpy = vi.fn(async () => ({ ok: true }));
            const { hashStringToNumber } = await import('../src/embeddings.js');

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const result = await strategy.deleteItems(['event_123', 'ref_456']);

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith('/api/vector/delete', expect.objectContaining({
                method: 'POST',
            }));

            const callArgs = fetchSpy.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.hashes).toEqual([hashStringToNumber('event_123'), hashStringToNumber('ref_456')]);
        });
    });

    describe('purgeCollection', () => {
        it('calls ST /api/vector/purge', async () => {
            const fetchSpy = vi.fn(async () => ({ ok: true }));

            const depsModule = await import('../src/deps.js');
            vi.spyOn(depsModule, 'getDeps').mockReturnValue({
                getExtensionSettings: vi.fn(() => ({ vectors: { source: 'openrouter' } })),
                fetch: fetchSpy,
            });

            const dataModule = await import('../src/utils/data.js');
            vi.spyOn(dataModule, 'getCurrentChatId').mockReturnValue('chat-123');

            const { getStrategy } = await import('../src/embeddings.js');
            const strategy = getStrategy('st-vectors');

            const result = await strategy.purgeCollection();

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith('/api/vector/purge', expect.objectContaining({
                method: 'POST',
            }));
        });
    });
});
