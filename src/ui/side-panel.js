/**
 * OpenVault Side Panel
 *
 * Persistent panel on the left side of the chat showing memories,
 * communities, and entities with infinite scroll.
 */

import { CHARACTERS_KEY, MEMORIES_KEY, extensionFolderPath } from '../constants.js';
import {
    deleteMemory as deleteMemoryAction,
    getOpenVaultData,
    updateMemory as updateMemoryAction,
    updateEntity,
    deleteEntity as deleteEntityAction,
    mergeEntities,
    updateCommunity,
    deleteCommunity,
} from '../store/chat-data.js';
import { escapeHtml, showToast } from '../utils/dom.js';
import { buildCharacterStateData, filterEntities, formatMemoryDate, formatMemoryImportance } from './helpers.js';
import { refreshStats } from './status.js';
import {
    renderCharacterState,
    renderCommunityAccordion,
    renderEntityCard,
    renderEntityEdit,
    renderEntityMergePicker,
    renderMemoryEdit,
} from './templates.js';

let _initialized = false;
let _entitySearchTimeout = null;

// =============================================================================
// Initialization
// =============================================================================

export async function initSidePanel() {
    if (_initialized) return;

    const html = await $.get(`${extensionFolderPath}/templates/side_panel.html`);
    $('body').append(html);

    bindSidePanelEvents();
    _initialized = true;
}

