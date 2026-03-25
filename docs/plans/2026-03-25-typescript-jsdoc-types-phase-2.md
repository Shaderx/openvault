# TypeScript/JSDoc Type Safety Phase 2 Implementation Plan

**Goal:** Add `@ts-check` and JSDoc type annotations to 6 files (graph.js, chat-data.js, 4 prompt builders) following the same approach as Phase 1.

**Architecture:** Centralized typedefs in `src/types.js` imported via JSDoc's `import()` syntax. Zero runtime impact — pure comments.

**Tech Stack:** JSDoc types, VS Code TypeScript server, `@ts-check` directive.

---

## File Structure Overview

- Modify: `src/types.js` - Add ~20 new typedefs for graph, store, and prompt builder types
- Modify: `src/graph/graph.js` - Add `@ts-check` and JSDoc to exported functions
- Modify: `src/store/chat-data.js` - Add `@ts-check` and JSDoc to repository methods
- Modify: `src/prompts/events/builder.js` - Add `@ts-check` and JSDoc
- Modify: `src/prompts/graph/builder.js` - Add `@ts-check` and JSDoc
- Modify: `src/prompts/reflection/builder.js` - Add `@ts-check` and JSDoc
- Modify: `src/prompts/communities/builder.js` - Add `@ts-check` and JSDoc

---

### Task 1: Add Graph Type Definitions to types.js

**Files:**
- Modify: `src/types.js`

- [ ] Step 1: Add GraphData, GraphNode, GraphEdge typedefs

Open `src/types.js` and add after the existing typedefs (before the final `export {}`):

```javascript
/**
 * Flat graph structure stored in chatMetadata.openvault.graph
 * @typedef {Object} GraphData
 * @property {Object.<string, GraphNode>} nodes - Keyed by normalized entity name
 * @property {Object.<string, GraphEdge>} edges - Keyed by "source__target"
 * @property {Object.<string, string>} [_mergeRedirects] - Maps old keys to merged keys
 * @property {string[]} [_edgesNeedingConsolidation] - Edge keys pending consolidation
 */

/**
 * Graph node (entity) structure
 * @typedef {Object} GraphNode
 * @property {string} name - Display name (original casing preserved)
 * @property {string} type - PERSON | PLACE | ORGANIZATION | OBJECT | CONCEPT
 * @property {string} description - Entity description (pipe-separated segments)
 * @property {number} mentions - How many times this entity was seen
 * @property {number[]} [embedding] - Vector representation (deprecated, use embedding_b64)
 * @property {string} [embedding_b64] - Base64-encoded Float32Array embedding
 * @property {string[]} [aliases] - Alternative names merged into this node
 * @property {boolean} [_st_synced] - ST Vector sync status
 */

/**
 * Graph edge (relationship) structure
 * @typedef {Object} GraphEdge
 * @property {string} source - Source entity key (normalized)
 * @property {string} target - Target entity key (normalized)
 * @property {string} description - Relationship description (pipe-separated segments)
 * @property {number} weight - Strength/occurrence count
 * @property {number} [_descriptionTokens] - Token count for consolidation trigger
 * @property {number[]} [embedding] - Vector representation (deprecated)
 * @property {string} [embedding_b64] - Base64-encoded Float32Array embedding
 * @property {boolean} [_st_synced] - ST Vector sync status
 */
```

- [ ] Step 2: Run linter to verify no syntax errors

Run: `npm run lint`
Expected: No errors (exit code 0)

---

### Task 2: Add Store Type Definitions to types.js

**Files:**
- Modify: `src/types.js`

- [ ] Step 1: Add OpenVaultData, CharacterData, ReflectionState typedefs

Add to `src/types.js` after the graph typedefs:

