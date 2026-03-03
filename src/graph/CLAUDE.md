# Graph & GraphRAG Subsystem

## WHAT
Flat-JSON entity/relationship storage with Louvain community detection. Data lives in `chatMetadata.openvault.graph` and `.communities`.

## HOW: Storage (`graph.js`)
- **Structure**: `{ nodes: { key: { name, type, description, mentions } }, edges: { key: { source, target, description, weight } } }`
- **Keys**: Nodes keyed by `name.toLowerCase().trim()`. Edges: `${source}__${target}`.
- **Upsert**: `upsertEntity` merges descriptions with ` | `, increments mentions. `upsertRelationship` increments weight, merges descriptions if different.
- **Normalization**: ALWAYS normalize before lookup. LLM outputs original casing.

## HOW: Communities (`communities.js`)
- **Library**: `graphology` via esm.sh. Test alias required in vitest.config.js.
- **Detection**: Louvain algorithm on undirected graph. Skip if < 3 nodes.
- **Summarization**: LLM generates title/summary/findings per community. Only re-summarize if node membership changed.
- **Island Guard**: Skip communities with < 2 nodes.
- **Trigger**: Every 50 messages in extraction pipeline.

## GOTCHAS & RULES
- **Orphaned Edges**: If `source`/`target` not in nodes, `upsertRelationship` silently skips.
- **CDN Imports**: `https://esm.sh/graphology`, `graphology-communities-louvain`, `graphology-operators`.
- **State Init**: Use `initGraphState(data)` to ensure all fields exist (non-destructive).
