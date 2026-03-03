# Phase 3: Reflection Engine

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

Build the per-character reflection system that synthesizes raw events into high-level insights.

---

### Task 3.1: Reflection Schemas and LLM Config

**Goal:** Add `SalientQuestionsSchema`, `InsightExtractionSchema` to `src/extraction/structured.js` and `LLM_CONFIGS.reflection` to `src/llm.js`.

**Step 1: Write the Failing Test**
- File: `tests/extraction/structured.test.js`
  ```javascript
  import {
      parseSalientQuestionsResponse,
      parseInsightExtractionResponse,
  } from '../../src/extraction/structured.js';

  describe('Reflection Schemas', () => {
      it('parses salient questions response with exactly 3 questions', () => {
          const json = JSON.stringify({
              questions: ['Why is the king paranoid?', 'Who does he trust?', 'What changed?'],
          });
          const result = parseSalientQuestionsResponse(json);
          expect(result.questions).toHaveLength(3);
      });

      it('rejects salient questions with wrong count', () => {
          const json = JSON.stringify({ questions: ['Only one'] });
          expect(() => parseSalientQuestionsResponse(json)).toThrow();
      });

      it('parses insight extraction response', () => {
          const json = JSON.stringify({
              insights: [
                  { insight: 'The king fears betrayal', evidence_ids: ['ev_001', 'ev_002'] },
              ],
          });
          const result = parseInsightExtractionResponse(json);
          expect(result.insights).toHaveLength(1);
          expect(result.insights[0].insight).toBe('The king fears betrayal');
          expect(result.insights[0].evidence_ids).toContain('ev_001');
      });
  });
  ```
- File: `tests/llm.test.js`
  ```javascript
  it('has reflection config', () => {
      expect(LLM_CONFIGS.reflection).toBeDefined();
      expect(LLM_CONFIGS.reflection.profileSettingKey).toBe('extractionProfile');
      expect(LLM_CONFIGS.reflection.maxTokens).toBe(2000);
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — functions and configs don't exist

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
- Add schemas and parse functions:
  ```javascript
  export const SalientQuestionsSchema = z.object({
      questions: z.array(z.string()).length(3),
  });

  export const InsightExtractionSchema = z.object({
      insights: z.array(z.object({
          insight: z.string().min(1),
          evidence_ids: z.array(z.string()),
      })).min(1).max(5),
  });

  export function getSalientQuestionsJsonSchema() {
      return toJsonSchema(SalientQuestionsSchema, 'SalientQuestions');
  }

  export function getInsightExtractionJsonSchema() {
      return toJsonSchema(InsightExtractionSchema, 'InsightExtraction');
  }

  export function parseSalientQuestionsResponse(content) {
      return parseStructuredResponse(content, SalientQuestionsSchema);
  }

  export function parseInsightExtractionResponse(content) {
      return parseStructuredResponse(content, InsightExtractionSchema);
  }
  ```

- File: `src/llm.js`
- Add import:
  ```javascript
  import { getSalientQuestionsJsonSchema, getInsightExtractionJsonSchema } from './extraction/structured.js';
  ```
- Add to `LLM_CONFIGS`:
  ```javascript
  reflection_questions: {
      profileSettingKey: 'extractionProfile',
      maxTokens: 2000,
      errorContext: 'Reflection (questions)',
      timeoutMs: 90000,
      getJsonSchema: getSalientQuestionsJsonSchema,
  },
  reflection_insights: {
      profileSettingKey: 'extractionProfile',
      maxTokens: 2000,
      errorContext: 'Reflection (insights)',
      timeoutMs: 90000,
      getJsonSchema: getInsightExtractionJsonSchema,
  },
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add reflection schemas and LLM configs"`

---

### Task 3.2: Reflection Triggers — accumulateImportance and shouldReflect

**Goal:** Create `src/reflection/reflect.js` with importance accumulation and threshold checking.

