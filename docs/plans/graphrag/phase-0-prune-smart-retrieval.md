# Phase 0: Prune Obsolete "Smart Retrieval"

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

Reflections + GraphRAG make inline LLM memory selection obsolete. Remove all smart retrieval code, settings, and UI before building new features on the simplified codebase.

---

### Task 0.1: Remove RetrievalResponseSchema and Smart Retrieval Parsing

**Goal:** Delete `RetrievalResponseSchema`, `getRetrievalJsonSchema`, and `parseRetrievalResponse` from `src/extraction/structured.js`.

**Step 1: Write the Failing Test**
- File: `tests/extraction/structured.test.js`
- Add a test that verifies the removed exports no longer exist:
  ```javascript
  describe('smart retrieval removal', () => {
      it('does not export RetrievalResponseSchema', () => {
          const module = await import('../../src/extraction/structured.js');
          expect(module.RetrievalResponseSchema).toBeUndefined();
      });

      it('does not export getRetrievalJsonSchema', () => {
          const module = await import('../../src/extraction/structured.js');
          expect(module.getRetrievalJsonSchema).toBeUndefined();
      });

      it('does not export parseRetrievalResponse', () => {
          const module = await import('../../src/extraction/structured.js');
          expect(module.parseRetrievalResponse).toBeUndefined();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — these exports still exist

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
- Action: Delete the `RetrievalResponseSchema` definition (lines 34-38), the `getRetrievalJsonSchema` function, and the `parseRetrievalResponse` function.
- Remove the export of all three.

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "refactor: remove RetrievalResponseSchema and smart retrieval parsing"`

---

### Task 0.2: Remove LLM_CONFIGS.retrieval and callLLMForRetrieval

**Goal:** Delete `LLM_CONFIGS.retrieval` and `callLLMForRetrieval` from `src/llm.js`.

**Step 1: Write the Failing Test**
- File: `tests/llm.test.js` (new file)
  ```javascript
  import { describe, it, expect } from 'vitest';
  import { LLM_CONFIGS } from '../src/llm.js';

  describe('LLM_CONFIGS after smart retrieval removal', () => {
      it('does not have a retrieval config', () => {
          expect(LLM_CONFIGS.retrieval).toBeUndefined();
      });

      it('still has extraction config', () => {
          expect(LLM_CONFIGS.extraction).toBeDefined();
          expect(LLM_CONFIGS.extraction.profileSettingKey).toBe('extractionProfile');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `LLM_CONFIGS.retrieval` still exists

**Step 3: Implementation (Green)**
- File: `src/llm.js`
- Action:
  - Delete the `retrieval` entry from `LLM_CONFIGS` (the whole object at lines 25-30).
  - Delete the `callLLMForRetrieval` function (lines 104-112).
  - Remove the import of `getRetrievalJsonSchema` from `./extraction/structured.js`.

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "refactor: remove LLM_CONFIGS.retrieval and callLLMForRetrieval"`

---

### Task 0.3: Remove selectRelevantMemoriesSmart and Smart Retrieval Branch

**Goal:** Remove the smart retrieval path from `src/retrieval/scoring.js`, leaving only simple mathematical scoring.

**Step 1: Write the Failing Test**
- File: `tests/scoring.test.js` (new file)
  ```javascript
  import { describe, it, expect } from 'vitest';

  describe('scoring after smart retrieval removal', () => {
      it('does not export selectRelevantMemoriesSmart', async () => {
          const module = await import('../src/retrieval/scoring.js');
          expect(module.selectRelevantMemoriesSmart).toBeUndefined();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `selectRelevantMemoriesSmart` still exists

**Step 3: Implementation (Green)**
- File: `src/retrieval/scoring.js`
- Action:
  - Delete the entire `selectRelevantMemoriesSmart` function (lines 81-140).
  - In `selectRelevantMemories`, remove the `if (smartRetrievalEnabled)` branch entirely. Keep only the simple mode path:
    ```javascript
    export async function selectRelevantMemories(memories, ctx) {
        if (!memories || memories.length === 0) return [];
        const { finalTokens } = ctx;
        const scored = await selectRelevantMemoriesSimple(memories, ctx, 1000);
        const finalResults = sliceToTokenBudget(scored, finalTokens);
        log(`Retrieval: ${memories.length} memories -> ${scored.length} scored -> ${finalResults.length} after token filter (${finalTokens} budget)`);
        return finalResults;
    }
    ```
  - Remove unused imports: `parseRetrievalResponse` from `../extraction/structured.js`, `callLLMForRetrieval` from `../llm.js`, `buildSmartRetrievalPrompt` from `../prompts.js`.
  - Remove `preFilterTokens` and `smartRetrievalEnabled` from the JSDoc `@param` on `selectRelevantMemories`.

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "refactor: remove selectRelevantMemoriesSmart, simplify selectRelevantMemories"`

