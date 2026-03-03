# Implementation Plan - Reflections & GraphRAG Integration

> **Reference:** `docs/designs/2026-03-03-reflections-graphrag-design.md`
> **Execution:** Use `executing-plans` skill.

---

## Phase 0: Prune Obsolete "Smart Retrieval"

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

---

## Phase 1: Schema & Graph CRUD

Build the flat-JSON graph data structures and CRUD operations. No LLM calls or extraction changes yet.

---

### Task 1.1: Add EntitySchema and RelationshipSchema to Structured Output

**Goal:** Extend `ExtractionResponseSchema` with `entities[]` and `relationships[]` fields.

**Step 1: Write the Failing Test**
- File: `tests/extraction/structured.test.js`
- Add tests:
  ```javascript
  describe('Extended ExtractionResponseSchema', () => {
      it('parses response with entities and relationships', () => {
          const json = JSON.stringify({
              reasoning: null,
              events: [],
              entities: [
                  { name: 'Castle', type: 'PLACE', description: 'An ancient fortress' }
              ],
              relationships: [
                  { source: 'King Aldric', target: 'Castle', description: 'Rules from the castle' }
              ],
          });
          const result = parseExtractionResponse(json);
          expect(result.entities).toHaveLength(1);
          expect(result.entities[0].name).toBe('Castle');
          expect(result.entities[0].type).toBe('PLACE');
          expect(result.relationships).toHaveLength(1);
          expect(result.relationships[0].source).toBe('King Aldric');
      });

      it('defaults entities and relationships to empty arrays', () => {
          const json = JSON.stringify({
              reasoning: null,
              events: [],
          });
          const result = parseExtractionResponse(json);
          expect(result.entities).toEqual([]);
          expect(result.relationships).toEqual([]);
      });

      it('validates entity type enum', () => {
          const json = JSON.stringify({
              reasoning: null,
              events: [],
              entities: [
                  { name: 'Blob', type: 'INVALID_TYPE', description: 'Something' }
              ],
              relationships: [],
          });
          expect(() => parseExtractionResponse(json)).toThrow();
      });

      it('includes entities and relationships in JSON schema output', () => {
          const schema = getExtractionJsonSchema();
          const props = schema.value.properties;
          expect(props).toHaveProperty('entities');
          expect(props).toHaveProperty('relationships');
          expect(props.entities.type).toBe('array');
          expect(props.relationships.type).toBe('array');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `entities` and `relationships` not in schema

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
- Action: Add schemas before `ExtractionResponseSchema`:
  ```javascript
  export const EntitySchema = z.object({
      name: z.string().min(1, 'Entity name is required').describe('Entity name, capitalized'),
      type: z.enum(['PERSON', 'PLACE', 'ORGANIZATION', 'OBJECT', 'CONCEPT']),
      description: z.string().min(1).describe('Comprehensive description of the entity'),
  });

  export const RelationshipSchema = z.object({
      source: z.string().min(1).describe('Source entity name'),
      target: z.string().min(1).describe('Target entity name'),
      description: z.string().min(1).describe('Description of the relationship'),
  });
  ```
- Modify `ExtractionResponseSchema` to include both:
  ```javascript
  export const ExtractionResponseSchema = z.object({
      reasoning: z.string().nullable().default(null),
      events: z.array(EventSchema),
      entities: z.array(EntitySchema).default([]),
      relationships: z.array(RelationshipSchema).default([]),
  });
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add EntitySchema and RelationshipSchema to extraction output"`

---

### Task 1.2: Create Graph CRUD Module — upsertEntity

**Goal:** Create `src/graph/graph.js` with `upsertEntity` that stores entities in a flat `{ nodes, edges }` structure.

