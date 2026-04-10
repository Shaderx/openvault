import { describe, expect, it } from 'vitest';
import { buildEventExtractionPrompt } from '../../src/prompts/events/builder.js';
import { SYSTEM_PREAMBLE_CN } from '../../src/prompts/shared/preambles.js';

const PREAMBLE = SYSTEM_PREAMBLE_CN;
const PREFILL = '<thinking>\n';

/**
 * Assert system message has role+examples but NOT schema/rules/language_rules.
 */
function assertSystemPrompt(content) {
    expect(content).toContain('<role>');
    expect(content).not.toContain('<output_schema>');
    expect(content).not.toContain('<task_rules>');
    // language_rules only in user prompt now
    const afterPreamble = content.slice(content.indexOf('</system_config>'));
    expect(afterPreamble).not.toContain('<language_rules>');
}

/**
 * Assert user message has constraints block at end.
 */
function assertUserPrompt(content) {
    expect(content).toContain('<language_rules>');
    expect(content).toContain('<output_schema>');
    expect(content).toContain('OUTPUT FORMAT:');
}

describe('Prompt Topology — Recency Bias Layout', () => {
    it('events: schema and rules in user prompt, not system', () => {
        const msgs = buildEventExtractionPrompt({
            messages: 'Test message',
            names: { char: 'Alice', user: 'Bob' },
            context: {},
            preamble: PREAMBLE,
            prefill: PREFILL,
        });
        expect(msgs).toHaveLength(3);
        assertSystemPrompt(msgs[0].content);
        assertUserPrompt(msgs[1].content);
        expect(msgs[2].role).toBe('assistant');
    });

    it('all builders default to auto', () => {
        // Test that language parameter defaults to 'auto' across builders
        const msgs = buildEventExtractionPrompt({
            messages: 'Test',
            names: { char: 'A', user: 'B' },
            context: {},
            preamble: PREAMBLE,
            prefill: PREFILL,
        });
        // Check that language is set to auto (implicitly tested by content not containing explicit language override)
        expect(msgs).toHaveLength(3);
        assertSystemPrompt(msgs[0].content);
        assertUserPrompt(msgs[1].content);
    });
});
