# UI Subsystem

## WHAT
Handles the ST settings panel, dashboard stats, the interactive memory/entity browser, and the Perf monitoring tab. Uses standard jQuery but enforces strict architectural boundaries.

## ARCHITECTURE
- **`helpers.js`**: Pure data transformations (pagination, filtering, math). **ZERO DOM INTERACTION**. Fully unit testable.
- **`templates.js`**: Pure functions returning HTML strings. **ZERO STATE MUTATION**.
- **`render.js`**: State orchestration and DOM manipulation (`$()`).
- **`settings.js`**: Event binding and persistence.

## PATTERNS & CONVENTIONS
- **Drawers (`.openvault-details`)**: Collapsible `<details>` elements. CSS hides the native triangle, uses `::after` for a rotating `›` chevron, and applies a tinted background via `color-mix()`.
- **Settings Binding**: Uses `bindSetting(elementId, settingKey, type)`. ALL saves must use `getDeps().saveSettingsDebounced()`.
- **Dropdowns**: `preambleLanguage` (cn/en) and `extractionPrefill` (7 presets) bound via `$('#openvault_...').on('change')` + `saveSetting()`. Populated from `PREFILL_PRESETS` in `src/prompts.js`.
- **Naming**: 
  - IDs: `openvault_setting_name`
  - Values: `openvault_setting_name_value`
  - Setting Keys: `camelCase` (e.g., `reflectionThreshold`)

## PAYLOAD CALCULATOR (`PAYLOAD_CALC`)
- Single source of truth in `src/constants.js`.
- Shows user the real total token cost: `Budget + Rearview + OVERHEAD`.
- **OVERHEAD** = 12k (8k max output + 4k prompt/safety buffer).
- Thresholds: Green <=32k, Yellow <=48k, Orange <=64k, Red >64k.

## GOTCHAS & RULES
- **No Inline Events**: Bind exclusively via jQuery `.on()` in `initBrowser()`.
- **XSS Safety**: ALL user-generated data (summaries, entity names) MUST pass through `escapeHtml()` from `src/utils/dom.js` before hitting templates.
- **Manual Backfill Guard**: The manual "Backfill Chat" button checks `isWorkerRunning()` (the background worker) first. If active, it rejects to prevent race conditions. The worker also yields if manual backfill takes over.

## PERF TAB (5th Tab)
- **Purpose**: Displays last-run timings for 12 metrics (2 sync, 10 async) with health indicators (green/red).
- **Table Structure**: Icon | Metric name | Last timing | Scale | Status dot
- **Health Indicators**: Green = within threshold (`PERF_THRESHOLDS`), Red = exceeds threshold
- **SYNC Badge**: Metrics that block chat generation (`retrieval_injection`, `auto_hide`) show a red "SYNC" badge.
- **Copy Button**: `formatForClipboard()` generates plain text report for paste into issues/debugging.
- **Rendering**: `renderPerfTab()` in `settings.js` called from `refreshAllUI()`.
- **Hydration**: `loadPerfFromChat()` called from `onChatChanged()` to restore persisted perf data on chat switch.