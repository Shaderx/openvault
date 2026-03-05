# Implementation Plan - Reflection Quality & GraphRAG Improvements

> **Reference:** `tmp/task.md` (OpenVault Improvement Plan)
> **Execution:** Use `executing-plans` skill.
> **Date:** 2026-03-05

---

## Overview

This plan implements four phases of improvements:
1. **Phase 1:** Reflection Lifecycle - 3-Tier Replacement & Pre-Flight Similarity Gate
2. **Phase 2:** GraphRAG Entity Merging Accuracy
3. **Phase 3:** Extraction Quality & Robustness
4. **Phase 4:** Clean Up & Tuning

---

## Phase 1: Reflection Lifecycle & "Replace, Don't Accumulate" Strategy

### Task 1.1: Implement 3-Tier Reflection Replacement with Logging

**Goal:** Replace the binary dedup filter with a 3-tier similarity system (Reject/Replace/Add) that logs what is being replaced.

**Step 1: Write the Failing Test**
- File: `tests/reflection/reflection-filter.test.js`
- Code:
  ```javascript
  import { describe, it, expect, beforeEach } from 'https://esm.sh/benchmark';
  import { filterDuplicateReflections } from '../../src/reflection/reflect.js';

  describe('filterDuplicateReflections - 3-Tier Replacement', () => {
      let existingMemories;
      let consoleOutput;

      beforeEach(() => {
          // Mock console.log to capture output
          consoleOutput = [];
          const originalLog = console.log;
          console.log = (...args) => consoleOutput.push(args.join(' '));

          existingMemories = [
              {
                  id: 'ref_001',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice struggles with trust issues due to past betrayal',
                  embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
              },
              {
                  id: 'ref_002',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice shows vulnerability around Bob',
                  embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
              },
          ];
      });

      it('should reject reflections >= 90% similar', () => {
          const newReflections = [
              {
                  id: 'ref_new_1',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice struggles with trust issues due to past betrayal', // Identical
                  embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // 100% similar
              },
          ];

          const result = filterDuplicateReflections(newReflections, existingMemories);

          expect(result.toAdd).toHaveLength(0);
          expect(result.toArchiveIds).toHaveLength(0);
      });

      it('should replace reflections 80-89% similar', () => {
          const newReflections = [
              {
                  id: 'ref_new_2',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice has deep trust problems because of previous betrayal', // Similar but different wording
                  embedding: [0.12, 0.22, 0.32, 0.42, 0.52], // ~85% similar
              },
          ];

          const result = filterDuplicateReflections(newReflections, existingMemories);

          expect(result.toAdd).toHaveLength(1);
          expect(result.toArchiveIds).toEqual(['ref_001']);
      });

      it('should add reflections < 80% similar', () => {
          const newReflections = [
              {
                  id: 'ref_new_3',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice enjoys painting landscapes', // Completely different
                  embedding: [0.9, 0.8, 0.7, 0.6, 0.5], // Low similarity
              },
          ];

          const result = filterDuplicateReflections(newReflections, existingMemories);

          expect(result.toAdd).toHaveLength(1);
          expect(result.toArchiveIds).toHaveLength(0);
      });

      it('should log OLD -> NEW with correlation percentage', () => {
          const newReflections = [
              {
                  id: 'ref_new_2',
                  type: 'reflection',
                  character: 'Alice',
                  summary: 'Alice has deep trust problems',
                  embedding: [0.12, 0.22, 0.32, 0.42, 0.52],
              },
          ];

          filterDuplicateReflections(newReflections, existingMemories);

          const logString = consoleOutput.join(' ');
          expect(logString).toContain('Reflection replaced');
          expect(logString).toContain('85.0%'); // Should show percentage
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/reflection/reflection-filter.test.js` (if test runner exists) or `node tests/reflection/reflection-filter.test.js`
- Expect: "Fail: function returns array not object"

