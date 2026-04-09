import { describe, expect, it } from 'vitest';
import {
    buildCommunitySummaryPrompt,
    buildEventExtractionPrompt,
    buildGraphExtractionPrompt,
} from '../../src/prompts/index.js';

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
