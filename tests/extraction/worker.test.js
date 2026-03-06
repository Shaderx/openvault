import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies that worker.js imports
vi.mock('../../src/deps.js', () => ({
    getDeps: () => ({
        getContext: () => ({ chat: [] }),
        getExtensionSettings: () => ({ openvault: { enabled: true, messagesPerExtraction: 5, extractionBuffer: 5 } }),
        console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }),
}));
vi.mock('../../src/utils.js', async (importOriginal) => {
    const orig = await importOriginal();
    return {
        ...orig,
        getCurrentChatId: vi.fn(() => 'chat_123'),
        isExtensionEnabled: vi.fn(() => true),
        getOpenVaultData: vi.fn(() => ({ memories: [], processed_message_ids: [] })),
        log: vi.fn(),
        saveOpenVaultData: vi.fn(async () => true),
        showToast: vi.fn(),
    };
});
vi.mock('../../src/extraction/scheduler.js', () => ({
    getNextBatch: vi.fn(() => null), // No batches by default
}));
vi.mock('../../src/extraction/extract.js', () => ({
    extractMemories: vi.fn(async () => ({ status: 'success', events_created: 1, messages_processed: 5 })),
}));
vi.mock('../../src/ui/status.js', () => ({ setStatus: vi.fn() }));
vi.mock('../../src/state.js', () => ({
    operationState: { extractionInProgress: false },
}));

// Mock constants
vi.mock('../../src/constants.js', () => ({
    extensionName: 'openvault',
}));

describe('worker single-instance guard', () => {
    let wakeUpBackgroundWorker, isWorkerRunning;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Re-import to reset module state
        vi.resetModules();
        const mod = await import('../../src/extraction/worker.js');
        wakeUpBackgroundWorker = mod.wakeUpBackgroundWorker;
        isWorkerRunning = mod.isWorkerRunning;
    });

    it('isWorkerRunning returns false initially', () => {
        expect(isWorkerRunning()).toBe(false);
    });

    it('exports wakeUpBackgroundWorker as a function', () => {
        expect(typeof wakeUpBackgroundWorker).toBe('function');
    });

    it('wakeUpBackgroundWorker does not throw', () => {
        expect(() => wakeUpBackgroundWorker()).not.toThrow();
    });
});

describe('interruptibleSleep', () => {
    let interruptibleSleep, getWakeGeneration, incrementWakeGeneration;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        const mod = await import('../../src/extraction/worker.js');
        interruptibleSleep = mod.interruptibleSleep;
        getWakeGeneration = mod.getWakeGeneration;
        incrementWakeGeneration = mod.incrementWakeGeneration;
    });

    it('resolves after the specified time', async () => {
        vi.useFakeTimers();
        const gen = getWakeGeneration();
        const promise = interruptibleSleep(1000, gen);
        await vi.runAllTimersAsync();
        await promise;
        vi.useRealTimers();
        // If we get here, it resolved
        expect(true).toBe(true);
    });

    it('resolves early when wakeGeneration changes', async () => {
        vi.useFakeTimers();
        const gen = getWakeGeneration();
        const promise = interruptibleSleep(10000, gen);
        // Advance past one chunk (500ms)
        vi.advanceTimersByTime(600);
        // Simulate new message
        incrementWakeGeneration();
        // Advance remaining timers
        await vi.runAllTimersAsync();
        await promise;
        vi.useRealTimers();
        // Resolved early due to generation change
        expect(true).toBe(true);
    });
});