**Step 3: Implementation (Green)**
- File: `src/reflection/reflect.js` -> `filterDuplicateReflections()`
- Action: Replace the entire function with:

  ```javascript
  /**
   * Filter out reflections that are too similar to existing reflections for the same character.
   * Uses a 3-tier similarity threshold:
   * - >= 90% (Reject): Too similar, discard new reflection
   * - 80% - 89% (Replace): Similar theme with newer wording, replace old with new
   * - < 80% (Add): Genuinely new insight, add to collection
   *
   * @param {Array} newReflections - Newly generated reflections
   * @param {Array} existingMemories - All existing memories
   * @param {number} rejectThreshold - Cosine similarity threshold for rejection (default: 0.90)
   * @param {number} replaceThreshold - Cosine similarity threshold for replacement (default: 0.80)
   * @returns {{toAdd: Array, toArchiveIds: string[]}} Reflections to add and IDs to archive
   */
  export function filterDuplicateReflections(
      newReflections,
      existingMemories,
      rejectThreshold = 0.90,
      replaceThreshold = 0.80
  ) {
      const existingReflections = existingMemories.filter((m) => m.type === 'reflection' && m.embedding);
      const toAdd = [];
      const toArchiveIds = new Set();

      for (const ref of newReflections) {
          if (!ref.embedding) {
              toAdd.push(ref);
              continue;
          }

          const sameCharReflections = existingReflections.filter((m) => m.character === ref.character);
          let bestMatch = null;
          let bestScore = 0;

          for (const existing of sameCharReflections) {
              const sim = cosineSimilarity(ref.embedding, existing.embedding);
              if (sim > bestScore) {
                  bestMatch = existing;
                  bestScore = sim;
              }
          }

          if (bestMatch && bestScore >= rejectThreshold) {
              // Tier 1: Reject - too similar
              log(`Reflection rejected: "${ref.summary}" (${(bestScore * 100).toFixed(1)}% similar to existing "${bestMatch.summary}")`);
              continue;
          }

          if (bestMatch && bestScore >= replaceThreshold) {
              // Tier 2: Replace - same theme, newer wording
              log(`Reflection replaced: OLD "${bestMatch.summary}" -> NEW "${ref.summary}" (${(bestScore * 100).toFixed(1)}% correlation)`);
              toArchiveIds.add(bestMatch.id);
              toAdd.push(ref);
              continue;
          }

          // Tier 3: Add - genuinely new
          toAdd.push(ref);
      }

      return { toAdd, toArchiveIds: Array.from(toArchiveIds) };
  }
  ```

**Step 4: Update generateReflections to Handle New Return Format**
- File: `src/reflection/reflect.js` -> `generateReflections()`
- Action: Find the deduplication section (around line 130) and replace:

  ```javascript
  // OLD CODE (to be replaced):
  const reflectionDedupThreshold = settings.reflectionDedupThreshold ?? 0.9;
  const dedupedReflections = filterDuplicateReflections(reflections, allMemories, reflectionDedupThreshold);
  if (dedupedReflections.length < reflections.length) {
      log(
          `Reflection dedup: Filtered ${reflections.length - dedupedReflections.length} duplicate reflections for ${characterName}`
      );
  }

  log(`Reflection: Generated ${dedupedReflections.length} reflections for ${characterName}`);
  return dedupedReflections;
  ```

  With:

  ```javascript
  // NEW CODE:
  const reflectionDedupThreshold = settings.reflectionDedupThreshold ?? 0.9;
  const replaceThreshold = (reflectionDedupThreshold - 0.1); // 0.80 when default is 0.90
  const { toAdd, toArchiveIds } = filterDuplicateReflections(reflections, allMemories, reflectionDedupThreshold, replaceThreshold);

  // Archive replaced reflections
  if (toArchiveIds.length > 0) {
      for (const memory of allMemories) {
          if (toArchiveIds.includes(memory.id)) {
              memory.archived = true;
          }
      }
      log(`Reflection: Archived ${toArchiveIds.length} replaced reflections for ${characterName}`);
  }

  log(`Reflection: Generated ${toAdd.length} reflections for ${characterName} (${reflections.length - toAdd.length} filtered)`);
  return toAdd;
  ```

**Step 5: Verify (Green)**
- Command: `npm test` (if test runner available)
- Expect: PASS for all reflection filter tests

**Step 6: Git Commit**
- Command: `git add src/reflection/reflect.js && git commit -m "feat: implement 3-tier reflection replacement with logging"`

---

### Task 1.2: Implement Pre-Flight Similarity Gate

**Goal:** Skip reflection generation entirely when new events align with existing insights (>85% similarity).

