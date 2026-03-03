# Phase 2: Extraction Pipeline Integration

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

Wire the new schema into the extraction flow so entities/relationships from LLM responses populate the graph.

---

### Task 2.1: Update Extraction Prompt to Request Entities and Relationships

**Goal:** Modify `buildExtractionPrompt` in `src/prompts.js` to instruct the LLM to also extract entities and relationships.

**Step 1: Write the Failing Test**
- File: `tests/prompts.test.js`
- Add test:
  ```javascript
  describe('buildExtractionPrompt entity/relationship instructions', () => {
      it('system prompt contains entity extraction instructions', () => {
          const result = buildExtractionPrompt({
              messages: '[Alice]: Hello',
              names: { char: 'Alice', user: 'Bob' },
              context: {},
          });
          const systemContent = result[0].content;
          expect(systemContent).toContain('entities');
          expect(systemContent).toContain('PERSON');
          expect(systemContent).toContain('PLACE');
          expect(systemContent).toContain('ORGANIZATION');
          expect(systemContent).toContain('relationships');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — system prompt does not mention entities/relationships

**Step 3: Implementation (Green)**
- File: `src/prompts.js`
- In the `systemPrompt` string of `buildExtractionPrompt`, add a new directive section after `</core_directives>`:
  ```
  <entity_extraction>
  ALONGSIDE events, extract entities and relationships from the messages.

  ENTITIES — Extract every named entity mentioned or implied:
  - name: The entity's canonical name, capitalized (e.g., "King Aldric", "The Castle").
  - type: One of PERSON, PLACE, ORGANIZATION, OBJECT, CONCEPT.
  - description: Comprehensive description based on what is known from the messages.

  RELATIONSHIPS — Extract pairs of clearly related entities:
  - source: Source entity name (must match an entity name above).
  - target: Target entity name (must match an entity name above).
  - description: Why/how they are related (e.g., "Rules from", "Loves", "Located in").

  Rules:
  - Extract entities even if no events occurred (entities help build world knowledge).
  - Include characters as PERSON entities with brief description of their role/state.
  - Places mentioned should be PLACE entities.
  - If no entities or relationships are evident, output empty arrays.
  </entity_extraction>
  ```
- Update the extraction examples to include `entities` and `relationships` fields in their output JSON. For example, the first example:
  ```
  Output:
  {"reasoning": "...", "events": [...], "entities": [{"name": "小雨", "type": "PERSON", "description": "A fighter wielding a long sword"}], "relationships": []}
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: update extraction prompt to request entities and relationships"`

---

### Task 2.2: Process Entities and Relationships in extractMemories

**Goal:** After LLM response parsing in `extractMemories`, upsert extracted entities and relationships into the graph.

**Step 1: Write the Failing Test**
- File: `tests/extraction/extract.test.js` (new file)
  ```javascript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { resetDeps, setDeps } from '../../src/deps.js';
  import { defaultSettings, extensionName } from '../../src/constants.js';

  // Mock embeddings
  vi.mock('../../src/embeddings.js', () => ({
      enrichEventsWithEmbeddings: vi.fn(async (events) => {
          events.forEach(e => { e.embedding = [0.1, 0.2]; });
      }),
      isEmbeddingsEnabled: () => true,
      getQueryEmbedding: vi.fn(async () => [0.1, 0.2]),
  }));

  // Mock LLM to return entities/relationships
  vi.mock('../../src/llm.js', () => ({
      callLLMForExtraction: vi.fn(async () => JSON.stringify({
          reasoning: null,
          events: [{ summary: 'King Aldric entered the Castle', importance: 3, characters_involved: ['King Aldric'] }],
          entities: [
              { name: 'King Aldric', type: 'PERSON', description: 'The aging ruler' },
              { name: 'Castle', type: 'PLACE', description: 'An ancient fortress' },
          ],
          relationships: [
              { source: 'King Aldric', target: 'Castle', description: 'Rules from' },
          ],
      })),
      LLM_CONFIGS: { extraction: { profileSettingKey: 'extractionProfile', maxTokens: 4000, timeoutMs: 120000 } },
  }));

  // Mock UI
  vi.mock('../../src/ui/render.js', () => ({ refreshAllUI: vi.fn() }));
  vi.mock('../../src/ui/status.js', () => ({ setStatus: vi.fn() }));

  import { extractMemories } from '../../src/extraction/extract.js';

  describe('extractMemories graph integration', () => {
      let mockContext;
      let mockData;

      beforeEach(() => {
          mockData = {
              memories: [],
              character_states: {},
              last_processed_message_id: -1,
              processed_message_ids: [],
          };

          mockContext = {
              chat: [
                  { mes: 'Hello', is_user: true, name: 'User' },
                  { mes: 'Welcome to the Castle', is_user: false, name: 'King Aldric' },
              ],
              name1: 'User',
              name2: 'King Aldric',
              characterId: 'char1',
              characters: { char1: { description: '' } },
              chatMetadata: { openvault: mockData },
              chatId: 'test-chat',
              powerUserSettings: {},
          };

          setDeps({
              getContext: () => mockContext,
              getExtensionSettings: () => ({
                  [extensionName]: { ...defaultSettings, enabled: true },
              }),
              saveChatConditional: vi.fn(async () => {}),
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
              Date: { now: () => 1000000 },
          });
      });

      afterEach(() => {
          resetDeps();
          vi.clearAllMocks();
      });

      it('populates graph.nodes from extracted entities', async () => {
          const result = await extractMemories([0, 1]);
          expect(result.status).toBe('success');
          expect(mockData.graph).toBeDefined();
          expect(mockData.graph.nodes['king aldric']).toBeDefined();
          expect(mockData.graph.nodes['king aldric'].type).toBe('PERSON');
          expect(mockData.graph.nodes['castle']).toBeDefined();
      });

      it('populates graph.edges from extracted relationships', async () => {
          await extractMemories([0, 1]);
          expect(mockData.graph.edges['king aldric__castle']).toBeDefined();
          expect(mockData.graph.edges['king aldric__castle'].description).toBe('Rules from');
      });

      it('increments graph_message_count', async () => {
          await extractMemories([0, 1]);
          expect(mockData.graph_message_count).toBeGreaterThan(0);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `extractMemories` doesn't populate graph data

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`
- Add import at top:
  ```javascript
  import { initGraphState, upsertEntity, upsertRelationship } from '../graph/graph.js';
  ```
- After the "Stage 4: Event Processing" section and before "Stage 5: Result Committing", add a new stage:
  ```javascript
  // Stage 4.5: Graph Update — upsert entities and relationships
  initGraphState(data);
  if (validated.entities) {
      for (const entity of validated.entities) {
          upsertEntity(data.graph, entity.name, entity.type, entity.description);
      }
  }
  if (validated.relationships) {
      for (const rel of validated.relationships) {
          upsertRelationship(data.graph, rel.source, rel.target, rel.description);
      }
  }
  data.graph_message_count = (data.graph_message_count || 0) + messages.length;
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: integrate graph upsert into extraction pipeline"`
