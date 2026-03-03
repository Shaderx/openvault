# Design: UI Overhaul for Reflections & GraphRAG

## 1. Problem Statement

OpenVault's UI was built for the core extraction/retrieval pipeline. Three major backend features now have zero UI exposure:

1. **Character Reflections** — importance accumulation, threshold triggers, generated insights — all invisible
2. **Knowledge Graph** — entities extracted every batch, stored in `data.graph`, never shown
3. **Community Detection & World Context** — Louvain communities, LLM summaries, injected into prompts — users can't see or control any of it

Additionally, the Memory Bank type filter dropdown is dead code (`_typeFilter` ignored in `filterMemories()`), and the filter options (action/revelation/emotion_shift/relationship_change) don't match the actual memory types the system produces.

## 2. Goals & Non-Goals

### Must Do
- Add new **World tab** (5th tab) for community summaries and entity browser
- Add **reflection progress counters** to Memory Bank tab (next to Character States)
- Replace broken type filter with working "All / Events / Reflections" filter
- Add **new settings** in Config tab: reflection threshold, world context budget, community trigger interval
- Fix `filterMemories()` to actually filter by type
- Add reflection-specific display in memory cards (badge, source evidence)
- Update Dashboard stats to include graph/community/reflection counts

### Won't Do
- Graph visualization (no D3/Cytoscape/sigma.js — per design constraint)
- Entity editing/deletion (read-only browser)
- Community manual creation/editing
- Reflection manual trigger button (out of scope)
- Reorganize existing Advanced Parameters (user wants to keep all 10 sliders)

## 3. Proposed Architecture

### Tab Structure (Before → After)

```
BEFORE (4 tabs):                    AFTER (5 tabs):
┌──────────┬─────────────┐          ┌──────────┬─────────────┐
│Dashboard │ Memory Bank │          │Dashboard │ Memory Bank │
├──────────┼─────────────┤          ├──────────┼─────────────┤
│ Config   │   System    │          │  World   │   Config    │
└──────────┴─────────────┘          ├──────────┼─────────────┤
                                    │  System  │             │
                                    └──────────┴─────────────┘
```

### Component Changes by Tab

```
TAB: DASHBOARD
  MODIFY: Stats grid
    ADD: stat card "Reflections" (count of type=reflection memories)
    ADD: stat card "Entities" (Object.keys(data.graph.nodes).length)
    ADD: stat card "Communities" (Object.keys(data.communities).length)
    KEEP: Memories, Characters, Embeddings cards
  KEEP: Status card, batch progress, quick toggles — unchanged

TAB: MEMORY BANK
  MODIFY: Type filter dropdown
    REMOVE: action, revelation, emotion_shift, relationship_change options
    ADD: "Events" (type !== 'reflection'), "Reflections" (type === 'reflection')
    FIX: filterMemories() to actually apply type filter
  ADD: Reflection Progress section (collapsible, below Character States)
    CONTENT: Per-character text counters "Alice: 22/30"
  MODIFY: Memory card template
    ADD: "reflection" badge for type=reflection memories
    ADD: "source_ids" display (count of evidence memories)
  KEEP: Search, character filter, pagination, character states, edit/delete

TAB: WORLD (NEW)
  ADD: Community Summaries section
    LAYOUT: Accordion list — each community is collapsible
    EXPANDED: title, summary paragraph, findings bullet list, member entity names
    COLLAPSED: title + member count badge
    EMPTY STATE: "No communities detected yet"
  ADD: Entity Browser section (below communities)
    LAYOUT: Scrollable list of entity cards
    CARD: name, type badge (PERSON/PLACE/ORG/OBJECT/CONCEPT), mention count, description
    FILTER: by type (dropdown)
    SEARCH: text search on name/description
    EMPTY STATE: "No entities extracted yet"

TAB: CONFIG
  ADD: "Features" settings group (between LLM Strategy and Embeddings)
    SETTING: Reflection Threshold (range 10-100, default 30)
    SETTING: World Context Budget (range 500-5000, default 2000 tokens)
    SETTING: Community Detection Interval (range 10-200, default 50 messages)
  KEEP: LLM Strategy, Embeddings, Pipeline Tuning, Advanced Parameters — unchanged

TAB: SYSTEM
  KEEP: Debug toggle, danger zone — unchanged
```

### Data Flow

```
getOpenVaultData() → data.graph.nodes     → World tab entity list
                   → data.communities     → World tab accordion
                   → data.reflection_state → Memory Bank progress counters
                   → data.memories         → Memory Bank (existing + new reflection type filter)
```

