# OpenVault codebase report

## Scope and reading notes

This report describes the tree as inspected on 2026-08-29. OpenVault is a browser-side, ESM SillyTavern extension. It is an agentic memory/RAG system for roleplay chats: it extracts structured events and graph facts with an LLM, stores them in SillyTavern chat metadata, optionally indexes them in SillyTavern Vector Storage, and injects selected memories/world context into later generations.

There is no `AGENTS.md` in this repository or its ancestor directories. The repository does contain `CLAUDE.md` files; the root file and the domain files under `src/extraction`, `src/graph`, `src/perf`, `src/prompts`, `src/reflection`, `src/retrieval`, `src/services`, `src/store`, `src/store/migrations`, `src/ui`, `src/utils`, and `tests` were read and treated as project guidance. `include/DATA_SCHEMA.md` is the intended schema/algorithm reference, but the implementation has drifted from parts of it; those differences are called out below.

## Quick orientation

| Area | Main files | Responsibility |
| --- | --- | --- |
| Extension bootstrap | `index.js`, `manifest.json` | SillyTavern entry point, version gate, slash commands, settings/side-panel initialization |
| ST boundary and DI | `src/deps.js` | Access to `getContext`, extension settings, event bus, prompt injection, connection manager, CSRF headers, timers/fetch |
| Runtime state | `src/state.js`, `src/events.js` | Abort/session lifecycle, operation locks, generation lock, chat-switch cleanup, event handlers |
| Persistence | `src/store/chat-data.js`, `src/store/schemas.js` | `context.chatMetadata.openvault` repository and CRUD operations |
| Migrations | `src/store/migrations/index.js`, `v2.js`, `v3.js` | Sequential chat metadata migrations to schema version 3 |
| Extraction | `src/extraction/extract.js`, `scheduler.js`, `worker.js`, `structured.js` | Batch selection, LLM extraction, event/graph mutation, reflections/communities, backfill |
| Graph | `src/graph/graph.js`, `communities.js` | Entity normalization/merge, relationship storage/consolidation, Louvain communities |
| Retrieval | `src/retrieval/retrieve.js`, `scoring.js`, `math.js`, `query-context.js` | Query context, hybrid BM25/vector scoring, soft budget selection, prompt formatting/injection |
| Embeddings | `src/embeddings.js`, `src/embeddings/migration.js` | Local Transformers.js, Ollama, OpenAI-compatible, or ST Vector strategies |
| ST Vector integration | `src/services/st-vector.js` | Collection naming, insert/delete/query/purge, orphan detection |
| LLM prompts/parsers | `src/llm.js`, `src/prompts`, `src/extraction/structured.js` | Connection Manager calls, JSON schema, few-shot prompts and tolerant response parsing |
| UI | `templates`, `src/ui`, `css`, `src/injection/macros.js` | Settings browser, side panel, CRUD actions, status/performance, macros |
| Verification | `tests`, `vitest.config.js`, `scripts` | Vitest/JSDOM tests, TypeScript, JSDoc and CSS checks |

The source is intentionally unbundled ESM. There is no application server or database in this repository. Runtime state is held by SillyTavern’s current chat object and optional ST Vector Storage.

## Runtime/bootstrap and control flow

1. `manifest.json` registers `index.js` and `style.css`, with loading order 100 and no extension dependencies. `index.js` is evaluated in the browser and statically imports the dependency boundary, settings, event, store, UI and status modules.
2. A jQuery DOM-ready callback installs an `APP_READY` listener and a 15-second fallback timer. Both call the guarded `initExtension()`; `_initDone` prevents double initialization. Initialization checks `/version` and refuses SillyTavern minor versions below 13, loads the settings panel, registers slash commands, initializes the side panel, loads persisted performance metrics, and installs event listeners.
3. `src/events.js` wires `GENERATION_AFTER_COMMANDS` (before generation), `GENERATION_ENDED`, `GENERATION_STOPPED`, `MESSAGE_RECEIVED`, and `CHAT_CHANGED`. Listener registration is removed/re-added when the enabled setting changes.
4. `CHAT_CHANGED` first resets the session `AbortController`, then performs migration and embedding-model mismatch handling. It clears token/sanitizer/embedding/retrieval caches, resets UI cooldowns and operation state, clears extension prompts, loads performance data and refreshes UI.
5. Before a generation, `onBeforeGeneration` checks enabled/session/locks, auto-hides old processed chat messages if enabled, obtains the pending user text (or last user message), and calls `updateInjection` under a 60-second timeout. Retrieval errors are surfaced/logged but should not block the generation.
6. `MESSAGE_RECEIVED` wakes the singleton background worker unless disabled, session-killed, in cooldown, system-only or missing content. `onGenerationEnded` releases generation/retrieval locks.

