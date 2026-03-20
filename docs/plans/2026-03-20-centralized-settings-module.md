# Centralized Settings Module Implementation Plan

**Goal:** Create a centralized settings module (`src/settings.js`) that exports `getSettings(path?, defaultValue?)`, `setSetting(path, value)`, and `hasSettings(path)` functions using lodash.get/set/has for consistent, safe nested access, then migrate `src/ui/settings.js` to use the new API.

**Architecture:** Add new public exports to the existing `src/settings.js` file. The new functions wrap `getDeps().getExtensionSettings()[extensionName]` with lodash utilities for dot-notation path support. Then replace internal functions in `src/ui/settings.js` with imports from the new API. No backward compatibility code - only new ST versions with full lodash support.

**Tech Stack:** JavaScript (ES6+), Vitest for testing, Lodash (provided by SillyTavern context - all methods available)

---

## File Structure Overview

- **Create:** `tests/settings.test.js` - Tests for new settings API
- **Modify:** `src/settings.js` - Add `getSettings`, `setSetting`, `hasSettings` exports
- **Modify:** `src/ui/settings.js` - Remove internal `getSettings()`/`saveSetting()`, import from settings.js
- **Modify:** `src/ui/settings.js` - Update `handleResetSettings()` to use `setSetting()`
- **Modify:** `src/ui/settings.js` - Update `bindInjectionSettings()` to use new API

---

## Task 1: Create test file structure and basic getSettings test

**Files:**
- Create: `tests/settings.test.js`

