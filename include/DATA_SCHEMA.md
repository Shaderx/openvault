# OpenVault Data Schema & Core Algorithms

Reference document for data structures, storage bounds, and non-obvious algorithm logic.

## 1. DATA SCHEMA (`chatMetadata.openvault`)

All extension state lives within SillyTavern's `context.chatMetadata.openvault`. 
**Rule:** Never assume fields exist. Migrations must backfill all fields so domain code can read safely without defensive `if (!data.field)` checks.

```typescript
{
  schema_version: number,      // Tracks migration state (Current: 2)
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
    source_ids?: string[],     // For reflections: Cited evidence memory IDs
    level?: number,            // Reflection hierarchy: 1 (from events), 2+ (from reflections)
    parent_ids?: string[],     // For level 2+: IDs of synthesized child reflections
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
**Rule:** Never `push()` to arrays or mutate schema roots directly from domain code. Use explicit repository methods from `src/store/chat-data.js`:
- `addMemories(newMemories)` - Appends to memories array.
- `markMessagesProcessed(fingerprints)` - Records processed message IDs.
- `incrementGraphMessageCount(count)` - Updates graph message counter.
- `updateMemory(id, updates)` - Updates memory fields (invalidates embedding if summary changes).
- `deleteMemory(id)` - Removes memory by ID.
- `deleteCurrentChatData()` - Purges all data for current chat and unhides all `is_system` messages.

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

## 4. GRAPH & SEMANTIC MERGE
**Rule:** Prevent duplicate nodes ("The King" vs "King Aldric") using a 4-Guard system in `shouldMergeEntities()`.

### The 4 Guards
1. **Cosine Similarity:** Check first. If `>= 0.94`, it's a candidate.
2. **Type-Aware Routing:** 
   - `PERSON` entities merge on high cosine alone (names are unique identifiers). 
   - `OBJECT/CONCEPT/PLACE/ORGANIZATION` *always* require token-overlap confirmation to prevent false merges caused by shared contextual embeddings.
3. **LCS (Longest Common Substring):** Ratio `>= 60%` for keys > 2 chars.
4. **Stem Overlap:** Stem-based overlap (catches Russian morphological variants like "ошейник"/"ошейником").

### Cross-Script Merging
- **Rule:** `PERSON` entities with keys in different scripts (Latin vs Cyrillic) are skipped in semantic merge.
- **Transliteration Match:** They ONLY merge if the Cyrillic name transliterated to Latin matches an existing English node with `Levenshtein Distance <= 2` (e.g., "Сузи" -> "suzi" -> merges with "suzy").

## 5. GRAPHRAG COMMUNITIES
- **Edge Consolidation:** Edges track `_descriptionTokens`. When `> 150`, marked in `_edgesNeedingConsolidation`. Before community detection, up to 10 bloated edges are sent to the LLM to be compressed into a single <100 token string.
- **Hairball Prevention:** During Louvain detection, edges involving User/Char are attenuated by 95% (`MAIN_CHARACTER_ATTENUATION`). This breaks "protagonist hairball" gravity in open-world RPs but prevents object orphaning. Nodes are re-anchored to their strongest neighbor post-detection.
- **Map-Reduce Synthesis:** `synthesizeInChunks()` chunks communities into groups of 10. Regional summaries are generated, then reduced into a final ~300 token `global_world_state`.

## 6. DEDUPLICATION & BUDGETING
- **Event Deduplication (Extraction):**
  - *Cross-Batch:* Cosine similarity `>= 0.95` AND Jaccard token overlap `>= 0.3`. Increments `mentions` on the survivor.
  - *Intra-Batch:* Jaccard token overlap `>= 0.6` between events in the same LLM payload.
- **Score-First Soft Balancing (Retrieval):**
  - *Phase 1:* Reserve 20% of the token budget for each chronological bucket (Old / Mid / Recent). Fill with highest-scoring memories from that bucket.
  - *Phase 2:* Pool the remaining 40% of the budget. Fill strictly by highest overall score, regardless of chronological bucket. Guarantees minimum temporal representation without starvation.

## 7. EMBEDDING MISMATCH PROTECTION
- **Trigger:** On `CHAT_CHANGED` and Settings Dropdown change.
- **Logic:** Compares `embedding_model_id` (e.g., `multilingual-e5-small`) and ST Vector fingerprint (`source` + `model`) against current settings.
- **Action:** If a mismatch is detected, `invalidateStaleEmbeddings()` bulk-wipes all `embedding_b64` and `_st_synced` flags across memories, nodes, and communities. Background worker auto-triggers `backfillAllEmbeddings({ silent: true })` to regenerate them.
