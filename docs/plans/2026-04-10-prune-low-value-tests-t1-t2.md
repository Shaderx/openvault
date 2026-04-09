# Prune Low-Value Tests (T1 + T2)

**Goal:** Remove ~67 tests that provide zero or near-zero regression protection, reducing test count by ~6% and noise in test output.
**Baseline:** 56 files, 1,093 tests, 905 KB (tests/ directory)
**Approach:** Deletion-only. No new code. Run full suite after each task to verify nothing breaks.

---

### Task 1: Delete `tests/integration/emergency-cut.test.js`

**Rationale:** All 7 tests check `typeof export === 'function'`. TypeScript already catches missing exports.

- [ ] Step 1: Delete the file

```bash
rm tests/integration/emergency-cut.test.js
```

- [ ] Step 2: Run full suite to confirm no breakage

Run: `npx vitest run`
Expected: All pass (file had zero integration with other tests)

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "chore: delete tautological export-check tests (emergency-cut)"
```

---

### Task 2: Delete `tests/prompts/formatters.test.js`

**Rationale:** All 6 tests verify `userName || "User"` fallback. Zero domain logic.

- [ ] Step 1: Delete the file

```bash
rm tests/prompts/formatters.test.js
```

- [ ] Step 2: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 3: Commit

```bash
git add -A && git commit -m "chore: delete trivial string-fallback tests (formatters)"
```

---

### Task 3: Gut `tests/store/schemas.test.js` — keep 4 tests, remove 16

**Rationale:** 85% of tests verify that Zod validates valid data and rejects invalid data. You're testing Zod, not domain constraints. Keep only tests that verify domain-specific constraints.

**Tests to KEEP (4):**
1. `should reject negative forgetfulnessBaseLambda`
2. `should reject vectorSimilarityThreshold >= 1.0` (ScoringConfigSchema)
3. `should reject alpha < 0`
4. `should reject alpha > 1`

**Tests to REMOVE (16):**
- `should validate a valid memory object`
- `should reject invalid importance values`
- `should validate a valid graph node`
- `should validate a valid graph edge`
- `should validate a valid entity without .catch fallbacks`
- `should reject empty name without fallback`
- `should validate a valid relationship without .catch fallbacks`
- `should validate events with temporal_anchor and is_transient`
- `should default temporal_anchor to null when omitted`
- `should default is_transient to false when omitted`
- `should allow updating temporal_anchor and is_transient`
- `should include transientDecayMultiplier`
- `should default transientDecayMultiplier when omitted`
- `should accept valid scoring config`
- `should reject vectorSimilarityThreshold >= 1.0` (ScoringSettingsSchema — duplicate constraint)
- `should accept valid scoring settings`

- [ ] Step 1: Rewrite file to keep only 4 domain constraint tests

Replace entire contents of `tests/store/schemas.test.js` with:

```javascript
// @ts-check
import { beforeAll, describe, expect, it } from 'vitest';

describe('schemas — domain constraints', () => {
    let schemas;

    beforeAll(async () => {
        schemas = await import('../../src/store/schemas.js');
    });

    describe('ScoringConfigSchema', () => {
        it('should reject negative forgetfulnessBaseLambda', () => {
            const result = schemas.ScoringConfigSchema.safeParse({
                forgetfulnessBaseLambda: -0.05,
                forgetfulnessImportance5Floor: 5,
                reflectionDecayThreshold: 750,
                reflectionLevelMultiplier: 2.0,
                vectorSimilarityThreshold: 0.5,
                alpha: 0.7,
                combinedBoostWeight: 15,
                embeddingSource: 'local',
            });
            expect(result.success).toBe(false);
        });

        it('should reject vectorSimilarityThreshold >= 1.0', () => {
            const result = schemas.ScoringConfigSchema.safeParse({
                forgetfulnessBaseLambda: 0.05,
                forgetfulnessImportance5Floor: 5,
                reflectionDecayThreshold: 750,
                reflectionLevelMultiplier: 2.0,
                vectorSimilarityThreshold: 1.0,
                alpha: 0.7,
                combinedBoostWeight: 15,
                embeddingSource: 'local',
            });
            expect(result.success).toBe(false);
        });

        it('should reject alpha < 0', () => {
            const result = schemas.ScoringConfigSchema.safeParse({
                forgetfulnessBaseLambda: 0.05,
                forgetfulnessImportance5Floor: 5,
                reflectionDecayThreshold: 750,
                reflectionLevelMultiplier: 2.0,
                vectorSimilarityThreshold: 0.5,
                alpha: -0.5,
                combinedBoostWeight: 15,
                embeddingSource: 'local',
            });
            expect(result.success).toBe(false);
        });

        it('should reject alpha > 1', () => {
            const result = schemas.ScoringConfigSchema.safeParse({
                forgetfulnessBaseLambda: 0.05,
                forgetfulnessImportance5Floor: 5,
                reflectionDecayThreshold: 750,
                reflectionLevelMultiplier: 2.0,
                vectorSimilarityThreshold: 0.5,
                alpha: 1.5,
                combinedBoostWeight: 15,
                embeddingSource: 'local',
            });
            expect(result.success).toBe(false);
        });
    });
});
```

- [ ] Step 2: Run file tests

Run: `npx vitest run tests/store/schemas.test.js`
Expected: 4 pass

- [ ] Step 3: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: prune Zod-validation tautologies from schemas tests (keep 4 domain constraints)"
```

