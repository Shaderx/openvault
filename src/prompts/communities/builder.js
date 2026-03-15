/**
 * Community summarization and global synthesis prompt builders.
 */

import {
    assembleSystemPrompt,
    buildMessages,
    resolveLanguageInstruction,
} from '../shared/formatters.js';
import { COMMUNITIES_ROLE, GLOBAL_SYNTHESIS_ROLE } from './role.js';
import { COMMUNITY_SCHEMA, GLOBAL_SYNTHESIS_SCHEMA } from './schema.js';
import { COMMUNITY_RULES, GLOBAL_SYNTHESIS_RULES } from './rules.js';
import { getExamples } from './examples/index.js';

export function buildCommunitySummaryPrompt(nodeLines, edgeLines, preamble, outputLanguage = 'auto', prefill) {
    if (!prefill) {
        throw new Error('buildCommunitySummaryPrompt: prefill is required');
    }
    const systemPrompt = assembleSystemPrompt({
        role: COMMUNITIES_ROLE,
        schema: COMMUNITY_SCHEMA,
        rules: COMMUNITY_RULES,
        examples: getExamples('COMMUNITIES', outputLanguage),
        outputLanguage,
    });

    const entityText = nodeLines.join('\n');
    const languageInstruction = resolveLanguageInstruction(entityText, outputLanguage);
    const userPrompt = `<community_entities>
${entityText}
</community_entities>

<community_relationships>
${edgeLines.join('\n')}
</community_relationships>
${languageInstruction}
Write a comprehensive report about this community of entities.
Respond with a single JSON object containing title, summary, and 1-5 findings. No other text.`;

    return buildMessages(systemPrompt, userPrompt, prefill, preamble);
}

export function buildGlobalSynthesisPrompt(communities, preamble, outputLanguage = 'auto', prefill) {
    if (!prefill) {
        throw new Error('buildGlobalSynthesisPrompt: prefill is required');
    }

    const systemPrompt = assembleSystemPrompt({
        role: GLOBAL_SYNTHESIS_ROLE,
        schema: GLOBAL_SYNTHESIS_SCHEMA,
        rules: GLOBAL_SYNTHESIS_RULES,
        examples: getExamples('GLOBAL_SYNTHESIS', outputLanguage),
        outputLanguage,
    });

    const communityText = communities.map((c, i) =>
        `${i + 1}. ${c.title}\n${c.summary}${c.findings?.length ? '\nKey findings: ' + c.findings.join('; ') : ''}`
    ).join('\n\n');

    const languageInstruction = resolveLanguageInstruction(communityText, outputLanguage);
    const userPrompt = `<communities>
${communityText}
</communities>

${languageInstruction}
Synthesize these community summaries into a single global narrative (max ~300 tokens).
Focus on macro-relationships, overarching tensions, and plot trajectory.

Respond with a single JSON object containing "global_summary". No other text.`;

    return buildMessages(systemPrompt, userPrompt, prefill, preamble);
}
