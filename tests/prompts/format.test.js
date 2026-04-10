import { describe, expect, it } from 'vitest';
import { formatExamples } from '../../src/prompts/shared/format-examples.js';

describe('formatExamples', () => {
    it('wraps each example in numbered XML tags', () => {
        const examples = [{ input: 'Hello world', output: '{"events": []}' }];
        const result = formatExamples(examples);
        expect(result).toContain('<example_1>');
        expect(result).toContain('</example_1>');
    });

    it('includes <think> block when thinking field is present', () => {
        const examples = [{ input: 'text', thinking: 'Step 1: analysis', output: '{"events": []}' }];
        const result = formatExamples(examples);
        expect(result).toContain('<think>\nStep 1: analysis\n</think>');
        expect(result).toContain('{"events": []}');
    });

    it('omits <think> block when thinking field is absent', () => {
        const examples = [{ input: 'text', output: '{"entities": []}' }];
        const result = formatExamples(examples);
        expect(result).not.toContain('<think>');
    });

    it('numbers multiple examples sequentially', () => {
        const examples = [
            { input: 'first', output: '1' },
            { input: 'second', output: '2' },
            { input: 'third', output: '3' },
        ];
        const result = formatExamples(examples);
        expect(result).toContain('<example_1>');
        expect(result).toContain('<example_2>');
        expect(result).toContain('<example_3>');
    });

    describe('language filtering', () => {
        const mixedExamples = [
            { input: 'English text', output: '{"events": []}', label: 'Discovery (EN/SFW)' },
            { input: 'Русский текст', output: '{"events": []}', label: 'Emotional conversation (RU/SFW)' },
            { input: 'More English', output: '{"events": []}', label: 'Combat (EN/Moderate)' },
            { input: 'Ещё русский', output: '{"events": []}', label: 'Romantic tension (RU/Moderate)' },
        ];

        it('filters to EN examples only when language is en', () => {
            const result = formatExamples(mixedExamples, 'en');
            expect(result).toContain('English text');
            expect(result).toContain('More English');
            expect(result).not.toContain('Русский текст');
            expect(result).not.toContain('Ещё русский');
        });
    });
});