The design uses lazy imports for heavy extraction/retrieval/UI work, and a session-level abort signal so changing chats interrupts pending LLM, embedding, graph and worker work. `src/state.js` also has a generation lock with a 120-second safety timeout and extraction/retrieval flags. Worker sleeps use interruptible short waits rather than one long timeout.

Slash commands in `index.js`:

- `/openvault-extract` starts extraction for the current chat and refreshes UI.
- `/openvault-retrieve` runs retrieval/injection immediately.
- `/openvault-status` reports enabled state and memory count.

## Storage and data lifecycle

`src/store/chat-data.js` is the repository around `getDeps().getContext().chatMetadata.openvault`. `getOpenVaultData()` creates a fresh object when absent with schema version 3, `memories`, `character_states`, `processed_message_ids`, `reflection_state`, `graph`, `communities`, and `graph_message_count`. The helper also supports legacy `context.chat_metadata.chat_id` when obtaining the current chat id.

Core repository operations include adding memories, recording processed message fingerprints, incrementing graph message count, updating/deleting memories, updating/deleting entities and communities, renaming characters, merging entities, saving with an expected chat id, and deleting all current-chat data. `saveOpenVaultData(expectedChatId)` rechecks the current chat id before/after the ST save call to avoid committing a result into a different chat. Domain code also returns `stChanges` (`toSync` and `toDelete`) for external vector synchronization, although not every mutation currently does so consistently.

Stored data conceptually contains:

- Event and reflection memories with ids, summaries, importance, type, timestamps/sequence, source message fingerprints, character/witness tags, temporal anchors, transient/secret flags, reflection hierarchy and optional embeddings.
- A graph with normalized-key entity nodes and `source__target` relationship edges. Nodes/edges can carry descriptions, aliases, mention/weight counts, embeddings and ST synchronization flags. Runtime queues include `_edgesNeedingConsolidation` and transient `_mergeRedirects`.
- Character states (`current_emotion`, emotion provenance/intensity, known event ids) and per-character reflection accumulation (`importance_sum`).
- Community summaries and a global world summary.
- Processed message fingerprints, an IDF cache and per-chat performance metrics.

Message fingerprints are generated in `src/extraction/scheduler.js`: `send_date` is preferred; otherwise a positive `cyrb53(name + mes)` hash is used. Processed fingerprints are the durable extraction boundary; system messages are excluded from extraction. `src/events.js` auto-hide marks already-processed source messages with `is_system=true` plus `openvault_hidden`, preserving the flag so deletion/reset can unhide only OpenVault-hidden messages.

`src/store/migrations/index.js` applies v1→v2→v3 sequentially. v2 converts old positional message ids to fingerprints, converts legacy embedding arrays and initializes newer collections; v3 backfills `message_fingerprints` from old `message_ids`. Migration is transaction-like: `onChatChanged` snapshots metadata, rolls back on failure and kills the session so extraction cannot continue against uncertain data. Embedding migration is separate from schema migration and is handled by `src/embeddings/migration.js`.

## Extraction pipeline

The extraction pipeline is implemented in `src/extraction/extract.js` and follows the six-stage model documented in `src/extraction/CLAUDE.md`:

1. Fetch the current batch of non-system, unprocessed messages.
2. Fetch graph entities/relationships from the same batch.
3. Enrich events with ids, tokens, source indices/fingerprints, sequence/time metadata, character canonicalization and embeddings; deduplicate against existing memories and within the batch.
4. Update graph nodes and edges, including semantic merges and redirect handling.
5. Accumulate importance and synthesize reflections when thresholds are met (normal extraction only).
6. Detect communities, consolidate oversized edges, generate community summaries and global world synthesis (normal extraction only and at the configured interval).

