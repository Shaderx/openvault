import { describe, expect, it } from 'vitest';
import {
    buildCommunitySummaryPrompt,
    buildEdgeConsolidationPrompt,
    buildEventExtractionPrompt,
    buildGlobalSynthesisPrompt,
    buildGraphExtractionPrompt,
    buildUnifiedReflectionPrompt,
    SYSTEM_PREAMBLE_CN,
} from '../../src/prompts/index.js';

describe('think tag support', () => {
    it.each([
        [
            'GRAPH_SCHEMA',
            () =>
                buildGraphExtractionPrompt({
                    messages: '[A]: test',
                    names: { char: 'A', user: 'B' },
                    prefill: '{',
                }),
        ],
        [
            'CONSOLIDATION_SCHEMA',
            () =>
                buildEdgeConsolidationPrompt(
                    { source: 'A', target: 'B', description: 'Test', weight: 1 },
                    'auto',
                    'auto',
                    '{'
                ),
        ],
        ['UNIFIED_REFLECTION_SCHEMA', () => buildUnifiedReflectionPrompt('Alice', [], 'auto', 'auto', '{')],
        ['COMMUNITY_SCHEMA', () => buildCommunitySummaryPrompt(['- Node'], ['- Edge'], 'auto', 'auto', '{')],
        [
            'GLOBAL_SYNTHESIS_SCHEMA',
            () => buildGlobalSynthesisPrompt([{ title: 'C1', summary: 'S1' }], 'auto', 'auto', '{'),
        ],
    ])('%s allows think tags before JSON', (_, buildPrompt) => {
        const result = buildPrompt();
        const user = result[1].content;
        expect(user).toContain('reasoning');
    });
});

describe('CN preamble and assistant prefill', () => {
    it('all prompts include CN system preamble in system message', () => {
        const eventResult = buildEventExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            context: {},
        });
        const graphResult = buildGraphExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            prefill: '{',
        });
        const communityResult = buildCommunitySummaryPrompt([], [], SYSTEM_PREAMBLE_CN, 'auto', '{');

        for (const result of [eventResult, graphResult, communityResult]) {
            expect(result[0].content).toContain('<system_config>');
            expect(result[0].content).toContain('</system_config>');
        }
    });

    it('event extraction does NOT prefill assistant when prefill is empty', () => {
        const result = buildEventExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            context: {},
        });
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('system');
        expect(result[1].role).toBe('user');
    });

    it('non-think prompts use provided prefill', () => {
        const graphResult = buildGraphExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            prefill: '{',
        });
        const communityResult = buildCommunitySummaryPrompt([], [], SYSTEM_PREAMBLE_CN, 'auto', '{');

        for (const result of [graphResult, communityResult]) {
            expect(result[2].role).toBe('assistant');
            expect(result[2].content).toBe('{');
        }
    });
});
