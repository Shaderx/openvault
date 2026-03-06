# Design: Code Review Fixes (Items 3, 4, 5)

Three targeted improvements identified during code review. Each is small, isolated, and independently shippable.

## 1. Problem Statement

1. **Generation lock blind spot:** `state.js` only listens to `GENERATION_ENDED`. If the user presses Stop in SillyTavern, the `GENERATION_STOPPED` event fires instead — the lock stays held for the full 2-minute safety timeout.
2. **Artificial yield delay:** `yieldToMain()` uses `setTimeout(resolve, 0)` which modern browsers clamp to ~4ms. In dedup loops yielding every 10 iterations on 500 items, this adds ~200ms of artificial delay. `scheduler.yield()` is available in Chrome 129+ and Firefox 129+ with zero delay and task-priority inheritance.
3. **Settings boilerplate:** 34 of 39 input handlers in `settings.js` follow an identical `parse → saveSetting → update display` pattern. Each is 4-5 lines. Adding a new setting requires copy-pasting a block and changing 3 strings.

## 2. Goals & Non-Goals

### Must do
- Subscribe to `GENERATION_STOPPED` to release the generation lock immediately on Stop
- Replace `setTimeout(0)` with `scheduler.yield()` in `yieldToMain()`
- Extract a declarative `bindSetting()` helper to replace repetitive handler blocks

### Won't do
- Add `device.lost` monitoring for WebGPU (graceful degradation already works — documented in ARCHITECTURE.md §3.4)
- Change the LRU cache (already true LRU via delete+set — documented in ARCHITECTURE.md §3.4)
- Rewrite the 5 special/custom handlers (RPM validation, embedding source switch, etc.)

## 3. Proposed Architecture

### 3A. `GENERATION_STOPPED` Event (state.js + events.js)

**Current `EVENT_MAP`** in `events.js:209`:
```js
const EVENT_MAP = [
    ['GENERATION_AFTER_COMMANDS', onBeforeGeneration],
    ['GENERATION_ENDED', onGenerationEnded],
    ['MESSAGE_RECEIVED', onMessageReceived],
    ['CHAT_CHANGED', onChatChanged],
];
```

**Change:** Add one entry:
```js
const EVENT_MAP = [
    ['GENERATION_AFTER_COMMANDS', onBeforeGeneration],
    ['GENERATION_ENDED', onGenerationEnded],
    ['GENERATION_STOPPED', onGenerationEnded],  // User hits Stop — same handler
    ['MESSAGE_RECEIVED', onMessageReceived],
    ['CHAT_CHANGED', onChatChanged],
];
```

Both `GENERATION_ENDED` and `GENERATION_STOPPED` route to `onGenerationEnded()`, which calls `clearGenerationLock()`. The existing safety timeout (`generationLockTimeout`) is already cleared by `clearGenerationLock()` — no changes needed in `state.js`.

No `GENERATION_STARTED` failsafe: `GENERATION_AFTER_COMMANDS` already has a pre-flight guard that skips if `generationInProgress` is true, which is sufficient.

### 3B. `scheduler.yield()` (utils.js)

**Current** (`src/utils.js:483`):
```js
export function yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
```

**Change:**
```js
export function yieldToMain() {
    return scheduler.yield();
}
```

Drop-in replacement. `scheduler.yield()` returns a `Promise<void>` — identical signature. Available since Chrome 129 (Sep 2024) and Firefox 129 (Aug 2025). OpenVault targets modern Chrome ESM only.

**Call sites (unchanged):**
| File | Function | Yield frequency |
|------|----------|----------------|
| `src/extraction/extract.js:224` | `filterSimilarEvents` phase 1 | Every 10 iterations |
| `src/extraction/extract.js:250` | `filterSimilarEvents` phase 2 | Every 10 iterations |
| `src/graph/communities.js:196` | `updateCommunitySummaries` | Every community |

### 3C. Declarative `bindSetting()` (settings.js)