---

### Task 4: Gut `tests/unit/settings.test.js` — keep 4 tests, remove 18

**Rationale:** 82% of tests verify that lodash's `get`/`set`/`merge` work. Keep only wiring checks proving the wrapper delegates correctly.

**Tests to KEEP (4):**
1. `should set nested value with dot notation` — proves wrapper calls lodash.set + triggers save
2. `should use setByPath fallback when lodash.set is unavailable` — proves fallback path works
3. `should return true for existing paths` (hasSettings) — proves wrapper delegates
4. `should return false for missing paths` (hasSettings) — proves wrapper delegates

**Tests to REMOVE (18):**
- `should return entire settings object when no path provided`
- `should get nested value with dot notation`
- `should return default value for missing paths`
- `should return default value when path is undefined`
- `should create intermediate objects when setting nested path`
- `should overwrite existing values`
- `should work with array notation` (setSetting)
- `should handle undefined path in getSettings`
- `should handle array notation in paths` (getSettings)
- `should handle deeply nested paths`
- `should return defaultValue for undefined settings object`
- `should use lodash.merge to combine defaults with existing`
- `should preserve existing settings while adding defaults`
- `should call lodash.merge with defaultSettings first`
- `should return true for existing paths` (deeply nested — duplicate coverage)
- `should work with deeply nested paths` (hasSettings — duplicate coverage)

- [ ] Step 1: Rewrite file to keep only 4 wiring tests

Replace entire contents of `tests/unit/settings.test.js` with:

```javascript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock lodash implementations
const lodashGet = (obj, path, defaultValue) => {
    const travel = (regexp) =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === null ? defaultValue : result;
};

const lodashSet = (obj, path, value) => {
    if (Object(obj) !== obj) return obj;
    const keys = String(path)
        .split(/[.[\]]+/)
        .filter(Boolean);
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const numKey = /^\d+$/.test(key) ? parseInt(key, 10) : key;
        if (!(numKey in current)) {
            current[numKey] = /^\d+$/.test(keys[i + 1]) ? [] : {};
        }
        current = current[numKey];
    }
    const lastKey = keys[keys.length - 1];
    const numLastKey = /^\d+$/.test(lastKey) ? parseInt(lastKey, 10) : lastKey;
    current[numLastKey] = value;
    return obj;
};

const lodashHas = (obj, path) => {
    const travel = (regexp) =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result !== undefined && result !== null;
};

const lodashMerge = (target, source) => {
    const result = { ...target };
    for (const key in source) {
        if (Object.hasOwn(source, key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = lodashMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
};

describe('Centralized Settings Module — wiring checks', () => {
    let mockExtensionSettings;
    let mockLodash;
    let mockSaveSettingsDebounced;

    beforeEach(async () => {
        vi.resetModules();

        mockSaveSettingsDebounced = vi.fn();

        mockLodash = {
            get: vi.fn(lodashGet),
            set: vi.fn(lodashSet),
            has: vi.fn(lodashHas),
            merge: vi.fn(lodashMerge),
        };

        mockExtensionSettings = {
            openvault: {
                enabled: true,
                extractionTokenBudget: 8000,
                injection: {
                    memory: { position: 1, depth: 4 },
                    world: { position: 1, depth: 4 },
                },
            },
        };

        vi.doMock('../../src/deps.js', () => ({
            getDeps: () => ({
                getContext: () => ({
                    lodash: mockLodash,
                }),
                getExtensionSettings: () => mockExtensionSettings,
                saveSettingsDebounced: mockSaveSettingsDebounced,
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));

        vi.doMock('../../src/constants.js', () => ({
            extensionName: 'openvault',
            defaultSettings: {
                enabled: true,
                extractionTokenBudget: 8000,
                injection: {
                    memory: { position: 1, depth: 4 },
                    world: { position: 1, depth: 4 },
                },
            },
        }));
    });

    it('should set nested value with dot notation and trigger save', async () => {
        const { setSetting, getSettings } = await import('../../src/settings.js');
        setSetting('injection.memory.position', 0);
        expect(getSettings('injection.memory.position')).toBe(0);
        expect(mockSaveSettingsDebounced).toHaveBeenCalled();
    });

    it('should use setByPath fallback when lodash.set is unavailable', async () => {
        const lodashNoSet = {
            get: mockLodash.get,
            has: mockLodash.has,
            merge: mockLodash.merge,
        };

        vi.doMock('../../src/deps.js', () => ({
            getDeps: () => ({
                getContext: () => ({
                    lodash: lodashNoSet,
                }),
                getExtensionSettings: () => mockExtensionSettings,
                saveSettingsDebounced: mockSaveSettingsDebounced,
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));

        const { setSetting, getSettings } = await import('../../src/settings.js');
        setSetting('fallback.test.value', 'works');
        expect(getSettings('fallback.test.value')).toBe('works');
    });

    it('should return true for existing paths (hasSettings)', async () => {
        const { hasSettings } = await import('../../src/settings.js');
        expect(hasSettings('injection.memory')).toBe(true);
        expect(hasSettings('enabled')).toBe(true);
    });

    it('should return false for missing paths (hasSettings)', async () => {
        const { hasSettings } = await import('../../src/settings.js');
        expect(hasSettings('nonexistent.path')).toBe(false);
        expect(hasSettings('injection.nonexistent')).toBe(false);
    });
});
```

