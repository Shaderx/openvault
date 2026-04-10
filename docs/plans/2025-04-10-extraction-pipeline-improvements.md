# Extraction Pipeline Improvements Implementation Plan

**Goal:** Fix four distinct problems in the OpenVault extraction pipeline: dangling graph edges, entity bloat, JSON parse failures, and main thread blocking on chat saves.

**Architecture:** This plan covers prompt-only fixes for Problems 1-3 (graph rules, object filtering, execution trigger) and a code change for Problem 4 (cooperative scheduling in the centralized save function).

**Tech Stack:** ES modules, no bundlers, CDN imports, Vitest for testing.

---

### File Structure Overview

- **Modify:** `src/prompts/graph/rules.js` - Add Step 4 validation rule and PROHIBITED list to OBJECT type
- **Modify:** `src/prompts/shared/formatters.js` - Update EXECUTION_TRIGGER with step-explicit instructions
- **Modify:** `src/store/chat-data.js` - Import yieldToMain and add calls inside saveOpenVaultData()
- **Test:** `tests/prompts/graph/rules.test.js` - Verify GRAPH_RULES content (create if missing)
- **Test:** `tests/prompts/shared/formatters.test.js` - Verify EXECUTION_TRIGGER format (create if missing)
- **Test:** `tests/store/chat-data.test.js` - Verify yieldToMain integration in saveOpenVaultData()

---

### Task 1: Add Step 4 Validation to GRAPH_RULES

**Purpose:** Fix dangling graph edges by instructing the LLM to validate that every relationship source/target exists in the entities list.

**Files:**
- Modify: `src/prompts/graph/rules.js`

**Common Pitfalls:**
- Ensure the new Step 4 is inserted before the existing "Step 4: Output" which will become Step 5
- Maintain proper indentation and line breaks for the template string

- [ ] Step 1: Read the current GRAPH_RULES to understand structure

Run: `cat src/prompts/graph/rules.js`
Expected: Shows current GRAPH_RULES with thinking_process containing Steps 1-4

- [ ] Step 2: Write the failing test

Create: `tests/prompts/graph/rules.test.js`

```javascript
// @ts-check
import { describe, it, expect } from 'vitest';
import { GRAPH_RULES } from '../../../src/prompts/graph/rules.js';

describe('GRAPH_RULES', () => {
    it('should contain Step 4 with validation instruction', () => {
        expect(GRAPH_RULES).toContain('Step 4: VALIDATION');
        expect(GRAPH_RULES).toContain("exactly matches a 'name' defined in your entities array");
    });

    it('should contain Step 5 for Output (renamed from Step 4)', () => {
        expect(GRAPH_RULES).toContain('Step 5: Output');
    });

    it('should have validation step before output step', () => {
        const validationIndex = GRAPH_RULES.indexOf('Step 4: VALIDATION');
        const outputIndex = GRAPH_RULES.indexOf('Step 5: Output');
        expect(validationIndex).toBeGreaterThan(-1);
        expect(outputIndex).toBeGreaterThan(-1);
        expect(validationIndex).toBeLessThan(outputIndex);
    });
});
```

- [ ] Step 3: Run test to verify it fails

Run: `npm test -- tests/prompts/graph/rules.test.js -v`
Expected: FAIL - "should contain Step 4 with validation instruction"

- [ ] Step 4: Add Step 4 validation rule to GRAPH_RULES

Edit `src/prompts/graph/rules.js` - Replace the thinking_process section:

