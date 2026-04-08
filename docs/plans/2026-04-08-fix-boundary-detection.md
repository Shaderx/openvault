# Fix: Boundary Detection Skips System Messages

**Goal:** `snapToTurnBoundary` and `trimTailTurns` must skip `is_system` messages when looking forward for Bot->User boundaries.
**Architecture:** Add a helper that walks forward past system messages to find the next real chat message, use it in both functions.
**Tech Stack:** Vanilla ESM, Vitest

---

### Task 1: Red test — snapToTurnBoundary with system messages

**Files:**
- Test: `tests/utils/tokens.test.js`

- [ ] Step 1: Write the failing tests

Append a new `describe` block inside `tests/utils/tokens.test.js`:

```javascript
describe('snapToTurnBoundary — system messages', () => {
    it('finds boundary when system message sits between Bot and User', async () => {
        const { snapToTurnBoundary } = await import('../../src/utils/tokens.js');

        // U(0) B(1) SYS(2) U(3)
        const chat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'note', is_user: false, is_system: true },  // Author's Note
            { mes: 'u3', is_user: true, is_system: false },
        ];

        // After index 1 (Bot), next non-system is U(3) → valid boundary
        const result = snapToTurnBoundary(chat, [0, 1]);
        expect(result).toEqual([0, 1]);
    });

    it('finds boundary when multiple system messages sit between Bot and User', async () => {
        const { snapToTurnBoundary } = await import('../../src/utils/tokens.js');

        // U(0) B(1) SYS(2) SYS(3) U(4)
        const chat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'sys1', is_user: false, is_system: true },
            { mes: 'sys2', is_user: true, is_system: true },
            { mes: 'u4', is_user: true, is_system: false },
        ];

        const result = snapToTurnBoundary(chat, [0, 1]);
        expect(result).toEqual([0, 1]);
    });

    it('returns empty when system message blocks boundary from reaching User', async () => {
        const { snapToTurnBoundary } = await import('../../src/utils/tokens.js');

        // B(0) SYS(1) B(2)
        const chat = [
            { mes: 'b0', is_user: false, is_system: false },
            { mes: 'sys', is_user: false, is_system: true },
            { mes: 'b2', is_user: false, is_system: false },
        ];

        const result = snapToTurnBoundary(chat, [0]);
        expect(result).toEqual([]);
    });

    it('finds boundary when system message has is_user true', async () => {
        const { snapToTurnBoundary } = await import('../../src/utils/tokens.js');

        // U(0) B(1) SYS(is_user:true)(2) U(3)
        const chat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'note', is_user: true, is_system: true },  // ST hidden with is_user
            { mes: 'u3', is_user: true, is_system: false },
        ];

        const result = snapToTurnBoundary(chat, [0, 1]);
        expect(result).toEqual([0, 1]);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/utils/tokens.test.js -t "system messages"`
Expected: FAIL — `snapToTurnBoundary` returns `[]` for the first test because `chat[2].is_user` is `false` (system message).

- [ ] Step 3: Commit failing test

```bash
git add tests/utils/tokens.test.js && git commit -m "test: add failing tests for snapToTurnBoundary system message handling"
```

---

### Task 2: Green — fix snapToTurnBoundary

**Files:**
- Modify: `src/utils/tokens.js`

- [ ] Step 1: Write the implementation

Replace the forward-look logic in `snapToTurnBoundary` (line 77-100):

```javascript
function snapToTurnBoundary(chat, messageIds, allowUserOnly = false) {
    if (messageIds.length === 0) return [];

    // Walk backward from the end of the list
    for (let i = messageIds.length - 1; i >= 0; i--) {
        const lastId = messageIds[i];
        const lastMsg = chat[lastId];

        // Skip system messages — they aren't real conversation turns
        if (lastMsg?.is_system) continue;

        // Walk forward past system messages to find the next real message
        let nextIdx = lastId + 1;
        while (chat[nextIdx]?.is_system) nextIdx++;
        const nextInChat = chat[nextIdx];

        // Valid: last message is from bot AND (end of chat OR next message is from user)
        // This ensures we split at B→U boundaries, not mid-turn (U→U or U→B)
        if (lastMsg && !lastMsg.is_user && (!nextInChat || nextInChat.is_user)) {
            return messageIds.slice(0, i + 1);
        }
    }

    // Fallback: if no Bot→User boundary found and we allow user-only batches,
    // return the accumulated messages anyway (prevents stall)
    if (allowUserOnly) {
        return messageIds;
    }

    return [];
}
```

- [ ] Step 2: Run tests to verify they pass

Run: `npx vitest run tests/utils/tokens.test.js`
Expected: ALL PASS

- [ ] Step 3: Commit

```bash
git add src/utils/tokens.js && git commit -m "fix: skip system messages in snapToTurnBoundary forward look"
```

---

### Task 3: Red test — trimTailTurns with system messages

**Files:**
- Test: `tests/extraction/extract.test.js` (or a new dedicated file — check where scheduler tests live)

