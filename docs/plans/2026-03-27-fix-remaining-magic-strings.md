# Fix Remaining Magic Strings — Implementation Plan

**Goal:** Replace the last 6 hardcoded string literals and 1 magic number with constants from `src/constants.js`.
**Architecture:** Pure substitution refactoring — no behavior changes. Every replacement produces the same runtime value as the original literal. Existing tests serve as the verification gate.
**Tech Stack:** ESM JavaScript, Vitest, Biome

---

**Common Pitfalls:**
- `EMBEDDING_SOURCES.OLLAMA` and `ENTITY_TYPES.OBJECT` are frozen-object property accesses — no quotes, no strings.
- `migration.js` currently only imports `MEMORIES_KEY` from `constants.js` — must add `EMBEDDING_SOURCES` to that import.
- `structured.js` currently has no import from `constants.js` — must add a new import line.
- `graph.js` already imports both `ENTITY_TYPES` and `GRAPH_JACCARD_DUPLICATE_THRESHOLD` — no import changes needed.
- `embeddings.js` already imports `EMBEDDING_SOURCES` — no import changes needed.
- The `0.6` in `shouldMergeEntities` is passed as an explicit argument (overriding the `ENTITY_TOKEN_OVERLAP_MIN_RATIO` default of `0.5`). It is not the same semantic constant — it's an entity-merge-specific overlap floor. We reuse `GRAPH_JACCARD_DUPLICATE_THRESHOLD` (also `0.6`) because they share the same threshold intent: Jaccard-based duplicate detection.

---

### File Structure Overview

- Modify: `src/embeddings.js` — replace 2 hardcoded embedding source strings
- Modify: `src/embeddings/migration.js` — add `EMBEDDING_SOURCES` import, replace 4 hardcoded `'st_vector'` strings
- Modify: `src/graph/graph.js` — replace `'OBJECT'` default param and hardcoded `0.6`
- Modify: `src/extraction/structured.js` — add `ENTITY_TYPES` import, replace `.catch('OBJECT')`

---

### Task 1: Fix OllamaStrategy.getId() and strategies map key in embeddings.js

**Files:**
- Modify: `src/embeddings.js`
- Test: `npm run test` (existing suite)

- [ ] Step 1: Replace `OllamaStrategy.getId()` return value

In `src/embeddings.js`, find the `OllamaStrategy.getId()` method (line ~372):

```js
// BEFORE:
getId() {
    return 'ollama';
}

// AFTER:
getId() {
    return EMBEDDING_SOURCES.OLLAMA;
}
```

No import change needed — `EMBEDDING_SOURCES` is already imported on line 1.

- [ ] Step 2: Replace bare key `ollama:` in strategies map with computed key

In the `strategies` constant (line ~533):

```js
// BEFORE:
const strategies = {
    'multilingual-e5-small': new TransformersStrategy(),
    'bge-small-en-v1.5': new TransformersStrategy(),
    'embeddinggemma-300m': new TransformersStrategy(),
    ollama: new OllamaStrategy(),
    [EMBEDDING_SOURCES.ST_VECTOR]: new StVectorStrategy(),
};

// AFTER:
const strategies = {
    'multilingual-e5-small': new TransformersStrategy(),
    'bge-small-en-v1.5': new TransformersStrategy(),
    'embeddinggemma-300m': new TransformersStrategy(),
    [EMBEDDING_SOURCES.OLLAMA]: new OllamaStrategy(),
    [EMBEDDING_SOURCES.ST_VECTOR]: new StVectorStrategy(),
};
```

- [ ] Step 3: Run tests

Run: `npm run test`
Expected: All tests PASS (same runtime values, no behavior change).

- [ ] Step 4: Commit

```bash
git add src/embeddings.js && git commit -m "refactor(embeddings): use EMBEDDING_SOURCES.OLLAMA in OllamaStrategy and strategies map"
```

---

### Task 2: Fix hardcoded 'st_vector' in embeddings/migration.js

**Files:**
- Modify: `src/embeddings/migration.js`
- Test: `npm run test` (existing suite)

- [ ] Step 1: Add `EMBEDDING_SOURCES` to import from constants.js

In `src/embeddings/migration.js`, line 1:

```js
// BEFORE:
import { MEMORIES_KEY } from '../constants.js';

// AFTER:
import { EMBEDDING_SOURCES, MEMORIES_KEY } from '../constants.js';
```

- [ ] Step 2: Replace 4 occurrences of `'st_vector'` in `invalidateStaleEmbeddings()`

In the `invalidateStaleEmbeddings` function (lines 133, 143, 199, 208):

```js
// BEFORE (line 133):
if (currentModelId === 'st_vector') {

// AFTER:
if (currentModelId === EMBEDDING_SOURCES.ST_VECTOR) {
```