---

### Task 0.4: Remove buildSmartRetrievalPrompt

**Goal:** Delete `buildSmartRetrievalPrompt` from `src/prompts.js`.

**Step 1: Write the Failing Test**
- File: `tests/prompts.test.js`
- Add a test:
  ```javascript
  describe('smart retrieval prompt removal', () => {
      it('does not export buildSmartRetrievalPrompt', async () => {
          const module = await import('../src/prompts.js');
          expect(module.buildSmartRetrievalPrompt).toBeUndefined();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `buildSmartRetrievalPrompt` still exists

**Step 3: Implementation (Green)**
- File: `src/prompts.js`
- Action: Delete the entire `buildSmartRetrievalPrompt` function (lines 175 onward to end of file).

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "refactor: remove buildSmartRetrievalPrompt"`

---

### Task 0.5: Remove Smart Retrieval Settings from Constants, UI, and Retrieve

**Goal:** Clean up `smartRetrievalEnabled`, `retrievalProfile`, and related UI from constants, settings, and retrieve modules.

**Step 1: Write the Failing Test**
- File: `tests/constants.test.js` (new file)
  ```javascript
  import { describe, it, expect } from 'vitest';
  import { defaultSettings } from '../src/constants.js';

  describe('defaultSettings after smart retrieval removal', () => {
      it('does not contain smartRetrievalEnabled', () => {
          expect(defaultSettings).not.toHaveProperty('smartRetrievalEnabled');
      });

      it('does not contain retrievalProfile', () => {
          expect(defaultSettings).not.toHaveProperty('retrievalProfile');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — both properties still exist

**Step 3: Implementation (Green)**
- File: `src/constants.js`
  - Delete `retrievalProfile: '',` (line 28)
  - Delete `smartRetrievalEnabled: false,` (line 37)
  - Delete `retrievalPreFilterTokens: 20000,` (line 36) — only used by smart retrieval
  - Delete `retrievalPreFilterTokens` from `UI_DEFAULT_HINTS`

- File: `src/retrieval/retrieve.js`
  - In `buildRetrievalContext()`, remove the `smartRetrievalEnabled` and `preFilterTokens` properties from the returned object.
  - Remove `smartRetrievalEnabled` from the `RetrievalContext` JSDoc typedef.

- File: `src/ui/settings.js`
  - Delete the `$('#openvault_smart_retrieval').on('change', ...)` handler (lines 316-319).
  - Delete the `$('#openvault_retrieval_profile')` change handler that saves `retrievalProfile` (line 448).
  - Delete the lines that set `#openvault_smart_retrieval` checked state and toggle `#openvault_retrieval_profile_group` (lines 507-508).
  - Delete the `populateProfileDropdown` call for `#openvault_retrieval_profile` (line 583).

- File: `templates/settings_panel.html`
  - Delete the "Smart Retrieval" checkbox label block (lines 174-177).
  - Delete the `openvault_retrieval_profile_group` div (lines 179-186).
  - Delete the "Pre-filter Token Budget" setting group that references `retrievalPreFilterTokens` (around line 396).

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "refactor: remove smart retrieval settings from constants, UI, and retrieve"`

---

### Task 0.6: Final Phase 0 Verification

**Goal:** Confirm no dead references remain and all existing tests pass.

**Step 1: Verification**
- Command: `npm test`
- Expect: All tests pass with no failures.

**Step 2: Grep Verification**
- Run: `grep -r "smartRetrieval\|callLLMForRetrieval\|selectRelevantMemoriesSmart\|RetrievalResponseSchema\|buildSmartRetrievalPrompt\|retrievalProfile\|preFilterTokens" src/ templates/`
- Expect: No matches except in comments (if any).

**Step 3: Git Commit**
- Command: `git add . && git commit -m "refactor(phase-0): complete smart retrieval removal"`
