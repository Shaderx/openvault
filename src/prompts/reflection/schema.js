/**
 * JSON output schemas for reflection, question, and insight prompts.
 */

export const UNIFIED_REFLECTION_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "reflections": [
    {
      "question": "A salient high-level question about the character",
      "insight": "A deep psychological insight answering the question",
      "evidence_ids": ["id1", "id2"]
    }
  ]
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. The "reflections" array MUST contain 1 to 3 reflection objects.
3. Each reflection MUST have "question", "insight" (strings) and "evidence_ids" (array of strings).
4. Do NOT wrap output in markdown code blocks.
5. You MAY use <thinking> tags for reasoning before providing the JSON.
   The JSON object must still be valid and parseable.

CRITICAL ID GROUNDING RULE:
For "evidence_ids", you MUST ONLY use the exact IDs shown in the <recent_memories> list.
Do NOT invent, hallucinate, or modify IDs. If you cannot find the exact ID in the list, use an empty array [].`;

export const QUESTIONS_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "questions": ["question 1", "question 2", "question 3"]
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. The "questions" array MUST contain EXACTLY 3 strings.
3. Do NOT wrap output in markdown code blocks.
4. Do NOT include ANY text outside the JSON object.`;

export const INSIGHTS_SCHEMA = `You MUST respond with EXACTLY ONE JSON object. No other text, no markdown fences, no commentary.

The JSON object MUST have this EXACT structure:

{
  "insights": [
    {
      "insight": "A concise high-level statement about the character",
      "evidence_ids": ["memory_id_1", "memory_id_2"]
    }
  ]
}

CRITICAL FORMAT RULES:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ].
2. The "insights" array MUST contain 1 to 3 insight objects.
3. Each insight MUST have both "insight" (string) and "evidence_ids" (array of strings).
4. Do NOT wrap output in markdown code blocks.
5. Do NOT include ANY text outside the JSON object.`;
