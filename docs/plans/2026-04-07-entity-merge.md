# Entity Merge Implementation Plan (Corrected)

**Goal:** Implement manual entity merging functionality allowing users to consolidate duplicate entities while preserving all relationships, aliases, and mentions.

**Architecture:** Adds a merge picker UI to entity cards, backed by `mergeEntities()` in the store that handles data consolidation, edge rewriting with collision detection, and redirect management.

**Tech Stack:** ESM JavaScript, Vitest for testing, jQuery for DOM manipulation, existing OpenVault patterns for state management and UI.

---

## File Structure Overview

**Create:**
- `tests/store/chat-data-merge.test.js` - Comprehensive merge logic tests

**Modify:**
- `src/utils/text.js` - Add `mergeDescriptions()` helper next to existing `jaccardSimilarity()`
- `src/store/chat-data.js` - Add `mergeEntities()` function
- `src/ui/templates.js` - Add merge button to entity card, add `renderEntityMergePicker()` with `<datalist>`
- `src/ui/render.js` - Add merge event bindings and flow handlers
- `css/entities.css` - Minimal styles for merge picker (native `<datalist>` needs little styling)

---

### Task 1: Add mergeDescriptions Helper to Text Utils

**Files:**
- Modify: `src/utils/text.js` - Add `mergeDescriptions()` next to existing `jaccardSimilarity()`
- Test: `tests/utils/text.test.js` - Add tests for `mergeDescriptions`

**Purpose:** Add the segmented Jaccard deduplication helper for merging entity descriptions.

**DRY Note:** `jaccardSimilarity()` already exists in this file. Do NOT recreate it.

**Common Pitfalls:**
- Must split by ` | ` (space-pipe-space) not just `|`
- Threshold constant comes from `src/constants.js` (`GRAPH_JACCARD_DUPLICATE_THRESHOLD`)
- Import from constants, don't hardcode 0.6

- [ ] Step 1: Read existing text.js to understand the pattern

Run: Read `src/utils/text.js` to see how `jaccardSimilarity` is implemented

- [ ] Step 2: Write the failing test for mergeDescriptions

```javascript
// tests/utils/text.test.js - add to existing file
import { describe, it, expect } from 'vitest';
import { mergeDescriptions } from '../../src/utils/text.js';

describe('mergeDescriptions', () => {
  it('returns source when target is empty', () => {
    expect(mergeDescriptions('', 'hello world', 0.6)).toBe('hello world');
  });

  it('returns target when source is empty', () => {
    expect(mergeDescriptions('hello world', '', 0.6)).toBe('hello world');
  });

  it('appends non-duplicate segments', () => {
    const target = 'Loves apples';
    const source = 'Hates dogs';
    expect(mergeDescriptions(target, source, 0.6)).toBe('Loves apples | Hates dogs');
  });

  it('skips duplicate segments based on threshold', () => {
    const target = 'Loves apples';
    const source = 'Loves apples | Fears heights';
    expect(mergeDescriptions(target, source, 0.6)).toBe('Loves apples | Fears heights');
  });

  it('handles multiple source segments', () => {
    const target = 'A | B';
    const source = 'C | D | E';
    expect(mergeDescriptions(target, source, 0.6)).toBe('A | B | C | D | E');
  });
});
```

- [ ] Step 3: Run test to verify it fails

Run: `npm test tests/utils/text.test.js -- --run`
Expected: FAIL with "mergeDescriptions is not exported"

- [ ] Step 4: Write minimal implementation

```javascript
// src/utils/text.js - add after existing jaccardSimilarity function

import { GRAPH_JACCARD_DUPLICATE_THRESHOLD } from '../constants.js';

/**
 * Merge source description into target using segmented Jaccard deduplication.
 * @param {string} targetDesc - Current target description
 * @param {string} sourceDesc - Source description to merge
 * @param {number} [threshold] - Similarity threshold (defaults to GRAPH_JACCARD_DUPLICATE_THRESHOLD)
 * @returns {string} Combined description
 */
export function mergeDescriptions(targetDesc, sourceDesc, threshold = GRAPH_JACCARD_DUPLICATE_THRESHOLD) {
  if (!sourceDesc) return targetDesc || '';
  if (!targetDesc) return sourceDesc;

  const segments = sourceDesc.split(' | ');
  let result = targetDesc;

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const similarity = jaccardSimilarity(trimmed, result);
    if (similarity < threshold) {
      result = result ? `${result} | ${trimmed}` : trimmed;
    }
  }

  return result;
}
```

