/**
 * Task-specific rules for event extraction.
 */

export const EVENT_RULES = `<precision>
Event summaries MUST be complete, highly descriptive sentences (minimum 6 words, 30 characters).
Do not extract fragmented thoughts or micro-actions like "Character breathed" or "She nodded."

Core principle: Name the exact action, emotion, or revelation. The output summary must preserve the source text's level of specificity. A vague generalization where the source has a concrete event is an extraction error.

- Physical actions: specify the exact act, method, and participants as described in the source
- Emotional events: name the specific emotion and its cause
- Revelations: state the exact information that was disclosed
- Combat: name the weapon, target, and outcome
- Commitments & Rules: state the exact promise, schedule, boundary, or ongoing agreement established (e.g., "agreed to check in every day").
- Preferences: state exactly what a character explicitly revealed they like, dislike, or require.

A correct extraction preserves all source specificity.
An incorrect extraction loses detail through generalization.

These are all WRONG — information destroyed by vagueness:
✗ "they got intimate" ✗ "combat occurred" ✗ "feelings were expressed" ✗ "a secret was shared" ✗ "things escalated"
✗ "they made a promise" ✗ "rules were discussed"
</precision>

<dedup>
This is the MOST IMPORTANT rule. Duplicating memories already in established_memories is the worst error.

BEFORE creating ANY event, you MUST check the <established_memories> section in the user message.

If a scene is already recorded there, DO NOT repeat the same actions. Instead, look for the NEWEST change within that scene:
1. A shift in emotional state (e.g., confidence → vulnerability, pleasure → discomfort).
2. A new phase or escalation (e.g., foreplay → penetration, sparring → real fight).
3. The scene concluding (e.g., climax, falling asleep, location change, combat ends).
4. A power dynamic reversal (e.g., submissive takes control, ambush turns into retreat).
5. A new element changing the scene's nature (new character arrives, weapon drawn, secret revealed).
6. A safeword explicitly used to halt the scene.

If the messages contain ONLY a continuation of the exact same action with no shift, escalation, or conclusion — then output "events": [].

When in doubt, extract a brief progression event rather than output nothing. The system will automatically filter true duplicates.
</dedup>

<importance_scale>
Rate each event from 1 (trivial) to 5 (critical):

1 — Trivial: Quick greeting, passing touch, mundane small talk. Usually skip these entirely.
2 — Minor: Standard continuation of an established dynamic, routine acts, momentary reactions. A goodbye kiss or a one-time compliment is 2 — it matters now but not next week.
3 — Notable: Meaningful conversation, Stated preferences (likes/dislikes), everyday promises ("I'll be there Saturday"), minor secrets shared, change of location. These are durable — they matter for future interactions.
4 — Significant: Hard boundaries established, strict ongoing rules agreed upon, long-term relationship commitments, major narrative shift, deep emotional vulnerability.
     Do NOT rate every intimate act as 4. If characters already have an established intimate relationship, routine acts are 2 or 3. Reserve 4 for narrative milestones.
5 — Critical: Life-changing events — first "I love you", pregnancy discovery, major betrayal revealed, permanent relationship change, character death.
</importance_scale>

<field_instructions>
characters_involved: Characters who actively participated in or were directly affected by this event (the main actors).

witnesses: ALL named characters from the lore who would know this event occurred — includes characters_involved PLUS any named characters present in the scene, observing, or mentioned as being aware. In a 1-on-1 scene between User and Character, BOTH are witnesses. If you are unsure whether a character knows, include them — the system will filter appropriately. Do NOT include generic NPCs described only by role (e.g., "saleswoman", "passerby", "waiter", "guard") — only characters with proper names.

is_secret: Set to true ONLY if the event is explicitly hidden from the main character (e.g., user's internal thoughts, secret actions behind character's back, hidden plots). Most events are NOT secrets.

temporal_anchor: ALWAYS include this field in output. Look for date/time markers in message headers.
Priority order:
  1. Date + time (best): "Friday, June 14, 3:40 PM", "Wednesday, 30 October 2024. 4:43 PM"
  2. Date only: "Friday, June 14", "30 October 2024"
  3. Time only (no date available): "3:40 PM", "11:20"
  4. null — ONLY when no temporal information exists at all
Strip decorative elements (emojis, locations, weather) but preserve the verbatim date/time format chosen by the user. A date alone is more valuable than a time alone.

is_transient: Set to true ONLY for short-term intentions, temporary states, or immediate plans (e.g., "going to wash up", "waiting for 10 minutes", "be right back", "let's meet at 7 PM"). Set to false for permanent facts, completed actions, or durable relationship changes (e.g., "revealed a secret", "professed love", "moved to a new city").
</field_instructions>

<draft_process>
Think step by step, but only keep a minimal draft for each step, with 8 words at most per step. Use symbols: -> for causation/actions, + for conjunction, != for contrast. Write your work inside <think/> tags BEFORE outputting the JSON:

Step 1: List <=5 actions/emotions/facts/promises/preferences from new messages.
Step 2: Check <established_memories> -> any already recorded?
Step 3: Continuation != new event -> find newest progression | output [].
Step 4: NEW events -> assign importance(1-5) + specific summary + witnesses.
Step 5: Output final JSON with "events" key.
</draft_process>`;
