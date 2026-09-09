# Prompts and LLM Directives

## DIRECTORY STRUCTURE
Prompt modules are organized by domain:
- `events/` - Event extraction prompts (role, rules, schema, examples)
- `graph/` - Graph entity extraction prompts
- `reflection/` - Reflection synthesis prompts
- `communities/` - Community summarization prompts
- `shared/` - Cross-domain formatters (`format-examples.js`, `formatters.js`, `preambles.js`, `rules.js`)

Each domain follows the same structure: `builder.js` (assembles messages), `role.js`, `rules.js`, `schema.js`, `examples/{en,ru}.js` (bilingual few-shot).

## TOPOLOGY & ANTI-RECENCY BIAS
- **Construct via `buildMessages()`.** Always use the shared formatter.
- **System Prompt:** Assemble using `assembleSystemPrompt()`. Include ONLY the role definition and few-shot examples.
- **User Prompt:** Append the constraint block using `assembleUserConstraints()`. Order strictly: `Language Rules -> Task Rules -> Schema -> Execution Trigger`. This ordering is a prompt strategy; schema validation, source validation and fallback handling remain required.

## REASONING TAGS
- **Emit paired `<think>...</think>` blocks.** Preserve parser tolerance for historical self-closing tags, alternate reasoning wrappers and orphaned closing tags.
- **Wrap structural guidelines in `<draft_process>`.** Use this XML tag in system rules to define the steps, and instruct the model to keep each draft step to 8 words max inside paired `<think>...</think>` tags.
- **Strip tags safely.** Run all LLM output through `stripThinkingTags()` before JSON parsing. Handle orphaned closing tags resulting from assistant prefilling.

## LANGUAGE MIRRORING
- **Enforce original scripts for entity names.** Never translate or transliterate character names in JSON values.
- **Honor configured language.** The fork defaults/migrates to English; automatic language mirroring applies only in `outputLanguage: auto`. JSON keys remain English. Preserve original-script entity names in every mode.
- **Detect non-Latin scripts heuristically.** If `outputLanguage` is 'auto', scan the user message for Cyrillic/CJK and dynamically inject the "Do NOT translate to English" reminder.

## FEW-SHOT EXAMPLES
- **Format via `formatExamples()`.** Wrap examples in numbered `<example_X>` tags. Map the `thinking` object property to paired `<think>...</think>` blocks.
- **Bilingual coverage.** Each domain has `examples/en.js` and `examples/ru.js` with language-matched few-shot examples.
- **Cover behavior diversity.** Examples should exercise varied narrative actions and edge cases for robust structured outputs; examples cannot guarantee model compliance.

## COVERAGE FALLBACKS

Preserve actual source IDs for every extracted event. Uncovered source messages require complete fallback coverage: one sentence per record, at most 15 Unicode words, importance 1, and no raw message body in archives. Coverage-only records do not enter graph/reflection semantic enrichment. See `src/prompts/events/fallback.js` and extraction validators; test the protocol rather than arbitrary wording.