- [ ] Step 5: Run test to verify it passes

Run: `npm test tests/utils/text.test.js -- --run`
Expected: PASS

- [ ] Step 6: Run typecheck and lint

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] Step 7: Commit

```bash
git add -A && git commit -m "feat: add mergeDescriptions helper for entity description merging"
```

---

### Task 2: Implement mergeEntities in Store

**Files:**
- Modify: `src/store/chat-data.js`
- Test: `tests/store/chat-data-merge.test.js`

**Purpose:** Add the core `mergeEntities()` function that consolidates two entities, handling node data, edges, and redirects.

**DRY Notes:**
- Import `cyrb53` from `'../utils/embedding-codec.js'` - do NOT redefine
- Import `countTokens` from `'../utils/tokens.js'` - do NOT use `split(/\s+/).length`
- Import `jaccardSimilarity` and `mergeDescriptions` from `'../utils/text.js'`

**Interface Consistency:**
Must return `{ success: boolean, stChanges?: { toDelete: string[] } }` (not `{ success, toDelete }`)

**Common Pitfalls:**
- Must import `GRAPH_JACCARD_DUPLICATE_THRESHOLD` from constants
- Must import `deleteEmbedding` from `'./embeddings.js'`
- Must guard `_mergeRedirects` initialization: `if (!g._mergeRedirects) g._mergeRedirects = {};`
- Edge keys are composite: `${source}__${target}` format
- Hash format must match ST vector format exactly
- `_edgesNeedingConsolidation` may not exist - initialize if needed

- [ ] Step 1: Write the failing tests

