import { describe, expect, it } from 'vitest';
import { UNIFIED_REFLECTION_EXAMPLES } from '../../../src/prompts/examples/reflections.js';

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

describe('UNIFIED_REFLECTION_EXAMPLES', () => {
    it('exports exactly 6 examples (3 EN + 3 RU)', () => {
        expect(UNIFIED_REFLECTION_EXAMPLES).toHaveLength(6);
    });

    it('contains 3 English examples', () => {
        const enExamples = UNIFIED_REFLECTION_EXAMPLES.filter(e => e.label.includes('(EN'));
        expect(enExamples).toHaveLength(3);
    });

    it('contains 3 Russian examples', () => {
        const ruExamples = UNIFIED_REFLECTION_EXAMPLES.filter(e => e.label.includes('(RU'));
        expect(ruExamples).toHaveLength(3);
    });

    it('each example has input, output with reflections array', () => {
        for (const example of UNIFIED_REFLECTION_EXAMPLES) {
            expect(example.input).toBeDefined();
            expect(example.output).toBeDefined();
            const parsed = JSON.parse(extractJson(example.output));
            expect(Array.isArray(parsed.reflections)).toBe(true);
            expect(parsed.reflections.length).toBeGreaterThan(0);
            expect(parsed.reflections[0]).toHaveProperty('question');
            expect(parsed.reflections[0]).toHaveProperty('insight');
            expect(parsed.reflections[0]).toHaveProperty('evidence_ids');
        }
    });

    it('progresses from SFW to explicit content', () => {
        const labels = UNIFIED_REFLECTION_EXAMPLES.map(e => e.label);
        const hasSFW = labels.some(l => l.includes('SFW'));
        const hasModerate = labels.some(l => l.includes('Moderate'));
        const hasExplicit = labels.some(l => l.includes('Explicit'));
        expect(hasSFW).toBe(true);
        expect(hasModerate).toBe(true);
        expect(hasExplicit).toBe(true);
    });

    it('all outputs have <thinking> tags before JSON', () => {
        for (const ex of UNIFIED_REFLECTION_EXAMPLES) {
            expect(ex.output).toContain('<thinking>');
            expect(ex.output).toContain('</thinking>');
        }
    });
});