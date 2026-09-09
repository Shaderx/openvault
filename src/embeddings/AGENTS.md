# Task-aware embeddings

The browser facade is `src/embeddings.js`; provider changes and invalidation live in `migration.js`. Retrieval and entity matching use explicit tasks with distinct instructions and cache identities. Stored retrieval documents must not receive query instructions.

Keep cache identity sensitive to source/model, task, instruction/prefix and text. Preserve exact alias and conservative cross-script/name matching before semantic identity resolution. ST Vector retrieval has no local cosine vectors: report unavailable semantic matching or use the configured matching provider.

Iterate memories, keyed graph nodes, keyed graph edges and communities for migration, invalidation and backfill. Preserve aliases and source memories; vectors are disposable derived data. Use shared ST text/hash representations when replacing indexed content, and capture originating chat/session before asynchronous saves or network work.

CDN versions are pinned in `src/utils/cdn.js`. Transformers is browser-only; tests inject model/pipeline fixtures rather than downloading weights. Mocked strategy tests do not establish real WebGPU compatibility or empirically calibrated thresholds.