The event and graph LLM calls are separate structured calls. A graph failure is generally non-fatal to event extraction. Phase 1 saves memories/graph and processed fingerprints before optional Phase 2. ST Vector changes are applied after the Phase 1 save. Backfill skips Phase 2 per batch, then runs one final enrichment pass after all batches.

`src/extraction/scheduler.js` uses tokenized budgets rather than raw message counts. It selects contiguous batches, snaps boundaries to complete turns, respects a maximum turn count, and applies swipe protection by trimming the final incomplete/recent turn during backfill. An “Emergency Cut” path extracts all eligible messages and hides the processed tail to break repetition loops; it has a progress modal and can be cancelled before uncancellable Phase 2.

`src/extraction/worker.js` is a fire-and-forget singleton. `wakeUpBackgroundWorker()` increments a generation token, and the loop exits when the session aborts, chat id changes, the extension is disabled, manual backfill is active, or a newer wake supersedes it. It retries empty extraction responses and API failures with bounded backoff, waits between successful batches, and updates status. `extractAllMessages()` is the manual/backfill orchestrator with retry limits, callbacks and extraction/backfill locks.

`src/extraction/structured.js` defines Zod schemas and tolerant parsers for events, graph extraction, reflections, community summaries, global synthesis and edge consolidation. Parsers strip `<think>`/reasoning tags, repair JSON, unwrap tool-call arguments/single-element arrays and bare strings, then validate individual records so one malformed record does not discard an otherwise valid response. Prompt builders live under `src/prompts/events`, `graph`, `reflection`, `communities` and `shared`; they combine system role/rules/schema/examples with user constraints and language mirroring.

## Graph and reflection subsystems

`src/graph/graph.js` normalizes names (lowercase, possessive stripping), expands aliases and uses transliteration/short Levenshtein checks for cross-script PERSON matching. New nodes receive descriptions and mention counts. Relationships use normalized `source__target` keys, reject missing/self edges, deduplicate by token overlap and cap descriptions. Edges exceeding the token threshold are queued for LLM consolidation. Semantic merges use type-specific cosine/token-overlap guards, aliases and transient redirect maps. `stChanges` identify old external vectors to remove and new vectors to insert.

`src/graph/communities.js` converts the backing graph to graphology, attenuates edges involving main characters to reduce “hairball” communities, runs Louvain, reanchors main-character nodes to a strongest neighbor, and builds member/edge text for LLM summaries. Communities are regenerated when membership changes or they are stale; dissolved synchronized communities are deleted from ST Vector Storage. Global world synthesis is single-pass for small sets and map/reduce for larger sets. The current implementation returns `null` for graphs with fewer than three nodes, so the later tiny-graph fallback path is unreachable for those graphs.

`src/reflection/reflect.js` accumulates importance for characters and witnesses, triggers at the configured threshold (default 40), performs a preflight skip when the candidate context is already mostly redundant, and asks the LLM for 1–3 unified insights. Candidates are token-budgeted recent events plus old reflections. Three-tier embedding similarity deduplication rejects near duplicates, replaces/archive borderline duplicates, and adds novel reflections. Reflections have levels, evidence/source ids and parent ids; old reflections are archived when per-character limits are exceeded. Reflection injection is independently configurable.

## Retrieval and injection

`src/retrieval/retrieve.js` builds a retrieval context from recent visible chat, the last user messages, current character/POV state, graph nodes/edges and IDF data. It filters out archived memories and respects hidden-message overlap rules; if strict POV filtering produces no usable result, it has a fallback to avoid injecting nothing. It then builds entity and world context, selects memories under a dynamic budget, formats timeline buckets and injects via `setExtensionPrompt`.