- [ ] Step 2: Run file tests

Run: `npx vitest run tests/unit/settings.test.js`
Expected: 4 pass

- [ ] Step 3: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: prune lodash delegation tests from settings (keep 4 wiring checks)"
```

---

### Task 5: Gut `tests/prompts/prefill.test.js` — keep think-tag + CN preamble tests, remove 10

**Rationale:** 10 tests verify array `.length` or that constants equal their declared values. The 2 think-tag tests prove the schema validation path works.

**Tests to KEEP (8):**
- All 5 tests in `think tag support` describe block (proves `reasoning` keyword is included in user message for each schema type)
- `all prompts include CN system preamble in system message`
- `event extraction does NOT prefill assistant when prefill is empty`
- `non-think prompts use provided prefill`

**Tests to REMOVE (14):**
- All 5 `'%s returns 2 messages when prefill is empty'` parameterized tests
- All 5 `'%s uses provided prefill in assistant message'` parameterized tests
- `each preset has label and value`
- `pure_think preset has 🔮 value`
- `cn_compliance preset has Chinese forensic framing`
- `none preset has empty string value`

Note: The 2 CN/EN preamble anti-tool-call tests and 3 defaultSettings tests are borderline. Remove them too — they test string content and constant values, not logic.

**Total removed: 17 (from 25 → 8)**

- [ ] Step 1: Rewrite file

Replace entire contents of `tests/prompts/prefill.test.js` with:

```javascript
import { describe, expect, it } from 'vitest';
import {
    buildCommunitySummaryPrompt,
    buildEdgeConsolidationPrompt,
    buildEventExtractionPrompt,
    buildGlobalSynthesisPrompt,
    buildGraphExtractionPrompt,
    buildUnifiedReflectionPrompt,
} from '../../src/prompts/index.js';

describe('think tag support', () => {
    it.each([
        [
            'GRAPH_SCHEMA',
            () =>
                buildGraphExtractionPrompt({
                    messages: '[A]: test',
                    names: { char: 'A', user: 'B' },
                    prefill: '{',
                }),
        ],
        [
            'CONSOLIDATION_SCHEMA',
            () =>
                buildEdgeConsolidationPrompt(
                    { source: 'A', target: 'B', description: 'Test', weight: 1 },
                    'auto',
                    'auto',
                    '{'
                ),
        ],
        ['UNIFIED_REFLECTION_SCHEMA', () => buildUnifiedReflectionPrompt('Alice', [], 'auto', 'auto', '{')],
        ['COMMUNITY_SCHEMA', () => buildCommunitySummaryPrompt(['- Node'], ['- Edge'], 'auto', 'auto', '{')],
        [
            'GLOBAL_SYNTHESIS_SCHEMA',
            () => buildGlobalSynthesisPrompt([{ title: 'C1', summary: 'S1' }], 'auto', 'auto', '{'),
        ],
    ])('%s allows think tags before JSON', (_, buildPrompt) => {
        const result = buildPrompt();
        const user = result[1].content;
        expect(user).toContain('reasoning');
    });
});

