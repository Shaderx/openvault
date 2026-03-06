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