- [ ] Step 1: Write the failing test for getSettings returning entire object

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Centralized Settings Module', () => {
    let mockExtensionSettings;
    let mockLodash;
    let mockSaveSettingsDebounced;

    beforeEach(async () => {
        vi.resetModules();

        // Setup mocks - use real lodash methods via vi.fn() wrapper
        mockSaveSettingsDebounced = vi.fn();

        // Import real lodash for the mocks
        const lodash = await import('lodash');

        mockLodash = {
            get: vi.fn(lodash.get),
            set: vi.fn(lodash.set),
            has: vi.fn(lodash.has),
            merge: vi.fn(lodash.merge),
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

        // Mock deps.js
        vi.doMock('../src/deps.js', () => ({
            getDeps: () => ({
                getContext: () => ({
                    extensionSettings: mockExtensionSettings,
                    lodash: mockLodash,
                }),
                saveSettingsDebounced: mockSaveSettingsDebounced,
            }),
            setDeps: vi.fn(),
            resetDeps: vi.fn(),
        }));

        // Mock constants.js
        vi.doMock('../src/constants.js', () => ({
            extensionName: 'openvault',
            defaultSettings: {
                enabled: true,
                extractionTokenBudget: 8000,
                injection: {
                    memory: { position: 1, depth: 4 },
                },
            },
        }));
    });

    describe('getSettings', () => {
        it('should return entire settings object when no path provided', async () => {
            const { getSettings } = await import('../src/settings.js');
            const result = getSettings();
            expect(result).toEqual(mockExtensionSettings.openvault);
        });
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL - "getSettings is not defined" or similar export error

- [ ] Step 3: Add getSettings export to src/settings.js

```javascript
// Add to src/settings.js after the loadSettings function

/**
 * Get settings object or nested value using lodash.get
 * @param {string} [path] - Optional lodash path (dot notation)
 * @param {*} [defaultValue] - Default value if path not found
 * @returns {Settings|*} Settings object or value at path
 */
export function getSettings(path, defaultValue) {
    const { getContext } = getDeps();
    const lodash = getContext()?.lodash;
    const settings = getContext().getExtensionSettings()[extensionName];

    if (path === undefined) {
        return settings;
    }

    return lodash?.get(settings, path, defaultValue) ?? defaultValue;
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat: add getSettings(path?, defaultValue?) export"
```

---

## Task 2: Test getSettings with nested path

**Files:**
- Modify: `tests/settings.test.js`

- [ ] Step 1: Write the failing test for nested path access

```javascript
// Add to tests/settings.test.js inside the 'getSettings' describe block

it('should get nested value with dot notation', async () => {
    const { getSettings } = await import('../src/settings.js');
    const result = getSettings('injection.memory.position');
    expect(result).toBe(1);
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL if lodash.get mock isn't being called correctly

- [ ] Step 3: Verify implementation (no changes needed - should already work)

The implementation from Task 1 should already handle this. If failing, debug the mock.

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "test: add getSettings nested path test"
```

---

## Task 3: Test getSettings with default value

**Files:**
- Modify: `tests/settings.test.js`

- [ ] Step 1: Write the failing test for default value

```javascript
// Add to tests/settings.test.js inside the 'getSettings' describe block

it('should return default value for missing paths', async () => {
    const { getSettings } = await import('../src/settings.js');
    const result = getSettings('nonexistent.path', 42);
    expect(result).toBe(42);
});

it('should return default value when path is undefined', async () => {
    const { getSettings } = await import('../src/settings.js');
    const result = getSettings('missing.nested.deep', 'default');
    expect(result).toBe('default');
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL - the nullish coalescing may not be working correctly

- [ ] Step 3: Verify implementation handles defaults correctly

The existing implementation should handle this. The `lodash.get(obj, path, defaultValue)` returns undefined if path not found and no default, then `?? defaultValue` provides fallback.

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "test: add getSettings default value tests"
```

---

## Task 4: Test setSetting with nested path

**Files:**
- Modify: `tests/settings.test.js`
- Modify: `src/settings.js`

- [ ] Step 1: Write the failing test for setSetting

```javascript
// Add to tests/settings.test.js - new describe block after getSettings

describe('setSetting', () => {
    it('should set nested value with dot notation', async () => {
        const { setSetting, getSettings } = await import('../src/settings.js');
        setSetting('injection.memory.position', 0);
        expect(getSettings('injection.memory.position')).toBe(0);
        expect(mockSaveSettingsDebounced).toHaveBeenCalled();
    });

    it('should create intermediate objects when setting nested path', async () => {
        const { setSetting, getSettings } = await import('../src/settings.js');
        setSetting('new.nested.path', 'value');
        expect(getSettings('new.nested.path')).toBe('value');
        expect(mockSaveSettingsDebounced).toHaveBeenCalled();
    });

    it('should overwrite existing values', async () => {
        const { setSetting, getSettings } = await import('../src/settings.js');
        setSetting('extractionTokenBudget', 12000);
        expect(getSettings('extractionTokenBudget')).toBe(12000);
    });

    it('should work with array notation', async () => {
        const { setSetting, getSettings } = await import('../src/settings.js');
        setSetting('testArray[0].name', 'first');
        expect(getSettings('testArray[0].name')).toBe('first');
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL - "setSetting is not defined"

- [ ] Step 3: Add setSetting implementation to src/settings.js

```javascript
// Add to src/settings.js after getSettings function

/**
 * Set settings value using lodash.set
 * @param {string} path - Lodash path (dot notation)
 * @param {*} value - Value to set
 */
export function setSetting(path, value) {
    const { getContext, saveSettingsDebounced } = getDeps();
    const lodash = getContext()?.lodash;
    const settings = getContext().getExtensionSettings()[extensionName];

    lodash.set(settings, path, value);
    saveSettingsDebounced();
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat: add setSetting(path, value) export"
```

---

## Task 5: Test edge cases and array notation

**Files:**
- Modify: `tests/settings.test.js`

- [ ] Step 1: Write the edge case tests

```javascript
// Add to tests/settings.test.js - new describe block after hasSettings

describe('Edge Cases', () => {
    it('should handle undefined path in getSettings', async () => {
        const { getSettings } = await import('../src/settings.js');
        const result = getSettings();
        expect(result).toEqual(mockExtensionSettings.openvault);
    });

    it('should handle array notation in paths', async () => {
        mockExtensionSettings.openvault = {
            testArray: [{ name: 'first' }, { name: 'second' }],
        };

        const { getSettings, setSetting } = await import('../src/settings.js');
        expect(getSettings('testArray[0].name')).toBe('first');
    });

    it('should handle deeply nested paths', async () => {
        const { getSettings, setSetting } = await import('../src/settings.js');
        setSetting('a.b.c.d.e', 'deep');
        expect(getSettings('a.b.c.d.e')).toBe('deep');
    });

    it('should return defaultValue for undefined settings object', async () => {
        mockExtensionSettings.openvault = undefined;
        const { getSettings } = await import('../src/settings.js');
        expect(getSettings('any.path', 'default')).toBe('default');
    });
});
```

**Files:**
- Modify: `tests/settings.test.js`

- [ ] Step 1: Write the failing test for fallback path

```javascript
// Add to tests/settings.test.js - new test case in setSetting describe

it('should use setByPath fallback when lodash.set is unavailable', async () => {
    // Re-mock with lodash that has no .set
    const lodashNoSet = {
        get: mockLodash.get,
        has: mockLodash.has,
        merge: mockLodash.merge,
        // No .set property
    };

    vi.doMock('../src/deps.js', () => ({
        getDeps: () => ({
            getContext: () => ({
                extensionSettings: mockExtensionSettings,
                lodash: lodashNoSet,
            }),
            saveSettingsDebounced: mockSaveSettingsDebounced,
        }),
    }));

    // Re-import to get fresh module
    const { setSetting, getSettings } = await import('../src/settings.js');
    setSetting('fallback.test.value', 'works');
    expect(getSettings('fallback.test.value')).toBe('works');
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL - setByPath is not exported/testable directly

- [ ] Step 3: The test actually verifies the behavior indirectly, which is correct

No implementation changes needed - setByPath is internal and the test verifies the fallback works.

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "test: add setSetting fallback test"
```

---

## Task 6: Test hasSettings function

**Files:**
- Modify: `tests/settings.test.js`
- Modify: `src/settings.js`

- [ ] Step 1: Write the failing test for hasSettings

```javascript
// Add to tests/settings.test.js - new describe block after setSetting

describe('hasSettings', () => {
    it('should return true for existing paths', async () => {
        const { hasSettings } = await import('../src/settings.js');
        expect(hasSettings('injection.memory')).toBe(true);
        expect(hasSettings('enabled')).toBe(true);
    });

    it('should return false for missing paths', async () => {
        const { hasSettings } = await import('../src/settings.js');
        expect(hasSettings('nonexistent.path')).toBe(false);
        expect(hasSettings('injection.nonexistent')).toBe(false);
    });

    it('should work with deeply nested paths', async () => {
        const { hasSettings } = await import('../src/settings.js');
        expect(hasSettings('injection.memory.position')).toBe(true);
        expect(hasSettings('injection.memory.nonexistent')).toBe(false);
    });
});
```

- [ ] Step 2: Run test to verify it fails

Run: `npm test -- tests/settings.test.js`
Expected: FAIL - "hasSettings is not defined"

- [ ] Step 3: Add hasSettings implementation to src/settings.js

```javascript
// Add to src/settings.js after setSetting function

/**
 * Check if path exists in settings
 * @param {string} path - Lodash path (dot notation)
 * @returns {boolean}
 */
export function hasSettings(path) {
    const { getContext } = getDeps();
    const lodash = getContext()?.lodash;
    const settings = getContext().getExtensionSettings()[extensionName];

    return lodash.has(settings, path);
}
```

- [ ] Step 4: Run test to verify it passes

Run: `npm test -- tests/settings.test.js`
Expected: PASS

- [ ] Step 5: Commit

```bash
git add -A && git commit -m "feat: add hasSettings(path) export"
```

---

## Task 7: Run full test suite to verify no regressions

**Files:**
- All modified files

- [ ] Step 1: Run the complete settings test suite

Run: `npm test -- tests/settings.test.js`
Expected: All tests PASS

- [ ] Step 2: Run all existing tests to ensure no regression

Run: `npm test`
Expected: All tests PASS

- [ ] Step 3: Commit if any issues found

```bash
git add -A && git commit -m "fix: any regression fixes"
```

---

## Task 8: Migrate src/ui/settings.js - remove internal functions

**Files:**
- Modify: `src/ui/settings.js`

- [ ] Step 1: Add imports at top of src/ui/settings.js

Add these imports after the existing constants import:
```javascript
import { getSettings, setSetting } from '../settings.js';
```

- [ ] Step 2: Delete internal getSettings() function

Find and delete these lines from `src/ui/settings.js`:
```javascript
function getSettings() {
    return getDeps().getExtensionSettings()[extensionName];
}
```

- [ ] Step 3: Delete internal saveSetting() function

Find and delete these lines from `src/ui/settings.js`:
```javascript
function saveSetting(key, value) {
    const settings = getSettings();

    // Support dot-notation paths for nested objects (e.g., 'injection.memory.position')
    if (key.includes('.')) {
        const parts = key.split('.');
        let current = settings;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    } else {
        settings[key] = value;
    }

    getDeps().saveSettingsDebounced();
}
```

- [ ] Step 4: Update handleResetSettings() to use imported setSetting

In `src/ui/settings.js`, find `handleResetSettings()` function and replace:
```javascript
// OLD:
extension_settings[extensionName][key] = defaultSettings[key];

// NEW:
setSetting(key, defaultSettings[key]);
```

The updated section should look like:
```javascript
// Reset each fine-tune setting to default
for (const key of RESETTABLE_KEYS) {
    if (key in defaultSettings) {
        setSetting(key, defaultSettings[key]);
    }
}
```

- [ ] Step 5: Run UI settings tests to verify migration

Run: `npm test -- tests/unit/settings-ui.test.js`
Expected: PASS

- [ ] Step 6: Commit migration

```bash
git add -A && git commit -m "refactor: migrate ui/settings.js to use centralized settings API"
```

---

## Task 9: Migrate src/ui/settings.js - update bindInjectionSettings()

**Files:**
- Modify: `src/ui/settings.js`

- [ ] Step 1: Update bindInjectionSettings() to remove direct settings access

The `bindInjectionSettings()` function already calls `saveSetting()` which we've replaced with the import. The function should already work, but verify there are no direct `settings.` references.

Find the `bindInjectionSettings()` function and ensure it only uses:
- `saveSetting()` → now imported as `setSetting()`

- [ ] Step 2: Update updateInjectionUI() to use imported getSettings

The `updateInjectionUI()` function uses local `const settings = getSettings();` - this now correctly uses the imported function.

- [ ] Step 3: Run all UI tests

Run: `npm test -- tests/unit/settings-ui.test.js tests/ui/settings-bindings.test.js`
Expected: PASS

- [ ] Step 4: Commit if any changes

```bash
git add -A && git commit -m "refactor: update bindInjectionSettings to use new settings API"
```

---

## Task 10: Update inline documentation and verify final state

**Files:**
- Modify: `src/settings.js`

- [ ] Step 1: Ensure all exports are documented

Verify `src/settings.js` has complete JSDoc comments:
```javascript
export function loadSettings() { ... }       // Already documented
export function getSettings(path, defaultValue) { ... }  // Added in Task 1
export function setSetting(path, value) { ... }  // Added in Task 4
export function hasSettings(path) { ... }  // Added in Task 6
```

- [ ] Step 2: Verify final src/settings.js exports

The final `src/settings.js` should export exactly:
1. `loadSettings()` - Initialize settings with defaults
2. `getSettings(path?, defaultValue?)` - Get settings object or nested value
3. `setSetting(path, value)` - Set nested value
4. `hasSettings(path)` - Check if path exists

No `setByPath()` function - we use lodash.set directly.

- [ ] Step 3: Run all tests one final time

Run: `npm test`
Expected: All tests PASS

- [ ] Step 4: Check git diff to review all changes

Run: `git diff src/settings.js src/ui/settings.js`
Verify:
- No fallback code in setSetting
- No internal getSettings/saveSetting in ui/settings.js
- Clean imports at top of ui/settings.js

- [ ] Step 5: Final documentation commit

```bash
git add -A && git commit -m "docs: complete centralized settings module documentation"
```

---

## Completion Summary

After completing all tasks:

### Final `src/settings.js` exports:
1. **getSettings(path?, defaultValue?)** - Get entire settings object or nested value with default
2. **setSetting(path, value)** - Set nested value using lodash.set, saves automatically
3. **hasSettings(path)** - Check if path exists using lodash.has
4. **loadSettings()** - Existing initialization function (unchanged)

### Migrated `src/ui/settings.js`:
- Removed internal `getSettings()` function (~3 lines)
- Removed internal `saveSetting()` function with manual dot-notation parsing (~20 lines)
- Added imports: `import { getSettings, setSetting } from '../settings.js'`
- Updated `handleResetSettings()` to use `setSetting()`
- All ~50+ call sites now use the centralized API

### Tests cover:
- Basic functionality (get/set/has)
- Nested path access (dot notation: `injection.memory.position`)
- Default values for missing paths
- Intermediate object creation
- Array notation support (`testArray[0].name`)
- Edge cases (undefined settings, deeply nested paths)

### No backward compatibility code:
- No `setByPath()` fallback - assumes lodash.set is available
- No duplicate internal functions
- Clean, single-source-of-truth settings access
