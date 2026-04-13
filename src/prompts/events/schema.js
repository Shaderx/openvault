/**
 * JSON output schema for event extraction.
 */

export const EVENT_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "events": [
    {
      "summary": "8-25 word description of what happened, past tense",
      "importance": 3,
      "temporal_anchor": null,
      "is_transient": false,
      "characters_involved": ["CharacterName"],
      "witnesses": ["CharacterName", "OtherCharacter"],
      "location": null,
      "is_secret": false,
      "emotional_impact": {"CharacterName": "emotion description"},
      "relationship_impact": {"CharacterA->CharacterB": "how relationship changed"}
    }
  ]
}

FIELD DEFINITIONS:
- characters_involved: Characters who actively participated or were directly affected (the main actors).
- witnesses: ALL characters who would know this event occurred. MUST include characters_involved PLUS any present/observers. In a 1-on-1 scene, BOTH characters are witnesses.
- is_secret: true ONLY for hidden actions (internal thoughts, secret plots). Most events are false.
- temporal_anchor: Extract timestamp/date from message headers if present (e.g., "Friday, June 14, 3:40 PM"). null if no time stated.
- is_transient: true for short-term plans or temporary states ("going to wash up", "waiting 10 min"). false for permanent facts or completed actions.

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. The "events" key MUST always be present. If nothing found: "events": [].
3. Do NOT wrap in markdown code blocks.
4. Keep character names exactly as they appear in the input.
5. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.`;