## 4. Data Models / Schema

### 4.1 New Settings Keys

```javascript
// src/constants.js — additions to defaultSettings
{
  // ... existing settings ...

  // Reflection settings
  reflectionThreshold: 30,           // Importance sum to trigger reflection

  // World context settings
  worldContextBudget: 2000,          // Token budget for community summary injection
  communityDetectionInterval: 50,    // Messages between community detection runs
}
```

### 4.2 New UI Default Hints

```javascript
// src/constants.js — additions to UI_DEFAULT_HINTS
{
  reflectionThreshold: 30,
  worldContextBudget: 2000,
  communityDetectionInterval: 50,
}
```

### 4.3 Memory Type Filter Values

```
""            → All memories (no filter)
"event"       → type !== "reflection" (raw events — default/legacy memories have no type field)
"reflection"  → type === "reflection"
```

**Implementation note:** Existing memories don't have a `type` field. Memories without `type` or with `type === undefined` are treated as events. Only explicitly `type === "reflection"` are reflections.

## 5. Interface / API Design

### 5.1 Modified: `filterMemories()` in `src/ui/helpers.js`

```javascript
/**
 * Filter memories by type and character.
 * @param {Array} memories
 * @param {string} typeFilter - "" (all), "event", "reflection"
 * @param {string} characterFilter - "" (all) or character name
 * @returns {Array}
 */
export function filterMemories(memories, typeFilter, characterFilter) {
    return memories.filter((m) => {
        // Type filter
        if (typeFilter === 'event' && m.type === 'reflection') return false;
        if (typeFilter === 'reflection' && m.type !== 'reflection') return false;

        // Character filter
        if (characterFilter && !m.characters_involved?.includes(characterFilter)) return false;

        return true;
    });
}
```

### 5.2 New: Reflection Progress Renderer

```javascript
// In src/ui/render.js or src/ui/templates.js

/**
 * Render reflection progress counters for all characters.
 * @param {Object} reflectionState - data.reflection_state (charName → { importance_sum })
 * @param {number} threshold - Reflection threshold setting
 * @returns {string} HTML
 */
export function renderReflectionProgress(reflectionState, threshold) {
    if (!reflectionState || Object.keys(reflectionState).length === 0) {
        return '<p class="openvault-placeholder">No reflection data yet</p>';
    }

    const items = Object.entries(reflectionState)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, state]) => {
            const sum = state.importance_sum || 0;
            return `<span class="openvault-reflection-counter">${escapeHtml(name)}: ${sum}/${threshold}</span>`;
        })
        .join(' · ');

    return `<div class="openvault-reflection-counters">${items}</div>`;
}
```

### 5.3 New: Community Accordion Renderer

```javascript
// In src/ui/templates.js

/**
 * Render a single community as an accordion item.
 * @param {string} id - Community ID (e.g., "C0")
 * @param {Object} community - { title, summary, findings, nodeKeys, lastUpdated }
 * @returns {string} HTML
 */
export function renderCommunityAccordion(id, community) {
    const memberCount = community.nodeKeys?.length || 0;
    const findings = (community.findings || [])
        .map(f => `<li>${escapeHtml(f)}</li>`)
        .join('');
    const members = (community.nodeKeys || [])
        .map(k => escapeHtml(k))
        .join(', ');

    return `
        <details class="openvault-community-item">
            <summary>
                <span class="openvault-community-title">${escapeHtml(community.title || id)}</span>
                <span class="openvault-community-badge">${memberCount} entities</span>
            </summary>
            <div class="openvault-community-content">
                <p>${escapeHtml(community.summary || 'No summary')}</p>
                ${findings ? `<ul class="openvault-community-findings">${findings}</ul>` : ''}
                <small class="openvault-community-members">Members: ${members}</small>
            </div>
        </details>
    `;
}
```

### 5.4 New: Entity Browser Renderer

```javascript
// In src/ui/templates.js

/**
 * Render a single entity card.
 * @param {Object} entity - { name, type, description, mentions }
 * @returns {string} HTML
 */
export function renderEntityCard(entity) {
    return `
        <div class="openvault-entity-card">
            <div class="openvault-entity-header">
                <span class="openvault-entity-name">${escapeHtml(entity.name)}</span>
                <span class="openvault-entity-type-badge ${entity.type.toLowerCase()}">${escapeHtml(entity.type)}</span>
            </div>
            <div class="openvault-entity-description">${escapeHtml(entity.description || '')}</div>
            <small class="openvault-entity-mentions">${entity.mentions || 0} mentions</small>
        </div>
    `;
}
```

