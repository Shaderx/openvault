// @ts-check
import { describe, expect, it } from 'vitest';
import { GRAPH_RULES } from '../../../src/prompts/graph/rules.js';

describe('GRAPH_RULES', () => {
    it('should contain Step 4 with verification instruction', () => {
        expect(GRAPH_RULES).toContain('Step 4: Verify');
        expect(GRAPH_RULES).toContain('matches Entity name');
    });

    it('should contain Step 5 for output JSON', () => {
        expect(GRAPH_RULES).toContain('Step 5: Count');
    });

    it('should have verification step before output step', () => {
        const verifyIndex = GRAPH_RULES.indexOf('Step 4: Verify');
        const countIndex = GRAPH_RULES.indexOf('Step 5: Count');
        expect(verifyIndex).toBeGreaterThan(-1);
        expect(countIndex).toBeGreaterThan(-1);
        expect(verifyIndex).toBeLessThan(countIndex);
    });

    describe('OBJECT type definition', () => {
        it('should contain PROHIBITED list for transient objects', () => {
            expect(GRAPH_RULES).toContain('PROHIBITED:');
            expect(GRAPH_RULES).toContain('food, meals, cleaning supplies');
            expect(GRAPH_RULES).toContain('temporary clothing states, consumables');
            expect(GRAPH_RULES).toContain('Do NOT extract fluids');
        });

        it('should allow significant unique items', () => {
            expect(GRAPH_RULES).toContain('The One Ring');
            expect(GRAPH_RULES).toContain('Cursed Sword');
        });
    });
});
