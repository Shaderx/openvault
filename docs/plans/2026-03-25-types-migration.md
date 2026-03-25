# Types Migration: Remove Deprecated types.js

**Goal:** Migrate all imports from `types.js` to `types.d.ts`, then delete the deprecated file.
**Architecture:** Mechanical find-replace of import paths, no logic changes.
**Prerequisite:** Type generation infrastructure already complete (`scripts/generate-types.js`, `src/store/schemas.js`, `src/types.d.ts`).

---

## Files to Modify

All 14 files with `@typedef {import('.../types.js')...}` imports:

| File | Types Count |
|------|-------------|
| `src/extraction/extract.js` | 10 |
| `src/graph/graph.js` | 5 |
| `src/store/chat-data.js` | 3 |
| `src/retrieval/scoring.js` | 7 |
| `src/retrieval/math.js` | 6 |
| `src/llm.js` | 3 |
| `src/services/st-vector.js` | 2 |
| `src/reflection/reflect.js` | 1 |
| `src/utils/cdn.js` | 1 |
| `src/utils/queue.js` | 1 |
| `src/prompts/events/builder.js` | 3 |
| `src/prompts/graph/builder.js` | 4 |
| `src/prompts/reflection/builder.js` | 3 |
| `src/prompts/communities/builder.js` | 3 |

---

## Task 1: Migrate extraction/extract.js

**Files:**
- Modify: `src/extraction/extract.js`

- [ ] Step 1: Update all import paths

Find all `@typedef {import('../types.js')...` and change to `@typedef {import('../types.d.ts')...`:

```javascript
// Before
/** @typedef {import('../types.js').Memory} Memory */
/** @typedef {import('../types.js').Entity} Entity */
// ... etc

// After
/** @typedef {import('../types.d.ts').Memory} Memory */
/** @typedef {import('../types.d.ts').Entity} Entity */
// ... etc
```

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate extract.js to types.d.ts"
```

---

## Task 2: Migrate graph/graph.js

**Files:**
- Modify: `src/graph/graph.js`

- [ ] Step 1: Update import paths

```javascript
// Change types.js → types.d.ts in all @typedef imports
```

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate graph.js to types.d.ts"
```

---

## Task 3: Migrate store/chat-data.js

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate chat-data.js to types.d.ts"
```

---

## Task 4: Migrate retrieval/scoring.js

**Files:**
- Modify: `src/retrieval/scoring.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate scoring.js to types.d.ts"
```

---

## Task 5: Migrate retrieval/math.js

**Files:**
- Modify: `src/retrieval/math.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate math.js to types.d.ts"
```

---

## Task 6: Migrate llm.js

**Files:**
- Modify: `src/llm.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate llm.js to types.d.ts"
```

---

## Task 7: Migrate services/st-vector.js

**Files:**
- Modify: `src/services/st-vector.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate st-vector.js to types.d.ts"
```

---

## Task 8: Migrate reflection/reflect.js

**Files:**
- Modify: `src/reflection/reflect.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate reflect.js to types.d.ts"
```

---

## Task 9: Migrate utils/cdn.js

**Files:**
- Modify: `src/utils/cdn.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate cdn.js to types.d.ts"
```

---

## Task 10: Migrate utils/queue.js

**Files:**
- Modify: `src/utils/queue.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate queue.js to types.d.ts"
```

---

## Task 11: Migrate prompts/events/builder.js

**Files:**
- Modify: `src/prompts/events/builder.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate events/builder.js to types.d.ts"
```

---

## Task 12: Migrate prompts/graph/builder.js

**Files:**
- Modify: `src/prompts/graph/builder.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate graph/builder.js to types.d.ts"
```

---

## Task 13: Migrate prompts/reflection/builder.js

**Files:**
- Modify: `src/prompts/reflection/builder.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate reflection/builder.js to types.d.ts"
```

---

## Task 14: Migrate prompts/communities/builder.js

**Files:**
- Modify: `src/prompts/communities/builder.js`

- [ ] Step 1: Update import paths

- [ ] Step 2: Run tests

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "refactor(types): migrate communities/builder.js to types.d.ts"
```

---

## Task 15: Delete deprecated types.js

**Files:**
- Delete: `src/types.js`

- [ ] Step 1: Verify no remaining imports

```bash
grep -r "types.js" src/ --include="*.js"
```

Expected: No matches (or only comments)

- [ ] Step 2: Delete the file

```bash
rm src/types.js
```

- [ ] Step 3: Run final verification

```bash
npm run typecheck && npm test
```

Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "refactor(types): remove deprecated types.js"
```

---

## Task 16: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] Step 1: Remove reference to deprecated types.js

Update the "Type System" section to remove `src/types.js - DEPRECATED` line since it's now deleted.

- [ ] Step 2: Commit

```bash
git add -A && git commit -m "docs: remove types.js reference from CLAUDE.md"
```

---

## Task 17: Final Verification & Fixes

**Files:**
- None (verification only)

- [ ] Step 1: Run typecheck

```bash
npm run typecheck
```

Expected: No errors

- [ ] Step 2: Run biome lint

```bash
npm run lint
```

Expected: No errors

- [ ] Step 3: Fix any issues if found

If biome or typecheck reports errors, fix them and re-run.

- [ ] Step 4: Run full test suite

```bash
npm test
```

Expected: All pass

- [ ] Step 5: Commit any fixes

```bash
git add -A && git commit -m "fix: resolve lint/typecheck issues after types migration"
```

---

## Success Criteria

- All 14 files migrated to `types.d.ts`
- `src/types.js` deleted
- `npm run typecheck` passes
- `npm run lint` passes
- `npm test` passes
- No remaining `types.js` imports in codebase