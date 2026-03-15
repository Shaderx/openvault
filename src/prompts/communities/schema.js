/**
 * JSON output schemas for community summarization and global synthesis.
 */

export const COMMUNITY_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "title": "Short name for this community (2-5 words)",
  "summary": "Executive summary of the community's structure, key entities, and dynamics",
  "findings": ["finding 1", "finding 2"]
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "title" must be a short, specific name (2-5 words).
3. "summary" must be a comprehensive paragraph.
4. "findings" must be an array of 1-5 strings, each a key insight about the community.
5. Do NOT wrap output in markdown code blocks.
6. You MAY use <thinking> tags for reasoning before providing the JSON.
   The JSON object must still be valid and parseable.`;

export const GLOBAL_SYNTHESIS_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "global_summary": "A 300-token overarching summary of the current story state"
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "global_summary" must be a single comprehensive string.
3. Do NOT wrap output in markdown code blocks.
4. You MAY use <thinking> tags for reasoning before providing the JSON.
   The JSON object must still be valid and parseable.`;
