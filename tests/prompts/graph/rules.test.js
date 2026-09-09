import { describe, expect, it } from 'vitest';
import { ENTITY_TYPES } from '../../../src/constants.js';
import { GRAPH_RULES } from '../../../src/prompts/graph/rules.js';

describe('graph extraction protocol', () => {
    it('contains the central entity vocabulary inside one paired draft block', () => {
        expect(GRAPH_RULES.match(/<draft_process>/g)).toHaveLength(1);
        expect(GRAPH_RULES.match(/<\/draft_process>/g)).toHaveLength(1);
        const draft = GRAPH_RULES.split('<draft_process>')[1].split('</draft_process>')[0];
        for (const type of Object.values(ENTITY_TYPES)) expect(draft).toContain(type);
        expect(draft).toContain('<think>');
    });
});
