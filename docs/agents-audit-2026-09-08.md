# AGENTS.md audit — 2026-09-08

## Verdict and scope

The product vision still applies, but the instructions do not fully describe the current fork. OpenVault remains an unbundled, local-first SillyTavern memory extension with witness tracking, relationships, reflections, and provider-independent structured LLM calls. Its architecture now combines an immutable narrative archive with dynamic scene recall and current-world state. The old description emphasizes the dynamic RAG system and omits important archive/rebuild invariants.

Reviewed all 13 repository AGENTS.md files against the current working tree, including the user's uncommitted changes, at HEAD `48b62ca`. Three Luna subagents audited the domain groups. The 12 domain files preserve the previous CLAUDE.md guidance, apart from renamed references and Markdown formatting. The root preserves the old architecture rules and adds agent-workflow links. This is inherited documentation drift, not evidence that renaming the files changed behavior.

This is an inspection report. No application code or instruction files were changed. Subagents ran targeted prompt/retrieval checks (12 files, 215 passing tests) and the existing migration suite (14 passing tests). Those results do not establish correctness for the uncovered paths described below.

## Highest-priority changes

### 1. Describe the archive and dynamic memory as separate systems

The root vision and directory map (`AGENTS.md:3`, `AGENTS.md:30`) omit `src/archive/`, `src/rebuild/`, and the task-aware embedding layer.

The archive maintains sealed segments and a bounded projection, with explicit persistence/recovery checkpoints (`src/archive/archive.js:118`, `:138`, `:265`, `:485`). Extraction now requires per-source coverage and separate short fallback summaries; those fallback records are excluded from semantic enrichment (`src/extraction/extract.js:168`, `:1029`, `:1261`, `:1322`). These are architectural requirements, not incidental implementation details.

Add guidance for source attribution, coverage before hiding, persistence before source deactivation, sealed-entry integrity, bounded projection selection, protected-entry overflow, and recovery. Add archive/rebuild/embedding pointers to the root map; dedicated scoped instructions would keep the root concise.

Suggested vision:

> OpenVault preserves long-running roleplay through immutable narrative history, POV-aware dynamic recall, and evolving world and character state. Durable chat data lives in SillyTavern metadata; optional vector indexes are derived state. No separately operated database is required. Embeddings default to local execution, and structured extraction supports configurable LLM providers.

### 2. State the actual POV boundary

The immutable archive is narrative reference data. Its preamble explicitly says narrative knowledge does not grant character knowledge (`src/archive/archive.js:13`); entries carry witness/visibility metadata (`:328`). Projection selection does not take a POV-character argument (`:138`). Dynamic memory uses `filterMemoriesByPOV` (`src/retrieval/retrieve.js:658`), whose accessible set includes witnesses, involved characters, and explicitly known events (`src/pov.js:43`).

Keep the POV-aware vision, but do not describe every injected token as mechanically witness-filtered. The archive's character-knowledge separation depends on model adherence to its instructions and metadata. A stronger guarantee would require a separate product/code decision, not a documentation-only correction.

### 3. Document schema v5 and the rebuild gate

The migration registry declares version 5 (`src/store/migrations/index.js:6`), and v5 deliberately marks legacy data `needs_rebuild` while clearing the old archive representation (`src/store/migrations/v5.js:8`). Full rebuild preserves recovery data, fixes a source boundary, restores OpenVault-hidden messages, and gates activation (`src/rebuild/rebuild.js:72`).

The migration guide currently describes generic sequential structural upgrades without this essential distinction. Retrieval's reference to serving unmigrated v2 data (`src/retrieval/AGENTS.md:9`) should be scoped to compatibility helpers/fixtures, not presented as an allowed production retrieval path.

The root-designated authoritative source is itself stale: `include/DATA_SCHEMA.md:6` and `:29` say schema v4. `codebase.md:48` still describes schema v3 initialization. Update these sources together with the instructions so agents are not sent to conflicting authorities.

### 4. Correct the CDN test workflow without weakening pinning

`AGENTS.md:12` and `src/graph/AGENTS.md:37` describe CDN URL aliases in Vitest. The current configuration aliases SillyTavern modules; CDN packages instead load through `CDN_SPECS` and `_setTestOverride` in `tests/setup.js:62`. `tests/AGENTS.md:17` already describes the override mechanism.

Scope the no-bare-import rule to browser runtime code; Node scripts and test setup necessarily use package imports. Preserve the requirement for pinned browser dependencies. There is a separate implementation concern: `resolveVersion` splits scoped names at the first slash (`src/utils/cdn.js:66`), so the `@huggingface/transformers` entry is not resolved by its full map key even though `src/embeddings.js:325` imports it through this helper. That is code drift to fix, not a reason to remove pinning guidance.

