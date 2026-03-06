import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Essential mocks: symbols onMessageReceived actually uses ──
vi.mock('../src/deps.js', () => ({
    getDeps: () => ({
        getContext: () => ({
            chat: [
                { is_user: true },
                { is_user: false },
            ],
        }),
    }),
}));

vi.mock('../src/utils.js', () => ({
    isAutomaticMode: () => true,
    log: vi.fn(),
    getCurrentChatId: vi.fn(),
    getOpenVaultData: vi.fn(),
    showToast: vi.fn(),
    safeSetExtensionPrompt: vi.fn(),
    withTimeout: vi.fn(),
}));

vi.mock('../src/state.js', () => ({
    operationState: {},
    isChatLoadingCooldown: vi.fn(() => false),
    setChatLoadingCooldown: vi.fn(),
    setGenerationLock: vi.fn(),
    clearGenerationLock: vi.fn(),
    resetOperationStatesIfSafe: vi.fn(),
}));

vi.mock('../src/extraction/worker.js', () => ({
    wakeUpBackgroundWorker: vi.fn(),
}));

// ── Stub mocks: prevent loading real modules (events.js imports these but
//    onMessageReceived never calls them) ──
vi.mock('../src/embeddings.js', () => ({ clearEmbeddingCache: vi.fn() }));
vi.mock('../src/extraction/extract.js', () => ({ extractMemories: vi.fn(), extractAllMessages: vi.fn(), cleanupCharacterStates: vi.fn() }));
vi.mock('../src/extraction/scheduler.js', () => ({ getBackfillStats: vi.fn(), getExtractedMessageIds: vi.fn(), getNextBatch: vi.fn() }));
vi.mock('../src/retrieval/retrieve.js', () => ({ updateInjection: vi.fn() }));
vi.mock('../src/retrieval/debug-cache.js', () => ({ clearRetrievalDebug: vi.fn() }));
vi.mock('../src/ui/render.js', () => ({ refreshAllUI: vi.fn(), resetMemoryBrowserPage: vi.fn() }));
vi.mock('../src/ui/status.js', () => ({ setStatus: vi.fn() }));

import { onMessageReceived } from '../src/events.js';
import { wakeUpBackgroundWorker } from '../src/extraction/worker.js';
import { isChatLoadingCooldown } from '../src/state.js';

describe('onMessageReceived', () => {
    beforeEach(() => vi.clearAllMocks());

    it('calls wakeUpBackgroundWorker for AI messages', () => {
        onMessageReceived(1);
        expect(wakeUpBackgroundWorker).toHaveBeenCalledOnce();
    });

    it('does not call wakeUpBackgroundWorker for user messages', () => {
        onMessageReceived(0);
        expect(wakeUpBackgroundWorker).not.toHaveBeenCalled();
    });

    it('does not await — returns synchronously', () => {
        const result = onMessageReceived(1);
        expect(result).toBeUndefined();
    });

    it('skips during chat loading cooldown', () => {
        isChatLoadingCooldown.mockReturnValue(true);
        onMessageReceived(1);
        expect(wakeUpBackgroundWorker).not.toHaveBeenCalled();
    });
});