```javascript
// tests/store/chat-data-merge.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/utils/cdn.js', () => ({
  cdnImport: vi.fn()
}));

vi.mock('../../src/utils/logging.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../src/deps.js', () => ({
  getDeps: vi.fn(() => ({
    getContext: vi.fn(() => ({
      chatMetadata: {}
    }))
  }))
}));

describe('mergeEntities', () => {
  let mockGraph;
  let mergeEntities;

  beforeEach(async () => {
    vi.resetModules();

    mockGraph = {
      nodes: {},
      edges: {},
      _mergeRedirects: {},
      _edgesNeedingConsolidation: []
    };

    global.saveChatConditional = vi.fn().mockResolvedValue(undefined);

    const module = await import('../../src/store/chat-data.js');
    mergeEntities = module.mergeEntities;
  });

  describe('validation', () => {
    it('rejects when source equals target', async () => {
      mockGraph.nodes['entity1'] = { name: 'Entity 1' };

      const result = await mergeEntities('entity1', 'entity1', mockGraph);

      expect(result.success).toBe(false);
      expect(result.stChanges).toBeUndefined();
    });

    it('rejects when source does not exist', async () => {
      mockGraph.nodes['target'] = { name: 'Target' };

      const result = await mergeEntities('nonexistent', 'target', mockGraph);

      expect(result.success).toBe(false);
    });

    it('rejects when target does not exist', async () => {
      mockGraph.nodes['source'] = { name: 'Source' };

      const result = await mergeEntities('source', 'nonexistent', mockGraph);

      expect(result.success).toBe(false);
    });
  });

  describe('basic merge', () => {
    beforeEach(() => {
      mockGraph.nodes['source'] = {
        name: 'Source Entity',
        description: 'Source description',
        mentions: 5,
        aliases: ['alias1', 'alias2'],
        type: 'PERSON',
        _st_synced: true,
        _embedding: [1, 2, 3]
      };
      mockGraph.nodes['target'] = {
        name: 'Target Entity',
        description: 'Target description',
        mentions: 10,
        aliases: ['alias3'],
        type: 'PERSON',
        _st_synced: true,
        _embedding: [4, 5, 6]
      };
    });

    it('combines mentions', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.nodes['target'].mentions).toBe(15);
    });

    it('merges aliases including source name', async () => {
      await mergeEntities('source', 'target', mockGraph);

      const targetAliases = mockGraph.nodes['target'].aliases;
      expect(targetAliases).toContain('alias1');
      expect(targetAliases).toContain('alias2');
      expect(targetAliases).toContain('alias3');
      expect(targetAliases).toContain('Source Entity');
    });

    it('removes duplicate aliases', async () => {
      mockGraph.nodes['target'].aliases = ['alias1'];

      await mergeEntities('source', 'target', mockGraph);

      const targetAliases = mockGraph.nodes['target'].aliases;
      expect(targetAliases.filter(a => a === 'alias1').length).toBe(1);
    });

    it('deletes source node', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.nodes['source']).toBeUndefined();
    });

    it('clears target embedding', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.nodes['target']._embedding).toBeUndefined();
    });

    it('sets merge redirect', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph._mergeRedirects['source']).toBe('target');
    });

    it('returns stChanges with toDelete for source node', async () => {
      const result = await mergeEntities('source', 'target', mockGraph);

      expect(result.success).toBe(true);
      expect(result.stChanges).toBeDefined();
      expect(result.stChanges.toDelete.length).toBeGreaterThan(0);
    });
  });

  describe('schema guard - _mergeRedirects', () => {
    it('initializes _mergeRedirects if missing', async () => {
      delete mockGraph._mergeRedirects;
      mockGraph.nodes['source'] = { name: 'Source', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['target'] = { name: 'Target', description: '', mentions: 1, aliases: [], type: 'PERSON' };

      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph._mergeRedirects).toBeDefined();
      expect(mockGraph._mergeRedirects['source']).toBe('target');
    });
  });

  describe('redirect cascading', () => {
    it('updates existing redirects pointing to source', async () => {
      mockGraph.nodes['source'] = { name: 'Source', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['target'] = { name: 'Target', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['other'] = { name: 'Other', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph._mergeRedirects['other'] = 'source';

      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph._mergeRedirects['other']).toBe('target');
    });
  });

  describe('edge rewriting', () => {
    beforeEach(() => {
      mockGraph.nodes['source'] = { name: 'Source', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['target'] = { name: 'Target', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['charlie'] = { name: 'Charlie', description: '', mentions: 1, aliases: [], type: 'PERSON' };

      mockGraph.edges['source__charlie'] = {
        source: 'source',
        target: 'charlie',
        weight: 3,
        description: 'Source knows Charlie',
        _st_synced: true
      };
    });

    it('rewrites edges from source to target', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.edges['target__charlie']).toBeDefined();
      expect(mockGraph.edges['target__charlie'].weight).toBe(3);
      expect(mockGraph.edges['source__charlie']).toBeUndefined();
    });
  });

  describe('edge collision', () => {
    beforeEach(() => {
      mockGraph.nodes['source'] = { name: 'Source', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['target'] = { name: 'Target', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['charlie'] = { name: 'Charlie', description: '', mentions: 1, aliases: [], type: 'PERSON' };

      mockGraph.edges['source__charlie'] = {
        source: 'source',
        target: 'charlie',
        weight: 3,
        description: 'Source knows Charlie',
        _st_synced: true
      };
      mockGraph.edges['target__charlie'] = {
        source: 'target',
        target: 'charlie',
        weight: 5,
        description: 'Target knows Charlie',
        _st_synced: true
      };
    });

    it('sums weights on collision', async () => {
      await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.edges['target__charlie'].weight).toBe(8);
    });

    it('merges descriptions on collision', async () => {
      await mergeEntities('source', 'target', mockGraph);

      const desc = mockGraph.edges['target__charlie'].description;
      expect(desc).toContain('Target knows Charlie');
      expect(desc).toContain('Source knows Charlie');
    });
  });

  describe('self-loop prevention', () => {
    it('deletes edge that would become self-loop', async () => {
      mockGraph.nodes['source'] = { name: 'Source', description: '', mentions: 1, aliases: [], type: 'PERSON' };
      mockGraph.nodes['target'] = { name: 'Target', description: '', mentions: 1, aliases: [], type: 'PERSON' };

      mockGraph.edges['source__target'] = {
        source: 'source',
        target: 'target',
        weight: 3,
        description: 'Source knows Target',
        _st_synced: true
      };

      const result = await mergeEntities('source', 'target', mockGraph);

      expect(mockGraph.edges['source__target']).toBeUndefined();
      expect(mockGraph.edges['target__target']).toBeUndefined();
      expect(result.stChanges.toDelete.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test tests/store/chat-data-merge.test.js -- --run`