## Rules worth retaining

- Unbundled browser ESM and centralized dependency injection.
- Settings/defaults boundaries and centrally named cross-module constants.
- Chat-id guarded persistence and session cancellation before the enabled check; the ordering is present in `src/events.js:164`.
- Generated types from schemas, explicit cancellation handling, and yielding during heavy browser work.
- Vector collection isolation and structured synchronization changes.
- Progressive disclosure and thin UI orchestration.
- Behavioral tests at appropriate boundaries rather than brittle prompt snapshots.
- The pre-commit check requirement: `.githooks/pre-commit` invokes `npm run check`, and this checkout configures `.githooks` as its hooks path.

Existing violations of these rules should be evaluated as code issues. For example, `src/rebuild/rebuild.js:81` reads raw extension settings despite the root settings boundary. Do not rewrite sound constraints simply to make the current code appear compliant.

## Linked agent-workflow documents

The new `docs/agents/domain.md` describes a future single-context layout, but this checkout has no root CONTEXT.md or docs/adr directory. Its missing-file allowance prevents a blocker; its wording should distinguish intended layout from existing documentation and point readers to actual project references.

The issue-tracker and triage-label documents describe workflow conventions. This audit did not verify remote GitHub label configuration. Their existence is not evidence of a product architecture change.

## Domain audit findings

### Storage, migrations, graph, and reflection

- **Storage:** Retain guarded saves and the `stChanges` contract. Expand schema guidance to distinguish migrations that backfill usable data from migrations that deliberately require a rebuild. Include lifecycle gates and archive state. The universal prohibition on direct domain mutation also needs a deliberate ownership decision for archive/rebuild orchestration; silently documenting every current exception would weaken the intended repository boundary.
- **Migrations:** Describe v4/v5 invalidation and rebuild activation explicitly. Preserve the four-item-type embedding invariant (memories, nodes, edges, communities). The rollback example should show a captured expected chat ID when saving, consistent with the storage guide.
- **Graph:** The community interval is configurable and defaults to 100 (`src/constants.js:120`), rather than the documented 50 (`src/graph/AGENTS.md:27`). The claimed under-three-node fallback is unreachable after `detectCommunities` returns early (`src/graph/communities.js:81`). Cross-script edit distance is length-dependent (`src/graph/graph.js:53`). Add current relationship status/validity and community freshness rules: resolved/superseded edges are excluded from clustering (`src/graph/communities.js:59`), and summary validity depends on current graph inputs. Preserve semantic matching versus retrieval embedding distinctions.
- **Reflection:** Replace the fixed 50-event candidate description with token-budgeted selection (`src/reflection/reflect.js:240`). Correct provenance: `source_ids` stores event evidence, while `parent_ids` stores reflection evidence (`:312`). Importance is clamped model output with fallback 4, not always 4 (`:321`). The promised accumulator restoration on failure is absent: extraction resets it before the call and only logs failures (`src/extraction/extract.js:826`, `:841`). This needs an explicit retry-policy decision; documentation should not promise restoration meanwhile. Document independent generation/injection controls.

### Extraction, retrieval, prompts, and services

- **Extraction:** Worker wake/cancellation, turn boundaries, swipe protection, emergency bypass, and deferred Phase 2 remain applicable. Add source attribution and complete fallback coverage before compaction. Update the best-effort Phase 2 explanation to account for exclusion of fallback-only memories (`src/extraction/extract.js:1441`).
- **Retrieval:** Keep score safety, entity anchors, multilingual intent, and soft balancing. Add the separate archive budget, projection checkpoints, dynamic recall cap, lifecycle gates, and precise POV scope. Treat ST Vector community routing as a desired but currently incomplete integration, rather than an established production guarantee.
- **Prompts:** Keep shared builders, constraint ordering, and multilingual examples. Describe paired `<think>...</think>` blocks rather than requiring the self-closing `<think/>` spelling: the formatter actually emits paired tags (`src/prompts/shared/format-examples.js:16`). Do not promise that constraint placement “guarantees” model compliance; validation and fallback remain necessary. Add the specialized coverage-fallback prompt and its source-ID/length contract. Distinguish optional language mirroring from the fork's English settings migration (`src/settings.js:40`).
- **Services:** CSRF, chat-scoped collections, OV_ID extraction, and raw transport boundaries still apply. Preserve separation between domain-produced `stChanges` and service CRUD batches. Clarify that SillyTavern Vector Storage is an optional derived index; the root's “all state” shorthand does not literally describe settings, runtime caches, or this index.

## Separate implementation discrepancies

These are not reasons to relax the corresponding rules, and no fixes were made as part of this audit.

