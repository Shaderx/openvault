# Phase 1: Schema & Graph CRUD

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

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
          if (!existing.description.includes(description)) {
              existing.description = existing.description + ' | ' + description;
          }
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
