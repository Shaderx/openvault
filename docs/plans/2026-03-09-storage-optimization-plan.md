# Implementation Plan - Storage Optimization (Base64 Embeddings + LRU Token Cache)

> **Reference:** `docs/designs/2026-03-09-storage-optimization-design.md`
> **Execution:** Use `executing-plans` skill.

---

## Task 1: Create Embedding Codec Module + Tests

**Goal:** Create `src/utils/embedding-codec.js` with `getEmbedding`, `setEmbedding`, `hasEmbedding`, `deleteEmbedding` — all tested before any callsite migration.

**Step 1: Write the Failing Tests**
- File: `tests/utils/embedding-codec.test.js`
- Code:
  ```js
  import { describe, expect, it } from 'vitest';
  import { getEmbedding, setEmbedding, hasEmbedding, deleteEmbedding } from '../../src/utils/embedding-codec.js';

  describe('setEmbedding + getEmbedding roundtrip', () => {
      it('encodes to Base64 and decodes back to number[]', () => {
          const vec = [0.1234, -0.5678, 0.9012, -0.3456];
          const obj = {};
          setEmbedding(obj, vec);

          expect(obj.embedding_b64).toBeTypeOf('string');
          expect(obj.embedding).toBeUndefined();

          const decoded = getEmbedding(obj);
          expect(decoded).toHaveLength(4);
          // Float32 precision: ~7 significant digits
          for (let i = 0; i < vec.length; i++) {
              expect(decoded[i]).toBeCloseTo(vec[i], 5);
          }
      });

      it('roundtrips a realistic 384-dim normalized vector', () => {
          const raw = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
          const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
          const vec = raw.map(v => v / norm);

          const obj = {};
          setEmbedding(obj, vec);
          const decoded = getEmbedding(obj);

          expect(decoded).toHaveLength(384);
          for (let i = 0; i < vec.length; i++) {
              expect(decoded[i]).toBeCloseTo(vec[i], 5);
          }
      });
  });

  describe('getEmbedding (lazy migration)', () => {
      it('reads legacy number[] from obj.embedding', () => {
          const obj = { embedding: [0.1, 0.2, 0.3] };
          expect(getEmbedding(obj)).toEqual([0.1, 0.2, 0.3]);
      });

      it('prefers embedding_b64 over legacy embedding', () => {
          const obj = { embedding: [999, 999] };
          setEmbedding(obj, [0.1, 0.2]);
          // Manually add back legacy key to simulate mixed state
          obj.embedding = [999, 999];
          const result = getEmbedding(obj);
          expect(result[0]).toBeCloseTo(0.1, 5);
      });

      it('returns null for empty object', () => {
          expect(getEmbedding({})).toBeNull();
      });

      it('returns null for null/undefined input', () => {
          expect(getEmbedding(null)).toBeNull();
          expect(getEmbedding(undefined)).toBeNull();
      });

      it('returns null for embedding: null', () => {
          expect(getEmbedding({ embedding: null })).toBeNull();
      });

      it('returns null for embedding: []', () => {
          expect(getEmbedding({ embedding: [] })).toBeNull();
      });
  });

  describe('setEmbedding', () => {
      it('deletes legacy embedding key', () => {
          const obj = { embedding: [1, 2, 3] };
          setEmbedding(obj, [0.5, 0.6]);
          expect(obj.embedding).toBeUndefined();
          expect(obj.embedding_b64).toBeTypeOf('string');
      });

      it('accepts Float32Array input', () => {
          const obj = {};
          setEmbedding(obj, new Float32Array([0.1, 0.2, 0.3]));
          const decoded = getEmbedding(obj);
          expect(decoded).toHaveLength(3);
          expect(decoded[0]).toBeCloseTo(0.1, 5);
      });
  });

  describe('hasEmbedding', () => {
      it('returns true for embedding_b64', () => {
          const obj = {};
          setEmbedding(obj, [0.1]);
          expect(hasEmbedding(obj)).toBe(true);
      });

      it('returns true for legacy embedding', () => {
          expect(hasEmbedding({ embedding: [0.1] })).toBe(true);
      });

      it('returns false for empty object', () => {
          expect(hasEmbedding({})).toBe(false);
      });

      it('returns false for null/undefined', () => {
          expect(hasEmbedding(null)).toBe(false);
          expect(hasEmbedding(undefined)).toBe(false);
      });

      it('returns false for embedding: null', () => {
          expect(hasEmbedding({ embedding: null })).toBe(false);
      });

      it('returns false for embedding: []', () => {
          expect(hasEmbedding({ embedding: [] })).toBe(false);
      });
  });

  describe('deleteEmbedding', () => {
      it('removes both embedding_b64 and embedding', () => {
          const obj = { embedding: [1], embedding_b64: 'abc' };
          deleteEmbedding(obj);
          expect(obj.embedding).toBeUndefined();
          expect(obj.embedding_b64).toBeUndefined();
      });

      it('handles object with only legacy key', () => {
          const obj = { embedding: [1, 2] };
          deleteEmbedding(obj);
          expect(obj.embedding).toBeUndefined();
      });

      it('no-ops on empty object', () => {
          const obj = {};
          deleteEmbedding(obj);
          expect(Object.keys(obj)).toHaveLength(0);
      });

      it('no-ops on null/undefined', () => {
          expect(() => deleteEmbedding(null)).not.toThrow();
          expect(() => deleteEmbedding(undefined)).not.toThrow();
      });
  });
  ```

