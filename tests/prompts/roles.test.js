import { describe, expect, it } from 'vitest';
import { COMMUNITIES_ROLE, EVENT_ROLE, GRAPH_ROLE, INSIGHTS_ROLE, QUESTIONS_ROLE } from '../../src/prompts/roles.js';

describe('Role exports', () => {
    const roles = { EVENT_ROLE, GRAPH_ROLE, QUESTIONS_ROLE, INSIGHTS_ROLE, COMMUNITIES_ROLE };

    it('exports all 5 roles as non-empty strings', () => {
        for (const [name, role] of Object.entries(roles)) {
            expect(typeof role, `${name} should be a string`).toBe('string');
            expect(role.length, `${name} should be non-empty`).toBeGreaterThan(50);
        }
    });

    it('EVENT_ROLE contains key extraction framing', () => {
        expect(EVENT_ROLE).toContain('structured data extraction');
        expect(EVENT_ROLE).toContain('read-only');
        expect(EVENT_ROLE).toContain('fiction');
    });

    it('GRAPH_ROLE contains entity extraction framing', () => {
        expect(GRAPH_ROLE).toContain('knowledge graph');
        expect(GRAPH_ROLE).toContain('entities');
        expect(GRAPH_ROLE).toContain('relationships');
    });

    it('GRAPH_ROLE contains nominative-case normalization rule', () => {
        expect(GRAPH_ROLE).toContain('Nominative');
        expect(GRAPH_ROLE).toContain('base dictionary form');
        // Must mention Russian example
        expect(GRAPH_ROLE).toContain('ошейник');
    });

    it('QUESTIONS_ROLE contains psychologist framing', () => {
        expect(QUESTIONS_ROLE).toContain('psycholog');
        expect(QUESTIONS_ROLE).toContain('character');
    });

    it('INSIGHTS_ROLE contains analyst framing', () => {
        expect(INSIGHTS_ROLE).toContain('analyst');
        expect(INSIGHTS_ROLE).toContain('insights');
    });

    it('COMMUNITIES_ROLE contains graph analyst framing', () => {
        expect(COMMUNITIES_ROLE).toContain('knowledge graph');
        expect(COMMUNITIES_ROLE).toContain('communities');
    });

    it('no role contains "Write in ENGLISH" or language enforcement', () => {
        for (const [name, role] of Object.entries(roles)) {
            expect(role, `${name} must not enforce English`).not.toContain('Write in ENGLISH');
            expect(role, `${name} must not enforce English`).not.toContain('in English');
        }
    });
});
