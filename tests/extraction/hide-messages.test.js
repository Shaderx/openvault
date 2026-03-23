import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeps } from '../../src/deps.js';

describe('hideExtractedMessages', () => {
    beforeEach(() => {
        // vi.resetModules() causes CDN re-import - not needed for this test
    });

    afterEach(() => {
        resetDeps();
        vi.restoreAllMocks();
    });

    it('hides messages whose fingerprints are in the processed set', async () => {
        const { hideExtractedMessages } = await import('../../src/extraction/extract.js');

        // Mock scheduler module - processed fingerprints are fp1 and fp2
        vi.spyOn(await import('../../src/extraction/scheduler.js'), 'getProcessedFingerprints').mockReturnValue(
            new Set(['fp1', 'fp2'])
        );
        vi.spyOn(await import('../../src/extraction/scheduler.js'), 'getFingerprint').mockImplementation((msg) => msg.fp);

        // Mock data module
        vi.spyOn(await import('../../src/store/chat-data.js'), 'getOpenVaultData').mockReturnValue({ memories: [] });

        // Mock deps
        const mockContext = {
            chat: [
                { fp: 'fp1', is_system: false }, // processed, should hide
                { fp: 'fp2', is_system: false }, // processed, should hide
                { fp: 'fp3', is_system: false }, // not processed, keep visible
                { fp: 'fp1', is_system: true }, // already hidden, skip
            ],
        };
        const mockSaveChatConditional = vi.fn(async () => true);
        vi.spyOn(await import('../../src/deps.js'), 'getDeps').mockReturnValue({
            getContext: () => mockContext,
            saveChatConditional: mockSaveChatConditional,
            console: global.console,
        });

        const count = await hideExtractedMessages();

        expect(count).toBe(2); // Only fp1 and fp2 (not already hidden)
        expect(mockContext.chat[0].is_system).toBe(true); // fp1 now hidden
        expect(mockContext.chat[1].is_system).toBe(true); // fp2 now hidden
        expect(mockContext.chat[2].is_system).toBe(false); // fp3 still visible
        expect(mockSaveChatConditional).toHaveBeenCalled();
    });

    it('returns 0 and does not save when nothing to hide', async () => {
        const { hideExtractedMessages } = await import('../../src/extraction/extract.js');

        // Mock scheduler module - no processed fingerprints
        vi.spyOn(await import('../../src/extraction/scheduler.js'), 'getProcessedFingerprints').mockReturnValue(
            new Set([])
        );
        vi.spyOn(await import('../../src/extraction/scheduler.js'), 'getFingerprint').mockImplementation((msg) => msg.fp);

        // Mock data module
        vi.spyOn(await import('../../src/store/chat-data.js'), 'getOpenVaultData').mockReturnValue({ memories: [] });

        // Mock deps
        const mockContext = {
            chat: [
                { fp: 'fp1', is_system: false },
                { fp: 'fp2', is_system: false },
            ],
        };
        const mockSaveChatConditional = vi.fn(async () => true);
        vi.spyOn(await import('../../src/deps.js'), 'getDeps').mockReturnValue({
            getContext: () => mockContext,
            saveChatConditional: mockSaveChatConditional,
            console: global.console,
        });

        const count = await hideExtractedMessages();

        expect(count).toBe(0);
        expect(mockSaveChatConditional).not.toHaveBeenCalled();
    });
});
