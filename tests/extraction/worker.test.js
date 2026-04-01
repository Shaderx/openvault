import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { setWorkerRunning } from '../../src/state.js';

describe('worker abort handling', () => {
    beforeEach(async () => {
        vi.resetModules();
        setWorkerRunning(false);
        await registerCdnOverrides();
    });

    afterEach(() => {
        setWorkerRunning(false);
        resetDeps();
        vi.restoreAllMocks();
    });

    it('worker loop exits on chat switch without throwing', async () => {
        // Chat ID changes between guard checks → worker breaks out
        let callCount = 0;
        setupTestContext({
            context: {
                // Return different chatId on second access
                get chatId() {
                    callCount++;
                    return callCount <= 1 ? 'chat-A' : 'chat-B';
                },
                chat: [{ mes: 'test', is_user: true }],
                chatMetadata: { openvault: { memories: [], processed_message_ids: [] } },
            },
            settings: { enabled: true, extractionTokenBudget: 9999 },
        });

        const { wakeUpBackgroundWorker } = await import('../../src/extraction/worker.js');
        const { isWorkerRunning } = await import('../../src/state.js');

        wakeUpBackgroundWorker();
        // Wait for async loop to settle
        await new Promise((r) => setTimeout(r, 100));
        expect(isWorkerRunning()).toBe(false);
    });
});