```javascript
/**
 * Complete OpenVault data structure from chat metadata
 * @typedef {Object} OpenVaultData
 * @property {number} schema_version - Data schema version (current: 2)
 * @property {Memory[]} [memories] - Stored memory objects
 * @property {Object.<string, CharacterData>} [characters] - Character data keyed by name
 * @property {string[]} [processed_messages] - Message fingerprints already extracted
 * @property {GraphData} [graph] - Entity relationship graph
 * @property {Object.<string, CommunitySummary>} [communities] - Community summaries
 * @property {ReflectionState} [reflection_state] - Reflection tracking
 * @property {number} [graph_message_count] - Messages processed since last community detection
 * @property {GlobalWorldState} [global_world_state] - Macro-level world state synthesis
 */

/**
 * Character tracking data
 * @typedef {Object} CharacterData
 * @property {number} [firstSeen] - First message ID where character appeared
 * @property {number} [lastSeen] - Most recent message ID
 * @property {number} [mentionCount] - How many times character mentioned
 */

/**
 * Reflection state tracking
 * @typedef {Object} ReflectionState
 * @property {number} [lastMessageId] - Last message processed for reflections
 * @property {number} [reflectionCount] - Number of reflections generated
 */

/**
 * Global world state synthesis
 * @typedef {Object} GlobalWorldState
 * @property {string} summary - Global narrative summary
 * @property {number} last_updated - Message ID when last updated
 * @property {number} community_count - Number of communities at time of synthesis
 */

/**
 * Memory update fields for updateMemory()
 * @typedef {Object} MemoryUpdate
 * @property {string} [summary] - New summary text
 * @property {number} [importance] - New importance (1-5)
 * @property {string[]} [tags] - New tags
 * @property {boolean} [is_secret] - Secret flag
 */
```

- [ ] Step 2: Run linter to verify no syntax errors

Run: `npm run lint`
Expected: No errors (exit code 0)

---

### Task 3: Add Prompt Builder Type Definitions to types.js

**Files:**
- Modify: `src/types.js`

- [ ] Step 1: Add prompt builder parameter and result typedefs

Add to `src/types.js` after the store typedefs:

```javascript
/**
 * Character names pair for prompt building
 * @typedef {Object} CharacterNames
 * @property {string} char - Character name
 * @property {string} user - User name
 */

/**
 * Context object for prompt builders
 * @typedef {Object} PromptContext
 * @property {Memory[]} [memories] - Existing memories for context
 * @property {string} [charDesc] - Character description
 * @property {string} [personaDesc] - Persona description
 */

/**
 * Base prompt builder parameters
 * @typedef {Object} BasePromptParams
 * @property {string} messages - Chat message text
 * @property {CharacterNames} names - Character and user names
 * @property {PromptContext} [context] - Additional context
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language ('en' | 'ru' | 'auto')
 */

/**
 * Graph extraction prompt parameters
 * @typedef {Object} GraphPromptParams
 * @property {string} messages - Chat message text
 * @property {CharacterNames} names - Character and user names
 * @property {PromptContext} [context] - Additional context
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language ('en' | 'ru' | 'auto')
 * @property {string[]} [extractedEvents] - Previously extracted events for context
 */

/**
 * Edge consolidation prompt parameters
 * @typedef {Object} EdgeConsolidationParams
 * @property {GraphEdge} edgeData - Edge to consolidate
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language
 */

/**
 * Reflection prompt parameters
 * @typedef {Object} ReflectionPromptParams
 * @property {string} characterName - Character name to reflect on
 * @property {Memory[]} recentMemories - Recent memories for reflection
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language
 */

/**
 * Community summary prompt parameters
 * @typedef {Object} CommunitySummaryParams
 * @property {string[]} nodeLines - Formatted node descriptions
 * @property {string[]} edgeLines - Formatted edge descriptions
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language
 */

/**
 * Global synthesis prompt parameters
 * @typedef {Object} GlobalSynthesisParams
 * @property {CommunitySummary[]} communities - Community summaries to synthesize
 * @property {string} preamble - System prompt preamble
 * @property {string} prefill - Assistant prefill text (required)
 * @property {string} [outputLanguage] - Output language
 */

/**
 * Community summary result
 * @typedef {Object} CommunitySummary
 * @property {string} title - Community title
 * @property {string} summary - Community summary
 * @property {string[]} [findings] - Key findings
 */

/**
 * LLM message array (OpenAI format)
 * @typedef {Array<{role: string, content: string}>} LLMMessages
 */

/**
 * Return value from consolidateEdges
 * @typedef {Object} ConsolidateEdgesResult
 * @property {number} count - Number of edges consolidated
 * @property {StSyncChanges} stChanges - ST Vector sync changes
 */

/**
 * Return value from mergeOrInsertEntity
 * @typedef {Object} MergeEntityResult
 * @property {string} key - The node key (may be merged target)
 * @property {StSyncChanges} stChanges - ST Vector sync changes
 */
```

