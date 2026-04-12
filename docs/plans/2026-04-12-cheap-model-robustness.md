# Cheap Model Robustness Fixes

**Goal:** Make the extraction pipeline resilient to cheap model failures: hallucinated tool-call wrappers, lazy exits (empty output after thinking tags), and destructive tag stripping.
**Testing Conventions:** Unit tests for pure functions use zero mocking. Tests mirror `src/` structure under `tests/`. Use `it.each()` for same-pattern-different-input. No prompt-content tests.

---

### Task 1: Stop Stripping Tool-Call Tags

**Objective:** Remove `tool_call` and `search` from the `stripThinkingTags` regex in `src/utils/text.js` so that valid JSON wrapped inside hallucinated `<tool_call/>` or `<search/>` tags survives and can be parsed by `extractJsonBlocks`.

**Files to modify:**
- Modify: `src/utils/text.js` — `stripThinkingTags` function (remove `tool_call` and `search` from the paired XML tag regex and the orphaned closing tag regex)
- Test: `tests/utils/text.test.js`

**Instructions for Execution Agent:**
1. Read the outline of `src/utils/text.js` to locate `stripThinkingTags`, then read the full function.
2. In the paired XML tag regex, remove `tool_call` and `search` from the alternation group. The regex currently contains `(think|thinking|thought|reasoning|reflection|tool_call|search|draft|draft_process)` — remove those two entries. Do the same for the paired bracket tag regex (remove `TOOL_CALL` if present) and the orphaned closing tag regex.
3. In `tests/utils/text.test.js`, add a test group for `stripThinkingTags` that verifies:
   - `<tool_call name="extract">{"events": []}</tool_call` is NOT stripped (JSON survives)
   - `<search>{"events": []}</search>` is NOT stripped (JSON survives)
   - `<think reasoning tokens</think` IS still stripped (existing behavior preserved)
   - Existing tests still pass.
4. Run `npx vitest run tests/utils/text.test.js` to verify all pass.

---

### Task 2: Auto-Unwrap Hallucinated Tool Arguments

**Objective:** In `parseStructuredResponse` in `src/extraction/structured.js`, add logic to detect and unwrap OpenAI-style function call payloads where the LLM hallucinates `{"name": "...", "arguments": {...}}` instead of outputting the expected schema directly.

**Depends on:** Task 1 (JSON inside tool_call tags must survive stripping first)

**Files to modify:**
- Modify: `src/extraction/structured.js` — `parseStructuredResponse` function (add unwrapping after `let parsed = result.data`)
- Test: `tests/extraction/structured.test.js`

**Instructions for Execution Agent:**
1. Read the outline of `src/extraction/structured.js` to locate `parseStructuredResponse`, then read the full function.
2. Immediately after `let parsed = result.data;`, add a block that checks if `parsed` is a non-array object with `(name || tool || function)` key AND an `arguments` key. If so, log a warning and unwrap: `parsed = parsed.arguments`. If `arguments` is a string, parse it with `safeParseJSON`.
3. In `tests/extraction/structured.test.js`, add tests:
   - Input `{"name": "extract", "arguments": {"events": []}}` unwraps to `{"events": []}`
   - Input `{"tool": "extract", "arguments": "{\"events\": []}"}` (string arguments) unwraps and re-parses
   - Input `{"function": "x", "arguments": {"events": []}}` unwraps
   - Input `{"events": []}` (normal) passes through unchanged
4. Run `npx vitest run tests/extraction/structured.test.js` to verify.

---

### Task 3: Handle Lazy Exits (Empty Output After Thinking Tags)

**Objective:** Intercept cases where cheap models output only reasoning tags and then stop generating, leaving nothing parseable. Both `parseEventExtractionResponse` and `parseGraphExtractionResponse` should return valid empty results instead of throwing a JSON parse error.

**Depends on:** Task 1

**Files to modify:**
- Modify: `src/extraction/structured.js` — add `stripThinkingTags` to imports from `../utils/text.js`, then add early-return guards in `parseEventExtractionResponse` and `parseGraphExtractionResponse`
- Test: `tests/extraction/structured.test.js`

**Instructions for Execution Agent:**
1. Read the full imports of `src/extraction/structured.js` and the implementations of `parseEventExtractionResponse` and `parseGraphExtractionResponse`.
2. Add `stripThinkingTags` to the existing import from `../utils/text.js`.
3. In `parseEventExtractionResponse`, before the `safeParseJSON` call, strip thinking tags and check if the result is empty. If empty, log a warning and return `{ events: [] }`.
4. In `parseGraphExtractionResponse`, before the `safeParseJSON` call, strip thinking tags and check if the result is empty. If empty, log a warning and return `{ entities: [], relationships: [] }`.
5. In `tests/extraction/structured.test.js`, add tests:
   - Input `<think analysis here</think` (only thinking, no JSON) → returns `{ events: [] }` from `parseEventExtractionResponse`
   - Input `<think analysis</think` → returns `{ entities: [], relationships: [] }` from `parseGraphExtractionResponse`
   - Input that is just whitespace → same graceful returns
6. Run `npx vitest run tests/extraction/structured.test.js` to verify.

---

### Task 4: Reinforce Prompts Against Lazy Exits

**Objective:** Update the prompt instructions in `EXECUTION_TRIGGER`, event schema, and graph schema to explicitly command the model to output the JSON object even when empty, and never stop generating after the thinking block.

**Files to modify:**
- Modify: `src/prompts/shared/formatters.js` — `EXECUTION_TRIGGER` constant
- Modify: `src/prompts/events/schema.js` — rule 2 in `EVENT_SCHEMA`
- Modify: `src/prompts/graph/schema.js` — rule 2 in `GRAPH_SCHEMA`

**Instructions for Execution Agent:**
1. Read the current values of `EXECUTION_TRIGGER` in `src/prompts/shared/formatters.js`, `EVENT_SCHEMA` in `src/prompts/events/schema.js`, and `GRAPH_SCHEMA` in `src/prompts/graph/schema.js`.
2. In `EXECUTION_TRIGGER`, add a new `CRITICAL` line after the existing ones: `CRITICAL: You MUST output the JSON object even if it is empty. Never stop generating after </think`. Also fix the truncated text in Step 2 if needed — it should reference closing the think tag properly.
3. In `EVENT_SCHEMA` rule 2, append: ` Do not just stop generating.` — so the full rule reads: `The "events" key MUST always be present. If nothing found: "events": []. Do not just stop generating.`
4. In `GRAPH_SCHEMA` rule 2, append: ` Do not just stop generating.` — so the full rule reads: `BOTH keys ("entities", "relationships") MUST always be present. If nothing found: empty arrays. Do not just stop generating.`
5. No new tests needed per test conventions (no prompt-content tests). Run the full existing test suite to confirm no regressions: `npx vitest run`.
