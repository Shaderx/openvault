# Testing Subsystem (Vitest)

## WHAT
All unit tests for OpenVault using Vitest + JSDOM. Covers extraction, retrieval, graph, reflection, and communities.

## HOW
- **Run**: `npm run test`
- **Mocks**: ST globals injected via `src/deps.js`. Use `setDeps({...})` before, `resetDeps()` after.
- **Stubs**: ST deps stubbed in `/tests/stubs/`. Don't import ST files outside project.

## RULES & GOTCHAS
- **Dependency Injection**: `setDeps()` before, `resetDeps()` after each test. Non-negotiable.
- **Pure Functions**: Test `src/ui/helpers.js`, `src/retrieval/math.js` by direct argument passing. No DOM mocks.
- **ESM URL Aliasing**: Production uses `https://esm.sh/...`. Vitest maps these to `node_modules` via `vitest.config.js`. Includes `graphology`, `graphology-communities-louvain`, `graphology-operators`.
- **New Package?** Add `npm install --save-dev <package>` AND add alias in vitest.config.js.
- **Module-Level State**: Worker tests (`tests/extraction/worker.test.js`) use `vi.resetModules()` in `beforeEach` to reset module-level variables (`isRunning`, `wakeGeneration`). Required for any module with mutable top-level state.

## STRICT MOCKING RULES

1. **Zero `vi.mock()`.** Never use `vi.mock()` on any module. Not internal, not external.
2. **Single Boundary: `deps.js`.** All external I/O is mocked exclusively via `setupTestContext({ deps: { ... } })`.
3. **External boundaries** mocked through deps: `connectionManager.sendRequest` (LLM), `fetch` (embeddings/network), `saveChatConditional` (persistence), `showToast` (notifications).
4. **Embeddings in tests** use Ollama strategy: set `embeddingSource: 'ollama'`, `ollamaUrl`, `embeddingModel` in test settings. Mock `fetch` via deps to return `{ embedding: [...] }`.
5. **Test Data, Not Implementation.** Assert on output data (`mockData.memories`, `mockData.graph`, prompt slot content), never on whether internal functions were called.
6. **UI modules** (`render.js`, `status.js`) run real code. jQuery on empty JSDOM selections is a silent no-op — no mocking needed.