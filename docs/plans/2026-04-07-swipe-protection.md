# Swipe Protection Implementation Plan

**Goal:** Exclude the last N complete turns from extraction batches so hallucinated/swiped AI responses don't enter the vault.
**Architecture:** Add a `trimTailTurns()` helper to `scheduler.js` that reuses the same Bot→User boundary logic as `snapToTurnBoundary()`. Integrate it into `getNextBatch()` and `getBackfillMessageIds()`, bypassed by Emergency Cut. One new constant in `constants.js`.
**Tech Stack:** Vanilla ESM JavaScript, Vitest for testing, `@ts-check` + Biome for linting.

---

## File Structure Overview

- Modify: `src/constants.js` — Add `SWIPE_PROTECTION_TAIL_MESSAGES` constant
- Modify: `src/extraction/scheduler.js` — Add `trimTailTurns()`, integrate into `getNextBatch()` and `getBackfillMessageIds()`
- Modify: `tests/scheduler.test.js` — New test cases for `trimTailTurns()` and integration with both batch functions

---

### Task 1: Add the `SWIPE_PROTECTION_TAIL_MESSAGES` constant

**Files:**
- Modify: `src/constants.js`
- Test: `tests/scheduler.test.js` (import check)

**Purpose:** Define the tunable constant in the centralized constants file.

- [ ] Step 1: Add the constant to `src/constants.js`

Insert before the `// ============== ST API Endpoints ==============` section (before line 335):

```js
/** Number of complete turns (User+Bot pairs) to exclude from the tail of extraction batches.
 *  Prevents hallucinated/swiped AI responses from being extracted before the user can review.
 *  Emergency Cut and backfill bypass this. */
export const SWIPE_PROTECTION_TAIL_MESSAGES = 1;
```

- [ ] Step 2: Verify the import resolves

Run: `npx vitest run tests/scheduler.test.js --reporter=verbose 2>&1 | head -5`
Expected: Tests still pass (no import errors). The constant is not yet used, so nothing changes.

- [ ] Step 3: Commit

```bash
git add src/constants.js && git commit -m "feat: add SWIPE_PROTECTION_TAIL_MESSAGES constant"
```

---

### Task 2: Implement and test `trimTailTurns()` helper

**Files:**
- Modify: `src/extraction/scheduler.js`
- Modify: `tests/scheduler.test.js`

**Purpose:** Pure function that trims N complete turns from the tail of a message ID list. A "turn" ends at a Bot→User boundary.

**Common Pitfalls:**
- The function operates on `messageIds` (an array of indices into `chat`), not on `chat` directly
- Must return the original `messageIds` if trimming would empty it (start-of-chat protection)
- `turnsToTrim <= 0` is a no-op, return original
- Must use the same Bot→User boundary detection as `snapToTurnBoundary()`: `!msg.is_user && (!nextInChat || nextInChat.is_user)`

- [ ] Step 1: Write the failing tests

Add to `tests/scheduler.test.js`. First, add `trimTailTurns` to the import from `'../src/extraction/scheduler.js'` and add `SWIPE_PROTECTION_TAIL_MESSAGES` to the import from `'../src/constants.js'`.

Then add this `describe` block:

```js
describe('trimTailTurns', () => {
    it('trims 1 turn from a 5-turn snapped batch', () => {
        // 5 turns: U,B, U,B, U,B, U,B, U,B
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
            ['u4', true], ['b4', false],
            ['u5', true], ['b5', false],
        ]);
        const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const result = trimTailTurns(chat, ids, 1);
        // Turn 5 (ids 8,9) trimmed → [0..7]
        expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns original when turnsToTrim is 0', () => {
        const chat = makeChat([['u1', true], ['b1', false]]);
        const ids = [0, 1];
        const result = trimTailTurns(chat, ids, 0);
        expect(result).toBe(ids); // Same reference
    });

    it('returns original when trimming would empty the batch', () => {
        // Single turn: U, B — trimming 1 turn would empty it
        const chat = makeChat([['u1', true], ['b1', false]]);
        const ids = [0, 1];
        const result = trimTailTurns(chat, ids, 1);
        expect(result).toBe(ids); // Same reference, not trimmed
    });

    it('returns original when messageIds is empty', () => {
        const result = trimTailTurns([], [], 1);
        expect(result).toEqual([]);
    });

    it('handles multi-message turns (U,U,B,B counts as 1 turn)', () => {
        // Turn 1: U, U, B, B
        // Turn 2: U, B
        const chat = makeChat([
            ['u1', true], ['u2', true], ['b1', false], ['b2', false],
            ['u3', true], ['b3', false],
        ]);
        const ids = [0, 1, 2, 3, 4, 5];
        const result = trimTailTurns(chat, ids, 1);
        // Turn 2 (ids 4,5) trimmed → [0..3]
        expect(result).toEqual([0, 1, 2, 3]);
    });

    it('trims 2 turns from a 4-turn batch', () => {
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
            ['u4', true], ['b4', false],
        ]);
        const ids = [0, 1, 2, 3, 4, 5, 6, 7];
        const result = trimTailTurns(chat, ids, 2);
        // Turns 3+4 (ids 4..7) trimmed → [0..3]
        expect(result).toEqual([0, 1, 2, 3]);
    });

    it('returns original when chat has only user messages (no Bot→User boundary)', () => {
        const chat = makeChat([
            ['u1', true], ['u2', true], ['u3', true],
        ]);
        const ids = [0, 1, 2];
        const result = trimTailTurns(chat, ids, 1);
        // No bot message → no turn boundary found → can't trim → return original
        expect(result).toBe(ids);
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest run tests/scheduler.test.js -t "trimTailTurns" --reporter=verbose`
Expected: FAIL — `trimTailTurns` is not exported from `scheduler.js`.

- [ ] Step 3: Write the implementation

Add to `src/extraction/scheduler.js`, in the imports section add:

```js
import { PROCESSED_MESSAGES_KEY, SWIPE_PROTECTION_TAIL_MESSAGES } from '../constants.js';
```

(Replace the existing `import { PROCESSED_MESSAGES_KEY } from '../constants.js';` line.)

Then add the function. Place it after `isBatchReady()` (line ~78) and before `getNextBatch()`:

```js
/**
 * Trim N complete turns from the tail of a snapped batch.
 * A "turn" ends at a Bot→User boundary (bot message followed by user message or end of chat).
 * Returns the trimmed array, or the original if trimming would empty it.
 * @param {Object[]} chat - Full chat messages array
 * @param {number[]} messageIds - Ordered message indices to trim
 * @param {number} turnsToTrim - Number of complete turns to remove from tail
 * @returns {number[]} Trimmed message IDs, or original if trim would empty it
 */
export function trimTailTurns(chat, messageIds, turnsToTrim) {
    if (turnsToTrim <= 0 || messageIds.length === 0) return messageIds;

    let cutIndex = messageIds.length;
    let turnsFound = 0;

    for (let i = messageIds.length - 1; i >= 0; i--) {
        const id = messageIds[i];
        const msg = chat[id];
        const nextInChat = chat[id + 1];

        // Bot→User boundary (same logic as snapToTurnBoundary)
        if (msg && !msg.is_user && (!nextInChat || nextInChat.is_user)) {
            turnsFound++;
            if (turnsFound === turnsToTrim) {
                cutIndex = i;
                break;
            }
        }
    }

    // If trimming would empty the batch, return original (protect start-of-chat)
    const trimmed = messageIds.slice(0, cutIndex);
    return trimmed.length > 0 ? trimmed : messageIds;
}
```

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest run tests/scheduler.test.js -t "trimTailTurns" --reporter=verbose`
Expected: All 7 `trimTailTurns` tests PASS.

- [ ] Step 5: Commit

```bash
git add src/extraction/scheduler.js tests/scheduler.test.js && git commit -m "feat: add trimTailTurns helper with tests"
```

---

### Task 3: Integrate tail-trim into `getNextBatch()`

**Files:**
- Modify: `src/extraction/scheduler.js`
- Modify: `tests/scheduler.test.js`

**Purpose:** After snapping to turn boundary in `getNextBatch()`, apply `trimTailTurns()` unless it's an Emergency Cut.

**Common Pitfalls:**
- The trim must happen AFTER `snapToTurnBoundary()` and AFTER the extend-forward edge case, but BEFORE the final return
- Emergency Cut must bypass the trim entirely
- If trimming empties the batch, `trimTailTurns` returns original (already handled by the helper), but we still need the existing `snapped.length > 0 ? snapped : null` guard

- [ ] Step 1: Write the failing tests

Add to `tests/scheduler.test.js`:

```js
describe('getNextBatch swipe protection', () => {
    it('excludes the last turn from extraction', () => {
        // 3 turns, all unextracted, budget low enough to get all 3
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
        ]);
        // Use a tiny budget so getNextBatch accumulates just enough for 1+ turns
        // but we want all messages to qualify — set budget to 0 so everything exceeds it
        const batch = getNextBatch(chat, {}, 1);
        // Should return only turns 1+2 (ids 0..3), excluding turn 3 (ids 4,5)
        expect(batch).not.toBeNull();
        expect(batch).toEqual([0, 1, 2, 3]);
    });

    it('does not trim when isEmergencyCut is true', () => {
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
        ]);
        const batch = getNextBatch(chat, {}, 1, true);
        // Emergency Cut: no trimming, should get all messages
        expect(batch).not.toBeNull();
        expect(batch).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('returns null when only 1 turn exists and trimming would empty batch', () => {
        const chat = makeChat([
            ['u1', true], ['b1', false],
        ]);
        // trimTailTurns returns original (won't empty), but the batch is the same as input
        // getNextBatch returns snapped which is the full 1-turn batch since trimTailTurns protects it
        const batch = getNextBatch(chat, {}, 1);
        // Single turn can't be trimmed (trimTailTurns returns original), so we still get it
        // Actually: with only 1 turn, trimming 1 turn would empty → helper returns original → full batch
        expect(batch).not.toBeNull();
        expect(batch).toEqual([0, 1]);
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest run tests/scheduler.test.js -t "getNextBatch swipe protection" --reporter=verbose`
Expected: The first test FAILS because `getNextBatch` currently returns all 3 turns (ids 0..5), not trimmed.

- [ ] Step 3: Integrate `trimTailTurns` into `getNextBatch()`

In `src/extraction/scheduler.js`, in the `getNextBatch()` function, add the tail-trim after the extend-forward edge case block and before the final return. Change:

```js
    return snapped.length > 0 ? snapped : null;
}
```

To:

```js
    // Swipe protection: exclude recent turns from extraction (bypassed for Emergency Cut)
    if (!isEmergencyCut) {
        snapped = trimTailTurns(chat, snapped, SWIPE_PROTECTION_TAIL_MESSAGES);
    }

    return snapped.length > 0 ? snapped : null;
}
```

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest run tests/scheduler.test.js -t "getNextBatch swipe protection" --reporter=verbose`
Expected: All 3 tests PASS.

- [ ] Step 5: Run ALL scheduler tests to verify no regressions

Run: `npx vitest run tests/scheduler.test.js --reporter=verbose`
Expected: All existing tests still pass + 3 new swipe protection tests pass.

- [ ] Step 6: Commit

```bash
git add src/extraction/scheduler.js tests/scheduler.test.js && git commit -m "feat: integrate swipe protection into getNextBatch"
```

---

### Task 4: Integrate tail-trim into `getBackfillMessageIds()`

**Files:**
- Modify: `src/extraction/scheduler.js`
- Modify: `tests/scheduler.test.js`

**Purpose:** Apply tail-trim once to the full accumulated list in `getBackfillMessageIds()`, bypassed by Emergency Cut. The trim happens before the incomplete-last-batch trimming so the batch count stays correct.

**Common Pitfalls:**
- The tail-trim is applied ONCE to the full accumulated list, not per-batch
- Must recalculate `batchCount` if trim changes the list size — but since we trim from the tail and the last batch is already trimmed by the existing incomplete-last-batch logic, the `batchCount` from the loop is still correct (the loop counted complete batches; the incomplete-last-batch trim already removed the remainder)
- Actually: the existing code already trims the incomplete last batch. Our tail-trim removes additional whole turns AFTER that. So `batchCount` is correct as-is after the existing trim logic. We just need to apply our trim after the existing trim and before return.

- [ ] Step 1: Write the failing tests

Add to `tests/scheduler.test.js`:

