import { describe, expect, it } from 'vitest';
import { INSIGHT_EXAMPLES } from '../../../src/prompts/examples/insights.js';

describe('INSIGHT_EXAMPLES', () => {
    it('exports exactly 6 examples', () => {
        expect(INSIGHT_EXAMPLES).toHaveLength(6);
    });

    it('each example has label, input, output (no thinking)', () => {
        for (const ex of INSIGHT_EXAMPLES) {
            expect(ex).toHaveProperty('label');
            expect(ex).toHaveProperty('input');
            expect(ex).toHaveProperty('output');
            expect(ex.thinking).toBeUndefined();
        }
    });

    it('has 3 English and 3 Russian examples', () => {
        expect(INSIGHT_EXAMPLES.filter((ex) => ex.label.includes('EN'))).toHaveLength(3);
        expect(INSIGHT_EXAMPLES.filter((ex) => ex.label.includes('RU'))).toHaveLength(3);
    });

    it('all outputs have 1-3 insights with evidence_ids', () => {
        for (const ex of INSIGHT_EXAMPLES) {
            const parsed = JSON.parse(ex.output);
            expect(parsed.insights.length).toBeGreaterThanOrEqual(1);
            expect(parsed.insights.length).toBeLessThanOrEqual(3);
            for (const insight of parsed.insights) {
                expect(insight).toHaveProperty('insight');
                expect(insight).toHaveProperty('evidence_ids');
                expect(insight.evidence_ids.length).toBeGreaterThan(0);
            }
        }
    });

    it('Russian examples have Russian insight text', () => {
        const cyrillicRe = /[\u0400-\u04FF]/;
        const ruExamples = INSIGHT_EXAMPLES.filter((ex) => ex.label.includes('RU'));
        for (const ex of ruExamples) {
            const parsed = JSON.parse(ex.output);
            for (const ins of parsed.insights) {
                expect(cyrillicRe.test(ins.insight), `Insight in "${ex.label}" should be Russian`).toBe(true);
            }
        }
    });
});
