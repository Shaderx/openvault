/** Prompt and formatter for low-priority coverage memories. */

import { buildMessages } from '../shared/formatters.js';
import { TEMPORAL_ANCHOR_RULE } from '../shared/rules.js';

export const FALLBACK_SCHEMA = `Output exactly one JSON object:
{
  "fallbacks": [
    {"source_message_id": 12, "summary": "One short sentence describing the message.", "temporal_anchor": null}
  ]
}

Rules:
- Return exactly one fallback for every id in <required_source_ids>, and no others.
- Sources not listed in <required_source_ids> are context only. Never summarize them.
- Each fallback summary covers exactly one required source message.
- summary must be exactly one sentence and no more than 15 Unicode words.
- ${TEMPORAL_ANCHOR_RULE}
- A timestamp header establishes story time for that source and the following sources until another timestamp header appears. If a required source has no timestamp of its own, inherit the nearest preceding roleplay timestamp from <context_sources>.
- Keep temporal_anchor separate from summary.
- Do not include analysis, markdown, or raw source text.`;

const FALLBACK_TEMPORAL_EXAMPLE = `<temporal_example>
Source message text:
Time: 8:45 AM — Thursday, March 6, 2025
Kitchen — Nadia's Apartment — Overcast, 38°F
Lev said he would return later.

Correct fallback:
{"source_message_id":12,"summary":"Lev said he would return later.","temporal_anchor":"Time: 8:45 AM — Thursday, March 6, 2025"}

The roleplay timestamp is copied from the message text. A message's real-world send date is never used.
</temporal_example>`;

export function buildFallbackExtractionPrompt({
    messages,
    requiredSourceIds = [],
    preamble,
    prefill = '',
    outputLanguage = 'auto',
}) {
    const system = `You create low-priority archival coverage summaries. Preserve only the basic gist of each message. Use ${outputLanguage} output language when possible.\n\n${FALLBACK_TEMPORAL_EXAMPLE}`;
    const user = `<context_sources>\n${messages}\n</context_sources>

<required_source_ids>${JSON.stringify(requiredSourceIds)}</required_source_ids>

${FALLBACK_SCHEMA}`;
    return buildMessages(system, user, prefill, preamble);
}