- [ ] Step 2: Run linter to verify no syntax errors

Run: `npm run lint`
Expected: No errors (exit code 0)

---

### Task 4: Commit types.js Changes

**Files:**
- Modify: `src/types.js`

- [ ] Step 1: Commit the new typedefs

Run: `git add src/types.js && git commit -m "feat(types): add Graph, Store, and Prompt Builder typedefs"`

---

### Task 5: Add @ts-check and Types to graph.js

**Files:**
- Modify: `src/graph/graph.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/graph/graph.js` after the file comment block:

```javascript
// @ts-check

/** @typedef {import('../types.js').GraphData} GraphData */
/** @typedef {import('../types.js').GraphNode} GraphNode */
/** @typedef {import('../types.js').GraphEdge} GraphEdge */
/** @typedef {import('../types.js').MergeEntityResult} MergeEntityResult */
/** @typedef {import('../types.js').ConsolidateEdgesResult} ConsolidateEdgesResult */
```

- [ ] Step 2: Add JSDoc to `normalizeKey` function

```javascript
/**
 * Normalize an entity name to a consistent key.
 * - Lowercases the name
 * - Strips possessives (e.g., "Vova's" -> "Vova")
 * - Collapses whitespace
 * @param {string} name - Entity name to normalize
 * @returns {string} Normalized key
 */
export function normalizeKey(name) {
```

- [ ] Step 3: Add JSDoc to `expandMainCharacterKeys` function

```javascript
/**
 * Expand main character keys with aliases discovered in the graph.
 * Prevents alter-ego nodes from forming false secondary communities.
 * @param {string[]} baseKeys - Normalized main character keys
 * @param {Object.<string, GraphNode>} graphNodes - Graph nodes keyed by normalized name
 * @returns {string[]} Expanded array including alias keys
 */
export function expandMainCharacterKeys(baseKeys, graphNodes) {
```

- [ ] Step 4: Add JSDoc to `findCrossScriptCharacterKeys` function

```javascript
/**
 * Find graph node keys that are Cyrillic transliterations of known main character names.
 * @param {string[]} baseKeys - Normalized English main character keys
 * @param {Object.<string, GraphNode>} graphNodes - Graph nodes keyed by normalized name
 * @returns {string[]} Cyrillic node keys matching main characters
 */
export function findCrossScriptCharacterKeys(baseKeys, graphNodes) {
```

- [ ] Step 5: Add JSDoc to `upsertEntity` function

```javascript
/**
 * Upsert an entity node into the flat graph structure.
 * Merges descriptions and increments mentions on duplicates.
 * @param {GraphData} graphData - The graph object { nodes, edges } (mutated in place)
 * @param {string} name - Entity name (original casing preserved on first insert)
 * @param {string} type - PERSON | PLACE | ORGANIZATION | OBJECT | CONCEPT
 * @param {string} description - Entity description
 * @param {number} [cap=3] - Maximum number of description segments to retain
 * @returns {void}
 */
export function upsertEntity(graphData, name, type, description, cap = 3) {
```