**Step 2: Run Tests (Red)**
- Command: `npx vitest run tests/utils/embedding-codec.test.js`
- Expect: Fail — module not found

**Step 3: Implementation (Green)**
- File: `src/utils/embedding-codec.js`
- Code:
  ```js
  /**
   * OpenVault Embedding Codec
   *
   * Encodes/decodes embedding vectors as Base64 Float32Array strings.
   * Provides accessor functions for lazy migration from legacy number[] format.
   */

  /**
   * Encode a number array to a Base64 string via Float32Array.
   * @param {number[]|Float32Array} vec - Embedding vector
   * @returns {string} Base64-encoded string
   */
  function encode(vec) {
      const f32 = vec instanceof Float32Array ? vec : new Float32Array(vec);
      const bytes = new Uint8Array(f32.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  /**
   * Decode a Base64 string back to a number[].
   * @param {string} b64 - Base64-encoded Float32Array
   * @returns {number[]} Decoded embedding vector
   */
  function decode(b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
      }
      return Array.from(new Float32Array(bytes.buffer));
  }

  /**
   * Read embedding from an object. Prefers Base64 format, falls back to legacy array.
   * @param {Object} obj - Object with embedding_b64 or embedding property
   * @returns {number[]|null} Embedding vector or null
   */
  export function getEmbedding(obj) {
      if (!obj) return null;
      if (obj.embedding_b64) return decode(obj.embedding_b64);
      if (obj.embedding && obj.embedding.length > 0) return obj.embedding;
      return null;
  }

  /**
   * Write embedding to an object in Base64 format. Removes legacy key.
   * @param {Object} obj - Target object (mutated)
   * @param {number[]|Float32Array} vec - Embedding vector
   */
  export function setEmbedding(obj, vec) {
      obj.embedding_b64 = encode(vec);
      delete obj.embedding;
  }

  /**
   * Check if an object has an embedding (either format).
   * @param {Object} obj - Object to check
   * @returns {boolean}
   */
  export function hasEmbedding(obj) {
      if (!obj) return false;
      if (obj.embedding_b64) return true;
      if (obj.embedding && obj.embedding.length > 0) return true;
      return false;
  }

  /**
   * Remove embedding from an object (both formats).
   * @param {Object} obj - Object to clean (mutated)
   */
  export function deleteEmbedding(obj) {
      if (!obj) return;
      delete obj.embedding;
      delete obj.embedding_b64;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/utils/embedding-codec.test.js`
- Expect: All tests PASS

**Step 5: Git Commit**
- `git add src/utils/embedding-codec.js tests/utils/embedding-codec.test.js && git commit -m "feat: add embedding codec with Base64 Float32Array encode/decode"`

---

## Task 2: Migrate embeddings.js Write Sites + Remove maybeRoundEmbedding

**Goal:** Replace `maybeRoundEmbedding(embeddings[i])` assignments with `setEmbedding()`. Remove `maybeRoundEmbedding` function and export.

