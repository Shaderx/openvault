# OpenVault Data Schema & Core Algorithms

Authoritative reference for data structures, retrieval formulas, and storage constants.
Implementation gotchas live in subdirectory `AGENTS.md` files — see the directory map in the root `AGENTS.md`.

### Immutable archive tiers (schema v5)

`lifecycle.status` gates retrieval and compaction. Legacy chats migrate to `needs_rebuild` and receive no legacy
memory, graph, community, macro, or prompt context. The explicit full rebuild preserves an inactive
`recovery_backup`, restores only `openvault_hidden` messages, captures a fixed source boundary, and activates the
new data only after extraction and final synthesis complete.

`archives.segments` is an ordered append-only log. Normal operation appends `prepared` then `sealed` segments and
never edits sealed `content` bytes. Compaction consumes only the oldest contiguous processed complete-turn range,
persists its replacement first, then hides source messages. The archive injects at TOP_OF_CHAT; dynamic entities,
communities, and optional small recall inject independently at IN_CHAT depth 4.

Graph edges carry current status, validity bounds, last confirmation, and revision. Resolved/superseded edges have
no clustering weight. Community canonical input hashes include node state, active internal edges, and boundary
edges; changed-input summary failures are stale last-known data and are excluded from retrieval.

The lifecycle states are `ready`, `needs_rebuild`, `rebuilding`, and `rebuild_failed`. Only `ready` serves production context. v2/v3 transform safe legacy fields; v4/v5 require rebuilding rather than trusting historical archive coverage. Settings are stored separately from chat metadata; runtime caches and optional remote vectors are derived state.

Each sealed segment records source revisions, coverage and integrity plus immutable content. Fallback records cover otherwise unrepresented messages with one sentence of at most 15 Unicode words and importance 1; they never feed semantic graph/reflection enrichment. Source text is not copied into an archive as a fallback.

The persisted projection is independently bounded. It protects five-star events, balances chronology, and drops low-priority coverage first. Protected overflow blocks new hiding and exposes a rollup requirement. Projection refreshes occur at explicit checkpoints, not per query or POV switch. Archive witness metadata is narrator-facing provenance, while dynamic recall applies character POV filtering; archives provide no hard character secrecy guarantee.

Relationships retain `active`, `weakened`, `resolved`, or `superseded` history. Resolved/superseded edges have no clustering weight; weakened edges are attenuated. Stable communities track canonical input hashes, status, lineage and boundary edges. Only current active summaries participate in retrieval; stale/dissolved results remain diagnostic history.

## 1. DATA SCHEMA (`chatMetadata.openvault`)

Durable chat data lives within SillyTavern's `context.chatMetadata.openvault`.
**Rule:** Never assume fields exist. Migrations must backfill all fields so domain code can read safely without defensive `if (!data.field)` checks.

```typescript
{
  schema_version: number,      // Tracks migration state (Current: 5)
  embedding_model_id: string,  // Tracks which model generated stored embeddings
  st_vector_source: string,    // ST Vector source used for last sync (e.g., 'openrouter')
  st_vector_model: string,     // ST Vector model used for last sync

  memories: [{                 // Both events and reflections
    id: string,
    type: "event" | "reflection",
    summary: string,
    importance: 1 | 2 | 3 | 4 | 5,
    tokens: string[],          // Pre-computed stemmed BM25 tokens
    message_ids?: number[],    // For events: Source ST message indices
    source_ids?: string[],     // For reflections: Event evidence IDs at every reflection level
    level?: number,            // Reflection hierarchy: 1 (from events), 2+ (from reflections)
    parent_ids?: string[],     // For level 2+: Direct ancestor reflection IDs
    temporal_anchor: string | null, // Extracted timestamp (e.g., "Friday, 3:40 PM")
    is_transient: boolean,     // True for short-term intentions (decays ~5x faster)
    characters_involved: string[],
    witnesses: string[],
    embedding_b64: string,     // Base64 Float32Array (Replaces legacy `embedding: number[]`)
    _st_synced?: boolean,      // True if pushed to ST Vector storage
    archived: boolean,         // True if replaced by newer reflection (ignored in retrieval)
    mentions?: number,         // Frequency boost multiplier (increments on dedup overlap)
    retrieval_hits?: number    // Dampens exponential decay (frequently recalled = slower fade)
  }],

  graph: {
    nodes: {
      [normKey: string]: {
        name: string, type: "PERSON"|"PLACE"|"ORGANIZATION"|"OBJECT"|"CONCEPT",
        description: string, mentions: number, aliases?: string[],
        embedding_b64: string, _st_synced?: boolean
      }
    },
    edges: {
      "src__tgt": {
        source: string, target: string, description: string, weight: number,
        _descriptionTokens: number, _st_synced?: boolean
      }
    },
    _edgesNeedingConsolidation: string[] // Edge keys pending LLM summarization
  },

  communities: {
    [communityId: string]: {
      title: string, summary: string, findings: string[], nodeKeys: string[],
      embedding_b64: string, _st_synced?: boolean
    }
  },

  global_world_state: {
    summary: string, last_updated: number, community_count: number
  },

  character_states: {
    [charName: string]: {
      current_emotion: string, emotion_from_messages?: {min: number, max: number},
      emotion_intensity: number, known_events: string[] // POV strictness boundary
    }
  },

  reflection_state: {
    [charName: string]: { importance_sum: number } // Triggers reflection at >= 40
  },

  processed_message_ids: string[], // Stores message fingerprints (send_date or cyrb53 hash)

  idf_cache: {
    memoryCount: number, avgDL: number, idfMap: { [token: string]: number }
  },

  perf: {
    [metricId: string]: { ms: number, size: string | null, ts: number }
  }
}
```

