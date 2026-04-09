import { describe, expect, it } from 'vitest';
import {
    buildCommunitySummaryPrompt,
    buildEventExtractionPrompt,
    buildGraphExtractionPrompt,
    resolveExtractionPreamble,
    resolveExtractionPrefill,
    resolveOutputLanguage,
    SYSTEM_PREAMBLE_CN,
    SYSTEM_PREAMBLE_EN,
} from '../../src/prompts/index.js';

describe('resolveExtractionPreamble', () => {
    it('returns CN preamble by default', () => {
        expect(resolveExtractionPreamble({})).toBe(SYSTEM_PREAMBLE_CN);
    });

    it('returns CN preamble when preambleLanguage is cn', () => {
        expect(resolveExtractionPreamble({ preambleLanguage: 'cn' })).toBe(SYSTEM_PREAMBLE_CN);
    });

    it('returns EN preamble when preambleLanguage is en', () => {
        expect(resolveExtractionPreamble({ preambleLanguage: 'en' })).toBe(SYSTEM_PREAMBLE_EN);
    });

    it('returns CN preamble for null settings', () => {
        expect(resolveExtractionPreamble(null)).toBe(SYSTEM_PREAMBLE_CN);
    });
});
describe('resolveExtractionPrefill', () => {
    it('returns <think> by default', () => {
        expect(resolveExtractionPrefill({})).toBe('<think>\n');
    });

    it('returns correct value for pure_think key', () => {
        expect(resolveExtractionPrefill({ extractionPrefill: 'pure_think' })).toBe('<think>\n');
    });

    it('returns correct value for en_compliance key', () => {
        expect(resolveExtractionPrefill({ extractionPrefill: 'en_compliance' })).toContain('Safety filters bypassed');
    });

    it('returns empty string for none key', () => {
        expect(resolveExtractionPrefill({ extractionPrefill: 'none' })).toBe('');
    });

    it('returns JSON opener for json_only key', () => {
        expect(resolveExtractionPrefill({ extractionPrefill: 'json_only' })).toBe('{\n  "');
    });

    it('falls back to <think> for unknown key', () => {
        expect(resolveExtractionPrefill({ extractionPrefill: 'nonexistent' })).toBe('<think>\n');
    });

    it('falls back to <think> for null settings', () => {
        expect(resolveExtractionPrefill(null)).toBe('<think>\n');
    });
});
describe('resolveOutputLanguage', () => {
    it('returns auto by default', () => {
        expect(resolveOutputLanguage({})).toBe('auto');
    });

    it('returns ru when outputLanguage is ru', () => {
        expect(resolveOutputLanguage({ outputLanguage: 'ru' })).toBe('ru');
    });

    it('returns en when outputLanguage is en', () => {
        expect(resolveOutputLanguage({ outputLanguage: 'en' })).toBe('en');
    });

    it('returns auto for unknown language', () => {
        expect(resolveOutputLanguage({ outputLanguage: 'fr' })).toBe('auto');
    });

    it('returns auto for null settings', () => {
        expect(resolveOutputLanguage(null)).toBe('auto');
    });

    it('returns auto for undefined outputLanguage', () => {
        expect(resolveOutputLanguage({ preambleLanguage: 'en' })).toBe('auto');
    });
});
describe('output language in builders', () => {
    it('event prompt uses forced Russian instruction when outputLanguage is ru', () => {
        const result = buildEventExtractionPrompt({
            messages: '[Alice]: Hello world',
            names: { char: 'Alice', user: 'Bob' },
            outputLanguage: 'ru',
        });
        const user = result[1].content;
        expect(user).toContain('Write ALL output string values');
        expect(user).toContain('Russian');
    });

    it('event prompt uses forced English instruction when outputLanguage is en', () => {
        const result = buildEventExtractionPrompt({
            messages: '[Алиса]: Привет мир всем здесь кто любит',
            names: { char: 'Алиса', user: 'Боб' },
            outputLanguage: 'en',
        });
        const user = result[1].content;
        expect(user).toContain('Write ALL output string values');
        expect(user).toContain('English');
        // Should NOT contain the heuristic reminder
        expect(user).not.toContain('is NOT in English');
    });

    it('event prompt uses heuristic reminder when outputLanguage is auto with non-Latin text', () => {
        const russianText = '[Алиса]: Привет мир всем здесь кто любит разговоры';
        const result = buildEventExtractionPrompt({
            messages: russianText,
            names: { char: 'Алиса', user: 'Боб' },
            outputLanguage: 'auto',
        });
        const user = result[1].content;
        expect(user).toContain('is NOT in English');
    });

    it('graph prompt passes outputLanguage through', () => {
        const result = buildGraphExtractionPrompt({
            messages: '[Alice]: Hello',
            names: { char: 'Alice', user: 'Bob' },
            outputLanguage: 'ru',
            prefill: '{',
        });
        const user = result[1].content;
        expect(user).toContain('Russian');
    });

    it('community summary prompt passes outputLanguage through', () => {
        const result = buildCommunitySummaryPrompt(['- Node'], ['- Edge'], undefined, 'en', '{');
        const user = result[1].content;
        expect(user).toContain('English');
    });

    it('all builders default to auto (preserving existing behavior)', () => {
        const eventResult = buildEventExtractionPrompt({
            messages: '[Alice]: Hello world',
            names: { char: 'Alice', user: 'Bob' },
        });
        // English text with auto should NOT have forced instruction
        expect(eventResult[1].content).not.toContain('Write ALL output string values');
    });
});