### 5.5 Modified: Memory Card Template

Add reflection badge and evidence count to `renderMemoryItem()` in `templates.js`:

```javascript
// Inside buildBadges(memory):
if (memory.type === 'reflection') {
    badges.push(
        `<span class="openvault-memory-card-badge reflection">
            <i class="fa-solid fa-lightbulb"></i> Reflection
        </span>`
    );
    if (memory.source_ids?.length > 0) {
        badges.push(
            `<span class="openvault-memory-card-badge evidence">
                <i class="fa-solid fa-link"></i> ${memory.source_ids.length} evidence
            </span>`
        );
    }
}
```

### 5.6 Modified: Dashboard Stats

Add 3 new stat cards after existing 3:

```html
<!-- After Embeddings stat card -->
<div class="openvault-stat-card">
    <div class="stat-icon"><i class="fa-solid fa-lightbulb"></i></div>
    <div class="stat-value" id="openvault_stat_reflections">0</div>
    <div class="stat-label">Reflections</div>
</div>
<div class="openvault-stat-card">
    <div class="stat-icon"><i class="fa-solid fa-diagram-project"></i></div>
    <div class="stat-value" id="openvault_stat_entities">0</div>
    <div class="stat-label">Entities</div>
</div>
<div class="openvault-stat-card">
    <div class="stat-icon"><i class="fa-solid fa-circle-nodes"></i></div>
    <div class="stat-value" id="openvault_stat_communities">0</div>
    <div class="stat-label">Communities</div>
</div>
```

### 5.7 Modified: `refreshStats()` in `src/ui/status.js`

```javascript
// Add after existing stat updates:
const reflectionCount = memories.filter(m => m.type === 'reflection').length;
const entityCount = Object.keys(data.graph?.nodes || {}).length;
const communityCount = Object.keys(data.communities || {}).length;

$('#openvault_stat_reflections').text(reflectionCount);
$('#openvault_stat_entities').text(entityCount);
$('#openvault_stat_communities').text(communityCount);
```

### 5.8 New Settings Bindings in `settings.js`

```javascript
// In bindUIElements():
$('#openvault_reflection_threshold').on('input', function () {
    const value = parseInt($(this).val(), 10);
    saveSetting('reflectionThreshold', value);
    $('#openvault_reflection_threshold_value').text(value);
});

$('#openvault_world_context_budget').on('input', function () {
    const value = parseInt($(this).val(), 10);
    saveSetting('worldContextBudget', value);
    $('#openvault_world_context_budget_value').text(value);
    updateWordsDisplay(value, 'openvault_world_context_budget_words');
});

$('#openvault_community_interval').on('input', function () {
    const value = parseInt($(this).val(), 10);
    saveSetting('communityDetectionInterval', value);
    $('#openvault_community_interval_value').text(value);
});

// In updateUI():
$('#openvault_reflection_threshold').val(settings.reflectionThreshold ?? 30);
$('#openvault_reflection_threshold_value').text(settings.reflectionThreshold ?? 30);

$('#openvault_world_context_budget').val(settings.worldContextBudget ?? 2000);
$('#openvault_world_context_budget_value').text(settings.worldContextBudget ?? 2000);
updateWordsDisplay(settings.worldContextBudget ?? 2000, 'openvault_world_context_budget_words');

$('#openvault_community_interval').val(settings.communityDetectionInterval ?? 50);
$('#openvault_community_interval_value').text(settings.communityDetectionInterval ?? 50);
```

### 5.9 New HTML Sections

#### World Tab (in `settings_panel.html`)

```html
<!-- TAB: WORLD (NEW — between Memory Bank and Config) -->
<div class="openvault-tab-content" data-tab="world">
    <!-- Community Summaries -->
    <div class="openvault-card">
        <div class="openvault-card-header">
            <span class="openvault-card-title">
                <i class="fa-solid fa-circle-nodes"></i> Communities
            </span>
            <span class="openvault-card-badge" id="openvault_community_count">0</span>
        </div>
        <div id="openvault_community_list" class="openvault-community-list">
            <p class="openvault-placeholder">No communities detected yet</p>
        </div>
    </div>

    <!-- Entity Browser -->
    <div class="openvault-card" style="margin-top: 15px;">
        <div class="openvault-card-header">
            <span class="openvault-card-title">
                <i class="fa-solid fa-diagram-project"></i> Entities
            </span>
            <span class="openvault-card-badge" id="openvault_entity_count">0</span>
        </div>
        <div class="openvault-filters">
            <div class="openvault-search-container">
                <i class="fa-solid fa-search"></i>
                <input type="text" id="openvault_entity_search" class="openvault-search-input"
                       placeholder="Search entities..." />
            </div>
            <select id="openvault_entity_type_filter" class="text_pole">
                <option value="">All Types</option>
                <option value="PERSON">Person</option>
                <option value="PLACE">Place</option>
                <option value="ORGANIZATION">Organization</option>
                <option value="OBJECT">Object</option>
                <option value="CONCEPT">Concept</option>
            </select>
        </div>
        <div id="openvault_entity_list" class="openvault-entity-list">
            <p class="openvault-placeholder">No entities extracted yet</p>
        </div>
    </div>
</div>
```

