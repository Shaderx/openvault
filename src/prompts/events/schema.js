/**
 * JSON output schema for event extraction.
 */

export const EVENT_SCHEMA = `You MUST respond with your analysis FIRST inside <thinking> tags, THEN EXACTLY ONE JSON object.

First, output your analysis inside <thinking> tags.
THEN, output EXACTLY ONE JSON object with this structure:

{
  "events": [
    {
      "summary": "8-25 word description of what happened, past tense",
      "importance": 3,
      "characters_involved": ["CharacterName"],
      "witnesses": [],
      "location": null,
      "is_secret": false,
      "emotional_impact": {"CharacterName": "emotion description"},
      "relationship_impact": {"CharacterA->CharacterB": "how relationship changed"}
    }
  ]
}

CRITICAL FORMAT RULES — violating ANY of these will cause a system error:
1. The top level MUST be a JSON object { }, NEVER a bare array [ ]. NEVER wrap your entire response in [ ].
2. The key "events" MUST always be present.
3. If nothing was found, use empty array: "events": [].
4. Do NOT wrap output in markdown code blocks (no \u0060\u0060\u0060json).
5. Do NOT use <tool_call> or function schemas. Output directly to the chat as plain text.
6. Do NOT include ANY text outside the <thinking> tags and the JSON object.
7. Keep character names exactly as they appear in the input.
8. Start your response with { after the <thinking> close tag. No other wrapping.`;
