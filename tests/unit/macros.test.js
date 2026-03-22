import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('macros module', () => {
    let mockRegisterMacro;

    beforeEach(async () => {
        vi.resetModules();
        mockRegisterMacro = vi.fn();

        // Use vi.doMock for dynamic mocking
        vi.doMock('../../src/deps.js', () => ({
            getDeps: () => ({
                getContext: () => ({
                    registerMacro: mockRegisterMacro,
                }),
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));
    });

    it('should export cachedContent object', async () => {
        const { cachedContent } = await import('../../src/injection/macros.js');
        expect(cachedContent).toBeDefined();
        expect(cachedContent.memory).toBe('');
        expect(cachedContent.world).toBe('');
    });

    it('should register openvault_memory macro on init', async () => {
        await import('../../src/injection/macros.js');
        expect(mockRegisterMacro).toHaveBeenCalledWith('openvault_memory', expect.any(Function));
    });

    it('should register openvault_world macro on init', async () => {
        await import('../../src/injection/macros.js');
        expect(mockRegisterMacro).toHaveBeenCalledWith('openvault_world', expect.any(Function));
    });
});