`src/retrieval/query-context.js` detects graph entities in recent context, prepends entity anchors before embedding truncation, and constructs BM25 query layers: exact phrases, graph entities, corpus-grounded user terms and non-grounded scene terms. `src/retrieval/scoring.js` supports local hybrid scoring and ST Vector overfetch/proxy ranking. Local scoring uses a cheap first pass and computes cosine only for the top 200 candidates. A soft balance initially reserves roughly equal old/middle/recent buckets, then fills by score. Hidden source memories are included in IDF corpus calculations and archived memories are excluded.

`src/retrieval/math.js` implements the score described by `include/DATA_SCHEMA.md`:

`(base + alpha * vectorBonus + (1-alpha) * bm25Bonus) * frequencyFactor`

Base importance decays with fingerprint distance, is damped by retrieval hits, accelerates for transient memories, and applies reflection-level decay. Vector similarity is thresholded/normalized; BM25 uses exact phrase/entity/corpus boosts and cached IDF. `src/retrieval/formatting.js` emits `<scene_memory>` timeline buckets and `<subconscious_drives>` reflection content, with importance stars, temporal anchors and known/private markers. `src/retrieval/entity-context.js` adds detected entities and one-hop neighbors; `world-context.js` formats global/community world information and detects world macros.

Injection positions and macros are implemented in `src/utils/st-helpers.js` and `src/injection/macros.js`. Supported positions include before main prompt, after main prompt, top of chat/character area, in-chat depth and custom macro-only mode. `{{openvault_memory}}` and `{{openvault_world}}` return cached retrieval text through SillyTavern’s macro registry or legacy context registration. The UI can also set a post-history prompt and custom injection depth.

## Embeddings and external services

`src/embeddings.js` uses a strategy registry:

- Local Transformers.js: `multilingual-e5-small` (default, 384d, multilingual), `bge-small-en-v1.5` (384d) and `embeddinggemma-300m` (768d), with WebGPU when available and WASM/CPU fallback.
- Ollama `/api/embeddings` with configurable URL/model.
- OpenAI-compatible `/v1/embeddings` with configurable base URL, bearer key and model.
- ST Vector Storage, where vectors are owned by SillyTavern.

CDN packages are loaded lazily through `src/utils/cdn.js`; pinned module versions are centralized there and mirrored in package dependencies/test aliases. Local embedding models use a 500-entry LRU cache. Chat changes clear it, but changing source/model settings does not universally include the source/model/prefix in the cache key.

`src/embeddings/migration.js` fingerprints the external source/model, counts all four external item categories (memories, nodes, edges, communities), clears stale embeddings/sync flags and triggers re-embedding after a mismatch. `backfillAllEmbeddings()` handles local generation and ST Vector synchronization. The ST branch currently collects memories, nodes and communities but does not collect graph edges, despite edge lifecycle guidance and migration logic treating edges as a fourth category.

`src/services/st-vector.js` is the only ST Vector REST boundary. It derives a per-chat collection id (`openvault-${chatId}-${source}`), determines source/model settings, sends CSRF headers from `getDeps()`, inserts/deletes/query items, verifies chat existence, and purges orphan collections. Items are tagged `[OV_ID:<id>]` in their text so query results can be mapped back to local memory/entity/community ids. LLM calls are centralized in `src/llm.js` through the SillyTavern Connection Manager, with configured extraction profile, optional backup profile, per-operation JSON schema, timeout, abort racing and reasoning-field recovery.

## UI, extension points and presentation

`templates/settings_panel.html` defines six tabs: dashboard/connections, memories, entities, communities, advanced settings and performance. It exposes extraction/backfill/Emergency Cut controls, embedding selection and tests, token/rate/concurrency sliders, scoring/decay/dedup controls, reflection/community settings, injection positions/macros, reset/delete actions and debug export. `templates/side_panel.html` defines a persistent side panel for memories, communities, entities and character states.

`src/ui/settings.js` loads the settings template, binds controls and action buttons, drives profile selectors, embedding tests/model switching, emergency-cut modal, reset/backfill and performance clipboard export. `src/ui/render.js` renders paginated/filterable memory cards, character state cards, entity CRUD and merge forms, community lists and refreshes the side panel. `src/ui/side-panel.js` scopes delegated jQuery handlers to the side panel and supports memory/entity/community/character rename actions. `src/ui/templates.js` is a pure HTML-template layer; dynamic values are escaped with `src/utils/dom.js`. `src/ui/status.js` owns status/embedding indicators and chat statistics. `src/ui/export-debug.js` exports compact state, graph, communities, last retrieval/scoring debug and performance data; embeddings are stripped from exported graph records.