**Step 1: Write the Failing Test**
- File: `tests/graph/graph.test.js` (new file, create `tests/graph/` directory)
  ```javascript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { upsertEntity } from '../../src/graph/graph.js';

  describe('upsertEntity', () => {
      let graphData;

      beforeEach(() => {
          graphData = { nodes: {}, edges: {} };
      });

      it('adds a new entity node', () => {
          upsertEntity(graphData, 'King Aldric', 'PERSON', 'The aging ruler');
          const key = 'king aldric';
          expect(graphData.nodes[key]).toBeDefined();
          expect(graphData.nodes[key].name).toBe('King Aldric');
          expect(graphData.nodes[key].type).toBe('PERSON');
          expect(graphData.nodes[key].description).toBe('The aging ruler');
          expect(graphData.nodes[key].mentions).toBe(1);
      });

      it('normalizes key to lowercase trimmed', () => {
          upsertEntity(graphData, '  Castle  ', 'PLACE', 'A fortress');
          expect(graphData.nodes['castle']).toBeDefined();
          expect(graphData.nodes['castle'].name).toBe('Castle');
      });

      it('merges descriptions on duplicate by appending with pipe', () => {
          upsertEntity(graphData, 'Castle', 'PLACE', 'An ancient fortress');
          upsertEntity(graphData, 'castle', 'PLACE', 'Seat of power');
          expect(graphData.nodes['castle'].description).toBe('An ancient fortress | Seat of power');
          expect(graphData.nodes['castle'].mentions).toBe(2);
      });

      it('preserves original name casing from first insertion', () => {
          upsertEntity(graphData, 'King Aldric', 'PERSON', 'First');
          upsertEntity(graphData, 'king aldric', 'PERSON', 'Second');
          expect(graphData.nodes['king aldric'].name).toBe('King Aldric');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `src/graph/graph.js` does not exist

**Step 3: Implementation (Green)**
- Create directory: `src/graph/`
- File: `src/graph/graph.js`
  ```javascript
  /**
   * OpenVault Graph Module
   *
   * Flat-JSON graph CRUD for entity and relationship storage.
   * All data stored in chatMetadata.openvault.graph as { nodes, edges }.
   */

  /**
   * Normalize an entity name to a consistent key.
   * @param {string} name
   * @returns {string}
   */
  function normalizeKey(name) {
      return name.toLowerCase().trim();
  }

  /**
   * Upsert an entity node into the flat graph structure.
   * Merges descriptions and increments mentions on duplicates.
   * @param {Object} graphData - The graph object { nodes, edges } (mutated in place)
   * @param {string} name - Entity name (original casing preserved on first insert)
   * @param {string} type - PERSON | PLACE | ORGANIZATION | OBJECT | CONCEPT
   * @param {string} description - Entity description
   */
  export function upsertEntity(graphData, name, type, description) {
      const key = normalizeKey(name);
      const existing = graphData.nodes[key];

      if (existing) {
          existing.description = existing.description + ' | ' + description;
          existing.mentions += 1;
      } else {
          graphData.nodes[key] = {
              name: name.trim(),
              type,
              description,
              mentions: 1,
          };
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: create graph module with upsertEntity"`

---

### Task 1.3: Graph CRUD — upsertRelationship

**Goal:** Add `upsertRelationship` to `src/graph/graph.js` that creates/updates edges with weight and description merging.

**Step 1: Write the Failing Test**
- File: `tests/graph/graph.test.js`
- Add tests:
  ```javascript
  import { upsertEntity, upsertRelationship } from '../../src/graph/graph.js';

  describe('upsertRelationship', () => {
      let graphData;

      beforeEach(() => {
          graphData = { nodes: {}, edges: {} };
          upsertEntity(graphData, 'King Aldric', 'PERSON', 'The ruler');
          upsertEntity(graphData, 'Castle', 'PLACE', 'A fortress');
      });

      it('adds a new edge between existing nodes', () => {
          upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
          const edgeKey = 'king aldric__castle';
          expect(graphData.edges[edgeKey]).toBeDefined();
          expect(graphData.edges[edgeKey].source).toBe('king aldric');
          expect(graphData.edges[edgeKey].target).toBe('castle');
          expect(graphData.edges[edgeKey].description).toBe('Rules from the castle');
          expect(graphData.edges[edgeKey].weight).toBe(1);
      });

      it('increments weight on duplicate edge', () => {
          upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
          upsertRelationship(graphData, 'king aldric', 'castle', 'Rules from the castle');
          expect(graphData.edges['king aldric__castle'].weight).toBe(2);
      });

      it('appends description on duplicate edge when description differs', () => {
          upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
          upsertRelationship(graphData, 'King Aldric', 'Castle', 'Imprisoned in the castle');
          const edge = graphData.edges['king aldric__castle'];
          expect(edge.weight).toBe(2);
          expect(edge.description).toContain('Rules from the castle');
          expect(edge.description).toContain('Imprisoned in the castle');
      });

      it('silently skips if source node does not exist', () => {
          upsertRelationship(graphData, 'Ghost', 'Castle', 'Haunts');
          expect(Object.keys(graphData.edges)).toHaveLength(0);
      });

      it('silently skips if target node does not exist', () => {
          upsertRelationship(graphData, 'King Aldric', 'Ghost', 'Fears');
          expect(Object.keys(graphData.edges)).toHaveLength(0);
      });

      it('normalizes source and target to lowercase trimmed', () => {
          upsertRelationship(graphData, '  King Aldric  ', '  Castle  ', 'Rules');
          expect(graphData.edges['king aldric__castle']).toBeDefined();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `upsertRelationship` not exported

**Step 3: Implementation (Green)**
- File: `src/graph/graph.js`
- Add after `upsertEntity`:
  ```javascript
  /**
   * Upsert a relationship edge. Increments weight on duplicates.
   * On duplicate edges: increments weight AND appends description if different.
   * Silently skips if source or target node doesn't exist.
   * @param {Object} graphData - The graph object { nodes, edges } (mutated in place)
   * @param {string} source - Source entity name (will be normalized)
   * @param {string} target - Target entity name (will be normalized)
   * @param {string} description - Relationship description
   */
  export function upsertRelationship(graphData, source, target, description) {
      const srcKey = normalizeKey(source);
      const tgtKey = normalizeKey(target);

      if (!graphData.nodes[srcKey] || !graphData.nodes[tgtKey]) return;

      const edgeKey = `${srcKey}__${tgtKey}`;
      const existing = graphData.edges[edgeKey];

      if (existing) {
          existing.weight += 1;
          if (!existing.description.includes(description)) {
              existing.description = existing.description + ' | ' + description;
          }
      } else {
          graphData.edges[edgeKey] = {
              source: srcKey,
              target: tgtKey,
              description,
              weight: 1,
          };
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add upsertRelationship to graph module"`

---

### Task 1.4: Graph Utility — createEmptyGraph, initGraphState

**Goal:** Add helper functions to create empty graph structures and initialize graph state in openvault data.

**Step 1: Write the Failing Test**
- File: `tests/graph/graph.test.js`
- Add tests:
  ```javascript
  import { createEmptyGraph, initGraphState } from '../../src/graph/graph.js';

  describe('createEmptyGraph', () => {
      it('returns an object with empty nodes and edges', () => {
          const g = createEmptyGraph();
          expect(g).toEqual({ nodes: {}, edges: {} });
      });
  });

  describe('initGraphState', () => {
      it('initializes graph, communities, reflection_state, and graph_message_count on openvault data', () => {
          const data = { memories: [], character_states: {} };
          initGraphState(data);
          expect(data.graph).toEqual({ nodes: {}, edges: {} });
          expect(data.communities).toEqual({});
          expect(data.reflection_state).toEqual({});
          expect(data.graph_message_count).toBe(0);
      });

      it('does not overwrite existing graph data', () => {
          const data = {
              memories: [],
              graph: { nodes: { castle: { name: 'Castle' } }, edges: {} },
              communities: { C0: { title: 'Test' } },
              reflection_state: { 'King Aldric': { importance_sum: 15 } },
              graph_message_count: 42,
          };
          initGraphState(data);
          expect(data.graph.nodes.castle.name).toBe('Castle');
          expect(data.communities.C0.title).toBe('Test');
          expect(data.reflection_state['King Aldric'].importance_sum).toBe(15);
          expect(data.graph_message_count).toBe(42);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — functions not exported

**Step 3: Implementation (Green)**
- File: `src/graph/graph.js`
- Add:
  ```javascript
  /**
   * Create an empty flat graph structure.
   * @returns {{ nodes: Object, edges: Object }}
   */
  export function createEmptyGraph() {
      return { nodes: {}, edges: {} };
  }

  /**
   * Initialize graph-related state fields on the openvault data object.
   * Does not overwrite existing fields.
   * @param {Object} data - The openvault data object (mutated in place)
   */
  export function initGraphState(data) {
      if (!data.graph) data.graph = createEmptyGraph();
      if (!data.communities) data.communities = {};
      if (!data.reflection_state) data.reflection_state = {};
      if (data.graph_message_count == null) data.graph_message_count = 0;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add createEmptyGraph and initGraphState helpers"`

---

## Phase 2: Extraction Pipeline Integration

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

---

## Phase 3: Reflection Engine

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
  import { log, sortMemoriesBySequence } from '../utils.js';

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
                  id: `ref_${now}_${reflections.length}`,
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

---

## Phase 4: Community Detection & Summarization

Build the GraphRAG community detection and summarization pipeline using graphology.

---

### Task 4.1: Community Summary Schema and LLM Config

**Goal:** Add `CommunitySummarySchema` to structured.js and `LLM_CONFIGS.community` to llm.js.

**Step 1: Write the Failing Test**
- File: `tests/extraction/structured.test.js`
  ```javascript
  import { parseCommunitySummaryResponse } from '../../src/extraction/structured.js';

  describe('CommunitySummarySchema', () => {
      it('parses a valid community summary', () => {
          const json = JSON.stringify({
              title: 'The Royal Court',
              summary: 'King Aldric rules from the Castle...',
              findings: ['The King fears betrayal', 'The Guard is loyal'],
          });
          const result = parseCommunitySummaryResponse(json);
          expect(result.title).toBe('The Royal Court');
          expect(result.findings).toHaveLength(2);
      });

      it('requires at least 1 finding', () => {
          const json = JSON.stringify({
              title: 'Empty',
              summary: 'Nothing',
              findings: [],
          });
          expect(() => parseCommunitySummaryResponse(json)).toThrow();
      });
  });
  ```
- File: `tests/llm.test.js`
  ```javascript
  it('has community config', () => {
      expect(LLM_CONFIGS.community).toBeDefined();
      expect(LLM_CONFIGS.community.profileSettingKey).toBe('extractionProfile');
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail

**Step 3: Implementation (Green)**
- File: `src/extraction/structured.js`
  ```javascript
  export const CommunitySummarySchema = z.object({
      title: z.string().min(1),
      summary: z.string().min(1),
      findings: z.array(z.string()).min(1).max(5),
  });

  export function getCommunitySummaryJsonSchema() {
      return toJsonSchema(CommunitySummarySchema, 'CommunitySummary');
  }

  export function parseCommunitySummaryResponse(content) {
      return parseStructuredResponse(content, CommunitySummarySchema);
  }
  ```
- File: `src/llm.js`
  ```javascript
  import { getCommunitySummaryJsonSchema } from './extraction/structured.js';

  // Add to LLM_CONFIGS:
  community: {
      profileSettingKey: 'extractionProfile',
      maxTokens: 2000,
      errorContext: 'Community summarization',
      timeoutMs: 90000,
      getJsonSchema: getCommunitySummaryJsonSchema,
  },
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add CommunitySummarySchema and LLM_CONFIGS.community"`

---

### Task 4.2: Community Summarization Prompt

**Goal:** Add `buildCommunitySummaryPrompt` to `src/prompts.js`.

**Step 1: Write the Failing Test**
- File: `tests/prompts.test.js`
  ```javascript
  import { buildCommunitySummaryPrompt } from '../src/prompts.js';

  describe('buildCommunitySummaryPrompt', () => {
      it('returns system/user message pair with node and edge data', () => {
          const nodes = ['- Castle (PLACE): An ancient fortress'];
          const edges = ['- King Aldric → Castle: Rules from [weight: 4]'];
          const result = buildCommunitySummaryPrompt(nodes, edges);
          expect(result).toHaveLength(2);
          expect(result[0].role).toBe('system');
          expect(result[1].role).toBe('user');
          expect(result[1].content).toContain('Castle');
          expect(result[1].content).toContain('King Aldric');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail

**Step 3: Implementation (Green)**
- File: `src/prompts.js`
  ```javascript
  /**
   * Build the community summarization prompt.
   * @param {string[]} nodeLines - Formatted node descriptions
   * @param {string[]} edgeLines - Formatted edge descriptions
   * @returns {Array<{role: string, content: string}>}
   */
  export function buildCommunitySummaryPrompt(nodeLines, edgeLines) {
      const systemPrompt = `You are an AI assistant performing information discovery on a narrative knowledge graph.
  Your task: write a comprehensive report about a community of related entities.

  Report Structure:
  - title: A short, specific name for this community (2-5 words).
  - summary: An executive summary of the community's structure, key entities, and their dynamics.
  - findings: 1-5 key insights about this group, grounded in the provided data.

  Rules:
  - Be specific — reference entity names and relationships.
  - Capture the narrative significance of the group.
  - Output as JSON in the required format.`;

      const userPrompt = `<community_entities>
  ${nodeLines.join('\n')}
  </community_entities>

  <community_relationships>
  ${edgeLines.join('\n')}
  </community_relationships>

  Write a comprehensive report about this community. Respond strictly in the required JSON format.`;

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
- Command: `git add . && git commit -m "feat: add community summarization prompt"`

---

### Task 4.3: Graphology Integration — toGraphology and detectCommunities

**Goal:** Create `src/graph/communities.js` with functions to convert flat graph data to graphology, run Louvain, and group results.

**Step 1: Write the Failing Test**
- File: `tests/graph/communities.test.js` (new file)
  ```javascript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { toGraphology, detectCommunities, buildCommunityGroups } from '../../src/graph/communities.js';

  describe('toGraphology', () => {
      it('converts flat graph to graphology instance', () => {
          const graphData = {
              nodes: {
                  'castle': { name: 'Castle', type: 'PLACE', description: 'A fortress', mentions: 1 },
                  'king': { name: 'King', type: 'PERSON', description: 'The ruler', mentions: 2 },
              },
              edges: {
                  'king__castle': { source: 'king', target: 'castle', description: 'Rules from', weight: 3 },
              },
          };
          const graph = toGraphology(graphData);
          expect(graph.order).toBe(2); // 2 nodes
          expect(graph.size).toBe(1); // 1 edge
          expect(graph.hasNode('castle')).toBe(true);
          expect(graph.hasNode('king')).toBe(true);
      });
  });

  describe('detectCommunities', () => {
      it('returns null when fewer than 3 nodes', () => {
          const graphData = {
              nodes: { a: { name: 'A' }, b: { name: 'B' } },
              edges: {},
          };
          const result = detectCommunities(graphData);
          expect(result).toBeNull();
      });

      it('detects communities in a connected graph', () => {
          // Create two clusters connected by a single weak edge
          const graphData = {
              nodes: {
                  a: { name: 'A', type: 'PERSON', description: 'A', mentions: 5 },
                  b: { name: 'B', type: 'PERSON', description: 'B', mentions: 5 },
                  c: { name: 'C', type: 'PERSON', description: 'C', mentions: 5 },
                  d: { name: 'D', type: 'PERSON', description: 'D', mentions: 5 },
                  e: { name: 'E', type: 'PERSON', description: 'E', mentions: 5 },
                  f: { name: 'F', type: 'PERSON', description: 'F', mentions: 5 },
              },
              edges: {
                  'a__b': { source: 'a', target: 'b', description: 'friends', weight: 10 },
                  'b__c': { source: 'b', target: 'c', description: 'allies', weight: 10 },
                  'a__c': { source: 'a', target: 'c', description: 'team', weight: 10 },
                  'd__e': { source: 'd', target: 'e', description: 'friends', weight: 10 },
                  'e__f': { source: 'e', target: 'f', description: 'allies', weight: 10 },
                  'd__f': { source: 'd', target: 'f', description: 'team', weight: 10 },
                  'c__d': { source: 'c', target: 'd', description: 'knows', weight: 1 },
              },
          };
          const result = detectCommunities(graphData);
          expect(result).not.toBeNull();
          expect(result.communities).toBeDefined();
          expect(result.count).toBeGreaterThanOrEqual(1);
      });
  });

  describe('buildCommunityGroups', () => {
      it('groups nodes by community ID and formats prompt data', () => {
          const graphData = {
              nodes: {
                  king: { name: 'King', type: 'PERSON', description: 'Ruler', mentions: 3 },
                  castle: { name: 'Castle', type: 'PLACE', description: 'Fortress', mentions: 2 },
                  tavern: { name: 'Tavern', type: 'PLACE', description: 'A pub', mentions: 1 },
              },
              edges: {
                  'king__castle': { source: 'king', target: 'castle', description: 'Rules from', weight: 4 },
              },
          };
          const partition = { king: 0, castle: 0, tavern: 1 };
          const groups = buildCommunityGroups(graphData, partition);

          expect(Object.keys(groups)).toHaveLength(2);
          expect(groups[0].nodeKeys).toContain('king');
          expect(groups[0].nodeKeys).toContain('castle');
          expect(groups[0].nodeLines.length).toBeGreaterThan(0);
          expect(groups[1].nodeKeys).toContain('tavern');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `src/graph/communities.js` does not exist

**Step 3: Implementation (Green)**

First, install graphology packages locally for test aliasing:
- Command: `npm install --save-dev graphology graphology-communities-louvain graphology-operators`
- Update `vitest.config.js` aliases:
  ```javascript
  'https://esm.sh/graphology@0.25.4': path.resolve(__dirname, 'node_modules/graphology'),
  'https://esm.sh/graphology-communities-louvain@0.12.0': path.resolve(__dirname, 'node_modules/graphology-communities-louvain'),
  'https://esm.sh/graphology-operators@1.6.0': path.resolve(__dirname, 'node_modules/graphology-operators'),
  ```

- File: `src/graph/communities.js`
  ```javascript
  /**
   * OpenVault Community Detection & Summarization
   *
   * Uses graphology for graph computation and Louvain for community detection.
   */

  import Graph from 'https://esm.sh/graphology@0.25.4';
  import louvain from 'https://esm.sh/graphology-communities-louvain@0.12.0';
  import { toUndirected } from 'https://esm.sh/graphology-operators@1.6.0';

  /**
   * Convert flat graph data to a graphology instance.
   * @param {Object} graphData - { nodes, edges } from chatMetadata
   * @returns {Graph}
   */
  export function toGraphology(graphData) {
      const graph = new Graph({ type: 'directed', allowSelfLoops: false });

      for (const [key, attrs] of Object.entries(graphData.nodes || {})) {
          graph.addNode(key, { ...attrs });
      }

      for (const [key, attrs] of Object.entries(graphData.edges || {})) {
          if (graph.hasNode(attrs.source) && graph.hasNode(attrs.target)) {
              graph.addEdgeWithKey(key, attrs.source, attrs.target, {
                  description: attrs.description,
                  weight: attrs.weight || 1,
              });
          }
      }

      return graph;
  }

  /**
   * Run Louvain community detection on the graph.
   * @param {Object} graphData - Flat graph data
   * @returns {{ communities: Object<string, number>, count: number } | null}
   */
  export function detectCommunities(graphData) {
      if (Object.keys(graphData.nodes || {}).length < 3) return null;

      const directed = toGraphology(graphData);
      const undirected = toUndirected(directed);

      const details = louvain.detailed(undirected, {
          getEdgeWeight: 'weight',
          resolution: 1.0,
      });

      return {
          communities: details.communities,
          count: details.count,
      };
  }

  /**
   * Group nodes by community ID and extract subgraph data for LLM prompts.
   * @param {Object} graphData - Flat graph data
   * @param {Object} communityPartition - nodeKey → communityId mapping
   * @returns {Object<number, { nodeKeys: string[], nodeLines: string[], edgeLines: string[] }>}
   */
  export function buildCommunityGroups(graphData, communityPartition) {
      const groups = {};

      // Group node keys
      for (const [nodeKey, communityId] of Object.entries(communityPartition)) {
          if (!groups[communityId]) {
              groups[communityId] = { nodeKeys: [], nodeLines: [], edgeLines: [] };
          }
          groups[communityId].nodeKeys.push(nodeKey);

          const node = graphData.nodes[nodeKey];
          if (node) {
              groups[communityId].nodeLines.push(
                  `- ${node.name} (${node.type || 'UNKNOWN'}): ${node.description}`
              );
          }
      }

      // Assign edges to communities
      for (const [edgeKey, edge] of Object.entries(graphData.edges || {})) {
          const srcCommunity = communityPartition[edge.source];
          const tgtCommunity = communityPartition[edge.target];

          // Include edge if both endpoints are in the same community
          if (srcCommunity === tgtCommunity && groups[srcCommunity]) {
              const srcNode = graphData.nodes[edge.source];
              const tgtNode = graphData.nodes[edge.target];
              groups[srcCommunity].edgeLines.push(
                  `- ${srcNode?.name || edge.source} → ${tgtNode?.name || edge.target}: ${edge.description} [weight: ${edge.weight}]`
              );
          }
      }

      return groups;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: create communities module with graphology integration, Louvain detection, and group builder"`

---

### Task 4.4: Community Summarization — updateCommunitySummaries

**Goal:** Implement `updateCommunitySummaries` that generates LLM summaries for changed communities.

**Step 1: Write the Failing Test**
- File: `tests/graph/communities.test.js`
  ```javascript
  import { afterEach, beforeEach, vi } from 'vitest';
  import { resetDeps, setDeps } from '../../src/deps.js';
  import { defaultSettings, extensionName } from '../../src/constants.js';

  // Mock LLM
  const mockCallLLM = vi.fn();
  vi.mock('../../src/llm.js', () => ({
      callLLM: (...args) => mockCallLLM(...args),
      LLM_CONFIGS: { community: { profileSettingKey: 'extractionProfile' } },
  }));

  // Mock embeddings
  vi.mock('../../src/embeddings.js', () => ({
      getQueryEmbedding: vi.fn(async (text) => [0.1, 0.2, 0.3]),
  }));

  import { updateCommunitySummaries } from '../../src/graph/communities.js';

  describe('updateCommunitySummaries', () => {
      beforeEach(() => {
          setDeps({
              console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
              getExtensionSettings: () => ({
                  [extensionName]: { ...defaultSettings },
              }),
              Date: { now: () => 1000000 },
          });

          mockCallLLM.mockResolvedValue(JSON.stringify({
              title: 'The Royal Court',
              summary: 'King Aldric rules from the Castle...',
              findings: ['The King is powerful'],
          }));
      });

      afterEach(() => {
          resetDeps();
          vi.clearAllMocks();
      });

      it('generates summaries for new communities', async () => {
          const graphData = {
              nodes: {
                  king: { name: 'King', type: 'PERSON', description: 'Ruler', mentions: 3 },
                  castle: { name: 'Castle', type: 'PLACE', description: 'Fortress', mentions: 2 },
              },
              edges: {
                  'king__castle': { source: 'king', target: 'castle', description: 'Rules from', weight: 4 },
              },
          };
          const communityGroups = {
              0: {
                  nodeKeys: ['king', 'castle'],
                  nodeLines: ['- King (PERSON): Ruler', '- Castle (PLACE): Fortress'],
                  edgeLines: ['- King → Castle: Rules from [weight: 4]'],
              },
          };

          const result = await updateCommunitySummaries(graphData, communityGroups, {});
          expect(result['C0']).toBeDefined();
          expect(result['C0'].title).toBe('The Royal Court');
          expect(result['C0'].embedding).toBeDefined();
          expect(result['C0'].nodeKeys).toEqual(['king', 'castle']);
      });

      it('skips communities whose membership has not changed', async () => {
          const communityGroups = {
              0: {
                  nodeKeys: ['king', 'castle'],
                  nodeLines: ['- King: Ruler'],
                  edgeLines: [],
              },
          };
          const existingCommunities = {
              C0: {
                  nodeKeys: ['king', 'castle'],
                  title: 'Old Title',
                  summary: 'Old summary',
                  findings: ['Old finding'],
                  embedding: [0.5, 0.5],
                  lastUpdated: 500000,
              },
          };

          const result = await updateCommunitySummaries({}, communityGroups, existingCommunities);
          expect(result['C0'].title).toBe('Old Title'); // Unchanged
          expect(mockCallLLM).not.toHaveBeenCalled(); // No LLM call needed
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — `updateCommunitySummaries` not exported

**Step 3: Implementation (Green)**
- File: `src/graph/communities.js`
- Add imports and function:
  ```javascript
  import { getDeps } from '../deps.js';
  import { getQueryEmbedding } from '../embeddings.js';
  import { callLLM, LLM_CONFIGS } from '../llm.js';
  import { buildCommunitySummaryPrompt } from '../prompts.js';
  import { parseCommunitySummaryResponse } from '../extraction/structured.js';
  import { log } from '../utils.js';

  /**
   * Check if two arrays contain the same elements (order-independent).
   * @param {string[]} a
   * @param {string[]} b
   * @returns {boolean}
   */
  function sameMembers(a, b) {
      if (a.length !== b.length) return false;
      const setA = new Set(a);
      return b.every(item => setA.has(item));
  }

  /**
   * Generate or update community summaries.
   * Only regenerates communities whose node membership changed.
   * @param {Object} graphData - Flat graph data
   * @param {Object} communityGroups - Output of buildCommunityGroups
   * @param {Object} existingCommunities - Current community summaries from state
   * @returns {Promise<Object>} Updated communities object
   */
  export async function updateCommunitySummaries(graphData, communityGroups, existingCommunities) {
      const deps = getDeps();
      const updatedCommunities = {};

      for (const [communityId, group] of Object.entries(communityGroups)) {
          const key = `C${communityId}`;
          const existing = existingCommunities[key];

          // Skip if membership hasn't changed
          if (existing && sameMembers(existing.nodeKeys, group.nodeKeys)) {
              updatedCommunities[key] = existing;
              continue;
          }

          // Generate new summary
          try {
              const prompt = buildCommunitySummaryPrompt(group.nodeLines, group.edgeLines);
              const response = await callLLM(prompt, LLM_CONFIGS.community, { structured: true });
              const parsed = parseCommunitySummaryResponse(response);

              // Embed the summary for retrieval
              const embedding = await getQueryEmbedding(parsed.summary);

              updatedCommunities[key] = {
                  nodeKeys: group.nodeKeys,
                  title: parsed.title,
                  summary: parsed.summary,
                  findings: parsed.findings,
                  embedding: embedding || [],
                  lastUpdated: deps.Date.now(),
              };

              log(`Community ${key}: "${parsed.title}" (${group.nodeKeys.length} nodes)`);
          } catch (error) {
              log(`Community ${key} summarization failed: ${error.message}`);
              // Keep existing if available, otherwise skip
              if (existing) {
                  updatedCommunities[key] = existing;
              }
          }
      }

      return updatedCommunities;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: implement updateCommunitySummaries with membership-change detection"`

---

### Task 4.5: Hook Community Detection into Extraction Pipeline

**Goal:** After reflection check in `extractMemories`, trigger community detection every 50 new messages.

**Step 1: Write the Failing Test**
- File: `tests/extraction/extract.test.js`
  ```javascript
  // Add mock for communities module
  vi.mock('../../src/graph/communities.js', () => ({
      detectCommunities: vi.fn(() => null),
      buildCommunityGroups: vi.fn(() => ({})),
      updateCommunitySummaries: vi.fn(async () => ({})),
  }));

  import { detectCommunities, buildCommunityGroups, updateCommunitySummaries } from '../../src/graph/communities.js';

  describe('extractMemories community detection', () => {
      it('triggers community detection when graph_message_count reaches multiple of 50', async () => {
          mockData.graph_message_count = 49; // Will increment by 2 (2 messages), reaching 51
          detectCommunities.mockReturnValue({ communities: { a: 0, b: 0 }, count: 1 });

          await extractMemories([0, 1]);

          expect(detectCommunities).toHaveBeenCalled();
      });

      it('does not trigger community detection when below threshold', async () => {
          mockData.graph_message_count = 10;
          await extractMemories([0, 1]);
          expect(detectCommunities).not.toHaveBeenCalled();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test`
- Expect: Fail — community detection not triggered

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`
- Add import:
  ```javascript
  import { detectCommunities, buildCommunityGroups, updateCommunitySummaries } from '../graph/communities.js';
  ```
- After the reflection check (Stage 4.6), add Stage 4.7 — Community check:
  ```javascript
  // Stage 4.7: Community detection (every 50 messages)
  const prevCount = (data.graph_message_count || 0) - messages.length;
  const currCount = data.graph_message_count || 0;
  // Check if we crossed a 50-message boundary
  if (Math.floor(currCount / 50) > Math.floor(prevCount / 50)) {
      try {
          const communityResult = detectCommunities(data.graph);
          if (communityResult) {
              const groups = buildCommunityGroups(data.graph, communityResult.communities);
              data.communities = await updateCommunitySummaries(
                  data.graph,
                  groups,
                  data.communities || {}
              );
              log(`Community detection: ${communityResult.count} communities found`);
          }
      } catch (error) {
          getDeps().console.error('[OpenVault] Community detection error:', error);
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: hook community detection into extraction pipeline at 50-message intervals"`

---

## Phase 5: Retrieval & World Context Injection

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

---

## Appendix: File Change Summary

### New Files Created
| File | Phase | Purpose |
|---|---|---|
| `src/graph/graph.js` | 1 | Entity/relationship CRUD, graph state init |
| `src/graph/communities.js` | 4 | Graphology integration, Louvain, community summarization |
| `src/reflection/reflect.js` | 3 | Reflection triggers and 3-step pipeline |
| `src/retrieval/world-context.js` | 5 | Community summary retrieval for prompt injection |
| `tests/graph/graph.test.js` | 1 | Graph CRUD tests |
| `tests/graph/communities.test.js` | 4 | Community detection tests |
| `tests/reflection/reflect.test.js` | 3 | Reflection pipeline tests |
| `tests/retrieval/world-context.test.js` | 5 | World context retrieval tests |
| `tests/retrieval/retrieve.test.js` | 5 | Retrieval integration tests |
| `tests/llm.test.js` | 0 | LLM config tests |
| `tests/scoring.test.js` | 0 | Scoring cleanup tests |
| `tests/constants.test.js` | 0 | Constants cleanup tests |

### Modified Files
| File | Phase | Changes |
|---|---|---|
| `src/extraction/structured.js` | 0, 1, 3, 4 | Remove retrieval schema; add Entity, Relationship, Reflection, Community schemas |
| `src/extraction/extract.js` | 2, 3, 4 | Add graph upsert, reflection trigger, community detection stages |
| `src/llm.js` | 0, 3, 4 | Remove retrieval config; add reflection and community configs |
| `src/prompts.js` | 0, 2, 3, 4 | Remove smart retrieval prompt; add entity extraction instructions, reflection prompts, community prompt |
| `src/retrieval/scoring.js` | 0 | Remove smart retrieval, simplify selectRelevantMemories |
| `src/retrieval/retrieve.js` | 0, 5 | Remove smart retrieval context; add world context injection |
| `src/utils.js` | 5 | Add name parameter to safeSetExtensionPrompt |
| `src/constants.js` | 0 | Remove smartRetrievalEnabled, retrievalProfile, retrievalPreFilterTokens |
| `src/ui/settings.js` | 0 | Remove smart retrieval UI handlers |
| `templates/settings_panel.html` | 0 | Remove smart retrieval checkbox and profile dropdown |
| `vitest.config.js` | 4 | Add graphology package aliases |
| `package.json` | 4 | Add graphology dev dependencies |
| `tests/extraction/structured.test.js` | 0, 1, 3, 4 | Add tests for new schemas |
| `tests/prompts.test.js` | 0, 2, 3, 4 | Add tests for new prompts |
