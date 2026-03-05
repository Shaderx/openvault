import { describe, expect, it } from 'vitest';
import { defaultSettings, UI_DEFAULT_HINTS } from '../src/constants.js';

describe('defaultSettings after smart retrieval removal', () => {
    it('does not contain smartRetrievalEnabled', () => {
        expect(defaultSettings).not.toHaveProperty('smartRetrievalEnabled');
    });

    it('does not contain retrievalProfile', () => {
        expect(defaultSettings).not.toHaveProperty('retrievalProfile');
    });
});

describe('new feature settings', () => {
    it('has reflectionThreshold default', () => {
        expect(defaultSettings.reflectionThreshold).toBe(40);
    });

    it('has worldContextBudget default', () => {
        expect(defaultSettings.worldContextBudget).toBe(2000);
    });

    it('has communityDetectionInterval default', () => {
        expect(defaultSettings.communityDetectionInterval).toBe(50);
    });
});

describe('UI_DEFAULT_HINTS for features', () => {
    it('has reflectionThreshold hint', () => {
        expect(UI_DEFAULT_HINTS.reflectionThreshold).toBe(40);
    });

    it('has worldContextBudget hint', () => {
        expect(UI_DEFAULT_HINTS.worldContextBudget).toBe(2000);
    });

    it('has communityDetectionInterval hint', () => {
        expect(UI_DEFAULT_HINTS.communityDetectionInterval).toBe(50);
    });
});

describe('dedupJaccardThreshold default', () => {
    it('has dedupJaccardThreshold in defaultSettings', () => {
        expect(defaultSettings.dedupJaccardThreshold).toBe(0.6);
    });

    it('has dedupJaccardThreshold in UI_DEFAULT_HINTS', () => {
        expect(UI_DEFAULT_HINTS.dedupJaccardThreshold).toBe(0.6);
    });
});

describe('all settings used in backend have UI hints', () => {
    const requiredHints = [
        'forgetfulnessBaseLambda',
        'forgetfulnessImportance5Floor',
        'reflectionDecayThreshold',
        'entityDescriptionCap',
        'maxReflectionsPerCharacter',
        'communityStalenessThreshold',
        'dedupJaccardThreshold',
    ];

    for (const key of requiredHints) {
        it(`has UI_DEFAULT_HINTS.${key}`, () => {
            expect(UI_DEFAULT_HINTS[key]).toBeDefined();
            expect(UI_DEFAULT_HINTS[key]).toBe(defaultSettings[key]);
        });
    }
});
