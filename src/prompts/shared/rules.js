/**
 * Shared prompt rules injected into all extraction prompts.
 * High-contrast protocol format for mid-tier instruct model compliance.
 */

export const MIRROR_LANGUAGE_RULES = `<language_rules>
OUTPUT LANGUAGE PROTOCOL:
• KEYS = ENGLISH ONLY. Never translate JSON keys.
• VALUES = SAME LANGUAGE AS SOURCE TEXT. Russian input → Russian values. English input → English values.
• NAMES = EXACT ORIGINAL SCRIPT. Never transliterate or translate (Саша stays Саша, Suzy stays Suzy).
• THINK BLOCKS = ENGLISH ONLY. All <think> reasoning in English regardless of input language.
• LANGUAGE ANCHOR = Narrative prose in <messages>, not dialogue or instruction language.
• NO MIXING within a single output field.
</language_rules>`;

/** Canonical story-time contract shared by every event-memory extraction pass. */
export const TEMPORAL_ANCHOR_RULE = `temporal_anchor: REQUIRED FIELD — always include it in output. Extract ONLY the roleplay/story date and time stated in the source message text, especially an explicit timestamp header such as "Time: 8:45 AM — Thursday, March 6, 2025". NEVER use message metadata, the real-world send date, source_message_id, fingerprint, or processing time. Prefer story date + time, then story date only, then story time only. Return null ONLY when the source text contains no story-time information. Strip decorative elements such as emojis, locations, and weather, but preserve the chosen story date/time wording.`;
