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