**Step 1: Write the Failing Test**
- File: `tests/embeddings.test.js` — add a new test (append to existing file)
- Code (append):
  ```js
  it('generateEmbeddingsForMemories stores embedding as Base64 via setEmbedding', async () => {
      const { hasEmbedding, getEmbedding } = await import('../src/utils/embedding-codec.js');
      const memories = [{ summary: 'Test memory', id: 'test1' }];
      mockGetStrategy().getDocumentEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      const count = await generateEmbeddingsForMemories(memories);
      expect(count).toBe(1);
      expect(hasEmbedding(memories[0])).toBe(true);
      expect(memories[0].embedding).toBeUndefined(); // no legacy key
      expect(memories[0].embedding_b64).toBeTypeOf('string');
      const decoded = getEmbedding(memories[0]);
      expect(decoded[0]).toBeCloseTo(0.1, 5);
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/embeddings.test.js`
- Expect: Fail — `memories[0].embedding` is still set (old format), `embedding_b64` undefined

**Step 3: Implementation (Green)**
- File: `src/embeddings.js`
- Actions:
  1. Add import at top: `import { setEmbedding } from './utils/embedding-codec.js';`
  2. In `generateEmbeddingsForMemories` (~line 619): replace `validMemories[i].embedding = maybeRoundEmbedding(embeddings[i]);` with `setEmbedding(validMemories[i], embeddings[i]);`
  3. In `enrichEventsWithEmbeddings` (~line 659): replace `validEvents[i].embedding = maybeRoundEmbedding(embeddings[i]);` with `setEmbedding(validEvents[i], embeddings[i]);`
  4. Delete `maybeRoundEmbedding` function (lines 12-24)
  5. Remove `maybeRoundEmbedding` from the exports block at the bottom
  6. In `generateEmbeddingsForMemories` filter (~line 602): replace `!m.embedding` with `!hasEmbedding(m)` (add `hasEmbedding` to import)
  7. In `enrichEventsWithEmbeddings` filter (~line 637): replace `!e.embedding` with `!hasEmbedding(e)`

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/embeddings.test.js`
- Expect: All tests PASS

**Step 5: Git Commit**
- `git add src/embeddings.js tests/embeddings.test.js && git commit -m "feat: switch embeddings.js to Base64 codec, remove maybeRoundEmbedding"`

---

## Task 3: Migrate graph.js Write + Read Sites

**Goal:** Replace `maybeRoundEmbedding` calls and `.embedding` accesses in `graph.js` with codec functions.

**Step 1: Update Test Mocks**
- File: `tests/graph/graph.test.js`
- Action: Remove `maybeRoundEmbedding` from the `vi.mock('../../src/embeddings.js', ...)` block (line 18). Add mock for embedding-codec:
  ```js
  vi.mock('../../src/utils/embedding-codec.js', () => ({
      getEmbedding: vi.fn((obj) => obj?.embedding_b64 ? [0.1] : obj?.embedding || null),
      setEmbedding: vi.fn((obj, vec) => { obj.embedding_b64 = 'mock_b64'; delete obj.embedding; }),
      hasEmbedding: vi.fn((obj) => !!(obj?.embedding_b64 || (obj?.embedding && obj.embedding.length > 0))),
      deleteEmbedding: vi.fn((obj) => { if (obj) { delete obj.embedding; delete obj.embedding_b64; } }),
  }));
  ```

**Step 2: Run Tests (Red — confirm baseline)**
- Command: `npx vitest run tests/graph/graph.test.js`
- Expect: May fail if tests reference `maybeRoundEmbedding` mock — that's expected

**Step 3: Implementation (Green)**
- File: `src/graph/graph.js`
- Actions:
  1. Replace import: `import { getDocumentEmbedding, maybeRoundEmbedding } from '../embeddings.js';` → `import { getDocumentEmbedding } from '../embeddings.js';`
  2. Add import: `import { getEmbedding, setEmbedding, hasEmbedding } from '../utils/embedding-codec.js';`
  3. Line 295 (`!node.embedding`): → `!hasEmbedding(node)`
  4. Line 304 (`cosineSimilarity(newEmbedding, node.embedding)`): → `cosineSimilarity(newEmbedding, getEmbedding(node))`
  5. Line 329 (`graphData.nodes[key].embedding = maybeRoundEmbedding(newEmbedding)`): → `setEmbedding(graphData.nodes[key], newEmbedding)`
  6. Line 407 (`!node.embedding`): → `!hasEmbedding(node)`
  7. Line 409 (`node.embedding = maybeRoundEmbedding(...)`): → `setEmbedding(node, ...embed result...)` — need to capture the result then call `setEmbedding`
  8. Line 412 (`if (node.embedding)`): → `if (hasEmbedding(node))`
  9. Line 422 (`!node.embedding`): → `!hasEmbedding(node)`
  10. Line 450 (`cosineSimilarity(nodeA.embedding, nodeB.embedding)`): → `cosineSimilarity(getEmbedding(nodeA), getEmbedding(nodeB))`

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/graph/graph.test.js`
- Expect: All tests PASS