function bindSidePanelEvents() {
    const $panel = $('#openvault_side_panel');

    // Tab switching
    $panel.on('click', '.openvault-side-tab', function () {
        const tabId = $(this).data('side-tab');
        $('.openvault-side-tab').removeClass('active');
        $(this).addClass('active');
        $('.openvault-side-tab-content').removeClass('active');
        $(`.openvault-side-tab-content[data-side-tab-content="${tabId}"]`).addClass('active');
    });

    // Close button
    $panel.on('click', '#openvault_side_panel_close', () => {
        closeSidePanel();
    });

    // Entity filters
    $panel.on('input', '#openvault_side_entity_search', () => {
        clearTimeout(_entitySearchTimeout);
        _entitySearchTimeout = setTimeout(renderSideEntities, 200);
    });
    $panel.on('change', '#openvault_side_entity_type', renderSideEntities);

    // Memory actions (scoped to sidebar so they don't conflict with main panel)
    $panel.on('click', '.openvault-delete-memory', async (e) => {
        const id = $(e.currentTarget).data('id');
        if (!confirm('Delete this memory?')) return;
        const result = await deleteMemoryAction(id);
        if (result.success) {
            if (result.stChanges) {
                const { applySyncChanges } = await import('../extraction/extract.js');
                await applySyncChanges(result.stChanges);
            }
            renderSideMemories();
            showToast('success', 'Memory deleted');
        }
    });

    $panel.on('click', '.openvault-edit-memory', (e) => {
        const id = $(e.currentTarget).data('id');
        const memory = getSideMemoryById(id);
        if (!memory) return;
        const $card = $panel.find(`.openvault-memory-card[data-id="${id}"]`);
        $card.replaceWith(renderMemoryEdit(memory));
    });

    $panel.on('click', '.openvault-cancel-edit', (e) => {
        const id = $(e.currentTarget).data('id');
        const memory = getSideMemoryById(id);
        if (!memory) return;
        const $card = $panel.find(`.openvault-memory-card[data-id="${id}"]`);
        $card.replaceWith(renderSideMemoryItem(memory));
    });

    $panel.on('click', '.openvault-save-edit', async (e) => {
        const id = $(e.currentTarget).data('id');
        const $card = $panel.find(`.openvault-memory-card[data-id="${id}"]`);
        const $btn = $(e.currentTarget);

        const summary = $card.find('[data-field="summary"]').val().trim();
        const importance = parseInt($card.find('[data-field="importance"]').val(), 10);
        const temporal_anchor = $card.find('[data-field="temporal_anchor"]').val().trim() || null;
        const is_transient = $card.find('[data-field="is_transient"]').is(':checked');

        if (!summary) {
            showToast('warning', 'Summary cannot be empty');
            return;
        }

        $btn.prop('disabled', true);
        const result = await updateMemoryAction(id, { summary, importance, temporal_anchor, is_transient });
        if (result.success) {
            if (result.stChanges) {
                const { applySyncChanges } = await import('../extraction/extract.js');
                await applySyncChanges(result.stChanges);
            }
            const updated = getSideMemoryById(id);
            if (updated) {
                $card.replaceWith(renderSideMemoryItem(updated));
            }
            showToast('success', 'Memory updated');
        }
        $btn.prop('disabled', false);
    });

    // =========================================================================
    // Entity actions (scoped to sidebar)
    // =========================================================================

    $panel.on('click', '.openvault-edit-entity', (e) => {
        const key = $(e.currentTarget).data('key');
        const graph = getOpenVaultData()?.graph;
        const entity = graph?.nodes?.[key];
        if (!entity) return;
        const $card = $panel.find(`.openvault-entity-card[data-key="${key}"]`);
        $card.replaceWith(renderEntityEdit(entity, key));
    });

    $panel.on('click', '.openvault-cancel-entity-edit', (e) => {
        const key = $(e.currentTarget).data('key');
        const entity = getOpenVaultData()?.graph?.nodes?.[key];
        if (!entity) return;
        const $edit = $panel.find(`.openvault-entity-edit[data-key="${key}"]`);
        $edit.replaceWith(renderEntityCard(entity, key));
    });

    $panel.on('click', '.openvault-save-entity-edit', async (e) => {
        const key = $(e.currentTarget).data('key');
        const $edit = $panel.find(`.openvault-entity-edit[data-key="${key}"]`);
        const name = $edit.find('.openvault-edit-name').val()?.toString().trim();
        const type = $edit.find('.openvault-edit-type').val()?.toString();
        const description = $edit.find('.openvault-edit-description').val()?.toString().trim();

        if (!name) { showToast('warning', 'Entity name cannot be empty'); return; }

        const aliases = $edit.find('.openvault-alias-chip')
            .map((_, chip) => $(chip).text().replace('×', '').trim()).get();
        const pending = $edit.find('.openvault-alias-input').val()?.toString()?.trim();
        if (pending && !aliases.map(a => a.toLowerCase()).includes(pending.toLowerCase())) {
            aliases.push(pending);
        }

        const $btn = $(e.currentTarget);
        $btn.prop('disabled', true).text('Saving...');
        try {
            const result = await updateEntity(key, { name, type, description, aliases });
            if (result === null) {
                showToast('warning', 'An entity with that name already exists');
                $btn.prop('disabled', false).text('Save');
                return;
            }
            if (result.stChanges) {
                const { applySyncChanges } = await import('../extraction/extract.js');
                await applySyncChanges(result.stChanges);
            }
            const entity = getOpenVaultData().graph.nodes[result.key];
            $edit.replaceWith(renderEntityCard(entity, result.key));
            showToast('success', 'Entity updated');
            refreshStats();
        } catch (err) {
            console.error('[OpenVault] Failed to save entity:', err);
            $btn.prop('disabled', false).text('Save');
        }
    });

    $panel.on('click', '.openvault-delete-entity', async (e) => {
        const key = $(e.currentTarget).data('key');
        const graph = getOpenVaultData()?.graph;
        const entity = graph?.nodes?.[key];
        if (!entity) return;
        const edgeCount = Object.values(graph.edges || {}).filter(ed => ed.source === key || ed.target === key).length;
        const msg = edgeCount > 0
            ? `Delete "${entity.name}"? This will also remove ${edgeCount} connected relationship(s).`
            : `Delete "${entity.name}"?`;
        if (!confirm(msg)) return;
        const result = await deleteEntityAction(key);
        if (result.success) {
            if (result.stChanges) {
                const { applySyncChanges } = await import('../extraction/extract.js');
                await applySyncChanges(result.stChanges);
            }
            $panel.find(`.openvault-entity-card[data-key="${key}"]`).remove();
            showToast('success', 'Entity deleted');
            refreshStats();
        }
    });

    $panel.on('click', '.openvault-remove-alias', function () {
        $(this).closest('.openvault-alias-chip').remove();
    });

    $panel.on('click', '.openvault-add-alias', (e) => {
        const key = $(e.currentTarget).data('key');
        const $edit = $panel.find(`.openvault-entity-edit[data-key="${key}"]`);
        const $input = $edit.find('.openvault-alias-input');
        const alias = $input.val()?.toString().trim();
        if (!alias) return;
        const existing = $edit.find('.openvault-alias-chip')
            .map((_, chip) => $(chip).text().replace('×', '').trim().toLowerCase()).get();
        if (existing.includes(alias.toLowerCase())) { $input.val(''); return; }
        $edit.find('.openvault-alias-list').append(`
            <span class="openvault-alias-chip">
                ${escapeHtml(alias)}
                <span class="remove openvault-remove-alias" data-key="${escapeHtml(key)}" data-alias="${escapeHtml(alias)}">×</span>
            </span>
        `);
        $input.val('');
    });

    $panel.on('click', '.openvault-merge-entity', (e) => {
        const key = $(e.currentTarget).data('key');
        const graph = getOpenVaultData()?.graph;
        const node = graph?.nodes?.[key];
        if (!node) return;
        const $card = $panel.find(`.openvault-entity-card[data-key="${key}"]`);
        $card.replaceWith(renderEntityMergePicker(key, node, graph.nodes));
        $panel.find('.openvault-merge-search').focus();
    });

    $panel.on('click', '.openvault-cancel-entity-merge', () => {
        renderSideEntities();
    });

    $panel.on('click', '.openvault-confirm-entity-merge', async (e) => {
        const sourceKey = $(e.currentTarget).data('source-key');
        const graph = getOpenVaultData()?.graph;
        if (!graph) return;
        const inputText = $panel.find('.openvault-merge-search').val();
        const targetKey = findMergeTarget(inputText, graph.nodes);
        if (!targetKey) { showToast('error', 'Please select a valid target entity'); return; }
        if (targetKey === sourceKey) { showToast('error', 'Cannot merge an entity into itself'); return; }
        try {
            const result = await mergeEntities(sourceKey, targetKey);
            if (!result.success) { showToast('error', 'Failed to merge entities'); return; }
            if (result.stChanges) {
                const { applySyncChanges } = await import('../extraction/extract.js');
                await applySyncChanges(result.stChanges);
            }
            renderSideEntities();
            showToast('success', `Merged into ${graph.nodes[targetKey]?.name || targetKey}`);
        } catch (err) {
            if (err.name !== 'AbortError') showToast('error', `Merge failed: ${err.message}`);
        }
    });

    // =========================================================================
    // Community actions (sidebar-only editing)
    // =========================================================================

    $panel.on('click', '.openvault-edit-community', (e) => {
        const id = $(e.currentTarget).data('id');
        const data = getOpenVaultData();
        const community = data?.communities?.[id];
        if (!community) return;
        const $item = $(e.currentTarget).closest('.openvault-community-item');
        $item.replaceWith(renderSideCommunityEdit(id, community));
    });

    $panel.on('click', '.openvault-cancel-community-edit', (e) => {
        const id = $(e.currentTarget).data('id');
        const community = getOpenVaultData()?.communities?.[id];
        if (!community) return;
        const $edit = $panel.find(`.openvault-community-editing[data-id="${id}"]`);
        $edit.replaceWith(renderSideCommunityAccordion(id, community));
    });

    $panel.on('click', '.openvault-save-community', async (e) => {
        const id = $(e.currentTarget).data('id');
        const $edit = $panel.find(`.openvault-community-editing[data-id="${id}"]`);
        const title = $edit.find('.openvault-community-edit-title').val().trim();
        const summary = $edit.find('.openvault-community-edit-summary').val().trim();
        if (!title) { showToast('warning', 'Title cannot be empty'); return; }
        const result = await updateCommunity(id, { title, summary });
        if (result) {
            const community = getOpenVaultData()?.communities?.[id];
            $edit.replaceWith(renderSideCommunityAccordion(id, community));
            showToast('success', 'Community updated');
        }
    });

    $panel.on('click', '.openvault-delete-community', async (e) => {
        const id = $(e.currentTarget).data('id');
        const community = getOpenVaultData()?.communities?.[id];
        if (!community) return;
        if (!confirm(`Delete community "${community.title || id}"?`)) return;
        const result = await deleteCommunity(id);
        if (result) {
            $panel.find(`.openvault-community-item[data-id="${id}"]`).remove();
            showToast('success', 'Community deleted');
        }
    });
}