## 2. REPOSITORY MUTATIONS
**Rule:** Never `push()` to arrays or mutate schema roots directly from domain code. Archive/rebuild modules own their explicit transactions; use ordinary repository methods from `src/store/chat-data.js`:
- `addMemories(newMemories)` - Appends to memories array.
- `markMessagesProcessed(fingerprints)` - Records processed message IDs.
- `incrementGraphMessageCount(count)` - Updates graph message counter.
- `updateMemory(id, updates)` - Updates memory fields (invalidates embedding if summary changes).
- `deleteMemory(id)` - Removes memory by ID.
- `deleteCurrentChatData()` - Purges OpenVault data and restores OpenVault-owned hidden messages.

## 3. RETRIEVAL MATH (Alpha-Blend)
**Formula:** `Score = (Base + (Alpha * VectorBonus) + ((1 - Alpha) * BM25Bonus)) × FrequencyFactor`

### Two-Pass Optimization
- **Fast Pass:** Score all memories with `Base + BM25` (O(N) cheap math).
- **Cutoff:** Take top `VECTOR_PASS_LIMIT` (200) candidates.
- **Slow Pass:** Execute `cosineSimilarity` (typed-array dot product) only on the top 200. Drops CPU load 10x on large histories.

### Base Score (Forgetfulness Curve)
- **Formula:** `Importance * e^(-Lambda * Distance)`.
- **Hit Damping:** `hitDamping = max(0.5, 1/(1 + retrieval_hits × 0.1))`. Frequently retrieved memories decay up to 50% slower.
- **Importance Floor:** Importance 5 has a soft floor of `1.0`. It never decays to zero.
- **Level-Aware Reflection Decay:** Higher-level reflections (Level 2+) decay 2x slower per level (`reflectionLevelMultiplier`). Applies linearly after 750 messages.
- **Transient Decay:** Short-term intentions (`is_transient: true`) multiply Lambda by 5.0. They fade ~5x faster than durable facts.

### 4-Tier BM25 Keyword Matching
IDF is cached in `chatMetadata.openvault.idf_cache` at extraction time. The corpus includes *both* candidates and hidden memories to prevent common terms from getting artificially high scores. POV names are dynamically stripped (stopwords) to prevent score inflation.
- **Layer 0 (Exact Phrases):** Multi-word entities (contain a space). Added once, boosted by `exactPhraseBoostWeight` (10x maxIDF).
- **Layer 1 (Entities):** Single-word graph entities. Stemmed, 5x boost.
- **Layer 2 (Corpus-Grounded):** User-message stems that exist in the established corpus vocabulary. 3x boost.
- **Layer 3 (Non-Grounded):** User-message stems NOT in corpus vocabulary. 2x boost (preserves scene context).

## 4. GRAPH MERGE, COMMUNITIES, DEDUP
See `src/graph/AGENTS.md` for semantic merge 4-guard system, edge consolidation, Louvain communities, hairball prevention.
See `src/extraction/AGENTS.md` for event dedup thresholds.
See `src/retrieval/AGENTS.md` for score-first soft balancing (context budgeting).

## 5. EMBEDDING MISMATCH PROTECTION
- **Trigger:** On `CHAT_CHANGED` and Settings Dropdown change.
- **Logic:** Compares `embedding_model_id` (e.g., `multilingual-e5-small`) and ST Vector fingerprint (`source` + `model`) against current settings.
- **Action:** If a mismatch is detected, `invalidateStaleEmbeddings()` bulk-wipes all `embedding_b64` and `_st_synced` flags across memories, nodes, and communities. Background worker auto-triggers `backfillAllEmbeddings({ silent: true })` to regenerate them.
