# Phase 5: Retrieval & World Context Injection

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

Inject community summaries into the prompt as world context alongside existing memory injection.

---

### Task 5.1: World Context Retrieval

**Goal:** Create `src/retrieval/world-context.js` with cosine similarity retrieval against community embeddings.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/world-context.test.js` (new file, create `tests/retrieval/` directory)
  ```javascript
  import { describe, it, expect } from 'vitest';
  import { retrieveWorldContext } from '../../src/retrieval/world-context.js';

  describe('retrieveWorldContext', () => {
      const communities = {
          C0: {
              nodeKeys: ['king', 'castle'],
              title: 'The Royal Court',
              summary: 'King Aldric rules from the Castle with his loyal Guard.',
              findings: ['The King is powerful', 'The Guard is loyal'],
              embedding: [0.9, 0.1, 0.0],
          },
          C1: {
              nodeKeys: ['tavern', 'bard'],
              title: 'The Tavern Folk',
              summary: 'The bard plays at the tavern every night.',
              findings: ['Music brings joy'],
              embedding: [0.0, 0.1, 0.9],
          },
      };

      it('returns most relevant community summaries by cosine similarity', () => {
          const queryEmbedding = [0.8, 0.2, 0.0]; // Close to C0
          const result = retrieveWorldContext(communities, queryEmbedding, 2000);
          expect(result.text).toContain('The Royal Court');
          expect(result.communityIds).toContain('C0');
      });

      it('respects token budget', () => {
          const queryEmbedding = [0.5, 0.5, 0.5];
          const result = retrieveWorldContext(communities, queryEmbedding, 10); // Very tight budget
          // Should include at most 1 community
          expect(result.communityIds.length).toBeLessThanOrEqual(1);
      });

      it('returns empty when no communities exist', () => {
          const result = retrieveWorldContext({}, [0.5, 0.5], 2000);
          expect(result.text).toBe('');
          expect(result.communityIds).toEqual([]);
      });

      it('returns empty when communities have no embeddings', () => {
          const noEmbed = { C0: { ...communities.C0, embedding: [] } };
          const result = retrieveWorldContext(noEmbed, [0.5, 0.5], 2000);
          expect(result.communityIds).toEqual([]);
      });

      it('formats output with XML tags', () => {
          const queryEmbedding = [0.9, 0.1, 0.0];
          const result = retrieveWorldContext(communities, queryEmbedding, 2000);
          expect(result.text).toContain('<world_context>');
          expect(result.text).toContain('</world_context>');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `src/retrieval/world-context.js` does not exist

**Step 3: Implementation (Green)**
- File: `src/retrieval/world-context.js`
  ```javascript
  /**
   * OpenVault World Context Retrieval
   *
   * Retrieves relevant community summaries for injection into the prompt.
   */

  import { cosineSimilarity } from './math.js';
  import { estimateTokens } from '../utils.js';

  /**
   * Retrieve the most relevant community summaries for the current context.
   * @param {Object} communities - Community data from state
   * @param {number[]} queryEmbedding - Embedding of current context
   * @param {number} tokenBudget - Max tokens for world context (default: 2000)
   * @returns {{ text: string, communityIds: string[] }}
   */
  export function retrieveWorldContext(communities, queryEmbedding, tokenBudget = 2000) {
      if (!communities || !queryEmbedding) {
          return { text: '', communityIds: [] };
      }

      // Score communities by cosine similarity
      const scored = [];
      for (const [id, community] of Object.entries(communities)) {
          if (!community.embedding || community.embedding.length === 0) continue;
          const score = cosineSimilarity(queryEmbedding, community.embedding);
          scored.push({ id, community, score });
      }

      if (scored.length === 0) {
          return { text: '', communityIds: [] };
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Select communities within token budget
      const selected = [];
      let usedTokens = 0;

      for (const { id, community } of scored) {
          const entry = formatCommunityEntry(community);
          const tokens = estimateTokens(entry);
          if (usedTokens + tokens > tokenBudget) break;
          selected.push({ id, entry });
          usedTokens += tokens;
      }

      if (selected.length === 0) {
          return { text: '', communityIds: [] };
      }

      const text = '<world_context>\n' +
          selected.map(s => s.entry).join('\n\n') +
          '\n</world_context>';

      return {
          text,
          communityIds: selected.map(s => s.id),
      };
  }

  /**
   * Format a community summary for prompt injection.
   * @param {Object} community
   * @returns {string}
   */
  function formatCommunityEntry(community) {
      const findings = community.findings
          ? community.findings.map(f => `  - ${f}`).join('\n')
          : '';
      return `## ${community.title}\n${community.summary}${findings ? '\nKey findings:\n' + findings : ''}`;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: create world context retrieval with cosine similarity ranking"`

---

### Task 5.2: Update safeSetExtensionPrompt to Support Named Slots

**Goal:** Modify `safeSetExtensionPrompt` in `src/utils.js` to accept a `name` parameter for separate injection slots.

**Step 1: Write the Failing Test**
- File: `tests/utils.test.js`
  ```javascript
  describe('safeSetExtensionPrompt with name parameter', () => {
      it('passes custom name to setExtensionPrompt', () => {
          const mockSetPrompt = vi.fn();
          setDeps({
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
              getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
              setExtensionPrompt: mockSetPrompt,
              extension_prompt_types: { IN_PROMPT: 0 },
          });

          safeSetExtensionPrompt('test content', 'openvault_world');
          expect(mockSetPrompt).toHaveBeenCalledWith('openvault_world', 'test content', 0, 0);
      });

      it('defaults to extensionName when no name provided', () => {
          const mockSetPrompt = vi.fn();
          setDeps({
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
              getExtensionSettings: () => ({ [extensionName]: { debugMode: false } }),
              setExtensionPrompt: mockSetPrompt,
              extension_prompt_types: { IN_PROMPT: 0 },
          });

          safeSetExtensionPrompt('test content');
          expect(mockSetPrompt).toHaveBeenCalledWith('openvault', 'test content', 0, 0);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `safeSetExtensionPrompt` doesn't accept a name parameter

**Step 3: Implementation (Green)**
- File: `src/utils.js`
- Modify `safeSetExtensionPrompt`:
  ```javascript
  /**
   * Safe wrapper for setExtensionPrompt with error handling
   * @param {string} content - Content to inject
   * @param {string} [name] - Named slot (defaults to extensionName for backwards compatibility)
   * @returns {boolean} True if successful
   */
  export function safeSetExtensionPrompt(content, name = extensionName) {
      try {
          const deps = getDeps();
          deps.setExtensionPrompt(name, content, deps.extension_prompt_types.IN_PROMPT, 0);
          return true;
      } catch (error) {
          getDeps().console.error('[OpenVault] Failed to set extension prompt:', error);
          return false;
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add named slot support to safeSetExtensionPrompt"`

---

### Task 5.3: Inject World Context in Retrieval Pipeline

**Goal:** After memory retrieval in `updateInjection` and `retrieveAndInjectContext`, also retrieve and inject world context via the `openvault_world` slot.

**Step 1: Write the Failing Test**
- File: `tests/retrieval/retrieve.test.js` (new file)
  ```javascript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { resetDeps, setDeps } from '../../src/deps.js';
  import { defaultSettings, extensionName } from '../../src/constants.js';

  // Mock embeddings
  vi.mock('../../src/embeddings.js', () => ({
      getQueryEmbedding: vi.fn(async () => [0.5, 0.5]),
      isEmbeddingsEnabled: () => true,
  }));

  // Mock embeddings strategies
  vi.mock('../../src/embeddings/strategies.js', () => ({
      getOptimalChunkSize: () => 500,
  }));

  // Mock scoring
  vi.mock('../../src/retrieval/scoring.js', () => ({
      selectRelevantMemories: vi.fn(async (memories) => memories.slice(0, 2)),
      getScoringParams: vi.fn(),
  }));

  // Mock formatting
  vi.mock('../../src/retrieval/formatting.js', () => ({
      formatContextForInjection: vi.fn(() => 'formatted memories'),
  }));

  // Mock world context
  vi.mock('../../src/retrieval/world-context.js', () => ({
      retrieveWorldContext: vi.fn(() => ({
          text: '<world_context>Royal Court Summary</world_context>',
          communityIds: ['C0'],
      })),
  }));

  import { updateInjection } from '../../src/retrieval/retrieve.js';
  import { retrieveWorldContext } from '../../src/retrieval/world-context.js';

  describe('updateInjection world context', () => {
      let mockSetPrompt;

      beforeEach(() => {
          mockSetPrompt = vi.fn();

          setDeps({
              getContext: () => ({
                  chat: [
                      { mes: 'Hello', is_user: true, is_system: true },
                      { mes: 'Hi', is_user: false, is_system: false },
                  ],
                  name1: 'User',
                  name2: 'Alice',
                  chatMetadata: {
                      openvault: {
                          memories: [
                              {
                                  id: 'ev1',
                                  summary: 'Test memory',
                                  importance: 3,
                                  message_ids: [0],
                                  characters_involved: ['Alice'],
                                  witnesses: ['Alice'],
                                  embedding: [0.5, 0.5],
                              },
                          ],
                          character_states: { Alice: { name: 'Alice', known_events: ['ev1'] } },
                          communities: {
                              C0: {
                                  title: 'Test Community',
                                  summary: 'A summary',
                                  findings: ['Finding'],
                                  embedding: [0.5, 0.5],
                                  nodeKeys: ['alice'],
                              },
                          },
                      },
                  },
                  chatId: 'test',
              }),
              getExtensionSettings: () => ({
                  [extensionName]: { ...defaultSettings, enabled: true },
              }),
              setExtensionPrompt: mockSetPrompt,
              extension_prompt_types: { IN_PROMPT: 0 },
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
          });
      });

      afterEach(() => {
          resetDeps();
          vi.clearAllMocks();
      });

      it('calls retrieveWorldContext when communities exist', async () => {
          await updateInjection();
          expect(retrieveWorldContext).toHaveBeenCalled();
      });

      it('injects world context via openvault_world named slot', async () => {
          await updateInjection();
          const worldCall = mockSetPrompt.mock.calls.find(c => c[0] === 'openvault_world');
          expect(worldCall).toBeDefined();
          expect(worldCall[1]).toContain('world_context');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `updateInjection` doesn't call `retrieveWorldContext`

**Step 3: Implementation (Green)**
- File: `src/retrieval/retrieve.js`
- Add imports:
  ```javascript
  import { getQueryEmbedding, isEmbeddingsEnabled } from '../embeddings.js';
  import { retrieveWorldContext } from './world-context.js';
  ```
- In the `selectFormatAndInject` function, after the memory injection call, add world context injection:
  ```javascript
  // After: injectContext(formattedContext);
  // Add world context injection
  const worldCommunities = data.communities;
  if (worldCommunities && Object.keys(worldCommunities).length > 0) {
      let worldQueryEmbedding = null;
      if (isEmbeddingsEnabled()) {
          worldQueryEmbedding = await getQueryEmbedding(ctx.userMessages || ctx.recentContext?.slice(-500));
      }
      if (worldQueryEmbedding) {
          const worldResult = retrieveWorldContext(worldCommunities, worldQueryEmbedding, 2000);
          safeSetExtensionPrompt(worldResult.text, 'openvault_world');
      } else {
          safeSetExtensionPrompt('', 'openvault_world');
      }
  } else {
      safeSetExtensionPrompt('', 'openvault_world');
  }
  ```
- Also clear the world context slot in `injectContext` when clearing, and in `updateInjection` when early-returning:
  ```javascript
  // At the top of updateInjection, after each early return with safeSetExtensionPrompt(''):
  safeSetExtensionPrompt('', 'openvault_world');
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: inject world context from community summaries via openvault_world slot"`

---

### Task 5.4: Final Integration Verification

**Goal:** Confirm all tests pass and the full pipeline is wired correctly.

**Step 1: Run Full Test Suite**
- Command: `npm test`
- Expect: All tests pass.

**Step 2: Grep Verification — No Dead Smart Retrieval Code**
- Run: `grep -r "smartRetrieval\|callLLMForRetrieval\|selectRelevantMemoriesSmart\|RetrievalResponseSchema\|buildSmartRetrievalPrompt" src/`
- Expect: No matches.

**Step 3: Grep Verification — New Features Wired**
- Run: `grep -r "upsertEntity\|upsertRelationship\|generateReflections\|detectCommunities\|retrieveWorldContext" src/extraction/extract.js src/retrieval/retrieve.js`
- Expect: Imports and calls present in both files.

**Step 4: Git Commit**
- Command: `git add . && git commit -m "feat(phase-5): complete Reflections & GraphRAG integration"`
