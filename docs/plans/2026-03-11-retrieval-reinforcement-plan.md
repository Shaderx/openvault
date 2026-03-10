# Implementation Plan - Retrieval-Reinforced Scoring

> **Reference:** `docs/designs/2026-03-11-retrieval-reinforcement-design.md`
> **Execution:** Use `executing-plans` skill.

---

## Task 1: Access-Reinforced Decay — hitDamping in calculateScore

**Goal:** Wire `memory.retrieval_hits` into the decay formula so frequently-retrieved memories decay slower.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/math.test.js`
- Code:
  ```javascript
  describe('Access-Reinforced Decay (hitDamping)', () => {
      it('should return hitDamping=1.0 when retrieval_hits is 0', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, retrieval_hits: 0 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.hitDamping).toBeCloseTo(1.0);
      });

      it('should return hitDamping=1.0 when retrieval_hits is missing', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.hitDamping).toBeCloseTo(1.0);
      });

      it('should dampen decay for 5 retrieval_hits (hitDamping ≈ 0.67)', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, retrieval_hits: 5 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          // 1 / (1 + 5 * 0.1) = 1/1.5 ≈ 0.667
          expect(result.hitDamping).toBeCloseTo(1 / 1.5, 2);
      });

      it('should cap hitDamping at 0.5 for very high retrieval_hits', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, retrieval_hits: 100 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.hitDamping).toBeCloseTo(0.5);
      });

      it('should produce higher base score with hits than without at same distance', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };

          const noHits = calculateScore(
              { message_ids: [10], importance: 3, retrieval_hits: 0 }, null, 200, constants, settings
          );
          const withHits = calculateScore(
              { message_ids: [10], importance: 3, retrieval_hits: 10 }, null, 200, constants, settings
          );
          expect(withHits.base).toBeGreaterThan(noHits.base);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: Fail — `result.hitDamping` is `undefined`

**Step 3: Implementation (Green)**
- File: `src/retrieval/math.js`
- Action: In `calculateScore()`, after line `const lambda = constants.BASE_LAMBDA / (importance * importance);` (line 198), apply hitDamping:

  Replace:
  ```javascript
  const lambda = constants.BASE_LAMBDA / (importance * importance);

  // Core forgetfulness formula: Score = Importance × e^(-λ × Distance)
  const base = importance * Math.exp(-lambda * distance);
  ```
  With:
  ```javascript
  // Access-reinforced decay: dampen lambda by retrieval history
  const hits = memory.retrieval_hits || 0;
  const hitDamping = Math.max(0.5, 1 / (1 + hits * 0.1));
  const lambda = (constants.BASE_LAMBDA / (importance * importance)) * hitDamping;

  // Core forgetfulness formula: Score = Importance × e^(-λ × Distance)
  const base = importance * Math.exp(-lambda * distance);
  ```

- Then add `hitDamping` to the return object:
  ```javascript
  return {
      total,
      base,
      baseAfterFloor,
      recencyPenalty,
      vectorBonus,
      vectorSimilarity,
      bm25Bonus,
      bm25Score,
      distance,
      importance,
      hitDamping,
  };
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: All 5 new tests PASS, all existing tests PASS.

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat: access-reinforced decay — hitDamping in calculateScore"`

---

## Task 2: Frequency Factor — mentions boost in calculateScore

