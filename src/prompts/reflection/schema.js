/**
 * JSON output schemas for reflection, question, and insight prompts.
 */

export const UNIFIED_REFLECTION_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "reflections": [
    {
      "question": "A salient high-level question about the character",
      "insight": "A deep psychological insight answering the question",
      "evidence_ids": ["id1", "id2"]
    }
  ]
}

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "reflections" array MUST contain 1-3 items, each with "question", "insight" (strings) and "evidence_ids" (array of strings).
3. Do NOT wrap in markdown code blocks.
4. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.

CRITICAL ID GROUNDING RULE:
"evidence_ids" MUST ONLY use exact IDs from the <recent_memories> list. Do NOT invent or modify IDs.

CRITICAL: NEVER include memory IDs (like event_123 or ref_456) in the "question" or "insight" text fields. IDs belong ONLY in the evidence_ids array. Reference memories by their content in the text.`;

export const QUESTIONS_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "questions": ["question 1", "question 2", "question 3"]
}

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "questions" array MUST contain EXACTLY 3 strings.
3. Do NOT wrap in markdown code blocks.
4. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.`;

export const INSIGHTS_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "insights": [
    {
      "insight": "A concise high-level statement about the character",
      "evidence_ids": ["memory_id_1", "memory_id_2"]
    }
  ]
}

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "insights" array MUST contain 1-3 items, each with "insight" (string) and "evidence_ids" (array of strings).
3. Do NOT wrap in markdown code blocks.
4. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.

CRITICAL: NEVER include memory IDs (like event_123 or ref_456) in the "insight" text field. IDs belong ONLY in the evidence_ids array. Reference memories by their content in the text.`;