**Common Pitfalls:**
- `trimTailTurns` is exported from `src/extraction/scheduler.js`, not `extract.js`
- The function is synchronous — no `await` needed

- [ ] Step 1: Check if scheduler tests exist. If not, create `tests/extraction/scheduler.test.js`.

Create `tests/extraction/scheduler.test.js`:

```javascript
import { describe, expect, it } from 'vitest';

describe('trimTailTurns — system messages', () => {
    it('finds Bot→User boundary with system message in between', async () => {
        const { trimTailTurns } = await import('../../src/extraction/scheduler.js');

        // U(0) B(1) SYS(2) U(3) B(4) SYS(5) U(6)
        const chat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'sys', is_user: false, is_system: true },
            { mes: 'u3', is_user: true, is_system: false },
            { mes: 'b4', is_user: false, is_system: false },
            { mes: 'sys2', is_user: false, is_system: true },
            { mes: 'u6', is_user: true, is_system: false },
        ];

        // Trim 1 turn from tail — should find B(4)→U(6) boundary past SYS(5)
        const result = trimTailTurns(chat, [0, 1, 2, 3, 4, 5, 6], 1);
        expect(result.length).toBeLessThan(7);
        expect(result.length).toBeGreaterThan(0);
    });

    it('trims correctly when system message blocks boundary detection', async () => {
        const { trimTailTurns } = await import('../../src/extraction/scheduler.js');

        // U(0) B(1) SYS(2) U(3) U(4) B(5)
        const chat = [
            { mes: 'u0', is_user: true, is_system: false },
            { mes: 'b1', is_user: false, is_system: false },
            { mes: 'sys', is_user: false, is_system: true },
            { mes: 'u3', is_user: true, is_system: false },
            { mes: 'u4', is_user: true, is_system: false },
            { mes: 'b5', is_user: false, is_system: false },
        ];

        // Without fix, B(1)→SYS(2) would fail boundary detection
        // With fix, B(1)→U(3) should be found past SYS(2)
        const result = trimTailTurns(chat, [0, 1, 3, 4, 5], 1);
        expect(result).toEqual([0, 1, 3]);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npx vitest run tests/extraction/scheduler.test.js`
Expected: FAIL

- [ ] Step 3: Commit failing test

```bash
git add tests/extraction/scheduler.test.js && git commit -m "test: add failing tests for trimTailTurns system message handling"
```

---

### Task 4: Green — fix trimTailTurns

**Files:**
- Modify: `src/extraction/scheduler.js`

- [ ] Step 1: Write the implementation

Replace the forward-look logic in `trimTailTurns` (line 90-126). The same pattern: skip `is_system` when looking forward.

```javascript
function trimTailTurns(chat, messageIds, turnsToTrim) {
    if (turnsToTrim <= 0 || messageIds.length === 0) return messageIds;

    let cutIndex = messageIds.length;
    let turnsFound = 0;

    for (let i = messageIds.length - 1; i >= 0; i--) {
        const id = messageIds[i];
        const msg = chat[id];

        // Skip system messages — they aren't real conversation turns
        if (msg?.is_system) continue;

        // Walk forward past system messages to find the next real message
        let nextIdx = id + 1;
        while (chat[nextIdx]?.is_system) nextIdx++;
        const nextInChat = chat[nextIdx];

        // Bot→User boundary (same logic as snapToTurnBoundary)
        if (msg && !msg.is_user && (!nextInChat || nextInChat.is_user)) {
            turnsFound++;
            if (turnsFound === turnsToTrim) {
                // Walk back to find the start of this turn (first user message in the sequence)
                cutIndex = i;
                for (let j = i - 1; j >= 0; j--) {
                    const prevMsg = chat[messageIds[j]];
                    if (prevMsg?.is_user) {
                        cutIndex = j;
                    } else {
                        break;
                    }
                }
                break;
            }
        }
    }

    // If no boundaries found, return original
    if (turnsFound === 0) return messageIds;

    // If trimming would empty the batch, return original (protect start-of-chat)
    const trimmed = messageIds.slice(0, cutIndex);
    return trimmed.length > 0 ? trimmed : messageIds;
}
```

- [ ] Step 2: Run all affected tests

Run: `npx vitest run tests/utils/tokens.test.js tests/extraction/scheduler.test.js`
Expected: ALL PASS

- [ ] Step 3: Run full test suite

Run: `npm test`
Expected: ALL PASS (no regressions)

- [ ] Step 4: Commit

```bash
git add src/extraction/scheduler.js && git commit -m "fix: skip system messages in trimTailTurns forward look"
```

---

### Task 5: Run full pre-commit checks

- [ ] Step 1: Run `npm run check`

Run: `npm run check`
Expected: PASS (lint, typecheck, jsdoc, css all pass)

- [ ] Step 2: Final commit if any auto-fixes applied

```bash
git add -A && git commit -m "chore: pre-commit fixes for boundary detection changes"
```
