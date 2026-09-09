# Full rebuild lifecycle

`rebuild.js` owns the explicit reset of derived memories, graph, communities, archives and processing markers. This is a scoped exception to ordinary store CRUD ownership; other domain modules use repository methods.

Schema v5 invalidates earlier retrieval/archive representations. `needs_rebuild`, `rebuilding`, and `rebuild_failed` gate production retrieval, macros and ordinary compaction. Only `ready` activates rebuilt state. Legacy codec/locator helpers support migration, not legacy production recall.

- Preserve an inactive `recovery_backup` before resetting derived data. Restore only messages marked `openvault_hidden`; unrelated system/hidden messages retain their host meaning.
- Capture a fixed source boundary at start. Resume failed rebuilds at that boundary using persisted coverage; newly appended messages belong to later extraction.
- Capture chat ID and session signal before yielding. Cancellation must not update or disable a newly selected chat. Persist preparation and progress through the guarded store API.
- Require complete source coverage and final enrichment before activation. Persist `ready` successfully before ordinary retrieval resumes; failed work remains resumable with its diagnostic reason.
- ST Vector is derived state: purge the originating collection before replacing legacy indexing and stop if purge fails.

Read `src/archive/AGENTS.md` for compaction after activation and `src/store/migrations/AGENTS.md` for schema gates.