Expected: FAIL with "mergeEntities is not exported"

- [ ] Step 3: Write minimal implementation

```javascript
// src/store/chat-data.js - add imports and function

// Add to imports at top:
import { mergeDescriptions } from '../utils/text.js';
import { deleteEmbedding } from './embeddings.js';
import { cyrb53 } from '../utils/embedding-codec.js';
import { countTokens } from '../utils/tokens.js';
import { GRAPH_JACCARD_DUPLICATE_THRESHOLD, CONSOLIDATION } from '../constants.js';

/**
 * Merge source entity into target entity. Source is deleted.
 * @param {string} sourceKey - Entity to absorb (will be deleted)
 * @param {string} targetKey - Entity that survives
 * @param {Object} graph - The graph object (defaults to current graph from deps)
 * @returns {Promise<{ success: boolean, stChanges?: { toDelete: string[] } }>}
 */
export async function mergeEntities(sourceKey, targetKey, graph = null) {
  const deps = getDeps();
  const ctx = deps.getContext();
  const g = graph || ctx.chatMetadata?.openvault?.graph;

  if (!g) {
    return { success: false };
  }

  // Validation
  if (sourceKey === targetKey) {
    return { success: false };
  }

  const sourceNode = g.nodes[sourceKey];
  const targetNode = g.nodes[targetKey];

  if (!sourceNode || !targetNode) {
    return { success: false };
  }

  const toDelete = [];

  // 1. Combine node data onto target
  targetNode.mentions += sourceNode.mentions;

  // Merge aliases (source name becomes an alias)
  const allAliases = [...(targetNode.aliases || []), ...(sourceNode.aliases || []), sourceNode.name];
  targetNode.aliases = [...new Set(allAliases)];

  // Merge descriptions using segmented Jaccard dedup
  targetNode.description = mergeDescriptions(
    targetNode.description,
    sourceNode.description,
    GRAPH_JACCARD_DUPLICATE_THRESHOLD
  );

  // 2. Set merge redirect and cascade
  if (!g._mergeRedirects) {
    g._mergeRedirects = {};
  }
  g._mergeRedirects[sourceKey] = targetKey;

  // Cascade: update any redirects pointing to source
  for (const [key, value] of Object.entries(g._mergeRedirects)) {
    if (value === sourceKey && key !== sourceKey) {
      g._mergeRedirects[key] = targetKey;
    }
  }

  // 3. Rewrite and combine edges
  const edgesToProcess = Object.entries(g.edges).filter(([_, edge]) =>
    edge.source === sourceKey || edge.target === sourceKey
  );

  for (const [oldKey, edge] of edgesToProcess) {
    const newSource = edge.source === sourceKey ? targetKey : edge.source;
    const newTarget = edge.target === sourceKey ? targetKey : edge.target;
    const newKey = `${newSource}__${newTarget}`;

    // Self-loop check: delete if would be target->target
    if (newSource === newTarget) {
      if (edge._st_synced) {
        toDelete.push(cyrb53(`[OV_ID:edge_${edge.source}_${edge.target}] ${edge.description}`));
      }
      delete g.edges[oldKey];
      continue;
    }

    // Collision check: target edge already exists
    if (g.edges[newKey] && newKey !== oldKey) {
      const existingEdge = g.edges[newKey];
      existingEdge.weight += edge.weight;

      // Merge descriptions
      existingEdge.description = mergeDescriptions(
        existingEdge.description,
        edge.description,
        GRAPH_JACCARD_DUPLICATE_THRESHOLD
      );

      // Recalculate tokens using proper token counter
      if (existingEdge._descriptionTokens !== undefined) {
        existingEdge._descriptionTokens = countTokens(existingEdge.description);
      }

      // Check consolidation threshold
      if (existingEdge._descriptionTokens > CONSOLIDATION.TOKEN_THRESHOLD) {
        if (!g._edgesNeedingConsolidation) {
          g._edgesNeedingConsolidation = [];
        }
        if (!g._edgesNeedingConsolidation.includes(newKey)) {
          g._edgesNeedingConsolidation.push(newKey);
        }
      }

      // Invalidate embedding since description changed
      deleteEmbedding(existingEdge);

      // Collect hash for old edge deletion
      if (edge._st_synced) {
        toDelete.push(cyrb53(`[OV_ID:edge_${edge.source}_${edge.target}] ${edge.description}`));
      }

      delete g.edges[oldKey];
    } else if (newKey !== oldKey) {
      // No collision: rewrite edge
      edge.source = newSource;
      edge.target = newTarget;
      g.edges[newKey] = edge;
      delete g.edges[oldKey];
    }
  }

  // 4. Cleanup
  // Collect hash for source node deletion
  if (sourceNode._st_synced) {
    toDelete.push(cyrb53(`[OV_ID:${sourceKey}] ${sourceNode.description}`));
  }

  delete g.nodes[sourceKey];

  // Invalidate target embedding since description changed
  deleteEmbedding(targetNode);

  // 5. Save
  await saveChatConditional();

  return {
    success: true,
    stChanges: { toDelete }
  };
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test tests/store/chat-data-merge.test.js -- --run`
Expected: PASS