function getSideMemoryById(id) {
    const data = getOpenVaultData();
    return data?.[MEMORIES_KEY]?.find((m) => m.id === id) || null;
}

function findMergeTarget(inputText, nodes) {
    if (!inputText) return null;
    const clean = inputText.toLowerCase().trim().replace(/\s*\[[^\]]+\]$/, '').trim();
    for (const [key, node] of Object.entries(nodes)) {
        if ((node.name || '').toLowerCase() === clean) return key;
        if ((node.aliases || []).some(a => a.toLowerCase() === clean)) return key;
    }
    return null;
}

// =============================================================================
// Open / Close / Toggle
// =============================================================================

export function openSidePanel() {
    const $panel = $('#openvault_side_panel');
    const topBar = document.getElementById('top-settings-holder') || document.getElementById('top-bar');
    if (topBar) {
        $panel.css('top', topBar.offsetHeight + 'px');
    }
    $panel.addClass('open');
    $('#openvault_side_panel_toggle').addClass('active');
    refreshSidePanel();
}

export function closeSidePanel() {
    $('#openvault_side_panel').removeClass('open');
    $('#openvault_side_panel_toggle').removeClass('active');
}

export function toggleSidePanel() {
    if ($('#openvault_side_panel').hasClass('open')) {
        closeSidePanel();
    } else {
        openSidePanel();
    }
}

