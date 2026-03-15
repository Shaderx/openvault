import { describe, expect, it } from 'vitest';
import { getExamples } from '../../../src/prompts/graph/examples/index.js';
const GRAPH_EXAMPLES = getExamples('auto');

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

describe('GRAPH_EXAMPLES', () => {
    it('exports exactly 8 examples', () => {
        expect(GRAPH_EXAMPLES).toHaveLength(8);
    });

    it('each example has required fields: label, input, output (no thinking)', () => {
        for (const ex of GRAPH_EXAMPLES) {
            expect(ex).toHaveProperty('label');
            expect(ex).toHaveProperty('input');
            expect(ex).toHaveProperty('output');
            expect(typeof ex.input).toBe('string');
            expect(typeof ex.output).toBe('string');
            // Graph uses { prefill, no thinking
            expect(ex.thinking).toBeUndefined();
        }
    });

    it('has 4 English and 4 Russian examples', () => {
        const enExamples = GRAPH_EXAMPLES.filter((ex) => ex.label.includes('EN'));
        const ruExamples = GRAPH_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        expect(enExamples).toHaveLength(4);
        expect(ruExamples).toHaveLength(4);
    });

    it('Russian examples have Russian text in output', () => {
        const ruExamples = GRAPH_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        const cyrillicRe = /[\u0400-\u04FF]/;
        for (const ex of ruExamples) {
            expect(cyrillicRe.test(ex.output), `RU example "${ex.label}" should have Cyrillic in output`).toBe(true);
        }
    });

    it('all outputs contain both entities and relationships keys', () => {
        for (const ex of GRAPH_EXAMPLES) {
            const parsed = JSON.parse(extractJson(ex.output));
            expect(parsed).toHaveProperty('entities');
            expect(parsed).toHaveProperty('relationships');
        }
    });

    it('Russian entity names use nominative case', () => {
        const ruExamples = GRAPH_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        for (const ex of ruExamples) {
            const parsed = JSON.parse(extractJson(ex.output));
            for (const entity of parsed.entities) {
                // Nominative Russian names should not end in typical oblique case endings
                // This is a heuristic — mainly checks that "Ошейником" doesn't appear as a name
                expect(entity.name).not.toMatch(/ником$/);
                expect(entity.name).not.toMatch(/нику$/);
            }
        }
    });

    it('all outputs have <thinking> tags before JSON', () => {
        for (const ex of GRAPH_EXAMPLES) {
            expect(ex.output).toContain('<thinking>');
            expect(ex.output).toContain('</thinking>');
        }
    });

    it('all thinking blocks in output follow rigid Step N format', () => {
        for (const ex of GRAPH_EXAMPLES) {
            const thinkMatch = ex.output.match(/<thinking>([\s\S]*?)<\/thinking>/);
            expect(thinkMatch, `"${ex.label}" must have <thinking> block`).not.toBeNull();
            const thinkText = thinkMatch[1].trim();
            expect(thinkText, `"${ex.label}" must start with Step 1:`).toMatch(/^Step 1:/);
            expect(thinkText, `"${ex.label}" must have Step 2:`).toContain('Step 2:');
        }
    });
});