```js
describe('getBackfillMessageIds swipe protection', () => {
    it('excludes the last turn from backfill', () => {
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
        ]);
        // Budget of 1 token means each message exceeds it → batches counted per message
        // but with incomplete-last-batch trimming, only complete batches survive
        // Use a budget that lets all messages form complete batches
        const result = getBackfillMessageIds(chat, {}, 1);
        // Should exclude last turn (ids 4,5)
        expect(result.messageIds).not.toContain(4);
        expect(result.messageIds).not.toContain(5);
        expect(result.messageIds).toEqual([0, 1, 2, 3]);
    });

    it('does not trim when isEmergencyCut is true', () => {
        const chat = makeChat([
            ['u1', true], ['b1', false],
            ['u2', true], ['b2', false],
            ['u3', true], ['b3', false],
        ]);
        const result = getBackfillMessageIds(chat, {}, 1, true);
        // Emergency Cut: no trimming
        expect(result.messageIds).toEqual([0, 1, 2, 3, 4, 5]);
    });
});
```

- [ ] Step 2: Run tests to verify they fail

Run: `npx vitest run tests/scheduler.test.js -t "getBackfillMessageIds swipe protection" --reporter=verbose`
Expected: The first test FAILS because `getBackfillMessageIds` currently returns all message IDs.

- [ ] Step 3: Integrate `trimTailTurns` into `getBackfillMessageIds()`

In `src/extraction/scheduler.js`, in `getBackfillMessageIds()`, add the tail-trim after the incomplete-last-batch trim and before the Emergency Cut batch-count fix. Change:

```js
    // Trim incomplete last batch (skip for Emergency Cut - extract all messages)
    if (!isEmergencyCut && currentSum > 0 && currentSum < tokenBudget) {
        while (messageIds.length > 0 && currentSum > 0) {
            const removed = messageIds.pop();
            currentSum -= getMessageTokenCount(chat, removed);
        }
    }

    // For Emergency Cut, if we have messages but no complete batches, report as 1 batch
```

To:

```js
    // Trim incomplete last batch (skip for Emergency Cut - extract all messages)
    if (!isEmergencyCut && currentSum > 0 && currentSum < tokenBudget) {
        while (messageIds.length > 0 && currentSum > 0) {
            const removed = messageIds.pop();
            currentSum -= getMessageTokenCount(chat, removed);
        }
    }

    // Swipe protection: exclude recent turns (bypassed for Emergency Cut)
    if (!isEmergencyCut && messageIds.length > 0) {
        const before = messageIds.length;
        const trimmed = trimTailTurns(chat, messageIds, SWIPE_PROTECTION_TAIL_MESSAGES);
        // splice in-place to replace messageIds contents
        messageIds.length = 0;
        messageIds.push(...trimmed);
        // If we trimmed messages, recalculate batchCount from the remaining messages
        if (messageIds.length < before) {
            let sum = 0;
            batchCount = 0;
            for (const id of messageIds) {
                sum += getMessageTokenCount(chat, id);
                if (sum >= tokenBudget) {
                    batchCount++;
                    sum = 0;
                }
            }
        }
    }

    // For Emergency Cut, if we have messages but no complete batches, report as 1 batch
```

- [ ] Step 4: Run tests to verify they pass

Run: `npx vitest run tests/scheduler.test.js -t "getBackfillMessageIds swipe protection" --reporter=verbose`
Expected: Both tests PASS.

- [ ] Step 5: Run ALL tests to verify no regressions

Run: `npx vitest run tests/scheduler.test.js --reporter=verbose`
Expected: All existing + new tests pass.

- [ ] Step 6: Commit

```bash
git add src/extraction/scheduler.js tests/scheduler.test.js && git commit -m "feat: integrate swipe protection into getBackfillMessageIds"
```

---

### Task 5: Typecheck and lint

**Files:** None (verification only)

**Purpose:** Ensure the code passes `@ts-check` and Biome linting.

- [ ] Step 1: Run typecheck

Run: `npm run typecheck`
Expected: No errors.

- [ ] Step 2: Run lint

Run: `npm run lint`
Expected: No errors (Biome may auto-fix; if it does, the changes are committed in the next step).

- [ ] Step 3: Commit any lint fixes

```bash
git add -A && git commit -m "auto lint"
```

(Only if there are changes — skip if clean.)

---

### Task 6: Final full test suite

**Files:** None (verification only)

**Purpose:** Confirm no regressions across the entire project.

- [ ] Step 1: Run full test suite

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] Step 2: Verify git log

Run: `git log --oneline -6`
Expected: Shows the sequential commits from Tasks 1–5.