export function isSidePanelOpen() {
    return $('#openvault_side_panel').hasClass('open');
}

// =============================================================================
// Sidebar-specific memory card (buttons beside date, compact layout)
// =============================================================================

function buildSideCharacterTags(characters) {
    if (!characters || characters.length === 0) return '';
    const tags = characters.map((c) => `<span class="openvault-character-tag">${escapeHtml(c)}</span>`).join('');
    return `<div class="openvault-memory-characters" style="margin-top: 4px;">${tags}</div>`;
}

function renderSideMemoryItem(memory) {
    const id = escapeHtml(memory.id);
    const date = formatMemoryDate(memory.created_at);
    const stars = formatMemoryImportance(memory.importance || 3);
    const anchorHtml = memory.temporal_anchor
        ? `<span class="openvault-side-mem-date" style="color: var(--SmartThemeQuoteColor);"><i class="fa-solid fa-clock"></i> ${escapeHtml(memory.temporal_anchor)}</span>`
        : '';
    const charTags = buildSideCharacterTags(memory.characters_involved);

    return `
        <div class="openvault-memory-card openvault-side-mem" data-id="${id}">
            <div class="openvault-side-mem-header">
                <div class="openvault-side-mem-meta">
                    ${anchorHtml}
                    <span class="openvault-side-mem-date">${escapeHtml(date)}</span>
                    <span class="openvault-memory-card-badge importance">${stars}</span>
                </div>
                <div class="openvault-side-mem-actions">
                    <button class="openvault-entity-action-btn openvault-edit-memory" data-id="${id}" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="openvault-entity-action-btn openvault-delete-memory" data-id="${id}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="openvault-memory-card-summary">${escapeHtml(memory.summary || 'No summary')}</div>
            ${charTags}
        </div>
    `;
}

// =============================================================================
// Sidebar-specific community templates (edit/delete buttons + edit form)
// =============================================================================

function renderSideCommunityAccordion(id, community) {
    const memberCount = community.nodeKeys?.length || 0;
    const findings = (community.findings || []).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
    const members = (community.nodeKeys || []).map((k) => escapeHtml(k)).join(', ');

    return `
        <details class="openvault-community-item" data-id="${escapeHtml(id)}">
            <summary>
                <span class="openvault-community-title">${escapeHtml(community.title || id)}</span>
                <span class="openvault-community-badge">${memberCount} entities</span>
                <div class="openvault-community-actions">
                    <button class="openvault-entity-action-btn openvault-edit-community" data-id="${escapeHtml(id)}" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="openvault-entity-action-btn openvault-delete-community" data-id="${escapeHtml(id)}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </summary>
            <div class="openvault-community-content">
                <p>${escapeHtml(community.summary || 'No summary')}</p>
                ${findings ? `<ul class="openvault-community-findings">${findings}</ul>` : ''}
                <small class="openvault-community-members">Members: ${members}</small>
            </div>
        </details>
    `;
}

