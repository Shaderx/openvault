# Phase 4: Community Detection & Summarization

> **Parent:** [index.md](index.md) | **Design:** `docs/designs/2026-03-03-reflections-graphrag-design.md`

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
   * Skips communities with fewer than 2 nodes (islands).
   * @param {Object} graphData - Flat graph data
   * @param {Object} communityGroups - Output of buildCommunityGroups
   * @param {Object} existingCommunities - Current community summaries from state
   * @returns {Promise<Object>} Updated communities object
   */
  export async function updateCommunitySummaries(graphData, communityGroups, existingCommunities) {
      const deps = getDeps();
      const updatedCommunities = {};

      for (const [communityId, group] of Object.entries(communityGroups)) {
          // Skip solo nodes - they don't form a meaningful community
          if (group.nodeKeys.length < 2) continue;

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
