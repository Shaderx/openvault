# Implementation Plan - Performance Monitoring Tab

> **Reference:** `docs/designs/2026-03-10-perf-tab-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Add `PERF_THRESHOLDS` and `PERF_METRICS` to constants

**Goal:** Define all 12 metric IDs, display metadata, and health thresholds in the central constants file.

**Step 1: Write the Failing Test**
- File: `tests/perf/store.test.js`
- Code:
  ```javascript
  import { describe, expect, it } from 'vitest';
  import { PERF_THRESHOLDS, PERF_METRICS } from '../../src/constants.js';

  describe('PERF constants', () => {
      const EXPECTED_METRIC_IDS = [
          'retrieval_injection', 'auto_hide', 'memory_scoring', 'event_dedup',
          'llm_events', 'llm_graph', 'llm_reflection', 'llm_communities',
          'embedding_generation', 'louvain_detection', 'entity_merge', 'chat_save',
      ];

      it('PERF_THRESHOLDS has all 12 metric IDs with positive numbers', () => {
          for (const id of EXPECTED_METRIC_IDS) {
              expect(PERF_THRESHOLDS[id], `missing threshold for ${id}`).toBeGreaterThan(0);
          }
          expect(Object.keys(PERF_THRESHOLDS)).toHaveLength(12);
      });

      it('PERF_METRICS has label, icon, and sync flag for every metric', () => {
          for (const id of EXPECTED_METRIC_IDS) {
              const meta = PERF_METRICS[id];
              expect(meta, `missing metadata for ${id}`).toBeDefined();
              expect(meta.label).toBeTypeOf('string');
              expect(meta.icon).toBeTypeOf('string');
              expect(meta.sync).toBeTypeOf('boolean');
          }
          expect(Object.keys(PERF_METRICS)).toHaveLength(12);
      });

      it('sync metrics are only retrieval_injection and auto_hide', () => {
          const syncIds = Object.entries(PERF_METRICS)
              .filter(([_, m]) => m.sync)
              .map(([id]) => id);
          expect(syncIds.sort()).toEqual(['auto_hide', 'retrieval_injection']);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/store.test.js`
- Expect: `PERF_THRESHOLDS is not exported` / `PERF_METRICS is not exported`

**Step 3: Implementation (Green)**
- File: `src/constants.js`
- Action: Add two exported objects at the bottom, before the closing. Values from the design doc:
  ```javascript
  // Performance monitoring thresholds (ms) — values above threshold show red
  export const PERF_THRESHOLDS = {
      retrieval_injection: 2000,
      auto_hide:           500,
      memory_scoring:      200,
      event_dedup:         500,
      llm_events:        30000,
      llm_graph:         30000,
      llm_reflection:    45000,
      llm_communities:   30000,
      embedding_generation: 10000,
      louvain_detection:  1000,
      entity_merge:       1000,
      chat_save:          1000,
  };

  // Performance metric display metadata
  export const PERF_METRICS = {
      retrieval_injection:  { label: 'Pre-gen injection',  icon: 'fa-bolt',          sync: true  },
      auto_hide:            { label: 'Auto-hide messages', icon: 'fa-eye-slash',     sync: true  },
      memory_scoring:       { label: 'Memory scoring',     icon: 'fa-calculator',    sync: false },
      event_dedup:          { label: 'Event dedup',        icon: 'fa-clone',         sync: false },
      llm_events:           { label: 'LLM: Events',       icon: 'fa-cloud',         sync: false },
      llm_graph:            { label: 'LLM: Graph',        icon: 'fa-cloud',         sync: false },
      llm_reflection:       { label: 'LLM: Reflection',   icon: 'fa-cloud',         sync: false },
      llm_communities:      { label: 'LLM: Communities',  icon: 'fa-cloud',         sync: false },
      embedding_generation: { label: 'Embeddings',        icon: 'fa-vector-square', sync: false },
      louvain_detection:    { label: 'Louvain',           icon: 'fa-circle-nodes',  sync: false },
      entity_merge:         { label: 'Entity merge',      icon: 'fa-code-merge',    sync: false },
      chat_save:            { label: 'Chat save',         icon: 'fa-floppy-disk',   sync: false },
  };
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/store.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/constants.js tests/perf/store.test.js && git commit -m "feat(perf): add PERF_THRESHOLDS and PERF_METRICS constants"`

---

### Task 2: Create perf store module (`src/perf/store.js`)

**Goal:** Singleton in-memory store with `record()`, `getAll()`, `loadFromChat()`, and `formatForClipboard()`.

**Step 1: Write the Failing Test**
- File: `tests/perf/store.test.js` (append to existing)
- Code:
  ```javascript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { extensionName, PERF_METRICS, PERF_THRESHOLDS } from '../../src/constants.js';
  import { resetDeps } from '../../src/deps.js';
  import { record, getAll, loadFromChat, formatForClipboard, _resetForTest } from '../../src/perf/store.js';

  describe('perf store', () => {
      let mockData;

      beforeEach(() => {
          mockData = { memories: [] };
          setupTestContext({
              context: { chatMetadata: { openvault: mockData } },
              settings: { debugMode: true },
          });
          _resetForTest();
      });

      afterEach(() => {
          resetDeps();
      });

      it('record() stores a metric and getAll() returns it', () => {
          record('memory_scoring', 42.5, '100 memories');
          const all = getAll();
          expect(all.memory_scoring.ms).toBe(42.5);
          expect(all.memory_scoring.size).toBe('100 memories');
          expect(all.memory_scoring.ts).toBeTypeOf('number');
      });

      it('record() overwrites previous value for same metric', () => {
          record('memory_scoring', 10);
          record('memory_scoring', 99);
          expect(getAll().memory_scoring.ms).toBe(99);
      });

      it('record() persists to chatMetadata.openvault.perf', () => {
          record('chat_save', 150);
          expect(mockData.perf.chat_save.ms).toBe(150);
      });

      it('getAll() returns empty object when nothing recorded', () => {
          expect(getAll()).toEqual({});
      });

      it('loadFromChat() hydrates in-memory store from chat metadata', () => {
          mockData.perf = { louvain_detection: { ms: 500, size: '50 edges', ts: 1000 } };
          loadFromChat();
          expect(getAll().louvain_detection.ms).toBe(500);
      });

      it('loadFromChat() clears previous in-memory data', () => {
          record('chat_save', 100);
          mockData.perf = { memory_scoring: { ms: 20, size: null, ts: 2000 } };
          loadFromChat();
          const all = getAll();
          expect(all.chat_save).toBeUndefined();
          expect(all.memory_scoring.ms).toBe(20);
      });

      it('formatForClipboard() produces readable text with all recorded metrics', () => {
          record('memory_scoring', 12.34, '450 memories');
          record('llm_events', 5200);
          const text = formatForClipboard();
          expect(text).toContain('Memory scoring');
          expect(text).toContain('12.34ms');
          expect(text).toContain('450 memories');
          expect(text).toContain('LLM: Events');
          expect(text).toContain('5200');
      });

      it('formatForClipboard() returns placeholder when empty', () => {
          const text = formatForClipboard();
          expect(text).toContain('No perf data');
      });

      it('record() ignores unknown metric IDs', () => {
          record('bogus_metric', 100);
          expect(getAll().bogus_metric).toBeUndefined();
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/store.test.js`
- Expect: `Cannot find module '../../src/perf/store.js'`

**Step 3: Implementation (Green)**
- File: `src/perf/store.js` **(new file)**
- Action: Create the singleton store:
  ```javascript
  import { PERF_METRICS } from '../constants.js';
  import { getOpenVaultData } from '../utils/data.js';
  import { log } from '../utils/logging.js';

  /** @type {Object<string, {ms: number, size: string|null, ts: number}>} */
  let _store = {};

  /**
   * Record a performance metric (last-value-wins).
   * Also persists to chatMetadata.openvault.perf.
   * @param {string} metricId - Key from PERF_METRICS
   * @param {number} durationMs - performance.now() delta
   * @param {string|null} [size=null] - Human-readable scale context
   */
  export function record(metricId, durationMs, size = null) {
      if (!PERF_METRICS[metricId]) return; // ignore unknown

      const entry = { ms: durationMs, size, ts: Date.now() };
      _store[metricId] = entry;

      // Persist to chat metadata
      const data = getOpenVaultData();
      if (data) {
          if (!data.perf) data.perf = {};
          data.perf[metricId] = entry;
      }

      log(`⏱️ [${PERF_METRICS[metricId].label}] ${durationMs.toFixed(2)}ms${size ? ` (${size})` : ''}`);
  }

  /**
   * Get all recorded metrics.
   * @returns {Object<string, {ms: number, size: string|null, ts: number}>}
   */
  export function getAll() {
      return { ..._store };
  }

  /**
   * Load persisted perf data from chatMetadata on chat switch.
   */
  export function loadFromChat() {
      _store = {};
      const data = getOpenVaultData();
      if (data?.perf) {
          for (const [id, entry] of Object.entries(data.perf)) {
              if (PERF_METRICS[id]) {
                  _store[id] = { ...entry };
              }
          }
      }
  }

  /**
   * Format all metrics as copyable plain text.
   * @returns {string}
   */
  export function formatForClipboard() {
      const entries = Object.entries(_store);
      if (entries.length === 0) return 'No perf data recorded yet.';

      const lines = ['OpenVault Performance Report', '═'.repeat(50)];
      for (const [id, entry] of entries) {
          const meta = PERF_METRICS[id];
          if (!meta) continue;
          const sizeStr = entry.size ? ` | ${entry.size}` : '';
          lines.push(`${meta.label.padEnd(22)} ${entry.ms.toFixed(2)}ms${sizeStr}`);
      }
      return lines.join('\n');
  }

  /** @internal Test-only reset */
  export function _resetForTest() {
      _store = {};
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/store.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/perf/store.js tests/perf/store.test.js && git commit -m "feat(perf): create perf store module"`

---

### Task 3: Add 5th tab HTML to settings panel

**Goal:** Add "Perf" tab button and tab content with table structure + clipboard button.

**Step 1: Write the Failing Test**
- File: `tests/perf/tab.test.js`
- Code:
  ```javascript
  import { describe, expect, it } from 'vitest';
  import { readFileSync } from 'fs';
  import { resolve } from 'path';

  describe('perf tab HTML', () => {
      const html = readFileSync(resolve(__dirname, '../../templates/settings_panel.html'), 'utf-8');

      it('has a 5th tab button for perf', () => {
          expect(html).toContain('data-tab="perf"');
      });

      it('has the perf tab content container', () => {
          expect(html).toContain('openvault-tab-content" data-tab="perf"');
      });

      it('has the perf table container', () => {
          expect(html).toContain('id="openvault_perf_table"');
      });

      it('has the clipboard copy button', () => {
          expect(html).toContain('id="openvault_copy_perf_btn"');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: Fails — `data-tab="perf"` not found in HTML

**Step 3: Implementation (Green)**
- File: `templates/settings_panel.html`
- Action 1: Add 5th tab button after the "Advanced" button:
  ```html
  <button class="openvault-tab-btn" data-tab="perf">
      <i class="fa-solid fa-stopwatch"></i> Perf
  </button>
  ```
- Action 2: Add tab content before the closing `</div>` of `inline-drawer-content` (after TAB 4):
  ```html
  <!-- ================================================================
       TAB 5: PERFORMANCE
       ================================================================ -->
  <div class="openvault-tab-content" data-tab="perf">
      <div class="openvault-card">
          <div class="openvault-card-header">
              <span class="openvault-card-title">
                  <i class="fa-solid fa-stopwatch"></i> Last Run Timings
              </span>
              <button id="openvault_copy_perf_btn" class="menu_button" style="padding: 4px 10px; font-size: 0.8em;">
                  <i class="fa-solid fa-clipboard"></i> Copy
              </button>
          </div>
          <table id="openvault_perf_table" class="openvault-perf-table">
              <thead>
                  <tr>
                      <th></th>
                      <th>Metric</th>
                      <th>Last</th>
                      <th>Scale</th>
                      <th></th>
                  </tr>
              </thead>
              <tbody id="openvault_perf_tbody">
                  <tr><td colspan="5" class="openvault-placeholder">No perf data yet</td></tr>
              </tbody>
          </table>
      </div>
  </div>
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add templates/settings_panel.html tests/perf/tab.test.js && git commit -m "feat(perf): add perf tab HTML to settings panel"`

---

### Task 4: Add perf table CSS

**Goal:** Style the perf table with green/red health indicator classes.

**Step 1: Write the Failing Test**
- File: `tests/perf/tab.test.js` (append)
- Code:
  ```javascript
  describe('perf tab CSS', () => {
      const css = readFileSync(resolve(__dirname, '../../style.css'), 'utf-8');

      it('has the perf table base class', () => {
          expect(css).toContain('.openvault-perf-table');
      });

      it('has green and red health indicator classes', () => {
          expect(css).toContain('.openvault-perf-ok');
          expect(css).toContain('.openvault-perf-warn');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: `.openvault-perf-table` not found in CSS

**Step 3: Implementation (Green)**
- File: `style.css`
- Action: Add styles at the end of the file:
  ```css
  /* ─── Perf Tab ─── */
  .openvault-perf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85em;
  }
  .openvault-perf-table th {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      color: var(--SmartThemeEmColor, #888);
      font-weight: 600;
      font-size: 0.8em;
      text-transform: uppercase;
  }
  .openvault-perf-table td {
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      white-space: nowrap;
  }
  .openvault-perf-table td:nth-child(3) {
      font-family: monospace;
      text-align: right;
  }
  .openvault-perf-table td:nth-child(4) {
      color: var(--SmartThemeEmColor, #888);
      font-size: 0.85em;
  }
  .openvault-perf-ok {
      color: #4b4;
  }
  .openvault-perf-warn {
      color: #f44;
  }
  .openvault-perf-neutral {
      color: var(--SmartThemeEmColor, #888);
  }
  .openvault-perf-icon {
      width: 20px;
      text-align: center;
      color: var(--SmartThemeEmColor, #888);
  }
  .openvault-perf-status {
      width: 20px;
      text-align: center;
      font-size: 1.1em;
  }
  .openvault-perf-sync-badge {
      font-size: 0.7em;
      background: rgba(255, 68, 68, 0.2);
      color: #f88;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 4px;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add style.css tests/perf/tab.test.js && git commit -m "feat(perf): add perf table CSS with health indicators"`

---

### Task 5: Wire perf tab rendering into UI (`src/ui/settings.js`)

**Goal:** Add `renderPerfTab()` function, call it from `refreshAllUI()`, wire clipboard button.

**Step 1: Write the Failing Test**
- File: `tests/perf/tab.test.js` (append)
- Code:
  ```javascript
  import { afterEach, beforeEach, vi } from 'vitest';
  import { resetDeps } from '../../src/deps.js';
  import { record, _resetForTest } from '../../src/perf/store.js';

  describe('renderPerfTab', () => {
      beforeEach(() => {
          // Set up DOM with perf table structure
          document.body.innerHTML = `
              <tbody id="openvault_perf_tbody"></tbody>
              <button id="openvault_copy_perf_btn"></button>
          `;
          setupTestContext({ settings: { debugMode: true } });
          _resetForTest();
      });

      afterEach(() => {
          resetDeps();
          document.body.innerHTML = '';
      });

      it('renders a row for each recorded metric', async () => {
          record('memory_scoring', 42.5, '100 memories');
          record('llm_events', 5200);

          const { renderPerfTab } = await import('../../src/ui/settings.js');
          renderPerfTab();

          const rows = document.querySelectorAll('#openvault_perf_tbody tr');
          expect(rows.length).toBe(2);
      });

      it('shows green class when value is within threshold', async () => {
          record('memory_scoring', 50); // threshold is 200

          const { renderPerfTab } = await import('../../src/ui/settings.js');
          renderPerfTab();

          const statusCell = document.querySelector('#openvault_perf_tbody .openvault-perf-status');
          expect(statusCell.classList.contains('openvault-perf-ok')).toBe(true);
      });

      it('shows red class when value exceeds threshold', async () => {
          record('memory_scoring', 500); // threshold is 200

          const { renderPerfTab } = await import('../../src/ui/settings.js');
          renderPerfTab();

          const statusCell = document.querySelector('#openvault_perf_tbody .openvault-perf-status');
          expect(statusCell.classList.contains('openvault-perf-warn')).toBe(true);
      });

      it('shows placeholder when no data recorded', async () => {
          const { renderPerfTab } = await import('../../src/ui/settings.js');
          renderPerfTab();

          const tbody = document.getElementById('openvault_perf_tbody');
          expect(tbody.innerHTML).toContain('No perf data');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: `renderPerfTab is not exported`

**Step 3: Implementation (Green)**
- File: `src/ui/settings.js`
- Action 1: Add imports at top:
  ```javascript
  import { PERF_METRICS, PERF_THRESHOLDS } from '../constants.js';
  import { getAll as getPerfData, formatForClipboard, loadFromChat as loadPerfFromChat } from '../perf/store.js';
  ```
- Action 2: Add `renderPerfTab()` function and export it:
  ```javascript
  export function renderPerfTab() {
      const tbody = document.getElementById('openvault_perf_tbody');
      if (!tbody) return;

      const data = getPerfData();
      const entries = Object.entries(data);

      if (entries.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="openvault-placeholder">No perf data yet</td></tr>';
          return;
      }

      // Render in PERF_METRICS key order so order is stable
      const rows = [];
      for (const [id, meta] of Object.entries(PERF_METRICS)) {
          const entry = data[id];
          if (!entry) continue;
          const threshold = PERF_THRESHOLDS[id];
          const isOk = entry.ms <= threshold;
          const statusClass = isOk ? 'openvault-perf-ok' : 'openvault-perf-warn';
          const statusIcon = isOk ? '●' : '●';
          const syncBadge = meta.sync ? '<span class="openvault-perf-sync-badge">SYNC</span>' : '';
          rows.push(`<tr>
              <td class="openvault-perf-icon"><i class="fa-solid ${meta.icon}"></i></td>
              <td>${meta.label}${syncBadge}</td>
              <td class="${statusClass}">${entry.ms.toFixed(2)}ms</td>
              <td>${entry.size || '—'}</td>
              <td class="openvault-perf-status ${statusClass}">${statusIcon}</td>
          </tr>`);
      }
      tbody.innerHTML = rows.join('');
  }
  ```
- Action 3: In `refreshAllUI()`, add `renderPerfTab()` call.
- Action 4: In initialization / event binding, wire the copy button:
  ```javascript
  $('#openvault_copy_perf_btn').on('click', () => {
      const text = formatForClipboard();
      navigator.clipboard.writeText(text).then(
          () => showToast('success', 'Perf data copied to clipboard'),
          () => showToast('error', 'Failed to copy — try selecting manually')
      );
  });
  ```
- Action 5: In `onChatChanged` handler (or wherever `loadFromChat` belongs), call `loadPerfFromChat()`.

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/tab.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/ui/settings.js tests/perf/tab.test.js && git commit -m "feat(perf): wire renderPerfTab into UI with clipboard support"`

---

### Task 6: Instrument sync critical path — `autoHideOldMessages` + `onBeforeGeneration`

**Goal:** Add `record()` calls for `auto_hide` and `retrieval_injection` metrics.

**Step 1: Write the Failing Test**
- File: `tests/perf/instrumentation.test.js`
- Code:
  ```javascript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { resetDeps } from '../../src/deps.js';
  import { getAll, _resetForTest } from '../../src/perf/store.js';

  describe('perf instrumentation - events.js', () => {
      beforeEach(() => {
          _resetForTest();
      });
      afterEach(() => {
          resetDeps();
          vi.restoreAllMocks();
      });

      it('autoHideOldMessages records auto_hide metric', async () => {
          setupTestContext({
              context: {
                  chat: [
                      { mes: 'hi', is_user: true, is_system: false },
                      { mes: 'hello', is_user: false, is_system: false },
                  ],
                  chatMetadata: { openvault: { memories: [], processed_message_ids: [0, 1] } },
              },
              settings: { autoHideEnabled: true, visibleChatBudget: 999999 },
              deps: { saveChatConditional: vi.fn(async () => true) },
          });

          const { autoHideOldMessages } = await import('../../src/events.js');
          await autoHideOldMessages();

          // Even if nothing was hidden (under budget), the timing should be recorded
          const all = getAll();
          expect(all.auto_hide).toBeDefined();
          expect(all.auto_hide.ms).toBeGreaterThanOrEqual(0);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: `auto_hide` not in store

**Step 3: Implementation (Green)**
- File: `src/events.js`
- Action 1: Add import: `import { record } from './perf/store.js';`
- Action 2: In `autoHideOldMessages()`, wrap the body:
  ```javascript
  export async function autoHideOldMessages() {
      const t0 = performance.now();
      // ... existing body ...
      record('auto_hide', performance.now() - t0);
  }
  ```
  Note: the `record()` call should be placed at the very end, after the existing `log()` call, right before the closing brace. Wrap in try/finally if needed to ensure it fires even on early returns.

  Better pattern for early returns:
  ```javascript
  export async function autoHideOldMessages() {
      const t0 = performance.now();
      try {
          // ... existing body unchanged ...
      } finally {
          record('auto_hide', performance.now() - t0);
      }
  }
  ```
- Action 3: In `onBeforeGeneration()`, wrap the retrieval section:
  ```javascript
  // Before: await withTimeout(updateInjection(...), ...)
  const t0Retrieval = performance.now();
  await withTimeout(updateInjection(pendingUserMessage), RETRIEVAL_TIMEOUT_MS, 'Memory retrieval');
  record('retrieval_injection', performance.now() - t0Retrieval);
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/events.js tests/perf/instrumentation.test.js && git commit -m "feat(perf): instrument autoHide and pre-gen injection"`

---

### Task 7: Instrument memory scoring (`src/retrieval/math.js`)

**Goal:** Replace existing hardcoded `console.log` with `record()` call.

**Step 1: Write the Failing Test**
- File: `tests/perf/instrumentation.test.js` (append)
- Code:
  ```javascript
  describe('perf instrumentation - math.js', () => {
      it('scoreMemories records memory_scoring metric with memory count', async () => {
          _resetForTest();
          setupTestContext({ settings: { debugMode: true } });

          const { scoreMemories } = await import('../../src/retrieval/math.js');
          const memories = [
              { summary: 'test event', importance: 3, sequence: 100, tokens: ['test'], archived: false },
              { summary: 'another event', importance: 5, sequence: 200, tokens: ['another'], archived: false },
          ];

          // Minimal constants for scoring
          const constants = { lambda: 0.05, imp5Floor: 5, combinedWeight: 15, alpha: 0.7, vectorThreshold: 0.5 };
          await scoreMemories(memories, null, 300, constants, {}, ['test', 'query']);

          const all = getAll();
          expect(all.memory_scoring).toBeDefined();
          expect(all.memory_scoring.ms).toBeGreaterThanOrEqual(0);
          expect(all.memory_scoring.size).toContain('2');
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: `memory_scoring` not in store

**Step 3: Implementation (Green)**
- File: `src/retrieval/math.js`
- Action 1: Add import: `import { record } from '../perf/store.js';`
- Action 2: Replace the `console.log` at line ~342 with:
  ```javascript
  const duration = performance.now() - start;
  record('memory_scoring', duration, `${memories.length} memories`);
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/retrieval/math.js tests/perf/instrumentation.test.js && git commit -m "feat(perf): replace console.log with record() in scoreMemories"`

---

### Task 8: Instrument event dedup (`src/extraction/extract.js` — `filterSimilarEvents`)

**Goal:** Add `record()` wrapping `filterSimilarEvents`.

**Step 1: Write the Failing Test**
- File: `tests/perf/instrumentation.test.js` (append)
- Code:
  ```javascript
  describe('perf instrumentation - extract.js dedup', () => {
      it('filterSimilarEvents records event_dedup metric with size context', async () => {
          _resetForTest();
          setupTestContext({ settings: { debugMode: true } });

          const { filterSimilarEvents } = await import('../../src/extraction/extract.js');
          const newEvents = [{ summary: 'event A', tokens: ['event', 'a'] }];
          const existing = [{ summary: 'event B', tokens: ['event', 'b'] }];

          await filterSimilarEvents(newEvents, existing);

          const all = getAll();
          expect(all.event_dedup).toBeDefined();
          expect(all.event_dedup.size).toContain('1'); // new count
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: `event_dedup` not in store

**Step 3: Implementation (Green)**
- File: `src/extraction/extract.js`
- Action 1: Add import: `import { record } from '../perf/store.js';`
- Action 2: Wrap `filterSimilarEvents` body:
  ```javascript
  export async function filterSimilarEvents(newEvents, existingMemories, cosineThreshold = 0.92, jaccardThreshold = 0.6) {
      const t0 = performance.now();
      // ... existing Phase 1 + Phase 2 code ...
      record('event_dedup', performance.now() - t0, `${newEvents.length}×${existingMemories?.length || 0} O(n×m)`);
      return kept;
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/extraction/extract.js tests/perf/instrumentation.test.js && git commit -m "feat(perf): instrument filterSimilarEvents dedup"`

---

### Task 9: Instrument LLM calls — events + graph (`src/extraction/extract.js`)

**Goal:** Add `record()` around the two `callLLM` calls in `extractMemories`.

**Step 1: Approach**
The two `callLLM` calls in `extractMemories` (lines ~411, ~432) are inside a large orchestrator function that's integration-tested. We'll add timing directly without a separate unit test — the store test from Task 2 already validates `record()` works. Verify by running the existing extraction integration tests.

**Step 2: Implementation**
- File: `src/extraction/extract.js`
- Action: Wrap both callLLM calls:
  ```javascript
  // Stage 3A: Event Extraction (LLM Call 1)
  const t0Events = performance.now();
  const eventJson = await callLLM(prompt, LLM_CONFIGS.extraction_events, { structured: true });
  record('llm_events', performance.now() - t0Events);

  // ... later ...

  // Stage 3B: Graph Extraction (LLM Call 2)
  const t0Graph = performance.now();
  const graphJson = await callLLM(graphPrompt, LLM_CONFIGS.extraction_graph, { structured: true });
  record('llm_graph', performance.now() - t0Graph);
  ```

**Step 3: Verify**
- Command: `npm test tests/extraction/extract.test.js`
- Expect: PASS (existing tests still green)

**Step 4: Git Commit**
- `git add src/extraction/extract.js && git commit -m "feat(perf): instrument LLM event + graph extraction calls"`

---

### Task 10: Instrument entity merge (`src/extraction/extract.js` — graph update loop)

**Goal:** Add `record()` around the entity merge loop in `extractMemories`.

**Step 1: Implementation**
- File: `src/extraction/extract.js`
- Action: Wrap the entity loop (around line ~486–500):
  ```javascript
  const t0Merge = performance.now();
  const existingNodeCount = Object.keys(data.graph.nodes).length;
  for (const entity of validated.entities) {
      await mergeOrInsertEntity(data.graph, entity.name, entity.type, entity.description, entityCap, settings);
  }
  record('entity_merge', performance.now() - t0Merge, `${validated.entities.length}×${existingNodeCount} nodes`);
  ```

**Step 2: Verify**
- Command: `npm test tests/extraction/extract.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/extraction/extract.js && git commit -m "feat(perf): instrument entity merge loop"`

---

### Task 11: Instrument embedding generation (`src/embeddings.js`)

**Goal:** Add `record()` around `enrichEventsWithEmbeddings`.

**Step 1: Implementation**
- File: `src/embeddings.js`
- Action 1: Add import: `import { record } from './perf/store.js';`
- Action 2: Wrap the batch processing in `enrichEventsWithEmbeddings`:
  ```javascript
  export async function enrichEventsWithEmbeddings(events, { signal } = {}) {
      // ... existing guards ...
      const t0 = performance.now();
      // ... existing processInBatches logic ...
      const source = /* existing source variable */;
      record('embedding_generation', performance.now() - t0, `${validEvents.length} embeddings via ${source}`);
      // ... rest ...
  }
  ```

**Step 2: Verify**
- Command: `npm test tests/embeddings.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/embeddings.js && git commit -m "feat(perf): instrument embedding generation"`

---

### Task 12: Instrument Louvain + community summaries (`src/graph/communities.js`)

**Goal:** Add `record()` for `louvain_detection` in `detectCommunities` and `llm_communities` in `updateCommunitySummaries`.

**Step 1: Implementation**
- File: `src/graph/communities.js`
- Action 1: Add import: `import { record } from '../perf/store.js';`
- Action 2: Wrap `detectCommunities`:
  ```javascript
  export function detectCommunities(graphData, mainCharacterKeys = []) {
      if (Object.keys(graphData.nodes || {}).length < 3) return null;
      const t0 = performance.now();
      // ... existing body ...
      const nodeCount = Object.keys(graphData.nodes).length;
      const edgeCount = Object.keys(graphData.edges || {}).length;
      record('louvain_detection', performance.now() - t0, `${nodeCount} nodes, ${edgeCount} edges`);
      return { communities: details.communities, count: details.count };
  }
  ```
  Note: there are two return paths (normal + fallback). Wrap both or use a let+finally pattern.
- Action 3: Wrap `updateCommunitySummaries`:
  ```javascript
  export async function updateCommunitySummaries(...) {
      const t0 = performance.now();
      // ... existing body ...
      const communityCount = Object.keys(updatedCommunities).length;
      record('llm_communities', performance.now() - t0, `${communityCount} communities`);
      return updatedCommunities;
  }
  ```

**Step 2: Verify**
- Command: `npm test tests/graph/communities.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/graph/communities.js && git commit -m "feat(perf): instrument Louvain and community summaries"`

---

### Task 13: Instrument reflection LLM calls (`src/reflection/reflect.js`)

**Goal:** Add `record()` for `llm_reflection` around `generateReflections`.

**Step 1: Implementation**
- File: `src/reflection/reflect.js`
- Action 1: Add import: `import { record } from '../perf/store.js';`
- Action 2: Wrap `generateReflections`:
  ```javascript
  export async function generateReflections(characterName, allMemories, characterStates) {
      const t0 = performance.now();
      // ... existing body ...
      record('llm_reflection', performance.now() - t0);
      return toAdd;
  }
  ```

**Step 2: Verify**
- Command: `npm test tests/reflection/reflect.test.js`
- Expect: PASS

**Step 3: Git Commit**
- `git add src/reflection/reflect.js && git commit -m "feat(perf): instrument reflection LLM calls"`

---

### Task 14: Instrument chat save (`src/utils/data.js`)

**Goal:** Add `record()` around `saveOpenVaultData`.

**Step 1: Write the Failing Test**
- File: `tests/perf/instrumentation.test.js` (append)
- Code:
  ```javascript
  describe('perf instrumentation - data.js', () => {
      it('saveOpenVaultData records chat_save metric', async () => {
          _resetForTest();
          setupTestContext({
              context: { chatMetadata: { openvault: { memories: [] } } },
              deps: { saveChatConditional: vi.fn(async () => true) },
              settings: { debugMode: true },
          });

          const { saveOpenVaultData } = await import('../../src/utils/data.js');
          await saveOpenVaultData();

          const all = getAll();
          expect(all.chat_save).toBeDefined();
          expect(all.chat_save.ms).toBeGreaterThanOrEqual(0);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npm test tests/perf/instrumentation.test.js`
- Expect: `chat_save` not in store

**Step 3: Implementation (Green)**
- File: `src/utils/data.js`
- Action 1: Add import: `import { record } from '../perf/store.js';`
- Action 2: Wrap `saveOpenVaultData`:
  ```javascript
  export async function saveOpenVaultData(expectedChatId = null) {
      const t0 = performance.now();
      // ... existing chat-ID guard ...
      try {
          await getDeps().saveChatConditional();
          record('chat_save', performance.now() - t0);
          log('Data saved to chat metadata');
          return true;
      } catch (error) {
          record('chat_save', performance.now() - t0);
          // ... existing error handling ...
      }
  }
  ```

**Step 4: Verify (Green)**
- Command: `npm test tests/perf/instrumentation.test.js && npm test tests/utils/data.test.js`
- Expect: PASS

**Step 5: Git Commit**
- `git add src/utils/data.js tests/perf/instrumentation.test.js && git commit -m "feat(perf): instrument chat save"`

---

### Task 15: Wire `loadFromChat` into `onChatChanged` and full integration smoke test

**Goal:** Ensure perf data loads from chat metadata on chat switch and all existing tests pass.

**Step 1: Implementation**
- File: `src/events.js`
- Action: In `onChatChanged()`, add `loadPerfFromChat()` call after `refreshAllUI()`:
  ```javascript
  import { loadFromChat as loadPerfFromChat } from './perf/store.js';
  // ... in onChatChanged():
  loadPerfFromChat();
  ```

**Step 2: Verify — Full Test Suite**
- Command: `npm test`
- Expect: ALL tests PASS, no regressions

**Step 3: Git Commit**
- `git add src/events.js && git commit -m "feat(perf): wire loadFromChat into onChatChanged"`

---

## Summary

| Task | Files Changed | What |
|------|---------------|------|
| 1 | `constants.js` | `PERF_THRESHOLDS` + `PERF_METRICS` |
| 2 | `perf/store.js` (new) | Singleton store: `record`, `getAll`, `loadFromChat`, `formatForClipboard` |
| 3 | `settings_panel.html` | 5th tab HTML |
| 4 | `style.css` | Perf table CSS |
| 5 | `ui/settings.js` | `renderPerfTab()`, clipboard wiring |
| 6 | `events.js` | Instrument `autoHide` + `onBeforeGeneration` |
| 7 | `retrieval/math.js` | Replace `console.log` with `record()` |
| 8 | `extraction/extract.js` | Instrument `filterSimilarEvents` |
| 9 | `extraction/extract.js` | Instrument 2 LLM calls |
| 10 | `extraction/extract.js` | Instrument entity merge loop |
| 11 | `embeddings.js` | Instrument `enrichEventsWithEmbeddings` |
| 12 | `graph/communities.js` | Instrument Louvain + community summaries |
| 13 | `reflection/reflect.js` | Instrument `generateReflections` |
| 14 | `utils/data.js` | Instrument `saveOpenVaultData` |
| 15 | `events.js` | Wire `loadFromChat` into `onChatChanged` + full regression |