The UI has direct integration extension points through `getDeps()`: SillyTavern context/event bus, `setExtensionPrompt`, macro registration, Connection Manager, chat save and toastr. A new embedding source normally requires a constants registry entry, strategy, settings UI, migration fingerprint and tests. A new LLM operation requires an `LLM_CONFIGS` entry, structured schema/parser and prompt builder. New persisted fields require schema/migration/type-generator updates.

## Configuration, dependencies and workflows

`src/constants.js` is the central source for extension name, metadata keys, injection positions, entity types, default settings, embedding prefixes, timeouts, pagination, retrieval/vector limits, scoring constants, reflection/consolidation limits and performance labels. `src/settings.js` merges defaults into SillyTavern extension settings and performs a one-time CN→EN language migration for existing installs. Connection profile ids are kept in extension settings; API keys for OpenAI-compatible embeddings are stored there as well.

`package.json` declares ESM and version 23.00. Runtime dependencies include Zod, cyrillic transliteration, tokenizer, stopword and related utilities. Development dependencies include Biome, Vitest, TypeScript, Zod-to-TS, graphology/Louvain, JSDOM, JSON repair, P-Queue, stemmers and repomix. There is no bundler; `manifest.json` loads the source directly.

Useful commands discovered in `package.json`:

```text
npm run check          sync version, generate types, Biome fix, JSDoc, CSS, TypeScript
npm run lint           Biome check
npm run lint:fix       Biome write/fix
npm run lint:jsdoc     node scripts/check-jsdoc.mjs
npm run check-css      node scripts/check-css.js
npm run typecheck      tsc --noEmit
npm run test:run       Vitest run
npm test               sync version + type generation + Vitest (writes generated files)
npm run generate-types node scripts/generate-types.js
npm run sync-version   copy package version to manifest
```

`vitest.config.js` uses JSDOM, globals, `tests/setup.js`, up to four worker threads and a 10-second test timeout. CDN imports are aliased to installed packages in tests. `tests/setup.js` supplies ST globals/fetch/jQuery/toastr stubs, CDN overrides and `setupTestContext()` dependency injection. Tests mirror source domains and include integration, parser, storage, migration, graph, retrieval, UI and utility coverage.

`scripts/generate-types.js` imports the Zod schemas with a local Zod override and writes `src/types.d.ts`; `scripts/check-css.js` scans JS/templates for tracked class usage; `scripts/check-jsdoc.mjs` checks multi-line JSDoc placement. Do not use `npm test` merely as a read-only check without reviewing generated-file diffs: its version/type steps can modify `manifest.json` and `src/types.d.ts`.

## Verified baseline and notable risks/quirks

The following are evidence-based observations from the current tree, not assumptions:

- Documentation drift: `include/DATA_SCHEMA.md` still states schema version 2, while `src/store/migrations/index.js` and new data in `src/store/chat-data.js` use version 3. `src/store/schemas.js` also names several roots `characters`, `processed_messages`, `reflection`, and `global`, while runtime code uses `character_states`, `processed_message_ids`, `reflection_state`, and `global_world_state`. Treat runtime/store code and migrations as authoritative until schemas/docs are reconciled.
- Migration edge case: `src/store/migrations/v2.js` iterates `data.graph?.nodes || []` as if it were an array, but runtime graph nodes are an object keyed by normalized entity key. Legacy graph-node embedding conversion may therefore be skipped.
- ST synchronization lifecycle is uneven. `src/store/chat-data.js:updateMemory` and `deleteMemory` hash bare summaries, whereas extraction/ST insertion hashes `[OV_ID:<id>] <summary>`; deletes/updates can consequently miss the originally indexed vector. Entity rename returns old deletes but does not consistently queue the newly renamed node for sync; entity deletion removes local connected edges without queuing their external edge vectors; community CRUD does not return `stChanges`. `src/embeddings.js:backfillAllEmbeddings` omits graph edges in its ST branch.
- Retrieval wiring quirks: the ST community ids returned by scoring are not passed into the world-context builder on the main `selectFormatAndInject` path, so ST community retrieval may not be reflected in generated world text. `retrieve.js` passes `{emotion, fromMessages}` while `formatting.js` looks for `emotionalInfo.characterEmotions`, so the emotional trajectory line is currently unlikely to render.
- Math/config drift: `src/retrieval/math.js` hardcodes the importance-5 floor as `1` even though `constants.js` names `IMPORTANCE_5_FLOOR` as 5. Reflection creation uses `defaultSettings.maxReflectionLevel` in one path rather than the active settings value. `global_synthesis` performance is recorded by `communities.js` but is not present in the central performance metric map, so it is ignored by the perf store.
- Parser/schema policy: `src/extraction/structured.js` contains `z.any()` for relationship impact even though root guidance explicitly forbids `z.any()`. The generated `src/types.d.ts` is intended to be derived from `src/store/schemas.js`, but the schema/runtime drift above means generated types should not be read as proof of persisted runtime shape.
- Lifecycle/DI quirks: boot logs and the version check in `index.js` use raw `console`/global `fetch`; several worker/utility waits use raw timers. This differs from the stated `getDeps()` boundary and can complicate deterministic tests. `src/utils/logging.js` can log full LLM requests/responses on request-logging/errors, which may expose private roleplay content in browser logs.
- Cache/sanitizer risks: embedding cache keys contain only query/document text, not source/model/prefix; settings changes rely on explicit reset/invalidation paths. Message sanitization initializes some regex data asynchronously at module load, so an earliest call can precede initialization; its token cache key is based on index/length and can collide for same-length edits.
- Initial/default shape is partial: `getOpenVaultData()` initializes only a subset of all fields documented in `include/DATA_SCHEMA.md`, and `createEmptyGraph()` initially returns only `nodes` and `edges`; callers must continue to tolerate absent queues/caches/world/perf fields.
- Community fallback: `detectCommunities()` returns early for fewer than three nodes, making the documented tiny-graph fallback code unreachable in those cases.

## What was verified and remaining unknowns

Verified during this survey:

- Read the repository guidance files and all source-domain guidance files listed above.
- Inspected the complete source tree, templates, CSS split, package/config files, scripts, schema reference, fork-change history, tests and test setup.
- Ran `npx tsc --noEmit`: passed.
- Ran `node scripts/check-css.js`: passed (156 tracked classes).
- Ran `node scripts/check-jsdoc.mjs`: passed.
- Ran `npx vitest run --reporter=dot`: 445 tests passed, 13 failed, 7 skipped across 51 test files. The 13 failures are in `tests/extraction/scheduler.test.js` and `tests/ui/helpers.test.js`: expected message-boundary/count behavior differs from current scheduler/helper behavior, and `validateRPM` expectations differ from its current 5–30 clamp. This was a read-only Vitest invocation; no source fix was made.
- Confirmed the worktree was clean before writing this report.

Not fully verified:

- Actual SillyTavern host behavior for extension prompt positions, Connection Manager profile payloads, chat save semantics, event ordering and ST Vector endpoint responses; tests use stubs rather than a live host.
- Browser CDN availability, WebGPU model loading, Ollama/OpenAI-compatible CORS/auth behavior and model dimensionality at runtime.
- Whether existing user chats contain legacy schema/data variants beyond the migration fixtures.
- Whether all ST Vector orphan cases above are reachable in normal usage or already covered by server-side replacement semantics; this needs an end-to-end vector-storage test.
- Performance and memory behavior on very large chats; no production-scale benchmark was run.
- `docs/designs` and `docs/plans` contain historical design/change material. They were inventoried and relevant guidance was compared with implementation, but not every historical design document was treated as current specification.

Future agents should begin with this report, then consult the nearest domain `CLAUDE.md`, `src/constants.js`, `src/store/chat-data.js`, and the relevant tests before changing behavior. Keep `include/DATA_SCHEMA.md`, `src/store/schemas.js`, migrations and runtime key names synchronized when modifying persistence.