**New helper** at top of `bindUIElements()`:
```js
/**
 * Bind a UI input to a setting with automatic save and display update.
 * @param {string} id - jQuery selector suffix (e.g. 'alpha' → '#openvault_alpha')
 * @param {string} key - Settings key passed to saveSetting()
 * @param {'int'|'float'|'bool'} type - Value parser
 * @param {function|null} callback - Optional post-save callback receiving parsed value
 */
function bindSetting(id, key, type = 'int', callback = null) {
    const event = type === 'bool' ? 'change' : 'input';
    $(`#openvault_${id}`).on(event, function () {
        let val;
        if (type === 'bool') val = $(this).is(':checked');
        else if (type === 'float') val = parseFloat($(this).val());
        else val = parseInt($(this).val(), 10);

        saveSetting(key, val);
        if (type !== 'bool') $(`#openvault_${id}_value`).text(val);
        if (callback) callback(val);
    });
}
```

**Usage — 34 blocks collapse to one-liners:**
```js
// Basic toggles
bindSetting('debug', 'debugMode', 'bool');
bindSetting('request_logging', 'requestLogging', 'bool');
bindSetting('auto_hide', 'autoHideEnabled', 'bool');

// Extraction settings
bindSetting('messages_per_extraction', 'messagesPerExtraction');
bindSetting('extraction_rearview', 'extractionRearviewTokens', 'int', (v) =>
    updateWordsDisplay(v, 'openvault_extraction_rearview_words'));

// Scoring weights
bindSetting('alpha', 'alpha', 'float');
bindSetting('combined_weight', 'combinedBoostWeight', 'float');
bindSetting('vector_threshold', 'vectorSimilarityThreshold', 'float');
bindSetting('dedup_threshold', 'dedupSimilarityThreshold', 'float');
bindSetting('entity_merge_threshold', 'entityMergeSimilarityThreshold', 'float');

// ... etc for all 34 standard handlers
```

**Handlers that stay manual (5):**
| Handler | Reason |
|---------|--------|
| `#openvault_enabled` | Calls `updateEventListeners()` after save — use callback param OR keep manual (side effect is important enough to be visible) |
| `#openvault_backfill_rpm` | Uses `validateRPM()` to correct value and write it back to the input |
| `#openvault_embedding_source` | Complex: resets old strategy, auto-populates prefixes, toggles Ollama UI |
| `#openvault_embedding_model/url/prefixes` | Use `.trim()` on string val, no display text update — could use `bindSetting` with a `'string'` type, but only 4 handlers |
| `#openvault_extraction_profile` | Simple `saveSetting` only, no display — trivial enough to inline |

**Decision for `enabled`:** Use `bindSetting` with callback:
```js
bindSetting('enabled', 'enabled', 'bool', () => updateEventListeners());
```
This keeps it declarative while making the side effect explicit.

## 4. Data Models / Schema

No data model changes. All three fixes are behavioral.

## 5. Interface / API Design

### New export: none
`bindSetting` is a file-local helper inside `settings.js`. Not exported.

### Changed signatures: none
`yieldToMain()` keeps its existing `() => Promise<void>` signature. `onGenerationEnded()` keeps its existing signature — it's just wired to an additional event.

## 6. Risks & Edge Cases

| Risk | Mitigation |
|------|------------|
| `GENERATION_STOPPED` doesn't exist in older ST versions | `eventTypes['GENERATION_STOPPED']` resolves to `undefined` → `eventSource.on(undefined, handler)` is a no-op. No crash. |
| `scheduler.yield()` unavailable in some browser | OpenVault requires Chrome 129+ (ESM-only extension). If someone runs an ancient Chromium fork, `yieldToMain` throws — but the extension already requires modern APIs. |
| `bindSetting` callback exception silently swallowed | Callbacks are called synchronously in the `on()` handler — jQuery propagates the error to the console. Same behavior as current inline code. |
| Double `clearGenerationLock()` call (both ENDED and STOPPED fire) | `clearGenerationLock()` is idempotent — sets `false` and clears a potentially-null timeout. Safe to call twice. |