#### Reflection Progress (in Memory Bank tab, after Character States)

```html
<!-- Reflection Progress (collapsed) -->
<div class="inline-drawer" style="margin-top: 15px;">
    <div class="inline-drawer-toggle inline-drawer-header">
        <span>Reflection Progress</span>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <div id="openvault_reflection_progress" class="openvault-reflection-progress">
            <p class="openvault-placeholder">No reflection data yet</p>
        </div>
    </div>
</div>
```

#### Features Settings Group (in Config tab)

```html
<!-- Features Group (between LLM Strategy and Embeddings) -->
<div class="openvault-settings-group">
    <div class="openvault-settings-group-header">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>Features</span>
    </div>

    <label for="openvault_reflection_threshold">
        Reflection Threshold: <span id="openvault_reflection_threshold_value">30</span>
        <small class="openvault-default-hint" data-default-key="reflectionThreshold"></small>
    </label>
    <input type="range" id="openvault_reflection_threshold" min="10" max="100" step="5" value="30" />
    <small class="openvault-hint">
        Importance sum needed to trigger character reflection. Lower = more frequent reflections.
    </small>

    <div style="height: 8px;"></div>

    <label for="openvault_world_context_budget">
        World Context Budget: <span id="openvault_world_context_budget_value">2000</span> tokens
        <small class="openvault-default-hint" data-default-key="worldContextBudget"></small>
        <small class="openvault-words-hint">~<span id="openvault_world_context_budget_words">1500</span> words</small>
    </label>
    <input type="range" id="openvault_world_context_budget" min="500" max="5000" step="250" value="2000" />
    <small class="openvault-hint">
        Token budget for community summaries injected as world context.
    </small>

    <div style="height: 8px;"></div>

    <label for="openvault_community_interval">
        Community Detection Interval: <span id="openvault_community_interval_value">50</span> messages
        <small class="openvault-default-hint" data-default-key="communityDetectionInterval"></small>
    </label>
    <input type="range" id="openvault_community_interval" min="10" max="200" step="10" value="50" />
    <small class="openvault-hint">
        How often Louvain community detection runs. Lower = fresher communities, more LLM calls.
    </small>
</div>
```

#### Modified Type Filter

```html
<!-- Replace existing filter dropdown -->
<select id="openvault_filter_type" class="text_pole">
    <option value="">All Memories</option>
    <option value="event">Events</option>
    <option value="reflection">Reflections</option>
</select>
```

#### Tab Navigation Update

```html
<!-- Add World tab button between Memory Bank and Config -->
<button class="openvault-tab-btn" data-tab="world">
    <i class="fa-solid fa-globe"></i> World
</button>
```

## 6. Risks & Edge Cases

### 6.1 Empty State Everywhere
**Risk:** New tabs show only "No data yet" for users who haven't run extraction or don't have enough messages for communities.
**Mitigation:** Each section has a descriptive placeholder. Dashboard stat cards show 0 gracefully. World tab explains what communities/entities are in the empty state text.

### 6.2 Stats Grid Overflow
**Risk:** Dashboard stats grid goes from 3 to 6 cards. On narrow panels this wraps awkwardly.
**Mitigation:** Use CSS grid with `auto-fill, minmax(100px, 1fr)`. On narrow widths, cards stack 2-per-row instead of 3. Already uses flex-wrap.

### 6.3 Entity List Performance
**Risk:** A graph with 500+ entities could make the entity browser sluggish if rendered all at once.
**Mitigation:** Paginate entity list (reuse existing pagination component). 20 entities per page, same as memories. Add search debounce (200ms, same pattern as memory search).