**Step 1: Write the Failing Test**
- File: `tests/reflection/preflight-gate.test.js`
- Code:
  ```javascript
  import { describe, it, expect } from 'https://esm.sh/benchmark';
  import { shouldSkipReflectionGeneration } from '../../src/reflection/reflect.js';

  describe('shouldSkipReflectionGeneration', () => {
      it('should return true when recent events align with existing reflections', () => {
          const recentMemories = [
              { summary: 'Alice trusted Bob with her secret', embedding: [0.1, 0.2, 0.3] },
              { summary: 'Alice showed vulnerability to Bob', embedding: [0.2, 0.3, 0.4] },
          ];

          const existingReflections = [
              { summary: 'Alice is learning to trust Bob', embedding: [0.12, 0.22, 0.32] },
          ];

          const result = shouldSkipReflectionGeneration(recentMemories, existingReflections, 0.85);

          expect(result.shouldSkip).toBe(true);
          expect(result.reason).toContain('align with existing insights');
      });

      it('should return false when recent events are novel', () => {
          const recentMemories = [
              { summary: 'Alice met a new character Carol', embedding: [0.9, 0.8, 0.7] },
          ];

          const existingReflections = [
              { summary: 'Alice trusts Bob', embedding: [0.1, 0.2, 0.3] },
          ];

          const result = shouldSkipReflectionGeneration(recentMemories, existingReflections, 0.85);

          expect(result.shouldSkip).toBe(false);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `node tests/reflection/preflight-gate.test.js`
- Expect: "ReferenceError: shouldSkipReflectionGeneration is not defined"

**Step 3: Implementation (Green)**
- File: `src/reflection/reflect.js`
- Action: Add the new function before `generateReflections()`:

  ```javascript
  /**
   * Check if reflection generation should be skipped due to high alignment
   * between recent events and existing reflections.
   *
   * @param {Array} recentMemories - Recent memories that triggered reflection threshold
   * @param {Array} existingReflections - Existing reflections for the character
   * @param {number} threshold - Similarity threshold for skipping (default: 0.85)
   * @returns {{shouldSkip: boolean, reason: string|null}}
   */
  export function shouldSkipReflectionGeneration(recentMemories, existingReflections, threshold = 0.85) {
      if (!recentMemories.length || !existingReflections.length) {
          return { shouldSkip: false, reason: null };
      }

      // Calculate average embedding of recent memories (or use top 3 most important)
      const topRecent = recentMemories
          .filter(m => m.embedding)
          .sort((a, b) => (b.importance || 3) - (a.importance || 3))
          .slice(0, 3);

      if (topRecent.length === 0) {
          return { shouldSkip: false, reason: null };
      }

      // For each top recent memory, check if it aligns with existing reflections
      let alignCount = 0;
      for (const recent of topRecent) {
          for (const reflection of existingReflections) {
              if (!reflection.embedding) continue;
              const sim = cosineSimilarity(recent.embedding, reflection.embedding);
              if (sim >= threshold) {
                  alignCount++;
                  break;
              }
          }
      }

      // If majority of recent events align with existing insights, skip generation
      if (alignCount >= Math.ceil(topRecent.length / 2)) {
          return {
              shouldSkip: true,
              reason: `Reflection skipped: ${alignCount}/${topRecent.length} recent events align with existing insights (>${(threshold * 100).toFixed(0)}%)`
          };
      }

      return { shouldSkip: false, reason: null };
  }
  ```

**Step 4: Integrate Pre-Flight Gate into generateReflections()**
- File: `src/reflection/reflect.js` -> `generateReflections()`
- Action: Add the pre-flight check after the memory count check (around line 85):

  ```javascript
  // Add this after the "too few memories" check:
  const existingReflections = accessibleMemories.filter((m) => m.type === 'reflection' && m.character === characterName);

  // Pre-flight similarity gate: check if recent events align with existing insights
  const { shouldSkip, reason: skipReason } = shouldSkipReflectionGeneration(
      recentMemories.slice(0, 10), // Check top 10 most recent
      existingReflections,
      0.85
  );

  if (shouldSkip) {
      log(`Reflection: ${skipReason} for ${characterName}`);
      // Reset importance sum for this character
      if (reflectionState && reflectionState[characterName]) {
          reflectionState[characterName].importance_sum = 0;
      }
      return [];
  }
  ```

  Note: You'll need to add `reflectionState` as a parameter to `generateReflections()` or access it via the data object. Adjust based on how the function is called.

**Step 5: Verify (Green)**
- Command: Run the test and verify logs show skip messages when appropriate
- Expect: Tests pass, logs show "Reflection skipped: Recent events align..."

**Step 6: Git Commit**
- Command: `git add src/reflection/reflect.js && git commit -m "feat: add pre-flight similarity gate to reflection generation"`

---

## Phase 2: GraphRAG Entity Merging Accuracy

### Task 2.1: Change Default Entity Merge Threshold

**Goal:** Increase the default entity merge similarity threshold from 0.9 to 0.94.

**Step 1: Update Default Setting**
- File: `src/constants.js` -> `defaultSettings`
- Action: Find `entityMergeSimilarityThreshold: 0.9` and change to:

  ```javascript
  entityMergeSimilarityThreshold: 0.94,
  ```

**Step 2: Update UI Hints**
- File: `src/constants.js` -> `UI_DEFAULT_HINTS`
- Action: Verify the hint exists and is consistent (should automatically reference defaultSettings)

**Step 3: Verify**
- Command: `grep -n "entityMergeSimilarityThreshold" src/constants.js`
- Expect: Both lines show `0.94`

**Step 4: Git Commit**
- Command: `git add src/constants.js && git commit -m "feat: increase default entity merge threshold to 0.94"`

---

### Task 2.2: Improve Token Overlap Guard

**Goal:** Prevent false merges by requiring at least 50% token overlap (not just a single common token).

**Step 1: Write the Failing Test**
- File: `tests/graph/token-overlap.test.js`
- Code:
  ```javascript
  import { describe, it, expect } from 'https://esm.sh/benchmark';
  import { hasSufficientTokenOverlap } from '../../src/graph/graph.js';

  describe('hasSufficientTokenOverlap', () => {
      it('should reject single adjective overlap (e.g., "Burgundy")', () => {
          const tokensA = new Set(['burgundy', 'panties']);
          const tokensB = new Set(['burgundy', 'soy-wax', 'candle']);

          expect(hasSufficientTokenOverlap(tokensA, tokensB, 0.5)).toBe(false);
      });

      it('should accept 50%+ token overlap', () => {
          const tokensA = new Set(['king', 'aldric', 'northern']);
          const tokensB = new Set(['king', 'aldric', 'southern']);

          expect(hasSufficientTokenOverlap(tokensA, tokensB, 0.5)).toBe(true);
      });

      it('should handle substring containment separately', () => {
          const keyA = 'alice';
          const keyB = 'alicia';

          expect(hasSufficientTokenOverlap(
              new Set([keyA]),
              new Set([keyB]),
              0.5,
              keyA,
              keyB
          )).toBe(true); // Substring containment
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `node tests/graph/token-overlap.test.js`
- Expect: "ReferenceError: hasSufficientTokenOverlap is not defined"

**Step 3: Implementation (Green)**
- File: `src/graph/graph.js`
- Action: Add the new helper function before `mergeOrInsertEntity()`:

  ```javascript
  /**
   * Check if two token sets have sufficient overlap to consider merging.
   * Requires at least the specified ratio (default 0.5) of tokens to overlap.
   * Substring containment is treated as a separate positive signal.
   *
   * @param {Set<string>} tokensA - First set of tokens
   * @param {Set<string>} tokensB - Second set of tokens
   * @param {number} minOverlapRatio - Minimum overlap ratio (default: 0.5)
   * @param {string} [keyA] - Original key A for substring check
   * @param {string} [keyB] - Original key B for substring check
   * @returns {boolean}
   */
  export function hasSufficientTokenOverlap(tokensA, tokensB, minOverlapRatio = 0.5, keyA = '', keyB = '') {
      // Substring containment is always a positive signal
      if (keyA && keyB && (keyA.includes(keyB) || keyB.includes(keyA))) {
          return true;
      }

      // Filter out common adjectives/stop words (basic list)
      const stopWords = new Set([
          'the', 'a', 'an', 'this', 'that', 'these', 'those',
          'red', 'blue', 'green', 'yellow', 'black', 'white',
          'burgundy', 'dark', 'light', 'large', 'small', 'big',
          'old', 'new', 'young', 'first', 'last', 'other'
      ]);

      const significantA = new Set([...tokensA].filter(t => !stopWords.has(t.toLowerCase())));
      const significantB = new Set([...tokensB].filter(t => !stopWords.has(t.toLowerCase())));

      if (significantA.size === 0 || significantB.size === 0) {
          return false;
      }

      // Calculate overlap
      let overlapCount = 0;
      for (const token of significantA) {
          if (significantB.has(token)) {
              overlapCount++;
          }
      }

      const minSize = Math.min(significantA.size, significantB.size);
      const overlapRatio = overlapCount / minSize;

      return overlapRatio >= minOverlapRatio;
  }
  ```

**Step 4: Update mergeOrInsertEntity to Use New Helper**
- File: `src/graph/graph.js` -> `mergeOrInsertEntity()`
- Action: Replace the token overlap logic (around line 155-165):

  ```javascript
  // OLD CODE:
  const newTokens = new Set(key.split(/\s+/));
  for (const [existingKey, node] of Object.entries(graphData.nodes)) {
      if (node.type !== type) continue;
      if (!node.embedding) continue;

      const existingTokens = existingKey.split(/\s+/);
      const hasTokenOverlap = existingTokens.some(t => newTokens.has(t));
      const hasSubstring = key.includes(existingKey) || existingKey.includes(key);
      if (!hasTokenOverlap && !hasSubstring) continue;

      const sim = cosineSimilarity(newEmbedding, node.embedding);
      // ... rest of code
  }
  ```

  With:

  ```javascript
  // NEW CODE:
  const newTokens = new Set(key.split(/\s+/));
  for (const [existingKey, node] of Object.entries(graphData.nodes)) {
      if (node.type !== type) continue;
      if (!node.embedding) continue;

      const existingTokens = new Set(existingKey.split(/\s+/));

      // Use improved token overlap guard
      if (!hasSufficientTokenOverlap(newTokens, existingTokens, 0.5, key, existingKey)) {
          continue;
      }

      const sim = cosineSimilarity(newEmbedding, node.embedding);
      // ... rest of code
  }
  ```

**Step 5: Update consolidateGraph Similarly**
- File: `src/graph/graph.js` -> `consolidateGraph()`
- Action: Apply the same helper function usage (around line 260-275)

**Step 6: Verify**
- Command: `node tests/graph/token-overlap.test.js`
- Expect: All tests pass

**Step 7: Git Commit**
- Command: `git add src/graph/graph.js && git commit -m "feat: improve entity merge token overlap guard"`

---

## Phase 3: Extraction Quality & Robustness

### Task 3.1: Add Minimum Quality Gate for Events

**Goal:** Require event summaries to be at least 30 characters (complete descriptive sentences).

**Step 1: Update Event Schema**
- File: `src/extraction/structured.js` -> `EventSchema`
- Action: Change line 18:

  ```javascript
  // OLD:
  summary: z.string().min(1, 'Summary is required'),

  // NEW:
  summary: z.string().min(30, 'Summary must be a complete descriptive sentence (min 30 characters)'),
  ```

**Step 2: Verify**
- Command: `grep -A2 "EventSchema" src/extraction/structured.js | grep summary`
- Expect: Shows `min(30,`

**Step 3: Git Commit**
- Command: `git add src/extraction/structured.js && git commit -m "feat: require minimum 30 char event summaries"`

---

### Task 3.2: Harden Extraction Prompt for Quality & Schema

**Goal:** Add explicit directives for quality and prevent array-wrapping errors.

**Step 1: Update Prompt Rules**
- File: `src/prompts.js` -> `<detail_rules>`
- Action: Add this rule after the first paragraph:

  ```markdown
  <detail_rules>
  Event summaries MUST be complete, highly descriptive sentences (minimum 6 words, 30 characters).
  Do not extract fragmented thoughts or micro-actions like "Character breathed" or "She nodded."
  ...
  </detail_rules>
  ```

**Step 2: Update Output Schema Critical Format Rules**
- File: `src/prompts.js` -> `<output_schema>` -> `CRITICAL FORMAT RULES`
- Action: Add to rule #1:

  ```markdown
  CRITICAL FORMAT RULES — violating ANY of these will cause a system error:
  1. The top level MUST be a JSON object { }, NEVER a bare array [ ]. NEVER wrap your entire response in [ ].
  2. ... (rest of existing rules)
  ```

**Step 3: Verify**
- Command: `grep -A5 "CRITICAL FORMAT RULES" src/prompts.js`
- Expect: Shows updated rule #1

**Step 4: Git Commit**
- Command: `git add src/prompts.js && git commit -m "feat: harden extraction prompt quality rules"`

---

### Task 3.3: Add Graceful JSON Array Recovery

**Goal:** Recover from LLM returning root-level array instead of object.

**Step 1: Update safeParseJSON**
- File: `src/utils.js` -> `safeParseJSON()`
- Action: Add array recovery after the parsing step (around line 235):

  ```javascript
  // After: const parsed = JSON.parse(repaired);
  // Add this fallback:
  if (parsed === null || typeof parsed !== 'object') {
      getDeps().console.error('[OpenVault] JSON Parse returned non-object/array:', typeof parsed);
      getDeps().console.error('[OpenVault] Raw LLM response:', input);
      return null;
  }

  // NEW: Graceful array recovery - if LLM returned a bare array of events
  if (Array.isArray(parsed)) {
      getDeps().console.warn('[OpenVault] LLM returned array instead of object, applying recovery wrapper');
      return {
          events: parsed,
          entities: [],
          relationships: [],
          reasoning: null
      };
  }

  return parsed;
  ```

**Step 2: Verify**
- Command: Run a test extraction or check that the function compiles
- Expect: No syntax errors

**Step 3: Git Commit**
- Command: `git add src/utils.js && git commit -m "feat: add graceful JSON array recovery for extraction"`

---

## Phase 4: Clean Up & Tuning

### Task 4.1: Update UI Settings Panel

**Goal:** Ensure UI hints show the new 0.94 merge threshold.

**Step 1: Check Settings File**
- File: `src/ui/settings.js`
- Action: Verify the hint text for entity merge threshold mentions 0.94 or references the default

**Step 2: Update if Necessary**
- If hardcoded, update to: `(default: 0.94)`

**Step 3: Verify**
- Command: `grep -n "0.9\|0.94" src/ui/settings.js`
- Expect: Shows 0.94 in the appropriate context

**Step 4: Git Commit**
- Command: `git add src/ui/settings.js && git commit -m "docs: update UI hints for entity merge threshold"`

---

### Task 4.2: Document Reflection Budgeting

**Goal:** Add comments documenting the replace strategy as the primary mechanism.

**Step 1: Add Documentation**
- File: `src/reflection/reflect.js`
- Action: Add comment block at the top of the file:

  ```javascript
  /**
   * OpenVault Reflection Engine
   *
   * Per-character reflection system inspired by the Smallville paper.
   * Synthesizes raw events into high-level insights.
   *
   * REFLECTION BUDGET MECHANISM:
   * - Primary: 3-Tier Replacement (filterDuplicateReflections) prevents accumulation
   *   by replacing similar reflections (80-89% similarity) rather than adding.
   * - Secondary: Hard cap (maxReflectionsPerCharacter: 50) archives oldest reflections
   *   when exceeded.
   * - Tertiary: Pre-Flight Similarity Gate skips generation when recent events
   *   align with existing insights (>85%).
   */
  ```

**Step 2: Verify**
- Command: `head -20 src/reflection/reflect.js`
- Expect: Shows the documentation block

**Step 3: Git Commit**
- Command: `git add src/reflection/reflect.js && git commit -m "docs: add reflection budgeting documentation"`

---

## Final Verification

**After all tasks:**

1. Run all tests (if test runner exists): `npm test`
2. Check for syntax errors: `node -c src/reflection/reflect.js && node -c src/graph/graph.js && node -c src/utils.js && node -c src/extraction/structured.js`
3. Review git log: `git log --oneline -10`

**Expected outcome:**
- 10 commits total across all phases
- No syntax errors
- Reflection system now uses 3-tier replacement with logging
- Entity merging uses 0.94 threshold and improved token overlap guard
- Event summaries require minimum 30 characters
- JSON array recovery prevents extraction failures
