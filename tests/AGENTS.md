# Testing subsystem (Vitest)

## Boundaries

Test pure transforms with direct inputs and outputs. Test orchestration at injected host/network boundaries using `setupTestContext()` and `getDeps()`; exercise the actual composed path whose behavior matters.

Each integration test should cover a distinct invariant or failure boundary. There is no arbitrary file lock or test-count cap: migration shapes, archive/rebuild persistence, cancellation races and retrieval wiring need their own regressions. Keep permutations of pure logic in the corresponding unit suite.

Prefer injected external dependencies. Narrow internal spies/mocks are justified for otherwise inaccessible asynchronous failures, lazy-import rejection, or expensive model setup; keep the behavior being asserted real and name the seam. Broad mocking of orchestration under test is not evidence of production composition.

## Fixtures and timing

- Use `tests/factories.js` for ordinary memory/graph fixtures. Use explicit partial objects for legacy migration shapes and merge/collision field combinations where factory defaults hide the condition.
- Production graph nodes and edges are keyed objects. Boundary tests should reflect persisted shapes, including absent/partially migrated fields.
- Use fake timers or controlled deferred promises. Attach rejection assertions before advancing timers. Avoid wall-clock sleeps.
- Tests mirror source directories. Group same-behavior variants with `it.each`.

## Protocol assertions

Assert source IDs, coverage, length limits, structure and required protocol tokens. Avoid exact arbitrary prompt prose or prose snapshots. UI interaction changes need event-level checks; static layout checks can read templates directly.

## Host and CDN setup

Provide `saveChatConditional` for store mutations, and reset graph/data per test. Inspect ST changesets and numeric hash types at real synchronization boundaries.

`tests/setup.js` registers local packages through `_setTestOverride`; call `registerCdnOverrides()` after `vi.resetModules()` when required. Test-only bare package imports are valid. Keep browser network/model loading out of unit tests and report live-host/WebGPU validation separately.