- [ ] Step 5: Run typecheck and lint

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] Step 6: Commit

```bash
git add -A && git commit -m "feat: implement mergeEntities function with edge collision and redirect handling"
```

---

### Task 3: Add Merge Button to Entity Card Template

**Files:**
- Modify: `src/ui/templates.js`

**Purpose:** Add a "Merge" button next to Edit and Delete on entity cards.

**Common Pitfalls:**
- Button must use correct FontAwesome icon class (`fa-code-merge`)
- Must include `data-key` attribute for event binding
- Follow existing pattern used for edit and delete buttons

- [ ] Step 1: Read renderEntityCard function

Run: Read `src/ui/templates.js` and find `renderEntityCard()`

- [ ] Step 2: Add merge button HTML

```javascript
// In src/ui/templates.js, in renderEntityCard()
// Add between edit and delete buttons:
`<button class="openvault-merge-entity" data-key="${key}" title="Merge into another entity">
  <i class="fa-solid fa-code-merge"></i>
</button>`
```

- [ ] Step 3: Run typecheck and lint

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "ui: add merge button to entity card template"
```

---

### Task 4: Create Merge Picker Template with Native Datalist

**Files:**
- Modify: `src/ui/templates.js`

**Purpose:** Add `renderEntityMergePicker()` function using native HTML5 `<datalist>` for lightweight target selection.

**Common Pitfalls:**
- Use `<datalist>` not custom jQuery dropdown (per review)
- Must exclude source entity from options
- Options should include both entity names and aliases for searchability
- Input needs `list` attribute pointing to datalist id
- Store selected target key via lookup on confirm, not via data attributes

- [ ] Step 1: Write the renderEntityMergePicker function

```javascript
// src/ui/templates.js

/**
 * Render a merge picker panel using native HTML5 datalist.
 * @param {string} sourceKey - The entity being merged (will be deleted)
 * @param {Object} sourceNode - The source entity node data
 * @param {Object} graphNodes - All nodes in graph (for building options)
 * @returns {string} HTML string for the merge picker
 */