### 6.4 Settings Not Consumed by Backend Yet
**Risk:** Adding `reflectionThreshold`, `worldContextBudget`, `communityDetectionInterval` to settings before the backend reads them.
**Mitigation:** The backend design (Phase 3-5) must read these from settings instead of hardcoded values. Until then, settings exist in UI but backend uses defaults. No functional difference — user just sees the controls before they take effect. Document this in implementation phases.

### 6.5 Type Filter Backward Compatibility
**Risk:** Users who had previously selected a type filter value (action/revelation/etc.) have a stale value in saved settings.
**Mitigation:** `filterMemories()` treats any unrecognized `typeFilter` value as "" (show all). No migration needed.

### 6.6 Reflection State Missing
**Risk:** `data.reflection_state` doesn't exist for older chats. Accessing it for the progress counters throws.
**Mitigation:** All renderers guard with `data.reflection_state || {}`. Same pattern as existing `data[CHARACTERS_KEY] || {}`.

### 6.7 World Tab Render Triggered Before Data Exists
**Risk:** Switching to World tab before any extraction has run → `data.graph` is undefined.
**Mitigation:** Guard all graph/community reads: `data.graph?.nodes || {}`, `data.communities || {}`.

## 7. Implementation Phases

### Phase A: Settings & Constants
- Add `reflectionThreshold`, `worldContextBudget`, `communityDetectionInterval` to `defaultSettings` and `UI_DEFAULT_HINTS` in `src/constants.js`
- Add bindings in `settings.js` (`bindUIElements` + `updateUI`)

### Phase B: Fix Type Filter
- Replace dropdown options in `settings_panel.html` (All Memories / Events / Reflections)
- Fix `filterMemories()` in `helpers.js` to apply type filter
- Pass `typeFilter` through in `renderMemoryList()` (currently passes empty string)

### Phase C: Memory Card Reflection Badge
- Add reflection badge + evidence count to `buildBadges()` in `templates.js`
- Add CSS for `.openvault-memory-card-badge.reflection` and `.evidence`

### Phase D: Dashboard Stats Expansion
- Add 3 new stat cards to `settings_panel.html`
- Update `refreshStats()` in `status.js` to populate reflection/entity/community counts

### Phase E: Memory Bank — Reflection Progress
- Add collapsible "Reflection Progress" section HTML after Character States
- Add `renderReflectionProgress()` template function
- Call from `refreshAllUI()` / `renderCharacterStates()`

### Phase F: World Tab — Communities
- Add World tab button + content section to `settings_panel.html`
- Add `renderCommunityAccordion()` template function
- Add `renderCommunityList()` to `render.js`
- Wire into `refreshAllUI()`

### Phase G: World Tab — Entity Browser
- Add entity browser HTML (search, type filter, list container)
- Add `renderEntityCard()` template function
- Add `renderEntityList()` with search/filter/pagination to `render.js`
- Add entity search debounce + type filter bindings to `settings.js`

### Phase H: Backend Integration (Wire Settings)
- Update `src/reflection/reflect.js` to read `reflectionThreshold` from settings instead of hardcoded 30
- Update `src/retrieval/world-context.js` to read `worldContextBudget` from settings instead of hardcoded 2000
- Update `src/extraction/extract.js` to read `communityDetectionInterval` from settings instead of hardcoded 50

Each phase is independently testable and committable.

## 8. Summary of Changes

| What | Action | Where |
|---|---|---|
| Type filter dropdown | **Replace** options with All/Events/Reflections | `settings_panel.html` |
| `filterMemories()` | **Fix** — apply type filter | `src/ui/helpers.js` |
| Dashboard stats | **Add** 3 cards (Reflections, Entities, Communities) | `settings_panel.html`, `status.js` |
| Memory card badges | **Add** reflection + evidence badges | `src/ui/templates.js` |
| Reflection progress | **Add** collapsible section with text counters | `settings_panel.html`, `render.js`, `templates.js` |
| World tab | **Add** new 5th tab | `settings_panel.html` |
| Community accordion | **Add** renderer | `src/ui/templates.js`, `render.js` |
| Entity browser | **Add** with search/filter/pagination | `src/ui/templates.js`, `render.js`, `settings.js` |
| Features settings | **Add** 3 sliders (threshold, budget, interval) | `settings_panel.html`, `constants.js`, `settings.js` |
| Tab navigation | **Add** World tab button | `settings_panel.html` |
| Advanced Parameters | **Keep** all 10 sliders unchanged | — |
| Legacy hidden badges | **Keep** unchanged | `settings_panel.html` |
| Smart retrieval remnants | Handled by Phase 0 of main design | Not this design's scope |
