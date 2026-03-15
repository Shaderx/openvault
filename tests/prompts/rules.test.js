import { describe, expect, it } from 'vitest';
import { MIRROR_LANGUAGE_RULES } from '../../src/prompts/shared/rules.js';

describe('MIRROR_LANGUAGE_RULES', () => {
    it('is a non-empty string', () => {
        expect(typeof MIRROR_LANGUAGE_RULES).toBe('string');
        expect(MIRROR_LANGUAGE_RULES.length).toBeGreaterThan(50);
    });

    it('uses high-contrast protocol format', () => {
        expect(MIRROR_LANGUAGE_RULES).toContain('KEYS = ENGLISH ONLY');
        expect(MIRROR_LANGUAGE_RULES).toContain('VALUES = SAME LANGUAGE');
        expect(MIRROR_LANGUAGE_RULES).toContain('NAMES = EXACT ORIGINAL SCRIPT');
        expect(MIRROR_LANGUAGE_RULES).toContain('THINK BLOCKS = ENGLISH ONLY');
        expect(MIRROR_LANGUAGE_RULES).toContain('NO MIXING');
    });

    it('preserves name examples in both scripts', () => {
        expect(MIRROR_LANGUAGE_RULES).toContain('Саша');
        expect(MIRROR_LANGUAGE_RULES).toContain('Suzy');
    });

    it('wrapped in <language_rules> tags', () => {
        expect(MIRROR_LANGUAGE_RULES).toMatch(/^<language_rules>/);
        expect(MIRROR_LANGUAGE_RULES).toMatch(/<\/language_rules>$/);
    });

    it('does NOT contain verbose numbered rules from old format', () => {
        expect(MIRROR_LANGUAGE_RULES).not.toContain('Rule 1');
        expect(MIRROR_LANGUAGE_RULES).not.toContain('Do NOT mix languages within a single output field');
    });
});