- [ ] Step 6: Add JSDoc to `upsertRelationship` function

```javascript
/**
 * Upsert a relationship edge. Increments weight on duplicates.
 * @param {GraphData} graphData - The graph object { nodes, edges } (mutated in place)
 * @param {string} source - Source entity name (will be normalized)
 * @param {string} target - Target entity name (will be normalized)
 * @param {string} description - Relationship description
 * @param {number} [cap=5] - Maximum number of description segments to retain
 * @param {Object} [settings=null] - Optional settings for consolidation behavior
 * @returns {void}
 */
export function upsertRelationship(graphData, source, target, description, cap = 5, settings = null) {
```

- [ ] Step 7: Add JSDoc to `hasSufficientTokenOverlap` function

```javascript
/**
 * Check if two token sets have sufficient overlap to consider merging.
 * @param {Set<string>} tokensA - First set of tokens
 * @param {Set<string>} tokensB - Second set of tokens
 * @param {number} [minOverlapRatio=0.5] - Minimum overlap ratio
 * @param {string} [keyA=''] - Original key A for substring check
 * @param {string} [keyB=''] - Original key B for substring check
 * @returns {boolean}
 */
export function hasSufficientTokenOverlap(tokensA, tokensB, minOverlapRatio = 0.5, keyA = '', keyB = '') {
```

- [ ] Step 8: Add JSDoc to `shouldMergeEntities` function

```javascript
/**
 * Determine if two entities should merge based on cosine similarity and token overlap.
 * @param {number} cosine - Cosine similarity between embeddings
 * @param {number} threshold - entityMergeSimilarityThreshold from settings
 * @param {Set<string>} tokensA - Word tokens from entity A's key (pre-computed)
 * @param {string} keyA - Entity A's normalized key
 * @param {string} keyB - Entity B's normalized key
 * @param {string} [type='OBJECT'] - Entity type (PERSON, OBJECT, CONCEPT, etc.)
 * @returns {boolean}
 */
export function shouldMergeEntities(cosine, threshold, tokensA, keyA, keyB, type = 'OBJECT') {
```

- [ ] Step 9: Add JSDoc to `mergeOrInsertEntity` function

```javascript
/**
 * Merge-or-insert an entity with semantic deduplication.
 * @param {GraphData} graphData - The graph object { nodes, edges }
 * @param {string} name - Entity name
 * @param {string} type - Entity type
 * @param {string} description - Entity description
 * @param {number} cap - Description segment cap
 * @param {Object} _settings - Extension settings
 * @returns {Promise<MergeEntityResult>} The key of the node and ST sync changes
 */
export async function mergeOrInsertEntity(graphData, name, type, description, cap, _settings) {
```

- [ ] Step 10: Add JSDoc to `consolidateEdges` function

```javascript
/**
 * Consolidate graph edges that have exceeded token budget.
 * @param {GraphData} graphData - The graph object
 * @param {Object} _settings - Extension settings
 * @returns {Promise<ConsolidateEdgesResult>} Consolidation result
 */
export async function consolidateEdges(graphData, _settings) {
```

- [ ] Step 11: Add JSDoc to `createEmptyGraph` function

```javascript
/**
 * Create an empty flat graph structure.
 * @returns {GraphData} Empty graph with nodes and edges objects
 */
export function createEmptyGraph() {
```

- [ ] Step 12: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 13: Open file in VS Code and verify no red squiggles

Open `src/graph/graph.js` in VS Code, check Problems panel (Cmd+Shift+M / Ctrl+Shift+M)
Expected: 0 errors

---

### Task 6: Commit graph.js Changes

**Files:**
- Modify: `src/graph/graph.js`

- [ ] Step 1: Commit graph.js

Run: `git add src/graph/graph.js && git commit -m "feat(types): add @ts-check and JSDoc to graph.js"`

---

### Task 7: Add @ts-check and Types to chat-data.js

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/store/chat-data.js` after the imports:

```javascript
// @ts-check

