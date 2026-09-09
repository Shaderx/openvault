# Archive invariants

Archives are narrator/world reference material. Witness and visibility metadata describe provenance; they are not a hard per-character secrecy filter. POV changes affect dynamic recall, never sealed archive bytes.

`archive.js` owns segments, projections, corrections and source visibility transitions. Use its public operations rather than mutating these roots from retrieval or UI. Ordinary memory/entity CRUD belongs to the store repository.

- Seal only a contiguous processed region with complete source attribution. Events cover their actual source IDs; each remaining message needs a one-sentence fallback of at most 15 Unicode words. Raw source bodies are excluded. Coverage fallbacks carry importance 1 and never enter semantic enrichment.
- Persist prepared replacement state before hiding sources. Validate source revisions, coverage and content integrity at sealing and recovery. A failed save or validation leaves sources visible or restores them; capture chat identity and cancellation before asynchronous work.
- Sealed content is immutable. New history appends a segment; corrections append an explicit correction or require an explicit rebuild. Retrieval reads a persisted bounded projection rather than regenerating it from current POV, query or dynamic token demand.
- Projection checkpoints are sealing, recovery, explicit settings changes and rebuild. Five-star entries are protected, temporal buckets retain representation, and low-priority coverage drops first. If protected content cannot fit, expose overflow/rollup requirements and keep new source history visible.
- Respect frozen replies and complete-turn boundaries. Use high-water/target hysteresis rather than a per-turn sliding cut. Recover interrupted prepared records idempotently before another compaction.

See `include/DATA_SCHEMA.md` and `src/rebuild/AGENTS.md` for lifecycle contracts.
