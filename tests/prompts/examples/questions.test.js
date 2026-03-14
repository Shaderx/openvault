import { describe, expect, it } from 'vitest';
import { QUESTION_EXAMPLES } from '../../../src/prompts/examples/questions.js';

/**
 * Extract JSON from output that may contain <thinking> tags.
 * If the output has <thinking>...</thinking>, extract the JSON after it.
 * Otherwise, return the original output.
 */
function extractJson(output) {
    const thinkingEnd = output.indexOf('</thinking>');
    if (thinkingEnd !== -1) {
        return output.slice(thinkingEnd + '</thinking>'.length).trim();
    }
    return output;
}

describe('QUESTION_EXAMPLES', () => {
    it('exports exactly 6 examples', () => {
        expect(QUESTION_EXAMPLES).toHaveLength(6);
    });

    it('each example has label, input, output (no thinking)', () => {
        for (const ex of QUESTION_EXAMPLES) {
            expect(ex).toHaveProperty('label');
            expect(ex).toHaveProperty('input');
            expect(ex).toHaveProperty('output');
            expect(ex.thinking).toBeUndefined();
        }
    });

    it('has 3 English and 3 Russian examples', () => {
        expect(QUESTION_EXAMPLES.filter((ex) => ex.label.includes('EN'))).toHaveLength(3);
        expect(QUESTION_EXAMPLES.filter((ex) => ex.label.includes('RU'))).toHaveLength(3);
    });

    it('all outputs have exactly 3 questions', () => {
        for (const ex of QUESTION_EXAMPLES) {
            const parsed = JSON.parse(extractJson(ex.output));
            expect(parsed.questions).toHaveLength(3);
        }
    });

    it('Russian examples have Russian questions', () => {
        const cyrillicRe = /[\u0400-\u04FF]/;
        const ruExamples = QUESTION_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        for (const ex of ruExamples) {
            expect(cyrillicRe.test(ex.output), `RU example "${ex.label}" should have Cyrillic`).toBe(true);
        }
    });

    it('all outputs have <thinking> tags before JSON', () => {
        for (const ex of QUESTION_EXAMPLES) {
            expect(ex.output).toContain('<thinking>');
            expect(ex.output).toContain('</thinking>');
        }
    });
});