/** @typedef {import('../types.js').OpenVaultData} OpenVaultData */
/** @typedef {import('../types.js').Memory} Memory */
/** @typedef {import('../types.js').MemoryUpdate} MemoryUpdate */
```

- [ ] Step 2: Add JSDoc to `getOpenVaultData`

```javascript
/**
 * Get OpenVault data from chat metadata.
 * @returns {OpenVaultData | null} Returns null if context is not available
 */
export function getOpenVaultData() {
```

- [ ] Step 3: Add JSDoc to `getCurrentChatId`

```javascript
/**
 * Get current chat ID for tracking across async operations.
 * @returns {string | null} Chat ID or null if unavailable
 */
export function getCurrentChatId() {
```

- [ ] Step 4: Add JSDoc to `saveOpenVaultData`

```javascript
/**
 * Save OpenVault data to chat metadata.
 * @param {string} [expectedChatId] - If provided, verify chat hasn't changed before saving
 * @returns {Promise<boolean>} True if save succeeded, false otherwise
 */
export async function saveOpenVaultData(expectedChatId = null) {
```

- [ ] Step 5: Add JSDoc to `generateId`

```javascript
/**
 * Generate a unique ID.
 * @returns {string} Unique ID string
 */
export function generateId() {
```

- [ ] Step 6: Add JSDoc to `updateMemory`

```javascript
/**
 * Update a memory by ID.
 * @param {string} id - Memory ID to update
 * @param {MemoryUpdate} updates - Fields to update
 * @returns {Promise<boolean>} True if updated, false otherwise
 */
export async function updateMemory(id, updates) {
```

- [ ] Step 7: Add JSDoc to `deleteMemory`

```javascript
/**
 * Delete a memory by ID.
 * @param {string} id - Memory ID to delete
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteMemory(id) {
```

- [ ] Step 8: Add JSDoc to `deleteCurrentChatData`

```javascript
/**
 * Delete all OpenVault data for the current chat.
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
export async function deleteCurrentChatData() {
```

- [ ] Step 9: Add JSDoc to `addMemories`

```javascript
/**
 * Append new memories to the store.
 * @param {Memory[]} newMemories - Memory objects to add
 * @returns {void}
 */
export function addMemories(newMemories) {
```

- [ ] Step 10: Add JSDoc to `markMessagesProcessed`

```javascript
/**
 * Record message fingerprints as processed.
 * @param {string[]} fingerprints - Message fingerprints to mark
 * @returns {void}
 */
export function markMessagesProcessed(fingerprints) {
```

- [ ] Step 11: Add JSDoc to `incrementGraphMessageCount`

```javascript
/**
 * Increment the graph message count.
 * @param {number} count - Number of messages to add
 * @returns {void}
 */
export function incrementGraphMessageCount(count) {
```

- [ ] Step 12: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 13: Open file in VS Code and verify no red squiggles

Open `src/store/chat-data.js` in VS Code, check Problems panel
Expected: 0 errors

---

### Task 8: Commit chat-data.js Changes

**Files:**
- Modify: `src/store/chat-data.js`

- [ ] Step 1: Commit chat-data.js

Run: `git add src/store/chat-data.js && git commit -m "feat(types): add @ts-check and JSDoc to chat-data.js"`

---

### Task 9: Add @ts-check and Types to events/builder.js

**Files:**
- Modify: `src/prompts/events/builder.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/prompts/events/builder.js` after the file comment block:

```javascript
// @ts-check

/** @typedef {import('../../types.js').BasePromptParams} BasePromptParams */
/** @typedef {import('../../types.js').LLMMessages} LLMMessages */
```

- [ ] Step 2: Add JSDoc to `buildEventExtractionPrompt`

```javascript
/**
 * Build the event extraction prompt (Stage 1).
 * @param {BasePromptParams} params - Prompt builder parameters
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildEventExtractionPrompt({
```

- [ ] Step 3: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 4: Open file in VS Code and verify no red squiggles

Open `src/prompts/events/builder.js` in VS Code, check Problems panel
Expected: 0 errors

---

### Task 10: Commit events/builder.js Changes

**Files:**
- Modify: `src/prompts/events/builder.js`

- [ ] Step 1: Commit events/builder.js

Run: `git add src/prompts/events/builder.js && git commit -m "feat(types): add @ts-check and JSDoc to events/builder.js"`

---

### Task 11: Add @ts-check and Types to graph/builder.js

**Files:**
- Modify: `src/prompts/graph/builder.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/prompts/graph/builder.js` after the file comment block:

```javascript
// @ts-check

/** @typedef {import('../../types.js').GraphPromptParams} GraphPromptParams */
/** @typedef {import('../../types.js').EdgeConsolidationParams} EdgeConsolidationParams */
/** @typedef {import('../../types.js').LLMMessages} LLMMessages */
```

- [ ] Step 2: Add JSDoc to `buildGraphExtractionPrompt`

```javascript
/**
 * Build the graph extraction prompt (Stage B).
 * @param {GraphPromptParams} params - Prompt builder parameters
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildGraphExtractionPrompt({
```

- [ ] Step 3: Add JSDoc to `buildEdgeConsolidationPrompt`

```javascript
/**
 * Build the edge consolidation prompt.
 * @param {EdgeConsolidationParams} params - Prompt builder parameters
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildEdgeConsolidationPrompt(edgeData, preamble, outputLanguage = 'auto', prefill) {
```

- [ ] Step 4: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 5: Open file in VS Code and verify no red squiggles

Open `src/prompts/graph/builder.js` in VS Code, check Problems panel
Expected: 0 errors

---

### Task 12: Commit graph/builder.js Changes

**Files:**
- Modify: `src/prompts/graph/builder.js`

- [ ] Step 1: Commit graph/builder.js

Run: `git add src/prompts/graph/builder.js && git commit -m "feat(types): add @ts-check and JSDoc to graph/builder.js"`

---

### Task 13: Add @ts-check and Types to reflection/builder.js

**Files:**
- Modify: `src/prompts/reflection/builder.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/prompts/reflection/builder.js` after the file comment block:

```javascript
// @ts-check

/** @typedef {import('../../types.js').ReflectionPromptParams} ReflectionPromptParams */
/** @typedef {import('../../types.js').LLMMessages} LLMMessages */
```

- [ ] Step 2: Add JSDoc to `buildUnifiedReflectionPrompt`

```javascript
/**
 * Build the unified reflection prompt.
 * @param {string} characterName - Character name to reflect on
 * @param {import('../../types.js').Memory[]} recentMemories - Recent memories for reflection
 * @param {string} preamble - System prompt preamble
 * @param {string} [outputLanguage='auto'] - Output language
 * @param {string} prefill - Assistant prefill text (required)
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildUnifiedReflectionPrompt(
```

- [ ] Step 3: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 4: Open file in VS Code and verify no red squiggles

Open `src/prompts/reflection/builder.js` in VS Code, check Problems panel
Expected: 0 errors

---

### Task 14: Commit reflection/builder.js Changes

**Files:**
- Modify: `src/prompts/reflection/builder.js`

- [ ] Step 1: Commit reflection/builder.js

Run: `git add src/prompts/reflection/builder.js && git commit -m "feat(types): add @ts-check and JSDoc to reflection/builder.js"`

---

### Task 15: Add @ts-check and Types to communities/builder.js

**Files:**
- Modify: `src/prompts/communities/builder.js`

- [ ] Step 1: Add `@ts-check` directive and type imports

Add at the top of `src/prompts/communities/builder.js` after the file comment block:

```javascript
// @ts-check

/** @typedef {import('../../types.js').CommunitySummaryParams} CommunitySummaryParams */
/** @typedef {import('../../types.js').GlobalSynthesisParams} GlobalSynthesisParams */
/** @typedef {import('../../types.js').LLMMessages} LLMMessages */
```

- [ ] Step 2: Add JSDoc to `buildCommunitySummaryPrompt`

```javascript
/**
 * Build the community summarization prompt.
 * @param {string[]} nodeLines - Formatted node descriptions
 * @param {string[]} edgeLines - Formatted edge descriptions
 * @param {string} preamble - System prompt preamble
 * @param {string} [outputLanguage='auto'] - Output language
 * @param {string} prefill - Assistant prefill text (required)
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildCommunitySummaryPrompt(nodeLines, edgeLines, preamble, outputLanguage = 'auto', prefill) {
```

- [ ] Step 3: Add JSDoc to `buildGlobalSynthesisPrompt`

```javascript
/**
 * Build the global world state synthesis prompt.
 * @param {import('../../types.js').CommunitySummary[]} communities - Community summaries to synthesize
 * @param {string} preamble - System prompt preamble
 * @param {string} [outputLanguage='auto'] - Output language
 * @param {string} prefill - Assistant prefill text (required)
 * @returns {LLMMessages} Array of {role, content} message objects
 */
export function buildGlobalSynthesisPrompt(communities, preamble, outputLanguage = 'auto', prefill) {
```

- [ ] Step 4: Run linter to verify

Run: `npm run lint`
Expected: No errors (exit code 0)

- [ ] Step 5: Open file in VS Code and verify no red squiggles

Open `src/prompts/communities/builder.js` in VS Code, check Problems panel
Expected: 0 errors

---

### Task 16: Commit communities/builder.js Changes

**Files:**
- Modify: `src/prompts/communities/builder.js`

- [ ] Step 1: Commit communities/builder.js

Run: `git add src/prompts/communities/builder.js && git commit -m "feat(types): add @ts-check and JSDoc to communities/builder.js"`

---

### Task 17: Final Verification

**Files:**
- All modified files

- [ ] Step 1: Run typecheck with auto-fix

Run: `npm run typecheck -- --fix && npx @biomejs/biome check --write --unsafe`
Expected: No type errors, Biome fixes applied

- [ ] Step 2: Run full test suite to ensure no runtime regressions

Run: `npm run test`
Expected: All tests pass (exit code 0)

- [ ] Step 3: Verify all 6 files have `@ts-check` directive

Run: `grep -l "@ts-check" src/graph/graph.js src/store/chat-data.js src/prompts/events/builder.js src/prompts/graph/builder.js src/prompts/reflection/builder.js src/prompts/communities/builder.js`
Expected: All 6 file paths printed

- [ ] Step 4: Check VS Code Problems panel for all workspace errors

Open VS Code, check Problems panel (Cmd+Shift+M / Ctrl+Shift+M)
Expected: 0 TypeScript errors

---

### Task 18: Final Commit

**Files:**
- All modified files

- [ ] Step 1: Stage and commit the design document

Run: `git add docs/designs/2026-03-25-typescript-jsdoc-types-phase-2.md docs/plans/2026-03-25-typescript-jsdoc-types-phase-2.md && git commit -m "docs: add TypeScript Phase 2 design and plan"`

---

## Common Pitfalls

- **JSDoc import paths**: Types are imported from `../../types.js` for files in `src/prompts/*/` and `../types.js` for files in `src/graph/` and `src/store/`. Double-check the relative path depth.
- **Existing typedefs**: `Memory`, `Entity`, `StSyncChanges` are already defined in `types.js` from Phase 1. Don't redefine them.
- **Function signatures**: When adding JSDoc, preserve the exact function signature (parameter names, default values). Don't modify the actual function code.
- **Linter configuration**: This project uses Biome. Run `npm run lint` after each file to catch issues early.
- **VS Code caching**: If IntelliSense doesn't show new types immediately, try: `Cmd+Shift+P` -> "TypeScript: Restart TS Server"
