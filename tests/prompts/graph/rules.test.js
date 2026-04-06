import { describe, expect, it } from 'vitest';
import { GRAPH_RULES } from '../../../src/prompts/graph/rules.js';

describe('graph/rules', () => {
    it('should include <thinking_process> block in GRAPH_RULES', () => {
        expect(GRAPH_RULES).toContain('<thinking_process>');
        expect(GRAPH_RULES).toContain('</thinking_process>');
    });

    it('should include the 4 steps in thinking_process', () => {
        expect(GRAPH_RULES).toContain('Step 1: Entity scan');
        expect(GRAPH_RULES).toContain('Step 2: Type validation');
        expect(GRAPH_RULES).toContain('Step 3: Relationship map');
        expect(GRAPH_RULES).toContain('Step 4: Output');
    });

    it('should reference <think> tags in thinking_process', () => {
        expect(GRAPH_RULES).toContain('<think>');
    });

    it('should include fictional identities in PERSON definition', () => {
        expect(GRAPH_RULES).toContain('PERSON:');
        expect(GRAPH_RULES).toContain('fictional identities presented as characters');
        expect(GRAPH_RULES).toContain('personas');
        expect(GRAPH_RULES).toContain('alter-egos');
        expect(GRAPH_RULES).toContain('avatars');
    });

    it('should include dietary/lifestyle requirements in CONCEPT definition', () => {
        expect(GRAPH_RULES).toContain('dietary/lifestyle requirements');
        expect(GRAPH_RULES).toContain('Peanut Allergy');
        expect(GRAPH_RULES).toContain('Veganism');
    });

    it('should include preference capture instruction', () => {
        expect(GRAPH_RULES).toContain('Capture durable character preferences as relationships');
        expect(GRAPH_RULES).toContain('Strongly dislikes');
    });
});
