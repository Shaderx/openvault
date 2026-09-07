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
- Return exactly one fallback for every supplied source_message_id, and no others.
- Each fallback covers exactly one source message.
- summary must be exactly one sentence and no more than 15 Unicode words.
- ${TEMPORAL_ANCHOR_RULE}
- Keep temporal_anchor separate from summary.
- Do not include analysis, markdown, or raw source text.`;

export function buildFallbackExtractionPrompt({ messages, preamble, prefill = '', outputLanguage = 'auto' }) {
    const system = `You create low-priority archival coverage summaries. Preserve only the basic gist of each message. Use ${outputLanguage} output language when possible.`;
    const user = `<sources>\n${messages}\n</sources>\n\n${FALLBACK_SCHEMA}`;
    return buildMessages(system, user, prefill, preamble);
}
