/**
 * JSON output schema for event extraction.
 */

import { TEMPORAL_ANCHOR_RULE } from '../shared/rules.js';

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
      "relationship_impact": {"CharacterA->CharacterB": "how relationship changed"},
      "source_message_ids": [12, 13]
    }
  ]
}

FIELD DEFINITIONS:
- characters_involved: Characters who actively participated or were directly affected (the main actors).
- witnesses: ALL characters who would know this event occurred. MUST include characters_involved PLUS any present/observers. In a 1-on-1 scene, BOTH characters are witnesses.
- is_secret: true ONLY for hidden actions (internal thoughts, secret plots). Most events are false.
- ${TEMPORAL_ANCHOR_RULE}
- source_message_ids: REQUIRED exact chat-array message ids whose text supports this event. Include one or more ids when an event spans messages. Never include an id that is not shown in the input.
- is_transient: true for short-term plans or temporary states ("going to wash up", "waiting 10 min"). false for permanent facts or completed actions.

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. The "events" key MUST always be present. If nothing found: "events": []. Do not just stop generating.
3. Do NOT wrap in markdown code blocks.
4. Keep character names exactly as they appear in the input.
5. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.`;
