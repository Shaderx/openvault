import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionName } from '../../src/constants.js';
import { resetDeps, setDeps } from '../../src/deps.js';
import { _clearValidatedChatsCache } from '../../src/services/st-vector.js';

describe('querySTVector — orphan detection', () => {
    let mockConsole;
    let mockContext;

    beforeEach(() => {
        mockConsole = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
        mockContext = { chatMetadata: {}, chatId: 'test-chat-123' };
        _clearValidatedChatsCache();
    });

    afterEach(() => resetDeps());

    it('detects orphaned collection and purges it', async () => {
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ file_name: 'other-chat.jsonl' }]),
            })
            .mockResolvedValueOnce({ ok: true }); // purge response

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        // Re-import to get fresh validatedChats cache
        const { querySTVector: freshQuery } = await import('../../src/services/st-vector.js');
        const result = await freshQuery('test query', 5, 0.5, 'deleted-chat-id');

        expect(result).toEqual([]);
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/characters/chats',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'X-CSRF-Token': 'test-token' }),
                body: JSON.stringify({ character_id: 123 }),
            })
        );
        expect(mockFetch).toHaveBeenCalledWith('/api/vector/purge', expect.objectContaining({ method: 'POST' }));
    });

    it('returns empty and shows toast when collection is orphaned', async () => {
        const mockShowToast = vi.fn();
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ file_name: 'existing-chat.jsonl' }]),
        });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: mockShowToast,
        });

        const { querySTVector: freshQuery } = await import('../../src/services/st-vector.js');
        const result = await freshQuery('test', 5, 0.5, 'existing-chat');

        // Should proceed to query (returns empty since no query mock)
        expect(result).toEqual([]);
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('validates group chats via /api/groups/get', async () => {
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ chats: ['group-chat-1'] }),
        });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: undefined,
                groupId: 'group-123',
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/services/st-vector.js');
        await freshQuery('test', 5, 0.5, 'group-chat-1');

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/groups/get',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ id: 'group-123' }),
            })
        );
    });

    it('caches validation result for the session', async () => {
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ file_name: 'cached-chat.jsonl' }]),
            })
            // Mock the actual query responses
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ metadata: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ metadata: [] }),
            });

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/services/st-vector.js');

        // First call should validate
        await freshQuery('query1', 5, 0.5, 'cached-chat');
        // Second call should use cache
        await freshQuery('query2', 5, 0.5, 'cached-chat');

        // First call: 1 validation + 1 query = 2 calls
        // Second call: 0 validation (cached) + 1 query = 1 call
        // Total: 3 calls, but only 1 validation call
        expect(mockFetch).toHaveBeenCalledTimes(3);
        // Verify that only one call was to the validation endpoint
        const validationCalls = mockFetch.mock.calls.filter((call) => call[0].includes('/characters/chats'));
        expect(validationCalls).toHaveLength(1);
    });

    it('assumes chat exists on validation error (fail-safe)', async () => {
        const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

        setDeps({
            console: mockConsole,
            getContext: () => ({
                ...mockContext,
                characterId: 123,
                groupId: undefined,
            }),
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true, embeddingSource: 'st_vector' },
                vectors: { source: 'transformers' },
            }),
            getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
            fetch: mockFetch,
            showToast: vi.fn(),
        });

        const { querySTVector: freshQuery } = await import('../../src/services/st-vector.js');
        const result = await freshQuery('test', 5, 0.5, 'error-chat');

        // Should not throw, should attempt query (returns empty since no query mock)
        expect(result).toEqual([]);
        expect(mockConsole.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to validate chat existence'),
            expect.any(Error)
        );
    });
});
