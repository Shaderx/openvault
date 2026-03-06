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