import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionName } from '../../src/constants.js';
import { resetDeps, setDeps } from '../../src/deps.js';
import { logDebug, logError, logInfo, logRequest, logWarn } from '../../src/utils/logging.js';

describe('logging', () => {
    // Test that verifies all expected exports are available
    // This prevents regression where imports break due to missing/renamed exports
    it('exports all expected logging functions', async () => {
        // Dynamic import to ensure we test the actual module exports
        const module = await import('../../src/utils/logging.js');
        expect(module).toHaveProperty('logDebug');
        expect(module).toHaveProperty('logInfo');
        expect(module).toHaveProperty('logWarn');
        expect(module).toHaveProperty('logError');
        expect(module).toHaveProperty('logRequest');

        // Verify the old 'log' export does NOT exist (prevent re-introduction)
        expect(module).not.toHaveProperty('log');
    });

    let mockConsole;

    beforeEach(() => {
        mockConsole = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    });
    afterEach(() => resetDeps());

    describe('logDebug', () => {
        it('logs when debugMode is true', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: true } }),
            });
            logDebug('test debug');
            expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] test debug');
        });

        it('logs with data when debugMode is true', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: true } }),
            });
            logDebug('scores', { top: 0.9 });
            expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] scores', { top: 0.9 });
        });

        it('does not log when debugMode is false', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
            });
            logDebug('hidden');
            expect(mockConsole.log).not.toHaveBeenCalled();
        });

        it('does not log when settings are missing', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({}),
            });
            logDebug('hidden');
            expect(mockConsole.log).not.toHaveBeenCalled();
        });
    });

    describe('logInfo', () => {
        it('always logs regardless of debugMode', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
            });
            logInfo('Extension initialized');
            expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] Extension initialized');
        });

        it('logs with data', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            logInfo('Backfill complete', { memories: 5, nodes: 12 });
            expect(mockConsole.log).toHaveBeenCalledWith('[OpenVault] Backfill complete', { memories: 5, nodes: 12 });
        });
    });

    describe('logWarn', () => {
        it('always warns regardless of debugMode', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
            });
            logWarn('Stale lock cleared');
            expect(mockConsole.warn).toHaveBeenCalledWith('[OpenVault] Stale lock cleared');
        });

        it('warns with data', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            logWarn('Array fallback', { length: 3 });
            expect(mockConsole.warn).toHaveBeenCalledWith('[OpenVault] Array fallback', { length: 3 });
        });
    });

    describe('logError', () => {
        it('logs error message with prefix', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            logError('Something broke');
            expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Something broke');
        });

        it('logs error object when provided', () => {
            setDeps({
                console: mockConsole,
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            const err = new Error('boom');
            logError('Parse failed', err);
            expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Parse failed');
            expect(mockConsole.error).toHaveBeenCalledWith(err);
        });

        it('logs context object in collapsed group when provided', () => {
            const groupCollapsed = vi.fn();
            const groupEnd = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd },
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            logError('Extraction failed', new Error('timeout'), { messageCount: 42 });
            expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Extraction failed');
            expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] Error context');
            expect(mockConsole.log).toHaveBeenCalledWith({ messageCount: 42 });
            expect(groupEnd).toHaveBeenCalled();
        });

        it('skips context group when context is not provided', () => {
            const groupCollapsed = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd: vi.fn() },
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            logError('Simple error', new Error('x'));
            expect(groupCollapsed).not.toHaveBeenCalled();
        });

        it('handles missing groupCollapsed gracefully', () => {
            setDeps({
                console: mockConsole, // no groupCollapsed
                getExtensionSettings: () => ({ [extensionName]: {} }),
            });
            // Should not throw even with context
            logError('Fallback test', new Error('y'), { key: 'val' });
            expect(mockConsole.error).toHaveBeenCalledWith('[OpenVault] Fallback test');
            expect(mockConsole.log).toHaveBeenCalledWith({ key: 'val' });
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

        it('logs compact summary on success when requestLogging is enabled', () => {
            const groupCollapsed = vi.fn();
            const groupEnd = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd },
                getExtensionSettings: () => ({ [extensionName]: { requestLogging: true } }),
            });
            logRequest('Extraction', { messages: ['m1'], maxTokens: 200, profileId: 'p2', response: 'ok' });
            expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] ✅ Extraction — OK (2 chars, 1 messages)');
            expect(mockConsole.log).toHaveBeenCalledWith('Profile:', 'p2');
            expect(mockConsole.log).toHaveBeenCalledWith('Max Tokens:', 200);
            // Successful calls should NOT log full Response or Messages
            expect(mockConsole.log).not.toHaveBeenCalledWith('Response:', expect.anything());
            expect(mockConsole.log).not.toHaveBeenCalledWith('Messages:', expect.anything());
            expect(groupEnd).toHaveBeenCalled();
        });

        it('logs full verbose output on failure', () => {
            const groupCollapsed = vi.fn();
            const groupEnd = vi.fn();
            setDeps({
                console: { ...mockConsole, groupCollapsed, groupEnd },
                getExtensionSettings: () => ({ [extensionName]: { requestLogging: true } }),
            });
            const err = new Error('boom');
            logRequest('Extraction', { messages: ['m1'], maxTokens: 100, profileId: 'p1', response: 'bad output', error: err });
            expect(groupCollapsed).toHaveBeenCalledWith('[OpenVault] ❌ Extraction — FAILED');
            expect(mockConsole.log).toHaveBeenCalledWith('Profile:', 'p1');
            expect(mockConsole.log).toHaveBeenCalledWith('Messages:', ['m1']);
            expect(mockConsole.log).toHaveBeenCalledWith('Response:', 'bad output');
            expect(mockConsole.error).toHaveBeenCalledWith('Error:', err);
            expect(groupEnd).toHaveBeenCalled();
        });
    });
});