**Step 1: Write the Failing Test**
- File: `tests/reflection/reflect.test.js` (new file, create `tests/reflection/` directory)
  ```javascript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { accumulateImportance, shouldReflect } from '../../src/reflection/reflect.js';

  describe('accumulateImportance', () => {
      let reflectionState;

      beforeEach(() => {
          reflectionState = {};
      });

      it('accumulates importance from event characters_involved', () => {
          const events = [
              { importance: 4, characters_involved: ['Alice', 'Bob'], witnesses: [] },
              { importance: 2, characters_involved: ['Alice'], witnesses: [] },
          ];
          accumulateImportance(reflectionState, events);
          expect(reflectionState['Alice'].importance_sum).toBe(6);
          expect(reflectionState['Bob'].importance_sum).toBe(4);
      });

      it('accumulates importance from witnesses too', () => {
          const events = [
              { importance: 3, characters_involved: ['Alice'], witnesses: ['Charlie'] },
          ];
          accumulateImportance(reflectionState, events);
          expect(reflectionState['Charlie'].importance_sum).toBe(3);
      });

      it('adds to existing importance_sum', () => {
          reflectionState['Alice'] = { importance_sum: 10 };
          const events = [
              { importance: 5, characters_involved: ['Alice'], witnesses: [] },
          ];
          accumulateImportance(reflectionState, events);
          expect(reflectionState['Alice'].importance_sum).toBe(15);
      });
  });

  describe('shouldReflect', () => {
      it('returns true when importance_sum >= 30', () => {
          const state = { 'Alice': { importance_sum: 30 } };
          expect(shouldReflect(state, 'Alice')).toBe(true);
      });

      it('returns true when importance_sum > 30', () => {
          const state = { 'Alice': { importance_sum: 45 } };
          expect(shouldReflect(state, 'Alice')).toBe(true);
      });

      it('returns false when importance_sum < 30', () => {
          const state = { 'Alice': { importance_sum: 29 } };
          expect(shouldReflect(state, 'Alice')).toBe(false);
      });

      it('returns false when character not in state', () => {
          expect(shouldReflect({}, 'Unknown')).toBe(false);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `src/reflection/reflect.js` does not exist

**Step 3: Implementation (Green)**
- Create directory: `src/reflection/`
- File: `src/reflection/reflect.js`
  ```javascript
  /**
   * OpenVault Reflection Engine
   *
   * Per-character reflection system inspired by the Smallville paper.
   * Synthesizes raw events into high-level insights.
   */

  const REFLECTION_THRESHOLD = 30;

  /**
   * Check if a character has accumulated enough importance to trigger reflection.
   * @param {Object} reflectionState - Per-character accumulators
   * @param {string} characterName
   * @returns {boolean}
   */
  export function shouldReflect(reflectionState, characterName) {
      const charState = reflectionState[characterName];
      if (!charState) return false;
      return charState.importance_sum >= REFLECTION_THRESHOLD;
  }

  /**
   * Accumulate importance scores from newly extracted events for each involved character.
   * Includes both characters_involved and witnesses.
   * @param {Object} reflectionState - Mutated in place
   * @param {Array} newEvents - Newly extracted event memories
   */
  export function accumulateImportance(reflectionState, newEvents) {
      for (const event of newEvents) {
          const importance = event.importance || 3;
          const allCharacters = new Set([
              ...(event.characters_involved || []),
              ...(event.witnesses || []),
          ]);

          for (const charName of allCharacters) {
              if (!reflectionState[charName]) {
                  reflectionState[charName] = { importance_sum: 0 };
              }
              reflectionState[charName].importance_sum += importance;
          }
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add reflection trigger functions — accumulateImportance, shouldReflect"`

---

### Task 3.3: Reflection Prompts

**Goal:** Add `buildSalientQuestionsPrompt` and `buildInsightExtractionPrompt` to `src/prompts.js`.

**Step 1: Write the Failing Test**
- File: `tests/prompts.test.js`
  ```javascript
  import { buildSalientQuestionsPrompt, buildInsightExtractionPrompt } from '../src/prompts.js';

  describe('buildSalientQuestionsPrompt', () => {
      it('returns system/user message pair with character name', () => {
          const memories = [
              { summary: 'Alice met Bob', importance: 3 },
              { summary: 'Alice fought the dragon', importance: 5 },
          ];
          const result = buildSalientQuestionsPrompt('Alice', memories);
          expect(result).toHaveLength(2);
          expect(result[0].role).toBe('system');
          expect(result[1].role).toBe('user');
          expect(result[1].content).toContain('Alice');
          expect(result[1].content).toContain('Alice met Bob');
      });
  });

  describe('buildInsightExtractionPrompt', () => {
      it('returns system/user message pair with question and evidence', () => {
          const memories = [
              { id: 'ev_001', summary: 'Alice fought the dragon' },
              { id: 'ev_002', summary: 'Alice was wounded' },
          ];
          const result = buildInsightExtractionPrompt('Alice', 'How has Alice changed?', memories);
          expect(result).toHaveLength(2);
          expect(result[0].role).toBe('system');
          expect(result[1].content).toContain('How has Alice changed?');
          expect(result[1].content).toContain('ev_001');
          expect(result[1].content).toContain('Alice fought the dragon');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — functions not exported

**Step 3: Implementation (Green)**
- File: `src/prompts.js`
- Add after the extraction prompt:
  ```javascript
  /**
   * Build the salient questions prompt for reflection step 1.
   * @param {string} characterName
   * @param {Object[]} recentMemories - Recent memories (both events and reflections)
   * @returns {Array<{role: string, content: string}>}
   */
  export function buildSalientQuestionsPrompt(characterName, recentMemories) {
      const memoryList = recentMemories
          .map((m, i) => `${i + 1}. [${m.importance || 3} Star] ${m.summary}`)
          .join('\n');

      const systemPrompt = `You are analyzing the memory stream of a character in an ongoing narrative.
  Your task: given the character's recent memories, generate exactly 3 high-level questions that capture the most salient themes about their current psychological state, evolving relationships, or shifting goals.

  Rules:
  - Questions should be answerable from the memory stream.
  - Focus on patterns, changes, and emotional arcs — not individual events.
  - Output exactly 3 questions as a JSON array.`;

      const userPrompt = `<character>${characterName}</character>

  <recent_memories>
  ${memoryList}
  </recent_memories>

  What are the 3 most salient high-level questions we can answer about ${characterName}'s current state based on these memories?
  Respond strictly in the required JSON format.`;

      return [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
      ];
  }

  /**
   * Build the insight extraction prompt for reflection step 2.
   * @param {string} characterName
   * @param {string} question - The salient question to answer
   * @param {Object[]} relevantMemories - Memories relevant to this question
   * @returns {Array<{role: string, content: string}>}
   */
  export function buildInsightExtractionPrompt(characterName, question, relevantMemories) {
      const memoryList = relevantMemories
          .map((m) => `${m.id}. ${m.summary}`)
          .join('\n');

      const systemPrompt = `You are synthesizing memories into high-level insights for a character in an ongoing narrative.
  Your task: given a question and relevant memories, extract 1-5 insights that answer the question.

  Rules:
  - Each insight must be a concise, high-level statement (not a restatement of a single memory).
  - Each insight must cite the specific memory IDs that serve as evidence.
  - Insights should reveal patterns, emotional arcs, or relationship dynamics.
  - Output as a JSON object with an "insights" array.`;

      const userPrompt = `<character>${characterName}</character>

  <question>${question}</question>

  <memories>
  ${memoryList}
  </memories>

  Based on these memories about ${characterName}, what insights answer the question above?
  Respond strictly in the required JSON format.`;

      return [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
      ];
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add reflection prompts — salient questions and insight extraction"`

---

### Task 3.4: generateReflections — The 3-Step Pipeline

**Goal:** Implement the core `generateReflections` function in `src/reflection/reflect.js` that runs the 3-step Smallville reflection pipeline.

**Step 1: Write the Failing Test**
- File: `tests/reflection/reflect.test.js`
  ```javascript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { resetDeps, setDeps } from '../../src/deps.js';
  import { defaultSettings, extensionName } from '../../src/constants.js';

  // Mock embeddings
  vi.mock('../../src/embeddings.js', () => ({
      getQueryEmbedding: vi.fn(async () => [0.5, 0.5]),
      enrichEventsWithEmbeddings: vi.fn(async (events) => {
          events.forEach(e => { e.embedding = [0.5, 0.5]; });
      }),
      isEmbeddingsEnabled: () => true,
  }));

  // Mock LLM — will be configured per test
  const mockCallLLM = vi.fn();
  vi.mock('../../src/llm.js', () => ({
      callLLM: (...args) => mockCallLLM(...args),
      LLM_CONFIGS: {
          reflection_questions: { profileSettingKey: 'extractionProfile' },
          reflection_insights: { profileSettingKey: 'extractionProfile' },
      },
  }));

  import { generateReflections } from '../../src/reflection/reflect.js';

  describe('generateReflections', () => {
      const characterName = 'Alice';
      const allMemories = [
          { id: 'ev_001', summary: 'Alice met Bob at the tavern', importance: 3, characters_involved: ['Alice', 'Bob'], witnesses: ['Alice'], embedding: [0.1, 0.9], type: 'event' },
          { id: 'ev_002', summary: 'Alice fought the dragon', importance: 5, characters_involved: ['Alice'], witnesses: ['Alice'], embedding: [0.9, 0.1], type: 'event' },
          { id: 'ev_003', summary: 'Alice learned a spell', importance: 4, characters_involved: ['Alice'], witnesses: ['Alice'], embedding: [0.5, 0.5], type: 'event' },
      ];
      const characterStates = {
          Alice: { name: 'Alice', known_events: ['ev_001', 'ev_002', 'ev_003'] },
      };

      beforeEach(() => {
          setDeps({
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
              getExtensionSettings: () => ({
                  [extensionName]: { ...defaultSettings },
              }),
              Date: { now: () => 2000000 },
          });

          // Step 1: Return 3 salient questions
          // Steps 2a, 2b, 2c: Return insights for each question
          mockCallLLM.mockReset();
          mockCallLLM
              .mockResolvedValueOnce(JSON.stringify({
                  questions: [
                      'How has Alice grown as a fighter?',
                      'What is Alice\'s relationship with Bob?',
                      'What drives Alice?',
                  ],
              }))
              .mockResolvedValueOnce(JSON.stringify({
                  insights: [{ insight: 'Alice is becoming a seasoned warrior', evidence_ids: ['ev_002'] }],
              }))
              .mockResolvedValueOnce(JSON.stringify({
                  insights: [{ insight: 'Alice values her friendship with Bob', evidence_ids: ['ev_001'] }],
              }))
              .mockResolvedValueOnce(JSON.stringify({
                  insights: [{ insight: 'Alice is driven by curiosity', evidence_ids: ['ev_003'] }],
              }));
      });

      afterEach(() => {
          resetDeps();
          vi.clearAllMocks();
      });

      it('returns reflection memory objects', async () => {
          const reflections = await generateReflections(characterName, allMemories, characterStates);
          expect(reflections.length).toBeGreaterThan(0);
          expect(reflections[0].type).toBe('reflection');
          expect(reflections[0].character).toBe('Alice');
          expect(reflections[0].source_ids).toBeDefined();
          expect(reflections[0].summary).toBeDefined();
          expect(reflections[0].embedding).toBeDefined();
      });

      it('makes 4 LLM calls total (1 questions + 3 insights in parallel)', async () => {
          await generateReflections(characterName, allMemories, characterStates);
          expect(mockCallLLM).toHaveBeenCalledTimes(4);
      });

      it('assigns importance 4 to reflections by default', async () => {
          const reflections = await generateReflections(characterName, allMemories, characterStates);
          for (const r of reflections) {
              expect(r.importance).toBe(4);
          }
      });

      it('sets character as sole witness', async () => {
          const reflections = await generateReflections(characterName, allMemories, characterStates);
          for (const r of reflections) {
              expect(r.witnesses).toEqual(['Alice']);
          }
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `generateReflections` not exported

**Step 3: Implementation (Green)**
- File: `src/reflection/reflect.js`
- Add imports and the function:
  ```javascript
  import { getDeps } from '../deps.js';
  import { enrichEventsWithEmbeddings, getQueryEmbedding, isEmbeddingsEnabled } from '../embeddings.js';
  import { callLLM, LLM_CONFIGS } from '../llm.js';
  import { filterMemoriesByPOV } from '../pov.js';
  import { buildSalientQuestionsPrompt, buildInsightExtractionPrompt } from '../prompts.js';
  import { parseSalientQuestionsResponse, parseInsightExtractionResponse } from '../extraction/structured.js';
  import { cosineSimilarity } from '../retrieval/math.js';
  import { log, sortMemoriesBySequence, generateId } from '../utils.js';

  /**
   * Run the 3-step reflection pipeline for a single character.
   *
   * Step 1: Generate 3 salient questions from recent memories
   * Step 2: For each question, retrieve relevant memories and extract insights (3 calls via Promise.all)
   * Step 3: Store reflections as memory objects with embeddings
   *
   * @param {string} characterName
   * @param {Array} allMemories - Full memory stream
   * @param {Object} characterStates - For POV filtering
   * @returns {Promise<Array>} New reflection memory objects
   */
  export async function generateReflections(characterName, allMemories, characterStates) {
      const deps = getDeps();

      // Filter memories to what this character knows
      const data = { character_states: characterStates };
      const accessibleMemories = filterMemoriesByPOV(allMemories, [characterName], data);
      const recentMemories = sortMemoriesBySequence(accessibleMemories, false).slice(0, 100);

      if (recentMemories.length < 3) {
          log(`Reflection: ${characterName} has too few accessible memories (${recentMemories.length}), skipping`);
          return [];
      }

      // Step 1: Generate salient questions
      const questionsPrompt = buildSalientQuestionsPrompt(characterName, recentMemories);
      const questionsResponse = await callLLM(questionsPrompt, LLM_CONFIGS.reflection_questions, { structured: true });
      const { questions } = parseSalientQuestionsResponse(questionsResponse);

      log(`Reflection: Generated ${questions.length} salient questions for ${characterName}`);

      // Step 2: For each question, retrieve relevant memories and extract insights (in parallel)
      const insightPromises = questions.map(async (question) => {
          // Retrieve memories relevant to this question via embedding similarity
          let relevantMemories = accessibleMemories;
          if (isEmbeddingsEnabled()) {
              const queryEmb = await getQueryEmbedding(question);
              if (queryEmb) {
                  const scored = accessibleMemories
                      .filter(m => m.embedding)
                      .map(m => ({ memory: m, score: cosineSimilarity(queryEmb, m.embedding) }))
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 20);
                  relevantMemories = scored.map(s => s.memory);
              }
          } else {
              relevantMemories = recentMemories.slice(0, 20);
          }

          const insightPrompt = buildInsightExtractionPrompt(characterName, question, relevantMemories);
          const insightResponse = await callLLM(insightPrompt, LLM_CONFIGS.reflection_insights, { structured: true });
          return parseInsightExtractionResponse(insightResponse);
      });

      const insightResults = await Promise.all(insightPromises);

      // Step 3: Convert insights into reflection memory objects
      const reflections = [];
      const now = deps.Date.now();

      for (const result of insightResults) {
          for (const { insight, evidence_ids } of result.insights) {
              reflections.push({
                  id: `ref_${generateId()}`,
                  type: 'reflection',
                  summary: insight,
                  importance: 4,
                  sequence: now,
                  characters_involved: [characterName],
                  character: characterName,
                  source_ids: evidence_ids,
                  witnesses: [characterName],
                  location: null,
                  is_secret: false,
                  emotional_impact: {},
                  relationship_impact: {},
                  created_at: now,
              });
          }
      }

      // Generate embeddings for reflections
      await enrichEventsWithEmbeddings(reflections);

      log(`Reflection: Generated ${reflections.length} reflections for ${characterName}`);
      return reflections;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: implement generateReflections 3-step pipeline"`

---

### Task 3.5: Hook Reflection Trigger into Extraction Pipeline

**Goal:** After graph update in `extractMemories`, check reflection triggers and generate reflections for qualifying characters.

**Step 1: Write the Failing Test**
- File: `tests/extraction/extract.test.js`
- Add to the existing describe block (extend the mocks to include reflection):
  ```javascript
  // Add mock for reflection module
  vi.mock('../../src/reflection/reflect.js', () => ({
      accumulateImportance: vi.fn(),
      shouldReflect: vi.fn(() => false),
      generateReflections: vi.fn(async () => []),
  }));

  import { accumulateImportance, shouldReflect, generateReflections } from '../../src/reflection/reflect.js';

  describe('extractMemories reflection integration', () => {
      it('calls accumulateImportance after extraction', async () => {
          await extractMemories([0, 1]);
          expect(accumulateImportance).toHaveBeenCalled();
      });

      it('calls generateReflections when shouldReflect returns true', async () => {
          shouldReflect.mockReturnValue(true);
          generateReflections.mockResolvedValue([
              { id: 'ref_1', type: 'reflection', summary: 'Test reflection', importance: 4, character: 'King Aldric' },
          ]);

          await extractMemories([0, 1]);

          expect(generateReflections).toHaveBeenCalled();
      });

      it('resets importance accumulator after generating reflections', async () => {
          shouldReflect.mockReturnValue(true);
          generateReflections.mockResolvedValue([]);

          await extractMemories([0, 1]);

          // Verify the reflection_state for the character was reset
          const charState = mockData.reflection_state?.['King Aldric'];
          expect(charState?.importance_sum).toBe(0);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — reflection functions not called in extract.js

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`
- Add import:
  ```javascript
  import { accumulateImportance, shouldReflect, generateReflections } from '../reflection/reflect.js';
  ```
- After the graph update stage (Stage 4.5), add Stage 4.6 — Reflection check:
  ```javascript
  // Stage 4.6: Reflection check (per character in new events)
  if (events.length > 0) {
      initGraphState(data); // Ensures reflection_state exists
      accumulateImportance(data.reflection_state, events);

      // Collect unique characters from new events
      const characters = new Set();
      for (const event of events) {
          for (const c of event.characters_involved || []) characters.add(c);
          for (const w of event.witnesses || []) characters.add(w);
      }

      // Check each character for reflection trigger
      for (const characterName of characters) {
          if (shouldReflect(data.reflection_state, characterName)) {
              try {
                  const reflections = await generateReflections(
                      characterName,
                      data[MEMORIES_KEY] || [],
                      data[CHARACTERS_KEY] || {}
                  );
                  if (reflections.length > 0) {
                      data[MEMORIES_KEY].push(...reflections);
                  }
                  // Reset accumulator after reflection
                  data.reflection_state[characterName].importance_sum = 0;
              } catch (error) {
                  getDeps().console.error(`[OpenVault] Reflection error for ${characterName}:`, error);
              }
          }
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: hook reflection trigger into extraction pipeline"`