**Goal:** Multiply final score by a sublinear frequency factor derived from `memory.mentions`.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/math.test.js`
- Code:
  ```javascript
  describe('Frequency Factor (mentions boost)', () => {
      it('should return frequencyFactor=1.0 when mentions is 1 (default)', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, mentions: 1 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.frequencyFactor).toBeCloseTo(1.0);
      });

      it('should return frequencyFactor=1.0 when mentions is missing', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.frequencyFactor).toBeCloseTo(1.0);
      });

      it('should boost score for mentions=10 (frequencyFactor ≈ 1.115)', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, mentions: 10 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          // 1 + Math.log(10) * 0.05 ≈ 1.115
          expect(result.frequencyFactor).toBeCloseTo(1 + Math.log(10) * 0.05, 2);
      });

      it('should boost score for mentions=50 (frequencyFactor ≈ 1.196)', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const memory = { message_ids: [10], importance: 3, mentions: 50 };
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };
          const result = calculateScore(memory, null, 100, constants, settings);
          expect(result.frequencyFactor).toBeCloseTo(1 + Math.log(50) * 0.05, 2);
      });

      it('should multiply total by frequencyFactor', async () => {
          const { calculateScore } = await import('../../src/retrieval/math.js');
          const constants = { BASE_LAMBDA: 0.05, IMPORTANCE_5_FLOOR: 1.0, reflectionDecayThreshold: 750 };
          const settings = { vectorSimilarityThreshold: 0.5, alpha: 0.5, combinedBoostWeight: 2.0 };

          const noMentions = calculateScore(
              { message_ids: [10], importance: 3 }, null, 100, constants, settings
          );
          const withMentions = calculateScore(
              { message_ids: [10], importance: 3, mentions: 10 }, null, 100, constants, settings
          );
          // Total should be proportionally higher by frequencyFactor
          const expectedRatio = withMentions.frequencyFactor / noMentions.frequencyFactor;
          expect(withMentions.total / noMentions.total).toBeCloseTo(expectedRatio, 2);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: Fail — `result.frequencyFactor` is `undefined`

**Step 3: Implementation (Green)**
- File: `src/retrieval/math.js`
- Action: In `calculateScore()`, after the line `let total = baseAfterFloor + vectorBonus + bm25Bonus;`, add frequencyFactor:

  Replace:
  ```javascript
  let total = baseAfterFloor + vectorBonus + bm25Bonus;

  // === Reflection Decay ===
  ```
  With:
  ```javascript
  let total = baseAfterFloor + vectorBonus + bm25Bonus;

  // === Frequency Boost (mentions) ===
  const mentions = memory.mentions || 1;
  const frequencyFactor = 1 + Math.log(mentions) * 0.05;
  total *= frequencyFactor;

  // === Reflection Decay ===
  ```

- Then add `frequencyFactor` to the return object (after `hitDamping`):
  ```javascript
  return {
      total,
      base,
      baseAfterFloor,
      recencyPenalty,
      vectorBonus,
      vectorSimilarity,
      bm25Bonus,
      bm25Score,
      distance,
      importance,
      hitDamping,
      frequencyFactor,
  };
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: All new + existing tests PASS.

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat: frequency factor — mentions boost in calculateScore"`

---

## Task 3: Increment mentions on dedup match

**Goal:** When `filterSimilarEvents` catches a duplicate, increment `mentions` on the surviving memory instead of silently dropping.

**Step 1: Write the Failing Test**
- File: `tests/extraction/extract.test.js`
- Code:
  ```javascript
  describe('filterSimilarEvents — mentions increment on dedup', () => {
      it('increments mentions on existing memory during cross-batch dedup', async () => {
          const existingMemories = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.9, 0.1],
                  mentions: 1,
              },
          ];
          const newEvents = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.91, 0.11],
              },
          ];
          await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);
          expect(existingMemories[0].mentions).toBe(2);
      });

      it('increments mentions from undefined (defaults to 1, then becomes 2)', async () => {
          const existingMemories = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.9, 0.1],
                  // mentions intentionally omitted
              },
          ];
          const newEvents = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.91, 0.11],
              },
          ];
          await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);
          expect(existingMemories[0].mentions).toBe(2);
      });

      it('increments mentions on kept event during intra-batch dedup', async () => {
          const newEvents = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.9, 0.1],
              },
              {
                  summary: 'Suzy proposed daily morning training sessions with warmup drills for Vova',
                  embedding: [0.1, 0.9],
              },
          ];
          const result = await filterSimilarEvents(newEvents, [], 0.85, 0.6);
          expect(result).toHaveLength(1);
          expect(result[0].mentions).toBe(2);
      });

      it('accumulates mentions across multiple cross-batch dedup matches', async () => {
          const existingMemories = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.9, 0.1],
                  mentions: 3,
              },
          ];
          const newEvents = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.91, 0.11],
              },
          ];
          await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);
          expect(existingMemories[0].mentions).toBe(4);
      });

      it('does not change mentions when no duplicates found', async () => {
          const existingMemories = [
              {
                  summary: 'Vova went shopping for food at the market',
                  embedding: [0.1, 0.9],
                  mentions: 1,
              },
          ];
          const newEvents = [
              {
                  summary: 'Suzy proposed daily morning training sessions for Vova starting at seven',
                  embedding: [0.9, 0.1],
              },
          ];
          await filterSimilarEvents(newEvents, existingMemories, 0.85, 0.6);
          expect(existingMemories[0].mentions).toBe(1);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/extraction/extract.test.js`
- Expect: Fail — `existingMemories[0].mentions` is still `1` (or `undefined`), not `2`

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`
- Action: In `filterSimilarEvents()`:

  **Phase 1 (cross-batch)**: After the line `isDuplicate = true;`, before `break;`, add mention increment:
  ```javascript
  isDuplicate = true;
  memory.mentions = (memory.mentions || 1) + 1;
  break;
  ```

  **Phase 2 (intra-batch)**: After the line that sets `isDuplicate = true;` inside the intra-batch loop, add mention increment:
  ```javascript
  isDuplicate = true;
  keptEvent.mentions = (keptEvent.mentions || 1) + 1;
  break;
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/extraction/extract.test.js`
- Expect: All new + existing tests PASS.

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat: increment mentions counter on dedup match"`

---

## Task 4: Propagate hitDamping and frequencyFactor to debug cache

**Goal:** Add the two new breakdown fields to `cacheScoringDetails()` so they appear in debug export.

> **Note:** The design doc states these "auto-propagate" — they don't. `cacheScoringDetails()` explicitly lists each `scores` field. Both must be added.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/math.test.js`
- Code:
  ```javascript
  describe('Debug cache propagation', () => {
      it('cacheScoringDetails includes hitDamping and frequencyFactor in scores', async () => {
          const { cacheScoringDetails, getCachedScoringDetails } = await import('../../src/retrieval/debug-cache.js');
          const scoredResults = [{
              memory: { id: 'test1', summary: 'Test event' },
              score: 2.5,
              breakdown: {
                  base: 2.0, baseAfterFloor: 2.0, recencyPenalty: 0,
                  vectorSimilarity: 0.6, vectorBonus: 0.3,
                  bm25Score: 0.4, bm25Bonus: 0.2,
                  total: 2.5, distance: 50, importance: 3,
                  hitDamping: 0.67, frequencyFactor: 1.115,
              },
          }];
          cacheScoringDetails(scoredResults, ['test1']);
          const cached = getCachedScoringDetails();
          expect(cached[0].scores.hitDamping).toBeCloseTo(0.67);
          expect(cached[0].scores.frequencyFactor).toBeCloseTo(1.115);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: Fail — `cached[0].scores.hitDamping` is `undefined`

**Step 3: Implementation (Green)**
- File: `src/retrieval/debug-cache.js`
- Action: In `cacheScoringDetails()`, add two fields to the `scores` object:

  Replace:
  ```javascript
  scores: {
      base: breakdown.base,
      baseAfterFloor: breakdown.baseAfterFloor,
      recencyPenalty: breakdown.recencyPenalty,
      vectorSimilarity: breakdown.vectorSimilarity,
      vectorBonus: breakdown.vectorBonus,
      bm25Score: breakdown.bm25Score,
      bm25Bonus: breakdown.bm25Bonus,
      total: breakdown.total,
  },
  ```
  With:
  ```javascript
  scores: {
      base: breakdown.base,
      baseAfterFloor: breakdown.baseAfterFloor,
      recencyPenalty: breakdown.recencyPenalty,
      vectorSimilarity: breakdown.vectorSimilarity,
      vectorBonus: breakdown.vectorBonus,
      bm25Score: breakdown.bm25Score,
      bm25Bonus: breakdown.bm25Bonus,
      hitDamping: breakdown.hitDamping,
      frequencyFactor: breakdown.frequencyFactor,
      total: breakdown.total,
  },
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/retrieval/math.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add -A && git commit -m "feat: propagate hitDamping and frequencyFactor to debug cache"`

---

## Task 5: Update ARCHITECTURE.md

**Goal:** Document the new scoring factors and schema fields.

**Step 1: No test needed** (documentation only)

**Step 2: Implementation**
- File: `include/ARCHITECTURE.md`

- **Edit 1** — In the `## 2. DATA SCHEMA` memory object, add `mentions` field. After `archived: boolean`:
  ```
  archived: boolean, mentions?: number,  // Event frequency (incremented on dedup)
  ```

- **Edit 2** — In `## 3. CORE SYSTEMS SAUCE` → `Retrieval Math (Alpha-Blend)`, update the scoring description.

  Replace:
  ```
  **Retrieval Math (Alpha-Blend)**: `Score = Base + (Alpha * VectorBonus) + ((1 - Alpha) * BM25Bonus)`
  - *Base (Forgetfulness)*: `Importance * e^(-Lambda * Distance)`. Imp 5 has soft floor of 1.0. Reflections > 750 msgs decay linearly to 0.25x.
  ```
  With:
  ```
  **Retrieval Math (Alpha-Blend)**: `Score = (Base + (Alpha * VectorBonus) + ((1 - Alpha) * BM25Bonus)) × FrequencyFactor`
  - *Base (Forgetfulness)*: `Importance * e^(-Lambda * Distance)`. Lambda dampened by `hitDamping = max(0.5, 1/(1 + retrieval_hits × 0.1))` — frequently retrieved memories decay up to 50% slower. Imp 5 has soft floor of 1.0. Reflections > 750 msgs decay linearly to 0.25x.
  - *Frequency Factor*: `1 + ln(mentions) × 0.05`. Sublinear boost from event repetitions (dedup increments `mentions`). 10 mentions ≈ +11.5%, 50 mentions ≈ +20%.
  ```

- **Edit 3** — In `Event Dedup` section, add mention of `mentions` increment:

  After `*Phase 2 (Intra-batch)*: Jaccard token overlap >= threshold between events in the same extraction batch.`, add:
  ```
  Both phases increment `mentions` on the surviving memory/event when a duplicate is caught, enabling the Frequency Factor scoring boost.
  ```

**Step 3: Verify**
- Command: `npx vitest run`
- Expect: Full suite passes (no functional code changed).

**Step 4: Git Commit**
- Command: `git add -A && git commit -m "docs: document retrieval-reinforced scoring in ARCHITECTURE.md"`

---

## Task 6: Full regression run

**Goal:** Verify all changes work together and nothing is broken.

**Step 1: Run full test suite**
- Command: `npx vitest run`
- Expect: All tests PASS.

**Step 2: Final Git Commit (if any fixups needed)**
- Command: `git add -A && git commit -m "test: retrieval-reinforced scoring — full regression green"`
