import { describe, expect, it } from 'vitest';
import { COMMUNITY_EXAMPLES } from '../../../src/prompts/examples/communities.js';

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

describe('COMMUNITY_EXAMPLES', () => {
    it('exports exactly 6 examples', () => {
        expect(COMMUNITY_EXAMPLES).toHaveLength(6);
    });

    it('each example has label, input, output (no thinking)', () => {
        for (const ex of COMMUNITY_EXAMPLES) {
            expect(ex).toHaveProperty('label');
            expect(ex).toHaveProperty('input');
            expect(ex).toHaveProperty('output');
            expect(ex.thinking).toBeUndefined();
        }
    });

    it('has 3 English and 3 Russian examples', () => {
        expect(COMMUNITY_EXAMPLES.filter((ex) => ex.label.includes('EN'))).toHaveLength(3);
        expect(COMMUNITY_EXAMPLES.filter((ex) => ex.label.includes('RU'))).toHaveLength(3);
    });

    it('all outputs have title, summary, and 1-5 findings', () => {
        for (const ex of COMMUNITY_EXAMPLES) {
            const parsed = JSON.parse(extractJson(ex.output));
            expect(parsed).toHaveProperty('title');
            expect(parsed).toHaveProperty('summary');
            expect(parsed).toHaveProperty('findings');
            expect(parsed.findings.length).toBeGreaterThanOrEqual(1);
            expect(parsed.findings.length).toBeLessThanOrEqual(5);
        }
    });

    it('Russian examples have Russian summary and findings', () => {
        const cyrillicRe = /[\u0400-\u04FF]/;
        const ruExamples = COMMUNITY_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        for (const ex of ruExamples) {
            const parsed = JSON.parse(extractJson(ex.output));
            expect(cyrillicRe.test(parsed.summary), `Summary in "${ex.label}" should be Russian`).toBe(true);
            expect(cyrillicRe.test(parsed.findings[0]), `Finding in "${ex.label}" should be Russian`).toBe(true);
        }
    });

    it('all outputs have <thinking> tags before JSON', () => {
        for (const ex of COMMUNITY_EXAMPLES) {
            expect(ex.output).toContain('<thinking>');
            expect(ex.output).toContain('</thinking>');
        }
    });
});