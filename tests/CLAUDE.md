# Testing Subsystem (Vitest + JSDOM)

## CORE RULES & CONSTRAINTS

1. **Zero `vi.mock()`**: NEVER use `vi.mock()` on internal or ST modules (except for minor `embeddings.js` edge cases if explicitly required). 
2. **Single I/O Boundary**: All external ST/Browser boundaries are mocked through `setupTestContext({ deps: { ... } })` in `tests/setup.js`. This overrides the injection in `src/deps.js`.
3. **Data, Not Implementation**: Assert on output data (`mockData.memories`, `mockData.graph`, prompt slot content), not on spy call counts.
4. **Module-Level State**: Worker tests MUST use `vi.resetModules()` in `beforeEach` to reset mutable top-level variables (like `isRunning` in `worker.js`).
5. **No DOM Mocks for Math/Helpers**: Test pure functions (`helpers.js`, `math.js`) by passing objects directly.

## ESM URL ALIASING
Production code uses bare URLs (e.g., `https://esm.sh/graphology`). Node/Vitest cannot resolve these natively.
- **Requirement**: Any CDN package MUST be aliased in `vitest.config.js` to a local `node_modules/` path.
- **Requirement**: You must `npm install --save-dev` the package to make it available to the alias.

## EMBEDDING MOCKS
Do not run real Transformers.js models in Vitest. 
- Force the 'ollama' strategy in test settings (`embeddingSource: 'ollama'`).
- Mock `deps.fetch` to return `{ ok: true, json: () => ({ embedding: [0.1, 0.2] }) }`.

## UI RENDERING TESTS
`render.js` and `status.js` run real code. jQuery on empty JSDOM selections is a silent no-op. If you need to test DOM output, use string templates from `templates.js` directly, or mount standard HTML to the JSDOM document before running.

## PERF TEST SUITE (`tests/perf/`)
- **`store.test.js`**: Unit tests for perf store singleton — `record()`, `getAll()`, `loadFromChat()`, `formatForClipboard()`. Uses `_resetForTest()` for isolation.
- **`tab.test.js`**: HTML/CSS presence tests for Perf tab UI structure.
- **`instrumentation.test.js`**: Validates that `record()` is called in instrumented code paths (`autoHide`, memory scoring, event dedup, chat save).