1. **Legacy graph migration can throw.** `src/store/migrations/v2.js:79` uses `for...of data.graph?.nodes`; graph nodes are keyed objects. The existing migration test uses array-shaped nodes (`tests/store/migrations.test.js:60`), so its passing result misses this case. The same migration omits edge embeddings. This can prevent an affected legacy chat from reaching the newer rebuild flow.
2. **ST Vector local-community routing is incomplete.** Retrieval context does not include communities (`src/retrieval/retrieve.js:180`); world context is built before selection and without `stCommunityIds` (`:504`); returned community IDs are not consumed (`:542`). The local-community ST Vector path requires those IDs (`src/retrieval/world-context.js:65`). Macro world-state handling is a separate path. Targeted passing tests do not establish this end-to-end wiring.
3. **Reflection accumulator behavior conflicts with documentation.** Failure currently consumes the accumulated importance. Decide whether bounded retry/restoration or consumption is intended before changing either behavior or its promise.
4. **Vector synchronization is incomplete on some mutations.** Entity rename deletes old edge hashes without queuing rewritten edges for synchronization (`src/store/chat-data.js:243`); entity deletion removes connected edges without their vector deletions (`:352`). Reflection replacement/capping archives old records without emitting deletion changes for their old vectors (`src/reflection/reflect.js:223`, `:363`). Preserve and extend the contract to cover these paths.
5. **Scoped CDN pin resolution misses Transformers.** See the CDN finding above.
6. **A prohibited schema escape remains.** `src/extraction/structured.js:16` uses `z.any()` despite the root prohibition. Keep the prohibition and fix the schema separately.

### UI, utilities, performance, and tests

- **UI:** Replace the old World-tab overview with the actual Entities/Communities split (`templates/settings_panel.html:11`). Settings binding belongs in `bindUIElements` (`src/ui/settings.js:819`); `initBrowser` owns browser/list event delegation (`src/ui/render.js:906`). Keep payload thresholds, settings-reset preservation, escaping, and progressive disclosure. Missing catches on imports (`src/ui/render.js:421`, `:951`) and missing Escape propagation handling (`src/ui/settings.js:58`) are implementation discrepancies, not obsolete safety requirements.
- **Utilities:** Codec compatibility, JSON parsing, turn boundaries, timeout cleanup, description merging, and AIMD guidance mostly fit. Raw logging remains in CDN/queue infrastructure (`src/utils/cdn.js:130`, `src/utils/queue.js:74`); resolve those boundary exceptions deliberately instead of assuming the logging rule describes every call site.
- **Performance:** Replace the frozen metric count (12) with a reference to `PERF_METRICS`, currently 13 entries (`src/constants.js:356`). `record()` updates the in-memory chat metadata object and does not independently call the durable save API (`src/perf/store.js:15`); clarify the word “auto-saves.” Separate code discrepancy: `global_synthesis` is recorded (`src/graph/communities.js:620`) but absent from the registry, so the store discards it.
- **Tests:** The 3–5 orchestrator-test cap and internal-mocking prohibition describe a desired discipline, not the existing suite. Graph, community, and UI tests already mock internal modules; orchestrator files exceed the cap. Clarify how to apply these constraints to new work without suppressing necessary archive/rebuild regression coverage. Preserve the preference for behavior over prompt prose snapshots; allow structural protocol checks only where they test a real contract. Real timer waits also remain despite the rule. The CDN override instructions are current.

## Coverage and recommended order

| AGENTS.md | Verdict |
| --- | --- |
| Root | Vision retained; architecture and dependency-test wording need revision. |
| src/store | Retain persistence/sync rules; add archive ownership and lifecycle gates. |
| src/store/migrations | Substantial update for invalidation and mandatory rebuilds. |
| src/graph | Retain graph/semantic design; update intervals, edge state, community validity, and fallback claim. |
| src/reflection | Substantial update for candidates, provenance, importance, and failure behavior. |
| src/extraction | Core pipeline still fits; add source coverage and fallback invariants. |
| src/retrieval | Substantial update for archive/dynamic split and incomplete ST community routing. |
| src/prompts | Keep builders; fix tag wording, qualify language policy, add fallback contract. |
| src/services | Largely current; retain transport and isolation boundaries. |
| src/ui | Mostly current; fix tab map and binding location. |
| src/utils | Mostly current; resolve logging exceptions and scoped dependency pinning. |
| src/perf | Small factual corrections; investigate discarded synthesis metric. |
| tests | Refresh policy to guide necessary regression coverage and acknowledge existing debt. |

First update the root vision, schema authority, and archive/rebuild invariants. Next correct retrieval, reflection, and graph descriptions. Then resolve the smaller UI/performance/dependency workflow wording and clarify testing policy. Track the implementation discrepancies separately so documentation cleanup does not silently change runtime behavior.