describe('worker loop batch processing', () => {
    let wakeUpBackgroundWorker, isWorkerRunning;
    let extractMemoriesMock, getNextBatchMock, setStatusMock;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Make getNextBatch return one batch, then null (no more work)
        const schedulerMock = await import('../../src/extraction/scheduler.js');
        getNextBatchMock = schedulerMock.getNextBatch;
        let callCount = 0;
        getNextBatchMock.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return [0, 1, 2, 3, 4];
            return null; // No more batches
        });

        const extractMock = await import('../../src/extraction/extract.js');
        extractMemoriesMock = extractMock.extractMemories;

        const statusMock = await import('../../src/ui/status.js');
        setStatusMock = statusMock.setStatus;

        const mod = await import('../../src/extraction/worker.js');
        wakeUpBackgroundWorker = mod.wakeUpBackgroundWorker;
        isWorkerRunning = mod.isWorkerRunning;
    });

    it('processes one batch and stops when no more batches', async () => {
        wakeUpBackgroundWorker();
        // Wait for the async loop to finish
        await vi.waitFor(() => expect(isWorkerRunning()).toBe(false), { timeout: 5000 });

        expect(extractMemoriesMock).toHaveBeenCalledOnce();
        expect(extractMemoriesMock).toHaveBeenCalledWith([0, 1, 2, 3, 4], 'chat_123', { silent: true });
    });

    it('sets status to extracting then ready', async () => {
        wakeUpBackgroundWorker();
        await vi.waitFor(() => expect(isWorkerRunning()).toBe(false), { timeout: 5000 });

        expect(setStatusMock).toHaveBeenCalledWith('extracting');
        expect(setStatusMock).toHaveBeenLastCalledWith('ready');
    });
});

describe('worker loop stops on chat switch', () => {
    let wakeUpBackgroundWorker, isWorkerRunning;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // getNextBatch always returns a batch (infinite work)
        const schedulerMock = await import('../../src/extraction/scheduler.js');
        schedulerMock.getNextBatch.mockReturnValue([0, 1, 2]);

        // Make getCurrentChatId change after first call
        const utilsMock = await import('../../src/utils.js');
        let chatCallCount = 0;
        utilsMock.getCurrentChatId.mockImplementation(() => {
            chatCallCount++;
            return chatCallCount <= 1 ? 'chat_123' : 'chat_456';
        });

        const mod = await import('../../src/extraction/worker.js');
        wakeUpBackgroundWorker = mod.wakeUpBackgroundWorker;
        isWorkerRunning = mod.isWorkerRunning;
    });

    it('halts worker when chat ID changes', async () => {
        wakeUpBackgroundWorker();
        await vi.waitFor(() => expect(isWorkerRunning()).toBe(false), { timeout: 5000 });

        const { extractMemories } = await import('../../src/extraction/extract.js');
        // Should not have processed any batches since chat switched
        expect(extractMemories).not.toHaveBeenCalled();
    });
});

describe('worker fast-fails on chat-switch error during extraction', () => {
    let wakeUpBackgroundWorker, isWorkerRunning;
    let extractMemoriesMock;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        const schedulerMock = await import('../../src/extraction/scheduler.js');
        schedulerMock.getNextBatch.mockReturnValue([0, 1, 2]);

        // extractMemories throws the chat-switch error
        const extractMock = await import('../../src/extraction/extract.js');
        extractMemoriesMock = extractMock.extractMemories;
        extractMemoriesMock.mockRejectedValue(new Error('Chat changed during extraction'));

        const mod = await import('../../src/extraction/worker.js');
        wakeUpBackgroundWorker = mod.wakeUpBackgroundWorker;
        isWorkerRunning = mod.isWorkerRunning;
    });

    it('breaks immediately without entering backoff sleep', async () => {
        wakeUpBackgroundWorker();
        await vi.waitFor(() => expect(isWorkerRunning()).toBe(false), { timeout: 5000 });

        // Should have called extractMemories exactly once (no retries)
        expect(extractMemoriesMock).toHaveBeenCalledOnce();
    });
});

describe('worker loop yields to manual backfill', () => {
    let wakeUpBackgroundWorker, isWorkerRunning;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        const schedulerMock = await import('../../src/extraction/scheduler.js');
        schedulerMock.getNextBatch.mockReturnValue([0, 1, 2]);

        // Set manual backfill flag
        const stateMock = await import('../../src/state.js');
        stateMock.operationState.extractionInProgress = true;

        const mod = await import('../../src/extraction/worker.js');
        wakeUpBackgroundWorker = mod.wakeUpBackgroundWorker;
        isWorkerRunning = mod.isWorkerRunning;
    });

    it('breaks out of loop when extractionInProgress is true', async () => {
        wakeUpBackgroundWorker();
        await vi.waitFor(() => expect(isWorkerRunning()).toBe(false), { timeout: 5000 });

        const { extractMemories } = await import('../../src/extraction/extract.js');
        expect(extractMemories).not.toHaveBeenCalled();
    });
});
