# Memory Extraction Subsystem

> For the big picture of how this fits into the whole app, see `docs/ARCHITECTURE.md`.

## WHAT
Extracts events, entities, and relationships from chat. Converts raw messages into structured JSON, deduplicates, embeds. Triggers reflection and community detection pipelines.

## HOW: The Pipeline (`extract.js`)
1. **Message Selection**: `scheduler.js` determines unextracted batches.
2. **Prompting**: `prompts.js` builds Zod-compatible prompts (events + entities + relationships).
3. **LLM Execution**: `llm.js` fetches the response.
4. **Processing**: `structured.js` strips tags, validates via Zod.
5. **Graph Update**: Semantic entity merge via `mergeOrInsertEntity()`, relationships via `upsertRelationship()`.
6. **Character States**: `updateCharacterStatesFromEvents()` validates names against known characters before creating state entries.
7. **Reflection Check**: Per-character importance accumulation; triggers at threshold 40.
8. **Community Detection**: Every 50 messages, runs Louvain via `src/graph/communities.js`.
9. **Commit**: Deduplicate (Cosine >= 0.85), save to `chatMetadata`.

## GOTCHAS & RULES
- **JSON Array Recovery**: If LLM returns malformed JSON (e.g., missing wrapping array), attempts to recover via regex before failing. Expected retry via backoff scheduler.
- **Event Summary Minimum**: 30 characters strictly enforced via Zod schema. LLM failures here are expected — scheduler retries automatically.
- **Entity Keys**: Always normalize via `normalizeKey()` (lowercase, strips possessives) before graph operations. LLM outputs original casing.
- **Key Normalization**: `source`/`target` in relationships resolved via `_resolveKey()` to handle entity merge redirects.
- **Zod Schemas**: Defined in `structured.js`, converted to JSON Schema Draft-04 for ST.
- **Settings Values**: All thresholds/interval values read from `settings` object (defaults provided): `reflectionThreshold` (40), `communityDetectionInterval` (50), `entityDescriptionCap` (3), `edgeDescriptionCap` (5).
- **Reflections are Memories**: Stored with `type: 'reflection'`, retrieved alongside events.
- **Character Validation**: `updateCharacterStatesFromEvents()` and `cleanupCharacterStates()` prevent corrupted state entries from invalid names.
- **Testing**: Test parsers heavily. See `tests/extraction/structured.test.js`.