**Step 5: Git Commit**
- `git add src/graph/graph.js tests/graph/graph.test.js && git commit -m "refactor: migrate graph.js to embedding codec"`

---

## Task 4: Migrate communities.js Write Sites

**Goal:** Replace `maybeRoundEmbedding` in `communities.js` with `setEmbedding`.

**Step 1: Update Test Mocks**
- File: `tests/graph/communities.test.js`
- Action: Remove `maybeRoundEmbedding` from the `vi.mock('../../src/embeddings.js', ...)` block (~line 174). Add mock for embedding-codec:
  ```js
  vi.mock('../../src/utils/embedding-codec.js', () => ({
      getEmbedding: vi.fn((obj) => obj?.embedding_b64 ? [0.1] : obj?.embedding || null),
      setEmbedding: vi.fn((obj, vec) => { obj.embedding_b64 = 'mock_b64'; delete obj.embedding; }),
      hasEmbedding: vi.fn((obj) => !!(obj?.embedding_b64 || (obj?.embedding && obj.embedding.length > 0))),
      deleteEmbedding: vi.fn((obj) => { if (obj) { delete obj.embedding; delete obj.embedding_b64; } }),
  }));
  ```

**Step 2: Run Tests (Red)**
- Command: `npx vitest run tests/graph/communities.test.js`
- Expect: May fail due to removed mock

