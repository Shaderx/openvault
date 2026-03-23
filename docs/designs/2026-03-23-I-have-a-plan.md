Your PR 1 was a textbook execution of pushing side-effects and global state (`getDeps()`) to the outer boundaries (the orchestrators). That is exactly the right path to tame a vanilla JS app of this size. 

Looking at the current codebase, your complexity pain points are stemming from **Layer Violations**. Deep domain logic (like graph math) is triggering network requests, and UI files are orchestrating massive background LLM jobs.

To get this app back into a comfortable, maintainable state, we need to continue applying the **Hexagonal Architecture** principle: Core logic stays pure, and all I/O (Storage, LLM calls, UI) happens at the orchestrator edges.

Here is the roadmap for your next refactoring phases, followed by a detailed design doc for PR 2.

---

### Refactoring Roadmap

*   **Phase 2 (Next): Decouple Storage & Side-Effects from Domain Logic.** Remove ST Vector API syncs (`syncItemsToST`, `deleteItemsFromST`) out of deep graph/community mathematical functions. Let the domain return what *changed*, and let the orchestrator sync it.
*   **Phase 3: Untangle UI from Business Logic.** `settings.js` currently contains `handleEmergencyCut` and `hideExtractedMessages`. The UI should only dispatch intents and render progress; the actual data manipulation belongs in the domain.
*   **Phase 4: Deconstruct the Extraction God-Function.** `extract.js:extractMemories` does way too much (batching, API delays, event parsing, graph upserts, saving). It needs to be broken into smaller pipeline steps orchestrated by a master function.

---

Here is the actionable design document for PR 2, matching your style.

# PR 2: Dependency Injection — Purging Network I/O from Domain Logic

## Goal
Remove SillyTavern Vector Storage network requests (`syncItemsToST`, `deleteItemsFromST`, `markStSynced`) from deep domain files (`graph.js`, `communities.js`, `embeddings.js`). Shift these side-effects up to the orchestrators (`extract.js`, `retrieve.js`). 

**Non-goals:** No changes to the actual API payload structures. No changes to the Louvain algorithm or graph consolidation logic. No UI changes. 

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | `graph.js`, `communities.js`, `data.js`, `extract.js` | These files currently mix graph mathematical transformations with HTTP POST requests. |
| Sync mechanism | Return "dirty" lists | Instead of `mergeOrInsertEntity` directly making a network call, it should return the modified entities. The orchestrator (`extract.js`) collects these and does one bulk network call at the end of the phase. |
| Test impact | Massive win | You will be able to test `consolidateGraph` and `updateCommunitySummaries` entirely synchronously without mocking `fetch` or `getDeps()`. |

## File-by-File Changes

### 1. `src/graph/graph.js`
**Remove** imports for `isStVectorSource`, `syncItemsToST`, `deleteItemsFromST`, `getCurrentChatId`.

**Signature & Logic changes:**
Functions that modify the graph currently do network I/O. We will change them to pure functions that modify the `graphData` object in-memory.

*   `mergeOrInsertEntity()`: Delete the block starting with `if (isStVectorSource()) { ... syncItemsToST ... }`. It should purely modify `graphData.nodes[key]` and return the key.
*   `redirectEdges()`: Delete the block that calls `deleteItemsFromST`. 
*   `consolidateEdges()`: Remove `syncItemsToST`. Instead of just returning the number of consolidated edges, return a list of the modified `edge` objects (or their keys) so the caller knows what to sync.
*   `consolidateGraph()`: Remove `deleteItemsFromST`. Return the list of deleted node keys alongside `mergedCount`.

### 2. `src/graph/communities.js`
**Remove** imports for `isStVectorSource`, `syncItemsToST`, `getCurrentChatId`.

**Signature & Logic changes:**
*   `updateCommunitySummaries()`: Delete the block at the bottom that checks `if (isStVectorSource()) { syncItemsToST(...) }`. The function already returns `{ communities: updatedCommunities }`. That is enough for the caller to know what needs syncing.

### 3. `src/extraction/extract.js` (The Orchestrator)
This file becomes responsible for the side-effects we just removed from the domain.

**Logic changes:**
At the end of **Phase 1** (around line ~250), right before calling `saveOpenVaultData(targetChatId)`, you will add a new block:
```javascript
// Sync Graph Nodes and Edges to ST Vector Storage if needed
if (isStVectorSource()) {
    const chatId = getCurrentChatId();
    
    // 1. Find all unsynced entities in data.graph.nodes
    // 2. Find all unsynced edges in data.graph.edges
    // 3. Find all unsynced events in data.memories (already doing this)
    // 4. Batch them into a single `syncItemsToST` call
    // 5. Apply `markStSynced` to the successful items
}
```
At the end of **Phase 2** (inside `runPhase2Enrichment` and the Phase 2 block of `extractMemories`), do the same for communities and reflections.

### 4. `src/utils/data.js`
Currently, `data.js` is a "junk drawer". Let's clean up the ST Vector logic.

*   Move `isStVectorSource()`, `syncItemsToST()`, `deleteItemsFromST()`, `purgeSTCollection()`, and `querySTVector()` into a new file: `src/embeddings/st-storage.js` (or just leave them in `data.js` for PR 2, but isolate them visually).
*   *Why?* `data.js` should only be about reading/writing `chatMetadata.openvault`. Network requests to `/api/vector/*` belong in an external service layer.

## Execution Order

| Step | File | Risk | Test change |
|------|------|------|-------------|
| 1 | `graph.js` | Medium | Remove `fetch` mocks from `graph.test.js`. Tests become synchronous pure-data assertions. |
| 2 | `communities.js` | Low | Remove `fetch` and `data.js` mocks from `communities.test.js`. |
| 3 | `extract.js` | Medium | Add `syncItemsToST` spy to integration tests to ensure orchestrator fires the sync once per batch. |
| 4 | `embeddings.js` (Backfill) | Low | `backfillAllEmbeddings` already does batch syncing cleanly, just ensure it imports from the right place if you move ST logic. |

## Verification
- Run `npm run test:graph` and `npm run test:extract`.
- Verify in SillyTavern UI (with ST Vector Storage enabled) that new memories, entities, and communities still appear in the Vectra DB (using ST's Data Bank UI).
- Ensure no `getDeps().fetch` calls exist in `graph.js` or `communities.js`.

---