export function renderEntityMergePicker(sourceKey, sourceNode, graphNodes) {
  const sourceDisplay = escapeHtml(sourceNode.name || sourceKey);
  const datalistId = `merge-targets-${sourceKey.replace(/[^a-zA-Z0-9]/g, '-')}`;

  // Build datalist options from all nodes except source
  // Include both name and aliases as separate options for searchability
  const options = Object.entries(graphNodes)
    .filter(([key]) => key !== sourceKey)
    .flatMap(([key, node]) => {
      const displayName = escapeHtml(node.name || key);
      const typeLabel = node.type ? ` [${node.type}]` : '';
      const primaryOption = `<option value="${displayName}${typeLabel}" data-key="${escapeHtml(key)}">`;

      // Also add alias options pointing to same entity
      const aliasOptions = (node.aliases || [])
        .filter(alias => alias !== node.name)
        .map(alias => `<option value="${escapeHtml(alias)} [alias of ${displayName}]" data-key="${escapeHtml(key)}">`);

      return [primaryOption, ...aliasOptions];
    }).join('\n');

  return `
    <div class="openvault-entity-merge-panel" data-source-key="${escapeHtml(sourceKey)}">
      <div class="merge-header">
        <h4>Merge "${sourceDisplay}" into another entity</h4>
        <p class="merge-explanation">
          "${sourceDisplay}" will be deleted. Its relationships, aliases, and description
          will be combined into the target entity.
        </p>
      </div>

      <div class="merge-target-picker">
        <label for="merge-target-input-${sourceKey}">Target:</label>
        <input
          type="text"
          id="merge-target-input-${sourceKey}"
          class="openvault-merge-search"
          placeholder="Type to search entities..."
          autocomplete="off"
          list="${datalistId}"
        />
        <datalist id="${datalistId}">
          ${options}
        </datalist>
      </div>

      <div class="merge-actions">
        <button class="openvault-cancel-entity-merge" data-key="${escapeHtml(sourceKey)}">
          Cancel
        </button>
        <button class="openvault-confirm-entity-merge" data-source-key="${escapeHtml(sourceKey)}">
          Confirm Merge
        </button>
      </div>
    </div>
  `;
}

// Helper function (add if not exists)
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

- [ ] Step 2: Run typecheck and lint

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "ui: add renderEntityMergePicker using native HTML5 datalist"
```

---

### Task 5: Add Merge Event Bindings and Flow Handlers

**Files:**
- Modify: `src/ui/render.js`

**Purpose:** Implement the merge flow: enter merge mode, handle confirm/cancel, lookup target from input text.

**Corrected Imports (per review):**
- `showToast` from `'../utils/dom.js'` (not `getToast`)
- `deleteItemsFromST` from `'../services/st-vector.js'`
- `getCurrentChatId` from `'../store/chat-data.js'` (not `getContext().chatId`)
- Call `renderEntityList()` to refresh UI (not `renderVault()`)

**Common Pitfalls:**
- Must lookup target key from input text by matching against node names/aliases
- Lookup must be case-insensitive
- Must handle Escape key for cancel
- Must show loading toast during operation
- Interface changed: `result.stChanges.toDelete` not `result.toDelete`

- [ ] Step 1: Read existing event binding patterns

Read `src/ui/render.js` to understand:
- How `initEntityEventBindings()` is structured
- How edit mode is entered/exited
- How to import and use `showToast`, `renderEntityList`, `getCurrentChatId`

- [ ] Step 2: Add merge event bindings

```javascript
// src/ui/render.js - add to initEntityEventBindings()

// Merge button on entity card
$container.on('click', '.openvault-merge-entity', (e) => {
  const key = $(e.currentTarget).data('key');
  enterEntityMergeMode(key);
});

// Cancel merge picker
$container.on('click', '.openvault-cancel-entity-merge', (e) => {
  const key = $(e.currentTarget).data('key');
  cancelEntityMerge(key);
});

// Confirm merge
$container.on('click', '.openvault-confirm-entity-merge', async (e) => {
  const sourceKey = $(e.currentTarget).data('source-key');
  await confirmEntityMerge(sourceKey);
});