**Step 3: Implementation (Green)**
- File: `src/graph/communities.js`
- Actions:
  1. Replace import: `import { getQueryEmbedding, maybeRoundEmbedding } from '../embeddings.js';` → `import { getQueryEmbedding } from '../embeddings.js';`
  2. Add import: `import { setEmbedding } from '../utils/embedding-codec.js';`
  3. Line 239 (`embedding: maybeRoundEmbedding(embedding) || []`): → Refactor to use `setEmbedding`. Since this is inside an object literal for community creation, change to first create the community object, then call `setEmbedding(community, embedding)` if embedding exists. Or set inline: build the object without embedding, then `if (embedding) setEmbedding(community, embedding);`

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/graph/communities.test.js`
- Expect: All tests PASS

**Step 5: Git Commit**
- `git add src/graph/communities.js tests/graph/communities.test.js && git commit -m "refactor: migrate communities.js to embedding codec"`

---

## Task 5: Migrate reflect.js Read + Check Sites

**Goal:** Replace all `.embedding` reads and checks in `reflect.js` with codec functions.

**Step 1: Write the Failing Test**
- File: `tests/reflection/reflect.test.js` — check existing tests pass first
- Command: `npx vitest run tests/reflection/reflect.test.js` (baseline)

**Step 2: Implementation**
- File: `src/reflection/reflect.js`
- Actions:
  1. Add import: `import { getEmbedding, hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 87 (`m.type === 'reflection' && m.embedding`): → `m.type === 'reflection' && hasEmbedding(m)`
  3. Line 92 (`!ref.embedding`): → `!hasEmbedding(ref)`
  4. Line 102 (`cosineSimilarity(ref.embedding, existing.embedding)`): → `cosineSimilarity(getEmbedding(ref), getEmbedding(existing))`
  5. Line 150 (`.filter((m) => m.embedding)`): → `.filter((m) => hasEmbedding(m))`
  6. Line 162 (`!reflection.embedding`): → `!hasEmbedding(reflection)`
  7. Line 163 (`cosineSimilarity(recent.embedding, reflection.embedding)`): → `cosineSimilarity(getEmbedding(recent), getEmbedding(reflection))`
  8. Line 257 (`.filter((m) => m.embedding)`): → `.filter((m) => hasEmbedding(m))`
  9. Line 258 (`cosineSimilarity(queryEmb, m.embedding)`): → `cosineSimilarity(queryEmb, getEmbedding(m))`

**Step 3: Verify**
- Command: `npx vitest run tests/reflection/reflect.test.js`
- Expect: All tests PASS

**Step 4: Git Commit**
- `git add src/reflection/reflect.js && git commit -m "refactor: migrate reflect.js to embedding codec"`

---

## Task 6: Migrate extract.js Read + Check Sites

**Goal:** Replace `.embedding` accesses in `filterSimilarEvents` with codec functions.

**Step 1: Baseline**
- Command: `npx vitest run tests/extraction/extract.test.js` (confirm passing)

**Step 2: Implementation**
- File: `src/extraction/extract.js`
- Actions:
  1. Add import: `import { getEmbedding, hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 253 (`!event.embedding`): → `!hasEmbedding(event)`
  3. Line 259 (`!memory.embedding`): → `!hasEmbedding(memory)`
  4. Line 260 (`cosineSimilarity(event.embedding, memory.embedding)`): → `cosineSimilarity(getEmbedding(event), getEmbedding(memory))`

**Step 3: Verify**
- Command: `npx vitest run tests/extraction/extract.test.js`
- Expect: All tests PASS

**Step 4: Git Commit**
- `git add src/extraction/extract.js && git commit -m "refactor: migrate extract.js to embedding codec"`

---

## Task 7: Migrate retrieval + world-context Read Sites

**Goal:** Replace `.embedding` accesses in `math.js` and `world-context.js`.

**Step 1: Baseline**
- Command: `npx vitest run tests/math.test.js tests/retrieval/world-context.test.js`

**Step 2: Implementation**
- File: `src/retrieval/math.js`
  1. Add import: `import { getEmbedding, hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 198 (`contextEmbedding && memory.embedding`): → `contextEmbedding && hasEmbedding(memory)`
  3. Line 199 (`cosineSimilarity(contextEmbedding, memory.embedding)`): → `cosineSimilarity(contextEmbedding, getEmbedding(memory))`

- File: `src/retrieval/world-context.js`
  1. Add import: `import { getEmbedding, hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 25 (`!community.embedding || community.embedding.length === 0`): → `!hasEmbedding(community)`
  3. Line 26 (`cosineSimilarity(queryEmbedding, community.embedding)`): → `cosineSimilarity(queryEmbedding, getEmbedding(community))`

**Step 3: Verify**
- Command: `npx vitest run tests/math.test.js tests/retrieval/world-context.test.js`
- Expect: All tests PASS

**Step 4: Git Commit**
- `git add src/retrieval/math.js src/retrieval/world-context.js && git commit -m "refactor: migrate retrieval math + world-context to embedding codec"`

---

## Task 8: Migrate UI Check Sites (render, settings, status, templates)

**Goal:** Replace `.embedding` presence checks in UI modules.

**Step 1: Implementation**
- File: `src/ui/render.js`
  1. Add import: `import { hasEmbedding, setEmbedding } from '../utils/embedding-codec.js';`
  2. Line 131 (`!memory.embedding && isEmbeddingsEnabled()`): → `!hasEmbedding(memory) && isEmbeddingsEnabled()`
  3. Line 134 (`memory.embedding = embedding`): → `setEmbedding(memory, embedding)`

- File: `src/ui/settings.js`
  1. Add import: `import { hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 332 (`!m.embedding`): → `!hasEmbedding(m)`

- File: `src/ui/status.js`
  1. Add import: `import { hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 111 (`m.embedding?.length > 0`): → `hasEmbedding(m)`

- File: `src/ui/templates.js`
  1. Add import: `import { hasEmbedding } from '../utils/embedding-codec.js';`
  2. Line 33 (`!memory.embedding`): → `!hasEmbedding(memory)`

**Step 2: Verify**
- Command: `npx vitest run tests/ui-templates.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/ui/render.js src/ui/settings.js src/ui/status.js src/ui/templates.js && git commit -m "refactor: migrate UI modules to embedding codec"`

---

## Task 9: Migrate data.js Delete Sites + export-debug.js

**Goal:** Replace `delete memory.embedding` with `deleteEmbedding()`.

**Step 1: Implementation**
- File: `src/utils/data.js`
  1. Add import: `import { deleteEmbedding, hasEmbedding } from './embedding-codec.js';`
  2. Line 105 (`delete memory.embedding`): → `deleteEmbedding(memory)`
  3. Lines 167-168 (`if (memory.embedding) { delete memory.embedding }`): → `if (hasEmbedding(memory)) { deleteEmbedding(memory) }`

- File: `src/ui/export-debug.js`
  1. Add import: `import { deleteEmbedding } from '../utils/embedding-codec.js';`
  2. Line 94 (`delete clone.embedding`): → `deleteEmbedding(clone)`

**Step 2: Verify**
- Command: `npx vitest run tests/utils/data.test.js tests/ui/export-debug.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/utils/data.js src/ui/export-debug.js && git commit -m "refactor: migrate data.js + export-debug to embedding codec"`

---

## Task 10: Remove embeddingRounding Setting + UI

**Goal:** Delete the setting default, UI binding, UI checkbox, and doc references.

**Step 1: Implementation**
- File: `src/constants.js` — delete line 47 (`embeddingRounding: false,`)
- File: `src/ui/settings.js` — delete line 477 (`bindSetting('embedding_rounding', 'embeddingRounding', 'bool');`)
- File: `src/ui/settings.js` — delete line 664 (`$('#openvault_embedding_rounding').prop('checked', settings.embeddingRounding);`)
- File: `templates/settings_panel.html` — delete lines 136-140 (the `<label>`, `<input>`, `<span>`, `</label>`, and `<small>` hint for rounding)
- File: `src/graph/CLAUDE.md` — delete line 26 or update to say embeddings use Base64 codec

**Step 2: Verify**
- Command: `npx vitest run`
- Expect: Full suite PASS, no references to `embeddingRounding` or `maybeRoundEmbedding` remain

**Step 3: Verify Complete Removal**
- Command: `grep -rn "maybeRoundEmbedding\|embeddingRounding\|embedding_rounding" src/ templates/ tests/`
- Expect: Zero results

**Step 4: Git Commit**
- `git add -A && git commit -m "chore: remove embeddingRounding setting and UI (replaced by Base64 codec)"`

---

## Task 11: Convert Token Cache to In-Memory LRU

**Goal:** Replace persisted `data.message_tokens` with a module-scoped LRU Map. Remove `pruneTokenCache`. Drop `data` param from `getMessageTokenCount` and `getTokenSum`.

**Step 1: Rewrite Token Tests**
- File: `tests/utils/tokens.test.js`
- Replace the `getMessageTokenCount` and `getTokenSum` describe blocks (keep `snapToTurnBoundary` unchanged):
  ```js
  import { beforeEach, describe, expect, it } from 'vitest';

  describe('getMessageTokenCount', () => {
      beforeEach(async () => {
          const { clearTokenCache } = await import('../../src/utils/tokens.js');
          clearTokenCache();
      });

      it('computes token count for a message', async () => {
          const { getMessageTokenCount } = await import('../../src/utils/tokens.js');
          const chat = [{ mes: 'Hello, how are you today?', is_user: true }];
          const count = getMessageTokenCount(chat, 0);
          expect(count).toBeGreaterThan(0);
          expect(Number.isInteger(count)).toBe(true);
      });

      it('returns cached count on second call', async () => {
          const { getMessageTokenCount } = await import('../../src/utils/tokens.js');
          const chat = [{ mes: 'Test message for caching', is_user: true }];
          const count1 = getMessageTokenCount(chat, 0);
          const count2 = getMessageTokenCount(chat, 0);
          expect(count1).toBe(count2);
      });

      it('handles empty or missing message text', async () => {
          const { getMessageTokenCount } = await import('../../src/utils/tokens.js');
          const chat = [{ mes: '', is_user: true }, { is_user: false }];
          expect(getMessageTokenCount(chat, 0)).toBe(0);
          expect(getMessageTokenCount(chat, 1)).toBe(0);
      });
  });

  describe('getTokenSum', () => {
      beforeEach(async () => {
          const { clearTokenCache } = await import('../../src/utils/tokens.js');
          clearTokenCache();
      });

      it('sums token counts for specified indices', async () => {
          const { getTokenSum } = await import('../../src/utils/tokens.js');
          const chat = [
              { mes: 'Hello world', is_user: true },
              { mes: 'How are you doing today?', is_user: false },
              { mes: 'Great thanks', is_user: true },
          ];
          const total = getTokenSum(chat, [0, 1, 2]);
          expect(total).toBeGreaterThan(0);
          expect(Number.isInteger(total)).toBe(true);
      });

      it('returns 0 for empty index list', async () => {
          const { getTokenSum } = await import('../../src/utils/tokens.js');
          expect(getTokenSum([], [])).toBe(0);
      });
  });

  describe('clearTokenCache', () => {
      it('clears the cache so counts are recomputed', async () => {
          const { getMessageTokenCount, clearTokenCache } = await import('../../src/utils/tokens.js');
          const chat = [{ mes: 'Cached message', is_user: true }];
          getMessageTokenCount(chat, 0);
          clearTokenCache();
          // After clear, should recompute (same result, but from scratch)
          const count = getMessageTokenCount(chat, 0);
          expect(count).toBeGreaterThan(0);
      });
  });

  // Keep snapToTurnBoundary tests unchanged below
  ```

**Step 2: Run Tests (Red)**
- Command: `npx vitest run tests/utils/tokens.test.js`
- Expect: Fail — signature mismatch (3 args vs 2) or `clearTokenCache` not found

**Step 3: Implementation (Green)**
- File: `src/utils/tokens.js`
- Full rewrite of token cache logic:
  ```js
  import { countTokens as _countTokens } from 'https://esm.sh/gpt-tokenizer/encoding/o200k_base';

  const MAX_CACHE_SIZE = 2000;
  const tokenCache = new Map();

  export function countTokens(text) {
      return (text || '').length === 0 ? 0 : _countTokens(text);
  }

  /**
   * Clear the token cache. Call on CHAT_CHANGED.
   */
  export function clearTokenCache() {
      tokenCache.clear();
  }

  /**
   * Get token count for a single message. Uses in-memory LRU cache.
   * @param {Object[]} chat - Chat array
   * @param {number} index - Message index
   * @returns {number} Token count
   */
  export function getMessageTokenCount(chat, index) {
      const text = chat[index]?.mes || '';
      const key = `${index}_${text.length}`;

      if (tokenCache.has(key)) {
          const value = tokenCache.get(key);
          tokenCache.delete(key);
          tokenCache.set(key, value);
          return value;
      }

      const count = text.length === 0 ? 0 : _countTokens(text);

      if (tokenCache.size >= MAX_CACHE_SIZE) {
          const oldest = tokenCache.keys().next().value;
          tokenCache.delete(oldest);
      }
      tokenCache.set(key, count);
      return count;
  }

  /**
   * Sum token counts for a list of message indices.
   * @param {Object[]} chat - Chat array
   * @param {number[]} indices - Message indices
   * @returns {number} Total tokens
   */
  export function getTokenSum(chat, indices) {
      let total = 0;
      for (const i of indices) {
          total += getMessageTokenCount(chat, i);
      }
      return total;
  }

  // snapToTurnBoundary stays unchanged
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/utils/tokens.test.js`
- Expect: All tests PASS

**Step 5: Git Commit**
- `git add src/utils/tokens.js tests/utils/tokens.test.js && git commit -m "feat: replace persisted token cache with in-memory LRU (2000 entries)"`

---

## Task 12: Update All Token Function Callers (Drop `data` Param)

**Goal:** Remove the `data` argument from every call to `getMessageTokenCount` and `getTokenSum` across the codebase. Remove `pruneTokenCache` import/call. Add legacy cleanup.

**Step 1: Implementation**
- File: `src/extraction/scheduler.js`
  - Line 60: `getTokenSum(chat, unextractedIds, data)` → `getTokenSum(chat, unextractedIds)`
  - Line 74: `getTokenSum(chat, unextractedIds, data)` → `getTokenSum(chat, unextractedIds)`
  - Line 85: `getMessageTokenCount(chat, id, data)` → `getMessageTokenCount(chat, id)`
  - Line 124: `getTokenSum(chat, unextractedIds, data)` → `getTokenSum(chat, unextractedIds)`
  - Line 143: `getTokenSum(chat, allUnextracted, data)` → `getTokenSum(chat, allUnextracted)`
  - Line 155: `getMessageTokenCount(chat, id, data)` → `getMessageTokenCount(chat, id)`
  - Line 168: `getMessageTokenCount(chat, removed, data)` → `getMessageTokenCount(chat, removed)`
  - Remove `data` parameter from functions that only passed it through to token functions (check each function signature)

- File: `src/extraction/extract.js`
  - Line 359: `getMessageTokenCount(chat, candidates[i].id, data)` → `getMessageTokenCount(chat, candidates[i].id)`

- File: `src/events.js`
  - Line 36: Remove `getMessageTokenCount` and `getTokenSum` destructuring if they gain separate import
  - Line 56: `getTokenSum(chat, visibleIndices, data)` → `getTokenSum(chat, visibleIndices)`
  - Line 73: `getMessageTokenCount(chat, idx, data)` → `getMessageTokenCount(chat, idx)`
  - Lines 187-200: Remove `pruneTokenCache` import and call block entirely. Replace with `clearTokenCache` import and call:
    ```js
    const { clearTokenCache } = await import('./utils/tokens.js');
    // ... in the handler:
    clearTokenCache();
    ```

- File: `src/ui/settings.js`
  - Line 824: `getTokenSum(chat, unextractedIds, data)` → `getTokenSum(chat, unextractedIds)`
  - Line 839: `getTokenSum(chat, visibleIndices, data)` → `getTokenSum(chat, visibleIndices)`

- File: `src/ui/status.js`
  - Line 135: `getTokenSum(chat, unextractedIds, data)` → `getTokenSum(chat, unextractedIds)`

- File: `src/utils/data.js` — add legacy cleanup in `getOpenVaultData()`:
  ```js
  // After the data initialization block, add:
  if (data.message_tokens) {
      delete data.message_tokens;
  }
  ```

**Step 2: Verify**
- Command: `npx vitest run`
- Expect: Full suite PASS

**Step 3: Verify No Stale References**
- Command: `grep -rn "pruneTokenCache\|message_tokens" src/ --include="*.js" | grep -v "delete data.message_tokens"`
- Expect: Zero results (only the legacy cleanup line in data.js)

**Step 4: Git Commit**
- `git add -A && git commit -m "refactor: drop data param from token functions, remove pruneTokenCache, add legacy cleanup"`

---

## Task 13: Update CLAUDE.md + Architecture Docs

**Goal:** Update documentation to reflect the new storage format.

**Step 1: Implementation**
- File: `src/graph/CLAUDE.md` — replace the embedding rounding note with:
  > **Embedding Storage**: Embeddings are stored as Base64-encoded `Float32Array` strings (`embedding_b64`) via the codec in `src/utils/embedding-codec.js`. Legacy `number[]` format (`embedding`) is read transparently but never written.

- File: `include/ARCHITECTURE.md` — update the data schema section:
  - Change `embedding: number[]` to `embedding_b64: string` in memories, graph nodes, and communities
  - Remove `message_tokens` from the schema
  - Add note under Embeddings section: "Stored as Base64 Float32Array. Legacy JSON arrays read transparently (lazy migration)."

- File: `src/utils/CLAUDE.md` — add note about the embedding codec module if the file exists

**Step 2: Git Commit**
- `git add -A && git commit -m "docs: update architecture and CLAUDE.md for Base64 embeddings + LRU token cache"`

---

## Task 14: Full Suite Verification

**Goal:** Run the complete test suite to confirm nothing is broken.

**Step 1: Run Full Suite**
- Command: `npx vitest run`
- Expect: All tests PASS

**Step 2: Grep for Stale References**
- Command: `grep -rn "maybeRoundEmbedding\|embeddingRounding\|embedding_rounding" src/ templates/ tests/`
- Expect: Zero results
- Command: `grep -rn "pruneTokenCache" src/ tests/`
- Expect: Zero results
- Command: `grep -rn "\.embedding[^_]" src/ --include="*.js" | grep -v "embedding_b64\|embedding-codec\|getEmbedding\|setEmbedding\|hasEmbedding\|deleteEmbedding\|getDocumentEmbedding\|getQueryEmbedding\|enrichEvents\|generateEmbeddings\|isEmbeddings\|clearEmbedding\|setEmbedding\|embeddingSource\|embeddingModel\|embeddingQuery\|embeddingDoc\|EmbeddingStrategy\|embedding_b64"`
- Expect: Zero results from production code (only comments/strings acceptable)

**Step 3: Git Commit (if any fixups needed)**
- `git add -A && git commit -m "fix: address remaining stale embedding references"`
