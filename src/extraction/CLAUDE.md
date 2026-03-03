# Memory Extraction Subsystem

## WHAT
Extracts events, entities, and relationships from chat. Converts raw messages into structured JSON, deduplicates, embeds. Triggers reflection and community detection pipelines.

## HOW: The Pipeline (`extract.js`)
1. **Message Selection**: `scheduler.js` determines unextracted batches.
2. **Prompting**: `prompts.js` builds Zod-compatible prompts (events + entities + relationships).
3. **LLM Execution**: `llm.js` fetches the response.
4. **Processing**: `structured.js` strips tags, validates via Zod.
5. **Graph Update**: Upsert entities/relationships via `src/graph/graph.js`.
6. **Reflection Check**: Per-character importance accumulation; triggers at threshold 30.
7. **Community Detection**: Every 50 messages, runs Louvain via `src/graph/communities.js`.
8. **Commit**: Deduplicate (Cosine >= 0.85), save to `chatMetadata`.

## GOTCHAS & RULES
- **Entity Keys**: Always normalize to `toLowerCase().trim()` before graph operations. LLM outputs original casing.
- **Key Normalization**: `source`/`target` in relationships MUST be normalized before edge creation.
- **Zod Schemas**: Defined in `structured.js`, converted to JSON Schema Draft-04 for ST.
- **Reflection Trigger**: Importance sum >= 30 per character. Accumulator resets after reflection.
- **Reflections are Memories**: Stored with `type: 'reflection'`, retrieved alongside events.
- **Testing**: Test parsers heavily. See `tests/extraction/structured.test.js`.