// Escape key to cancel
$container.on('keydown', '.openvault-entity-merge-panel', (e) => {
  if (e.key === 'Escape') {
    const key = $(e.currentTarget).data('source-key');
    cancelEntityMerge(key);
  }
});
```

- [ ] Step 3: Add merge flow handler functions

```javascript
// src/ui/render.js - add imports and functions

import { renderEntityMergePicker } from './templates.js';
import { mergeEntities, getCurrentChatId } from '../store/chat-data.js';
import { deleteItemsFromST } from '../services/st-vector.js';
import { showToast } from '../utils/dom.js';

/**
 * Enter merge mode for an entity - replace card with merge picker.
 * @param {string} sourceKey
 */
function enterEntityMergeMode(sourceKey) {
  const deps = getDeps();
  const ctx = deps.getContext();
  const graph = ctx.chatMetadata?.openvault?.graph;

  if (!graph) return;

  const sourceNode = graph.nodes[sourceKey];
  if (!sourceNode) return;

  // Render the merge picker
  const pickerHtml = renderEntityMergePicker(sourceKey, sourceNode, graph.nodes);

  // Replace the entity card with the picker
  const $card = $(`.openvault-entity-card[data-key="${sourceKey}"]`);
  $card.replaceWith(pickerHtml);

  // Focus the search input
  $('.openvault-merge-search').focus();
}

/**
 * Cancel merge mode - restore the entity card view.
 * @param {string} sourceKey
 */
function cancelEntityMerge(sourceKey) {
  // Re-render the entity list to restore the card
  renderEntityList();
}

/**
 * Find target entity key from user input text.
 * Matches against node names and aliases (case-insensitive).
 * @param {string} inputText - The text entered by user
 * @param {Object} nodes - Graph nodes
 * @returns {string|null} Target key or null if not found
 */
function findMergeTargetFromInput(inputText, nodes) {
  if (!inputText) return null;

  const normalizedInput = inputText.toLowerCase().trim();
  // Remove type suffix like " [PERSON]" for matching
  const cleanInput = normalizedInput.replace(/\s*\[[^\]]+\]$/, '').trim();

  for (const [key, node] of Object.entries(nodes)) {
    const name = (node.name || '').toLowerCase();
    if (name === cleanInput) return key;

    const aliases = (node.aliases || []).map(a => a.toLowerCase());
    if (aliases.includes(cleanInput)) return key;
  }

  return null;
}

/**
 * Confirm and execute the entity merge.
 * @param {string} sourceKey
 */
async function confirmEntityMerge(sourceKey) {
  const deps = getDeps();
  const ctx = deps.getContext();
  const graph = ctx.chatMetadata?.openvault?.graph;

  if (!graph) {
    showToast('Graph not available', 'error');
    return;
  }

  // Get the input value and find the target
  const $panel = $(`.openvault-entity-merge-panel[data-source-key="${sourceKey}"]`);
  const inputText = $panel.find('.openvault-merge-search').val();
  const targetKey = findMergeTargetFromInput(inputText, graph.nodes);

  if (!targetKey) {
    showToast('Please select a valid target entity', 'error');
    return;
  }

  if (targetKey === sourceKey) {
    showToast('Cannot merge an entity into itself', 'error');
    return;
  }

  try {
    showToast('Merging entities...', 'info');

    const result = await mergeEntities(sourceKey, targetKey);

    if (!result.success) {
      showToast('Failed to merge entities', 'error');
      return;
    }

    // Delete ST vectors for removed items
    if (result.stChanges?.toDelete?.length > 0) {
      const chatId = getCurrentChatId();
      await deleteItemsFromST(result.stChanges.toDelete, chatId);
    }

    // Re-render the entity list
    renderEntityList();

    showToast(`Merged into ${graph.nodes[targetKey]?.name || targetKey}`, 'success');
  } catch (error) {
    if (error.name === 'AbortError') return;
    showToast(`Merge failed: ${error.message}`, 'error');
    console.error('Entity merge failed:', error);
  }
}
```

- [ ] Step 4: Run typecheck and lint

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "ui: add merge flow handlers with datalist lookup"
```

