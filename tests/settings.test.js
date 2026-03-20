import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock lodash implementations
const lodashGet = (obj, path, defaultValue) => {
    const travel = (regexp) =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === null ? defaultValue : result;
};

const lodashSet = (obj, path, value) => {
    if (Object(obj) !== obj) return obj;
    const keys = String(path).split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) current[key] = {};
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
};

const lodashHas = (obj, path) => {
    const travel = (regexp) =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result !== undefined && result !== null;
};

const lodashMerge = (target, source) => {
    const result = { ...target };
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = lodashMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
};

describe('Centralized Settings Module', () => {
    let mockExtensionSettings;
    let mockLodash;
    let mockSaveSettingsDebounced;

    beforeEach(async () => {
        vi.resetModules();

        // Setup mocks - use mock implementations
        mockSaveSettingsDebounced = vi.fn();

        mockLodash = {
            get: vi.fn(lodashGet),
            set: vi.fn(lodashSet),
            has: vi.fn(lodashHas),
            merge: vi.fn(lodashMerge),
        };

        mockExtensionSettings = {
            openvault: {
                enabled: true,
                extractionTokenBudget: 8000,
                injection: {
                    memory: { position: 1, depth: 4 },
                    world: { position: 1, depth: 4 },
                },
            },
        };

        // Mock deps.js
        vi.doMock('../src/deps.js', () => ({
            getDeps: () => ({
                getContext: () => ({
                    lodash: mockLodash,
                }),
                getExtensionSettings: () => mockExtensionSettings,
                saveSettingsDebounced: mockSaveSettingsDebounced,
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));

        // Mock constants.js
        vi.doMock('../src/constants.js', () => ({
            extensionName: 'openvault',
            defaultSettings: {
                enabled: true,
                extractionTokenBudget: 8000,
                injection: {
                    memory: { position: 1, depth: 4 },
                },
            },
        }));
    });

    describe('getSettings', () => {
        it('should return entire settings object when no path provided', async () => {
            const { getSettings } = await import('../src/settings.js');
            const result = getSettings();
            expect(result).toEqual(mockExtensionSettings.openvault);
        });
    });
});