describe('CN preamble and assistant prefill', () => {
    it('all prompts include CN system preamble in system message', () => {
        const eventResult = buildEventExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            context: {},
        });
        const graphResult = buildGraphExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            prefill: '{',
        });
        const communityResult = buildCommunitySummaryPrompt([], [], 'auto', 'auto', '{');

        for (const result of [eventResult, graphResult, communityResult]) {
            expect(result[0].content).toContain('<system_config>');
            expect(result[0].content).toContain('</system_config>');
        }
    });

    it('event extraction does NOT prefill assistant when prefill is empty', () => {
        const result = buildEventExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            context: {},
        });
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('system');
        expect(result[1].role).toBe('user');
    });

    it('non-think prompts use provided prefill', () => {
        const graphResult = buildGraphExtractionPrompt({
            messages: '[A]: test',
            names: { char: 'A', user: 'B' },
            prefill: '{',
        });
        const communityResult = buildCommunitySummaryPrompt([], [], 'auto', 'auto', '{');

        for (const result of [graphResult, communityResult]) {
            expect(result[2].role).toBe('assistant');
            expect(result[2].content).toBe('{');
        }
    });
});
```

- [ ] Step 2: Run file tests

Run: `npx vitest run tests/prompts/prefill.test.js`
Expected: 8 pass

- [ ] Step 3: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: prune constant-value and array-length tests from prefill (keep 8 think-tag/preamble tests)"
```

---

### Task 6: Trim `tests/utils/embedding-codec.test.js` — remove 9 null-guard tests

**Rationale:** 39% of tests verify null/empty inputs return null/false. The roundtrip, legacy migration, and precision tests are genuinely valuable.

**Tests to REMOVE (9):**
- `returns null for empty object` (getEmbedding)
- `returns null for null/undefined input` (getEmbedding)
- `returns null for embedding: null` (getEmbedding)
- `returns null for embedding: []` (getEmbedding)
- `returns false for empty object` (hasEmbedding)
- `returns false for null/undefined` (hasEmbedding)
- `returns false for embedding: null` (hasEmbedding)
- `returns false for embedding: []` (hasEmbedding)
- `no-ops on empty object` (deleteEmbedding)

Also remove `no-ops on null/undefined` from deleteEmbedding (defensive coding test, not domain logic).

**Total removed: 10 (from 23 → 13)**

- [ ] Step 1: Rewrite file

Replace entire contents of `tests/utils/embedding-codec.test.js` with:

```javascript
import { describe, expect, it } from 'vitest';
import { deleteEmbedding, getEmbedding, hasEmbedding, setEmbedding } from '../../src/utils/embedding-codec.js';

describe('setEmbedding + getEmbedding roundtrip', () => {
    it('encodes to Base64 and decodes back to Float32Array', () => {
        const vec = [0.1234, -0.5678, 0.9012, -0.3456];
        const obj = {};
        setEmbedding(obj, vec);

        expect(obj.embedding_b64).toBeTypeOf('string');
        expect(obj.embedding).toBeUndefined();

        const decoded = getEmbedding(obj);
        expect(decoded).toBeInstanceOf(Float32Array);
        expect(decoded).toHaveLength(4);
        // Float32 precision: ~7 significant digits
        for (let i = 0; i < vec.length; i++) {
            expect(decoded[i]).toBeCloseTo(vec[i], 5);
        }
    });

    it('roundtrips a realistic 384-dim normalized vector', () => {
        const raw = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
        const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
        const vec = raw.map((v) => v / norm);

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
    it('wraps legacy number[] in Float32Array', () => {
        const obj = { embedding: [0.1, 0.2, 0.3] };
        const result = getEmbedding(obj);
        expect(result).toBeInstanceOf(Float32Array);
        expect(result).toHaveLength(3);
        expect(result[0]).toBeCloseTo(0.1, 5);
        expect(result[1]).toBeCloseTo(0.2, 5);
        expect(result[2]).toBeCloseTo(0.3, 5);
    });

    it('prefers embedding_b64 over legacy embedding', () => {
        const obj = { embedding: [999, 999] };
        setEmbedding(obj, [0.1, 0.2]);
        // Manually add back legacy key to simulate mixed state
        obj.embedding = [999, 999];
        const result = getEmbedding(obj);
        expect(result[0]).toBeCloseTo(0.1, 5);
    });

    it('returns Float32Array from Base64 decode', () => {
        const obj = {};
        setEmbedding(obj, [0.5, -0.5, 1.0]);
        const result = getEmbedding(obj);
        expect(result).toBeInstanceOf(Float32Array);
        expect(result).toHaveLength(3);
    });

    it('returns Float32Array from legacy path', () => {
        const obj = { embedding: [1.0, 2.0] };
        const result = getEmbedding(obj);
        expect(result).toBeInstanceOf(Float32Array);
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
});

describe('post-migration behavior (no legacy fallback)', () => {
    it('getEmbedding returns null for legacy array after migration', () => {
        const obj = {};
        setEmbedding(obj, [0.1, 0.2, 0.3]);
        expect(getEmbedding(obj)).toBeInstanceOf(Float32Array);

        // Manually setting legacy array should still work during transition
        obj.embedding = [0.4, 0.5];
        expect(getEmbedding(obj)).toBeInstanceOf(Float32Array);
        expect(getEmbedding(obj)[0]).toBeCloseTo(0.1, 5); // Prefers b64
    });
});
```

