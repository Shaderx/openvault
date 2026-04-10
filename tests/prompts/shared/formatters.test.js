// @ts-check
import { describe, expect, it } from 'vitest';
import { EXECUTION_TRIGGER } from '../../../src/prompts/shared/formatters.js';

describe('EXECUTION_TRIGGER', () => {
    it('should contain step-explicit output format', () => {
        expect(EXECUTION_TRIGGER).toContain('Step 1: Write your reasoning');
        expect(EXECUTION_TRIGGER).toContain('Step 2: You MUST close the reasoning block');
        expect(EXECUTION_TRIGGER).toContain('Step 3: Output ONLY a single raw JSON object');
    });

    it('should reference think tags', () => {
        expect(EXECUTION_TRIGGER).toContain('<think/>');
    });

    it('should reference closing delimiter', () => {
        expect(EXECUTION_TRIGGER).toContain('</think>');
    });

    it('should warn about JSON placement', () => {
        expect(EXECUTION_TRIGGER).toContain('Do NOT put the JSON inside the think tags');
    });
});
