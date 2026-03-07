import { describe, expect, it } from 'vitest';
import { defaultSettings, PAYLOAD_CALC } from '../src/constants.js';

describe('PAYLOAD_CALC', () => {
    it('exports all required fields', () => {
        expect(PAYLOAD_CALC.LLM_OUTPUT_TOKENS).toBe(8000);
        expect(PAYLOAD_CALC.PROMPT_ESTIMATE).toBe(2000);
        expect(PAYLOAD_CALC.SAFETY_BUFFER).toBe(2000);
        expect(PAYLOAD_CALC.OVERHEAD).toBe(12000);
        expect(PAYLOAD_CALC.THRESHOLD_GREEN).toBe(32000);
        expect(PAYLOAD_CALC.THRESHOLD_YELLOW).toBe(48000);
        expect(PAYLOAD_CALC.THRESHOLD_ORANGE).toBe(64000);
    });

    it('default slider sum + overhead = THRESHOLD_GREEN', () => {
        const total =
            defaultSettings.extractionTokenBudget + defaultSettings.extractionRearviewTokens + PAYLOAD_CALC.OVERHEAD;
        expect(total).toBe(PAYLOAD_CALC.THRESHOLD_GREEN);
    });
});

describe('defaultSettings updated defaults', () => {
    it('extractionTokenBudget is 12000', () => {
        expect(defaultSettings.extractionTokenBudget).toBe(12000);
    });

    it('extractionRearviewTokens is 8000', () => {
        expect(defaultSettings.extractionRearviewTokens).toBe(8000);
    });
});

describe('defaultSettings includes query-context keys', () => {
    it('entityWindowSize is 10', () => {
        expect(defaultSettings.entityWindowSize).toBe(10);
    });
    it('embeddingWindowSize is 5', () => {
        expect(defaultSettings.embeddingWindowSize).toBe(5);
    });
    it('recencyDecayFactor is 0.09', () => {
        expect(defaultSettings.recencyDecayFactor).toBe(0.09);
    });
    it('topEntitiesCount is 5', () => {
        expect(defaultSettings.topEntitiesCount).toBe(5);
    });
    it('entityBoostWeight is 5.0', () => {
        expect(defaultSettings.entityBoostWeight).toBe(5.0);
    });
});