```js
// BEFORE (line 143):
if (currentModelId === 'st_vector' && _hasStVectorMismatch(data)) {

// AFTER:
if (currentModelId === EMBEDDING_SOURCES.ST_VECTOR && _hasStVectorMismatch(data)) {
```

```js
// BEFORE (line 199):
if (oldModel === 'st_vector') {

// AFTER:
if (oldModel === EMBEDDING_SOURCES.ST_VECTOR) {
```

```js
// BEFORE (line 208):
if (currentModelId === 'st_vector') {

// AFTER:
if (currentModelId === EMBEDDING_SOURCES.ST_VECTOR) {
```

- [ ] Step 3: Run tests

Run: `npm run test`
Expected: All tests PASS.

- [ ] Step 4: Commit

```bash
git add src/embeddings/migration.js && git commit -m "refactor(migration): use EMBEDDING_SOURCES.ST_VECTOR instead of hardcoded string"
```

---

### Task 3: Fix 'OBJECT' default param and magic number 0.6 in graph.js

**Files:**
- Modify: `src/graph/graph.js`
- Test: `npm run test` (existing suite)

- [ ] Step 1: Replace `'OBJECT'` default parameter in `shouldMergeEntities()`

In `src/graph/graph.js`, the `shouldMergeEntities` function (line ~379):

```js
// BEFORE:
function shouldMergeEntities(cosine, threshold, tokensA, keyA, keyB, type = 'OBJECT') {

// AFTER:
function shouldMergeEntities(cosine, threshold, tokensA, keyA, keyB, type = ENTITY_TYPES.OBJECT) {
```

No import change needed — `ENTITY_TYPES` is already imported.

- [ ] Step 2: Replace hardcoded `0.6` with `GRAPH_JACCARD_DUPLICATE_THRESHOLD`

In the same function (line ~388):

```js
// BEFORE:
    return hasSufficientTokenOverlap(tokensA, tokensB, 0.6, keyA, keyB);

// AFTER:
    return hasSufficientTokenOverlap(tokensA, tokensB, GRAPH_JACCARD_DUPLICATE_THRESHOLD, keyA, keyB);
```

No import change needed — `GRAPH_JACCARD_DUPLICATE_THRESHOLD` is already imported.

- [ ] Step 3: Run tests

Run: `npm run test`
Expected: All tests PASS.

- [ ] Step 4: Commit

```bash
git add src/graph/graph.js && git commit -m "refactor(graph): use ENTITY_TYPES.OBJECT and GRAPH_JACCARD_DUPLICATE_THRESHOLD in shouldMergeEntities"
```

---

### Task 4: Fix .catch('OBJECT') in structured.js EntitySchema

**Files:**
- Modify: `src/extraction/structured.js`
- Test: `npm run test` (existing suite)

- [ ] Step 1: Add `ENTITY_TYPES` import

In `src/extraction/structured.js`, after the existing imports (after line 8):

```js
// ADD this line after the existing imports:
import { ENTITY_TYPES } from '../constants.js';
```

- [ ] Step 2: Replace `.catch('OBJECT')` in EntitySchema

In the `EntitySchema` constant (line ~30):

```js
// BEFORE:
const EntitySchema = z.object({
    name: BaseEntitySchema.shape.name.catch('Unknown').describe('Entity name, capitalized'),
    type: BaseEntitySchema.shape.type.catch('OBJECT'),
    description: BaseEntitySchema.shape.description
        .catch('No description available')
        .describe('Comprehensive description of the entity'),
});

// AFTER:
const EntitySchema = z.object({
    name: BaseEntitySchema.shape.name.catch('Unknown').describe('Entity name, capitalized'),
    type: BaseEntitySchema.shape.type.catch(ENTITY_TYPES.OBJECT),
    description: BaseEntitySchema.shape.description
        .catch('No description available')
        .describe('Comprehensive description of the entity'),
});
```

- [ ] Step 3: Run tests

Run: `npm run test`
Expected: All tests PASS.

- [ ] Step 4: Commit

```bash
git add src/extraction/structured.js && git commit -m "refactor(structured): use ENTITY_TYPES.OBJECT in EntitySchema catch fallback"
```

---

### Task 5: Final verification and formatting

- [ ] Step 1: Run full test suite one more time

Run: `npm run test`
Expected: All tests PASS, no failures, no skipped tests that were previously passing.

- [ ] Step 2: Run Biome lint/format

Run: `npx biome check --write src/`
Expected: No errors. Any formatting changes are auto-applied.

- [ ] Step 3: Commit any Biome formatting changes

```bash
git add -A && git commit -m "chore: apply biome formatting after magic string fixes"
```