- [ ] Step 2: Run file tests

Run: `npx vitest run tests/utils/embedding-codec.test.js`
Expected: 13 pass

- [ ] Step 3: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: prune null-guard tests from embedding-codec (keep 13 roundtrip/migration tests)"
```

---

### Task 7: Trim `tests/embeddings/migration.test.js` — remove 8 property-stamping tests

**Rationale:** 8 tests verify that property assignment works or that early returns happen. The mismatch detection, embedding clearing, legacy handling, and edge handling tests are genuinely valuable.

**Tests to REMOVE (8):**
- `stamps model ID on empty chat and returns 0`
- `returns 0 when model matches`
- `stamps ST fingerprint on empty chat`
- `returns 0 when ST source and model match`
- `returns current ST vector source and model`
- `returns empty model for transformers source`
- `stamps source and model onto data`
- `is a no-op for null data`

**Total removed: 8 (from 22 → 14)**

- [ ] Step 1: Remove tests from file

Edit `tests/embeddings/migration.test.js` to remove the 8 identified tests. Specifically:

1. In `describe('invalidateStaleEmbeddings')` — remove first 2 tests (`stamps model ID on empty chat...` and `returns 0 when model matches`)
2. In `describe('invalidateStaleEmbeddings — ST Vector fingerprint')` — remove first 2 tests (`stamps ST fingerprint on empty chat` and `returns 0 when ST source and model match`)
3. In `describe('getStVectorFingerprint')` — remove both tests (`returns current ST vector source and model` and `returns empty model for transformers source`)
4. In `describe('stampStVectorFingerprint')` — remove both tests (`stamps source and model onto data` and `is a no-op for null data`)

- [ ] Step 2: Run file tests

Run: `npx vitest run tests/embeddings/migration.test.js`
Expected: 14 pass

- [ ] Step 3: Run full suite

Run: `npx vitest run`
Expected: All pass

- [ ] Step 4: Commit

```bash
git add -A && git commit -m "chore: prune property-stamping tests from migration (keep 14 mismatch/clearing tests)"
```

---

## Summary

| Task | File | Action | Tests Before | Tests After | Removed |
|------|------|--------|-------------|-------------|---------|
| 1 | `emergency-cut.test.js` | Delete file | 7 | 0 | 7 |
| 2 | `formatters.test.js` | Delete file | 6 | 0 | 6 |
| 3 | `schemas.test.js` | Gut to 4 | 20 | 4 | 16 |
| 4 | `settings.test.js` | Gut to 4 | 22 | 4 | 18 |
| 5 | `prefill.test.js` | Gut to 8 | 25 | 8 | 17 |
| 6 | `embedding-codec.test.js` | Gut to 13 | 23 | 13 | 10 |
| 7 | `migration.test.js` | Trim | 22 | 14 | 8 |
| **Total** | | | **125** | **43** | **82** |

**Before:** 1,093 tests, 905 KB
**After (projected):** ~1,011 tests, ~850 KB
**Reduction:** ~82 tests (7.5%)