```javascript
<thinking_process>
Follow these steps IN ORDER. Write your work inside <think/> tags BEFORE outputting the JSON:

Step 1: Entity scan — List every named entity mentioned or implied. Include type (${Object.values(ENTITY_TYPES).join(', ')}).
Step 2: Type validation — Verify each entity type against the allowed set. Skip mundane objects unless plot-critical.
Step 3: Relationship map — For each entity pair with a stated or implied connection, note the direction and nature.
Step 4: VALIDATION — Verify every 'source' and 'target' in your relationships array
  exactly matches a 'name' defined in your entities array. If a relationship references
  an entity not in your list, either add that entity or remove the relationship.
Step 5: Output — Count entities and relationships, then produce the final JSON.
</thinking_process>`;
```

- [ ] Step 5: Run test to verify it passes

Run: `npm test -- tests/prompts/graph/rules.test.js -v`
Expected: PASS - all tests pass

- [ ] Step 6: Commit

Run: `git add -A && git commit -m "feat: add Step 4 validation to GRAPH_RULES for dangling edge prevention"`

---

### Task 2: Add PROHIBITED List to OBJECT Type Definition

**Purpose:** Reduce entity bloat by explicitly prohibiting transient objects like food, cleaning supplies, and scene props.

**Files:**
- Modify: `src/prompts/graph/rules.js`

**Common Pitfalls:**
- The OBJECT type definition is inline within the GRAPH_RULES template string
- Ensure the PROHIBITED text is inserted before "Do NOT extract body parts"

- [ ] Step 1: Write the failing test

Add to `tests/prompts/graph/rules.test.js`:

```javascript
describe('OBJECT type definition', () => {
    it('should contain PROHIBITED list for transient objects', () => {
        expect(GRAPH_RULES).toContain('PROHIBITED:');
        expect(GRAPH_RULES).toContain('food, meals, cleaning supplies');
        expect(GRAPH_RULES).toContain('temporary clothing states, consumables');
        expect(GRAPH_RULES).toContain('Do NOT extract fluids');
    });

    it('should allow significant unique items', () => {
        expect(GRAPH_RULES).toContain('The One Ring');
        expect(GRAPH_RULES).toContain('Cursed Sword');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/prompts/graph/rules.test.js -v`
Expected: FAIL - "should contain PROHIBITED list for transient objects"

- [ ] Step 3: Update OBJECT type definition with PROHIBITED constraints

Edit `src/prompts/graph/rules.js` - Replace the OBJECT line:

Old:
```
- ${ENTITY_TYPES.OBJECT}: Highly significant unique items, weapons, or plot devices. Do NOT extract mundane items, clothing, food, cups, phones, or daily objects UNLESS they are enchanted, unique, or become permanent fixtures of the story. Do NOT extract body parts, anatomical features, or bodily fluids UNLESS they act as unique plot devices, evidence, or specific permanent anchors for the narrative.
```

New:
```
- ${ENTITY_TYPES.OBJECT}: Highly significant unique items, weapons, or plot devices.
  PROHIBITED: Do not extract food, meals, cleaning supplies, mundane furniture,
  temporary clothing states, consumables, or scene props unless they are permanent,
  story-defining artifacts (e.g., "The One Ring", "Cursed Sword").
  Do NOT extract fluids, temporary body states, or transient physical descriptions.
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/prompts/graph/rules.test.js -v`
Expected: PASS - all tests pass

- [ ] Step 5: Commit

Run: `git add -A && git commit -m "feat: add PROHIBITED constraints to OBJECT type to reduce entity bloat"`

---

### Task 3: Update EXECUTION_TRIGGER with Step-Explicit Instructions

**Purpose:** Fix reflection JSON parse failures by making the output format instructions more explicit with numbered steps.

**Files:**
- Modify: `src/prompts/shared/formatters.js`

**Common Pitfalls:**
- The EXECUTION_TRIGGER is used across multiple domains (graph, events, reflection, communities)
- Ensure the closing delimiter is correctly escaped in the template string
- The delimiter `</think>` must appear exactly as shown

- [ ] Step 1: Write the failing test

Create: `tests/prompts/shared/formatters.test.js`

```javascript
// @ts-check
import { describe, it, expect } from 'vitest';
import { EXECUTION_TRIGGER } from '../../../src/prompts/shared/formatters.js';

describe('EXECUTION_TRIGGER', () => {
    it('should contain step-explicit output format', () => {
        expect(EXECUTION_TRIGGER).toContain('Step 1: Write your reasoning');
        expect(EXECUTION_TRIGGER).toContain('Step 2: You MUST close the reasoning block');
        expect(EXECUTION_TRIGGER).toContain('Step 3: Output ONLY a single raw JSON object');
    });

    it('should reference think tags', () => {
        expect(EXECUTION_TRIGGER).toContain('<think/>');
    });

    it('should reference closing delimiter', () => {
        expect(EXECUTION_TRIGGER).toContain('</think>');
    });

    it('should warn about JSON placement', () => {
        expect(EXECUTION_TRIGGER).toContain('Do NOT put the JSON inside the think tags');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/prompts/shared/formatters.test.js -v`
Expected: FAIL - "should contain step-explicit output format"

- [ ] Step 3: Update EXECUTION_TRIGGER with step-explicit instructions

Edit `src/prompts/shared/formatters.js` - Replace the EXECUTION_TRIGGER constant (around line 14):

Old:
```javascript
export const EXECUTION_TRIGGER = `OUTPUT FORMAT: Write your reasoning in plain text inside <think/> tags, then output a single raw JSON object immediately after. No tool calls, no function wrappers, no markdown code blocks.`;
```

New:
```javascript
export const EXECUTION_TRIGGER = `OUTPUT FORMAT:
Step 1: Write your reasoning in plain text inside <think/> tags.
Step 2: You MUST close the reasoning block with exactly </think>.
Step 3: Output ONLY a single raw JSON object immediately after the closing tag.
CRITICAL: Do NOT put the JSON inside the think tags. The JSON must follow AFTER </think>.`;
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/prompts/shared/formatters.test.js -v`
Expected: PASS - all tests pass

- [ ] Step 5: Commit

Run: `git add -A && git commit -m "feat: update EXECUTION_TRIGGER with step-explicit format instructions"`

---

### Task 4: Add yieldToMain to saveOpenVaultData

**Purpose:** Fix main thread blocking during chat saves by yielding before and after the synchronous save operation.

**Files:**
- Modify: `src/store/chat-data.js`
- Test: `tests/store/chat-data.test.js` (or create if needed)

**Common Pitfalls:**
- Ensure `yieldToMain` is imported from the correct path (`../utils/st-helpers.js`)
- The import statement may already exist - check first
- `yieldToMain()` must be awaited - it's async
- Place yields strategically: before and after `saveChatConditional()` call

- [ ] Step 1: Check current imports in chat-data.js

Run: `head -20 src/store/chat-data.js`
Expected: Shows import statements including from `../utils/st-helpers.js`

- [ ] Step 2: Verify yieldToMain is importable

Run: `grep -n "export function yieldToMain" src/utils/st-helpers.js`
Expected: Shows line with yieldToMain export

- [ ] Step 3: Write the failing test

Add to `tests/store/chat-data.test.js` (create if it doesn't exist):

```javascript
// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { saveOpenVaultData } from '../../src/store/chat-data.js';
import { setDeps } from '../../src/deps.js';

describe('saveOpenVaultData', () => {
    it('should call yieldToMain before and after saveChatConditional', async () => {
        const yieldToMainSpy = vi.fn().mockResolvedValue(undefined);
        const saveChatConditionalSpy = vi.fn().mockResolvedValue(undefined);

        // Mock dependencies
        setDeps({
            getContext: () => ({
                chatMetadata: {},
                chatId: 'test-chat-123'
            }),
            saveChatConditional: saveChatConditionalSpy,
            console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() }
        });

        // Mock yieldToMain by temporarily replacing the module
        const module = await import('../../src/utils/st-helpers.js');
        const originalYieldToMain = module.yieldToMain;
        module.yieldToMain = yieldToMainSpy;

        await saveOpenVaultData('test-chat-123');

        // Restore original
        module.yieldToMain = originalYieldToMain;

        // Verify yieldToMain was called twice (before and after save)
        expect(yieldToMainSpy).toHaveBeenCalledTimes(2);
        expect(yieldToMainSpy.mock.calls[0]).toEqual([]);
        expect(yieldToMainSpy.mock.calls[1]).toEqual([]);

        // Verify saveChatConditional was called between the yields
        expect(saveChatConditionalSpy).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] Step 4: Run test to verify it fails

Run: `npm test -- tests/store/chat-data.test.js -v`
Expected: FAIL - yieldToMain not called (or test errors if file doesn't exist yet)

- [ ] Step 5: Add yieldToMain import and calls

Edit `src/store/chat-data.js`:

Add import (if not already present):
```javascript
import { yieldToMain } from '../utils/st-helpers.js';
```

Modify `saveOpenVaultData` function (around line 70-91):

Old:
```javascript
    try {
        await getDeps().saveChatConditional();
        record('chat_save', performance.now() - t0);
        logDebug('Data saved to chat metadata');
        return true;
    } catch (error) {
```

New:
```javascript
    try {
        await yieldToMain(); // Yield before ST's heavy synchronous save
        await getDeps().saveChatConditional();
        await yieldToMain(); // Yield after the thread-blocking operation
        record('chat_save', performance.now() - t0);
        logDebug('Data saved to chat metadata');
        return true;
    } catch (error) {
```

- [ ] Step 6: Run test to verify it passes

Run: `npm test -- tests/store/chat-data.test.js -v`
Expected: PASS - all tests pass

- [ ] Step 7: Run full check suite

Run: `npm run check`
Expected: All checks pass (sync-version, generate-types, lint, jsdoc, css, typecheck)

- [ ] Step 8: Commit

Run: `git add -A && git commit -m "feat: add yieldToMain calls to saveOpenVaultData for cooperative scheduling"`

---

### Task 5: Final Verification and Commit

**Purpose:** Ensure all changes work together and the design document is committed.

- [ ] Step 1: Run all tests

Run: `npm test`
Expected: All tests pass

- [ ] Step 2: Run check command

Run: `npm run check`
Expected: All checks pass

- [ ] Step 3: Verify design document is committed

Run: `git status`
Expected: No uncommitted changes (design doc already committed or will be committed now)

- [ ] Step 4: Commit design document if needed

If the design document is not yet committed:
Run: `git add docs/designs/2025-04-10-extraction-pipeline-improvements.md && git commit -m "design: commit extraction pipeline improvements design document"`

---

## Implementation Summary

| Task | Problem | Files Modified | Change Type |
|------|---------|----------------|-------------|
| 1 | Dangling Graph Edges | `src/prompts/graph/rules.js` | Prompt-only |
| 2 | Entity Bloat | `src/prompts/graph/rules.js` | Prompt-only |
| 3 | JSON Parse Failures | `src/prompts/shared/formatters.js` | Prompt-only |
| 4 | Main Thread Blocking | `src/store/chat-data.js` | Code + Import |

## Success Criteria

After implementation:
- [ ] `GRAPH_RULES` contains Step 4 VALIDATION instruction
- [ ] `GRAPH_RULES` contains PROHIBITED list for OBJECT type
- [ ] `EXECUTION_TRIGGER` uses step-explicit format (Step 1, 2, 3)
- [ ] `saveOpenVaultData()` calls `yieldToMain()` before and after `saveChatConditional()`
- [ ] All tests pass (`npm test`)
- [ ] All checks pass (`npm run check`)
- [ ] Design document is committed

## Notes

- Problems 1-3 are prompt-only changes and require no code logic changes
- Problem 4 modifies the centralized save function to automatically protect all call sites
- The `yieldToMain()` polyfill uses `scheduler.yield()` when available, falling back to `setTimeout(resolve, 0)`
- All changes are backward-compatible and require no schema migrations
