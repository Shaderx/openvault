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

/** Canonical timestamp contract shared by every event-memory extraction pass. */
export const TEMPORAL_ANCHOR_RULE = `temporal_anchor: REQUIRED FIELD — always include it in output. Copy the exact date/time from the source's date attribute when present. Otherwise use an explicit date/time header in the source text. Prefer date + time, then date only, then time only. Return null ONLY when neither the source attribute nor its text contains temporal information. Strip decorative elements such as emojis, locations, and weather, but preserve the chosen date/time wording.`;
