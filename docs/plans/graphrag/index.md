# Reflections & GraphRAG Integration

> **Design Doc:** `docs/designs/2026-03-03-reflections-graphrag-design.md`
> **Execution:** Use `executing-plans` skill.

## Phases

| Phase | File | Description |
|-------|------|-------------|
| 0 | [phase-0-prune-smart-retrieval.md](phase-0-prune-smart-retrieval.md) | Prune obsolete "Smart Retrieval" |
| 1 | [phase-1-schema-graph-crud.md](phase-1-schema-graph-crud.md) | Schema & Graph CRUD |
| 2 | [phase-2-extraction-integration.md](phase-2-extraction-integration.md) | Extraction Pipeline Integration |
| 3 | [phase-3-reflection-engine.md](phase-3-reflection-engine.md) | Reflection Engine |
| 4 | [phase-4-community-detection.md](phase-4-community-detection.md) | Community Detection & Summarization |
| 5 | [phase-5-retrieval-world-context.md](phase-5-retrieval-world-context.md) | Retrieval & World Context Injection |

## File Change Summary

### New Files Created
| File | Phase | Purpose |
|---|---|---|
| `src/graph/graph.js` | 1 | Entity/relationship CRUD, graph state init |
| `src/graph/communities.js` | 4 | Graphology integration, Louvain, community summarization |
| `src/reflection/reflect.js` | 3 | Reflection triggers and 3-step pipeline |
| `src/retrieval/world-context.js` | 5 | Community summary retrieval for prompt injection |
| `tests/graph/graph.test.js` | 1 | Graph CRUD tests |
| `tests/graph/communities.test.js` | 4 | Community detection tests |
| `tests/reflection/reflect.test.js` | 3 | Reflection pipeline tests |
| `tests/retrieval/world-context.test.js` | 5 | World context retrieval tests |
| `tests/retrieval/retrieve.test.js` | 5 | Retrieval integration tests |
| `tests/llm.test.js` | 0 | LLM config tests |
| `tests/scoring.test.js` | 0 | Scoring cleanup tests |
| `tests/constants.test.js` | 0 | Constants cleanup tests |

### Modified Files
| File | Phase | Changes |
|---|---|---|
| `src/extraction/structured.js` | 0, 1, 3, 4 | Remove retrieval schema; add Entity, Relationship, Reflection, Community schemas |
| `src/extraction/extract.js` | 2, 3, 4 | Add graph upsert, reflection trigger, community detection stages |
| `src/llm.js` | 0, 3, 4 | Remove retrieval config; add reflection and community configs |
| `src/prompts.js` | 0, 2, 3, 4 | Remove smart retrieval prompt; add entity extraction instructions, reflection prompts, community prompt |
| `src/retrieval/scoring.js` | 0 | Remove smart retrieval, simplify selectRelevantMemories |
| `src/retrieval/retrieve.js` | 0, 5 | Remove smart retrieval context; add world context injection |
| `src/utils.js` | 5 | Add name parameter to safeSetExtensionPrompt |
| `src/constants.js` | 0 | Remove smartRetrievalEnabled, retrievalProfile, retrievalPreFilterTokens |
| `src/ui/settings.js` | 0 | Remove smart retrieval UI handlers |
| `templates/settings_panel.html` | 0 | Remove smart retrieval checkbox and profile dropdown |
| `vitest.config.js` | 4 | Add graphology package aliases |
| `package.json` | 4 | Add graphology dev dependencies |
| `tests/extraction/structured.test.js` | 0, 1, 3, 4 | Add tests for new schemas |
| `tests/prompts.test.js` | 0, 2, 3, 4 | Add tests for new prompts |

## Minor Adjustments

**A. Refine `upsertEntity` deduplication (Task 1.2)**
- Add `.includes()` check to avoid duplicate descriptions (same fix as `upsertRelationship`).

**B. Use existing ID generator (Task 3.4)**
- Import `generateId()` from `src/utils.js` instead of manual `ref_${now}_${index}` IDs.

**C. API profile for Communities (Task 4.1)**
- Both Reflection and Community LLM calls use `extractionProfile`. No separate dropdown needed.

**D. Handle "Island" communities (Task 4.3)**
- Skip communities with < 2 nodes in `updateCommunitySummaries` to avoid confusing single-node summaries.
