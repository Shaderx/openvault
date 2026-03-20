import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('updateInjection with position settings', () => {
    let mockSetExtensionPrompt;
    let mockCachedContent;
    let mockGetContext;
    let mockGetExtensionSettings;

    beforeEach(async () => {
        vi.resetModules();

        // Track the cachedContent object to verify it gets updated
        mockCachedContent = {
            memory: '',
            world: ''
        };

        mockSetExtensionPrompt = vi.fn();
        mockGetContext = vi.fn(() => ({
            chat: [
                { is_system: true, mes: 'System message' },
                { is_system: false, is_user: true, mes: 'User test message' }
            ]
        }));

        const mockSettings = {
            enabled: true,
            retrievalMode: 'automatic',
            povCharacters: [],
            groupChatMode: 'disabled',
            retrievalFinalTokens: 2000,
            worldContextBudget: 500,
            injection: {
                memory: { position: 1, depth: 4 },
                world: { position: 2, depth: 4 }
            }
        };

        mockGetExtensionSettings = vi.fn(() => ({
            openvault: mockSettings
        }));

        // Mock all dependencies - must mock before importing retrieve.js
        vi.doMock('../../src/deps.js', () => ({
            getDeps: () => ({
                setExtensionPrompt: mockSetExtensionPrompt,
                getContext: mockGetContext,
                getExtensionSettings: mockGetExtensionSettings
            })
        }));

        // Mock macros module to track cachedContent updates
        vi.doMock('../../src/injection/macros.js', () => ({
            cachedContent: mockCachedContent,
            initMacros: vi.fn()
        }));

        // Mock st-helpers
        vi.doMock('../../src/utils/st-helpers.js', () => ({
            safeSetExtensionPrompt: mockSetExtensionPrompt,
            isExtensionEnabled: () => true
        }));

        // Mock formatting module to avoid CDN import
        vi.doMock('../../src/retrieval/formatting.js', () => ({
            formatContextForInjection: vi.fn(() => 'formatted context')
        }));

        // Mock data utility to return no memories (clear injection scenario)
        vi.doMock('../../src/utils/data.js', () => ({
            getOpenVaultData: () => ({
                characters: {},
                communities: {}
            })
        }));

        // Mock pov module
        vi.doMock('../../src/pov.js', () => ({
            getPOVContext: () => ({
                povCharacters: [],
                isGroupChat: false
            }),
            filterMemoriesByPOV: () => []
        }));

        // Mock scoring module
        vi.doMock('../../src/retrieval/scoring.js', () => ({
            selectRelevantMemories: vi.fn(async () => [])
        }));

        // Mock world-context module
        vi.doMock('../../src/retrieval/world-context.js', () => ({
            retrieveWorldContext: vi.fn(() => ({ text: '', isMacroIntent: false }))
        }));

        // Mock embeddings module
        vi.doMock('../../src/embeddings.js', () => ({
            isEmbeddingsEnabled: () => false,
            getQueryEmbedding: vi.fn(async () => null)
        }));

        // Mock constants
        vi.doMock('../../src/constants.js', () => ({
            extensionName: 'openvault',
            CHARACTERS_KEY: 'characters',
            MEMORIES_KEY: 'memories'
        }));

        // Mock logging
        vi.doMock('../../src/utils/logging.js', () => ({
            logDebug: vi.fn(),
            logError: vi.fn()
        }));

        // Mock debug-cache
        vi.doMock('../../src/retrieval/debug-cache.js', () => ({
            cacheRetrievalDebug: vi.fn()
        }));
    });

    afterEach(async () => {
        vi.clearAllMocks();
    });

    it('should update cachedContent when injecting context', async () => {
        const { injectContext } = await import('../../src/retrieval/retrieve.js');

        // Before injection, cachedContent should be empty
        expect(mockCachedContent.memory).toBe('');
        expect(mockCachedContent.world).toBe('');

        // Call injectContext with test content
        injectContext('Test memory content', 'Test world content');

        // After injection, cachedContent should be populated
        expect(mockCachedContent.memory).toBe('Test memory content');
        expect(mockCachedContent.world).toBe('Test world content');
    });

    it('should clear cachedContent when given empty strings', async () => {
        const { injectContext } = await import('../../src/retrieval/retrieve.js');

        // First populate it
        injectContext('Some content', 'Some world');

        expect(mockCachedContent.memory).toBe('Some content');
        expect(mockCachedContent.world).toBe('Some world');

        // Then clear it
        injectContext('', '');

        expect(mockCachedContent.memory).toBe('');
        expect(mockCachedContent.world).toBe('');
    });

    it('should pass position and depth to safeSetExtensionPrompt', async () => {
        const { injectContext } = await import('../../src/retrieval/retrieve.js');

        injectContext('Test memory', 'Test world');

        // Should call safeSetExtensionPrompt with position 1 and depth 4 for memory
        expect(mockSetExtensionPrompt).toHaveBeenCalledWith(
            'Test memory',
            'openvault',
            1,
            4
        );

        // Should call safeSetExtensionPrompt with position 2 and depth 4 for world
        expect(mockSetExtensionPrompt).toHaveBeenCalledWith(
            'Test world',
            'openvault_world',
            2,
            4
        );
    });
});
