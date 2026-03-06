import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionName } from '../../src/constants.js';
import { resetDeps, setDeps } from '../../src/deps.js';
import { log, logRequest } from '../../src/utils/logging.js';

describe('logging', () => {
    let mockConsole;

    beforeEach(() => {
        mockConsole = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    });
    afterEach(() => resetDeps());

    describe('log', () => {
        it('logs message when debug mode is enabled', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: true } }),
            });
            log('test message');
            expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] test message');
        });

        it('does not log when debug mode is disabled', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
            });
            log('test message');
            expect(mockConsole.log).not.toHaveBeenCalled();
        });

        it('handles missing settings gracefully', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({}),
            });
            log('test message');
            expect(mockConsole.log).not.toHaveBeenCalled();
        });
    });

    describe('logRequest', () => {
        it('does not log when requestLogging is disabled', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { requestLogging: false } }),
            });
            logRequest('Test', { messages: [], maxTokens: 100, profileId: 'p1' });
            expect(mockConsole.log).not.toHaveBeenCalled();
        });

        it('logs grouped output when requestLogging is enabled', () => {
            const groupCollapsed = vi.fn();
            const groupEnd = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd },
                getExtensionSettings: () => ({ [extensionName]: { requestLogging: true } }),
            });
            logRequest('Extraction', { messages: ['m1'], maxTokens: 200, profileId: 'p2', response: 'ok' });
            expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] ✅ Extraction — OK');
            expect(mockConsole.log).toHaveBeenCalledWith('Profile:', 'p2');
            expect(mockConsole.log).toHaveBeenCalledWith('Response:', 'ok');
            expect(groupEnd).toHaveBeenCalled();
        });

        it('logs error label on failure', () => {
            const groupCollapsed = vi.fn();
            const groupEnd = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd },
                getExtensionSettings: () => ({ [extensionName]: { requestLogging: true } }),
            });
            const err = new Error('boom');
            logRequest('Extraction', { messages: [], maxTokens: 100, profileId: 'p1', error: err });
            expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] ❌ Extraction — FAILED');
            expect(mockConsole.error).toHaveBeenCalledWith('Error:', err);
        });
    });
});