function renderSideCommunityEdit(id, community) {
    return `
        <div class="openvault-community-editing" data-id="${escapeHtml(id)}">
            <div class="openvault-entity-edit-row">
                <label>Title</label>
                <input type="text" class="openvault-community-edit-title" value="${escapeHtml(community.title || '')}">
            </div>
            <div class="openvault-entity-edit-row">
                <label>Summary</label>
                <textarea class="openvault-community-edit-summary" rows="4">${escapeHtml(community.summary || '')}</textarea>
            </div>
            <div class="openvault-entity-edit-actions">
                <button class="cancel openvault-cancel-community-edit" data-id="${escapeHtml(id)}">Cancel</button>
                <button class="save openvault-save-community" data-id="${escapeHtml(id)}">Save</button>
            </div>
        </div>
    `;
}

// =============================================================================
// Rendering
// =============================================================================

export function refreshSidePanel() {
    if (!isSidePanelOpen()) return;

    renderSideMemories();
    renderSideCommunities();
    renderSideEntities();
    renderSideCharacters();
}

function renderSideMemories() {
    const $container = $('#openvault_side_memories');
    const data = getOpenVaultData();

    if (!data) {
        $container.html('<p class="openvault-side-placeholder">No chat loaded</p>');
        return;
    }

    const memories = data[MEMORIES_KEY] || [];

    if (memories.length === 0) {
        $container.html('<p class="openvault-side-placeholder">No memories yet</p>');
        return;
    }

    // Sort oldest first so latest is at the bottom (natural scroll)
    const sorted = [...memories].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const html = sorted.map(renderSideMemoryItem).join('');
    $container.html(html);

    // Auto-scroll to bottom (latest memories)
    $container.scrollTop($container[0].scrollHeight);
}

function renderSideCommunities() {
    const $container = $('#openvault_side_communities');
    const data = getOpenVaultData();

    if (!data) {
        $container.html('<p class="openvault-side-placeholder">No chat loaded</p>');
        return;
    }

    const communities = data?.communities || {};
    const ids = Object.keys(communities);

    if (ids.length === 0) {
        $container.html('<p class="openvault-side-placeholder">No communities detected yet</p>');
        return;
    }

    const html = ids.map((id) => renderSideCommunityAccordion(id, communities[id])).join('');
    $container.html(html);
}

function renderSideEntities() {
    const $container = $('#openvault_side_entities');
    const data = getOpenVaultData();

    if (!data) {
        $container.html('<p class="openvault-side-placeholder">No chat loaded</p>');
        return;
    }

    const graph = data?.graph || {};
    const typeFilter = $('#openvault_side_entity_type').val() || '';
    const searchQuery = ($('#openvault_side_entity_search').val() || '').toLowerCase().trim();

    const filtered = filterEntities(graph, searchQuery, typeFilter);

    if (filtered.length === 0) {
        const msg = searchQuery || typeFilter ? 'No entities match your filters' : 'No entities extracted yet';
        $container.html(`<p class="openvault-side-placeholder">${escapeHtml(msg)}</p>`);
        return;
    }

    const html = filtered.map(([key, entity]) => renderEntityCard(entity, key)).join('');
    $container.html(html);
}

function renderSideCharacters() {
    const $container = $('#openvault_side_characters');
    const data = getOpenVaultData();

    if (!data) {
        $container.html('<p class="openvault-side-placeholder">No chat loaded</p>');
        return;
    }

    const characters = data[CHARACTERS_KEY] || {};
    const charNames = Object.keys(characters);

    if (charNames.length === 0) {
        $container.html('<p class="openvault-side-placeholder">No character data yet</p>');
        return;
    }

    const html = charNames
        .sort()
        .map((name) => renderCharacterState(buildCharacterStateData(name, characters[name])))
        .join('');

    $container.html(html);
}
