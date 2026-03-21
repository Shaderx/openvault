import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetExtensionPrompt = vi.fn();

describe('safeSetExtensionPrompt with position', () => {
    beforeEach(async () => {
        vi.resetModules();
        mockSetExtensionPrompt.mockReset();

        vi.doMock('../../src/deps.js', () => ({
            getDeps: () => ({
                setExtensionPrompt: mockSetExtensionPrompt,
                extension_prompt_types: {
                    IN_PROMPT: 0,
                    AN: 2,
                    AN_SCOPE: 3,
                    CHAT: 4,
                },
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));
    });

    it('should use default position when not specified', async () => {
        const { safeSetExtensionPrompt } = await import('../../src/utils/st-helpers.js');
        safeSetExtensionPrompt('test content');
        expect(mockSetExtensionPrompt).toHaveBeenCalledWith(
            'openvault',
            'test content',
            0, // IN_PROMPT
            0 // depth
        );
    });

    it('should accept position parameter', async () => {
        const { safeSetExtensionPrompt } = await import('../../src/utils/st-helpers.js');
        safeSetExtensionPrompt('test content', 'openvault', 2, 4);
        expect(mockSetExtensionPrompt).toHaveBeenCalledWith(
            'openvault',
            'test content',
            2, // AN
            4 // depth
        );
    });

    it('should skip injection when position is CUSTOM (-1)', async () => {
        const { safeSetExtensionPrompt } = await import('../../src/utils/st-helpers.js');
        const result = safeSetExtensionPrompt('test content', 'openvault', -1, 0);
        expect(mockSetExtensionPrompt).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('should handle named slots', async () => {
        const { safeSetExtensionPrompt } = await import('../../src/utils/st-helpers.js');
        safeSetExtensionPrompt('world content', 'openvault_world', 1, 0);
        expect(mockSetExtensionPrompt).toHaveBeenCalledWith(
            'openvault_world',
            'world content',
            0, // IN_PROMPT (mapped from 1)
            0
        );
    });
});