---

### Task 6: Add Minimal CSS for Merge Picker

**Files:**
- Modify: `css/entities.css`

**Purpose:** Basic styling for the merge picker panel. Native `<datalist>` needs minimal styling.

**Note:** Native `<datalist>` styling is limited by browser. Focus on the panel container and action buttons.

- [ ] Step 1: Add merge picker styles

```css
/* css/entities.css */

/* Merge Picker Panel */
.openvault-entity-merge-panel {
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.openvault-entity-merge-panel .merge-header h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary, #fff);
}

.openvault-entity-merge-panel .merge-explanation {
  margin: 0 0 16px 0;
  color: var(--text-secondary, #aaa);
  font-size: 0.9em;
  line-height: 1.4;
}

/* Target Search with datalist */
.merge-target-picker {
  margin-bottom: 16px;
}

.merge-target-picker label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-primary, #fff);
  font-weight: 500;
}

.openvault-merge-search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  background: var(--bg-primary, #1a1a1a);
  color: var(--text-primary, #fff);
  font-size: 14px;
  box-sizing: border-box;
}

.openvault-merge-search:focus {
  outline: none;
  border-color: var(--accent-color, #4a9eff);
}

/* Merge Actions */
.merge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.merge-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s ease;
}

.openvault-cancel-entity-merge {
  background: var(--bg-tertiary, #444);
  color: var(--text-primary, #fff);
}

.openvault-cancel-entity-merge:hover {
  background: var(--bg-hover, #555);
}

.openvault-confirm-entity-merge {
  background: var(--danger-color, #ff4444);
  color: white;
}

.openvault-confirm-entity-merge:hover {
  background: var(--danger-color-hover, #ff6666);
}
```

- [ ] Step 2: Run lint to verify CSS

Run: `npm run lint`
Expected: No errors

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "styles: add minimal CSS for entity merge picker"
```

---

### Task 7: Verify Full Integration

**Files:**
- All modified files

**Purpose:** Run full test suite and verify the implementation works end-to-end.

- [ ] Step 1: Run all tests

Run: `npm test -- --run`
Expected: All tests pass

- [ ] Step 2: Run typecheck

Run: `npm run typecheck`
Expected: No errors

- [ ] Step 3: Run lint

Run: `npm run lint`
Expected: No errors

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: entity merge feature complete"
```

---

## Plan Summary (Corrected)

This plan implements the Entity Merge feature across 7 tasks with corrections from review:

### DRY Corrections Applied:
1. ✅ **Task 1**: Only added `mergeDescriptions()` - `jaccardSimilarity()` already exists
2. ✅ **Task 2**: Import `cyrb53` from `'../utils/embedding-codec.js'` - do NOT redefine
3. ✅ **Task 2**: Import `countTokens` from `'../utils/tokens.js'` - do NOT use split
4. ✅ **Task 2**: Return `{ success, stChanges: { toDelete } }` for Phase 1 interface consistency

### Architecture Corrections Applied:
5. ✅ **Tasks 4-6**: Use native `<datalist>` instead of custom jQuery dropdown
6. ✅ **Task 2**: Schema guard `if (!g._mergeRedirects) g._mergeRedirects = {};`
7. ✅ **Task 5**: Use `showToast` from `'../utils/dom.js'`
8. ✅ **Task 5**: Use `deleteItemsFromST` from `'../services/st-vector.js'`
9. ✅ **Task 5**: Use `renderEntityList()` not `renderVault()`
10. ✅ **Task 5**: Use `getCurrentChatId()` not `getContext().chatId`

**Total estimated commits:** 7

**Key architectural decisions:**
- Source → Target convention (source deleted, target survives)
- Native HTML5 `<datalist>` for lightweight target selection
- Segmented Jaccard deduplication for description merging
- Edge collision handling with weight summing
- ST vector cleanup via `stChanges.toDelete` return
- In-place panel replacement (same pattern as edit mode)
