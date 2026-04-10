/**
 * OpenVault Side Panel
 *
 * Persistent panel on the left side of the chat showing memories,
 * communities, and entities with infinite scroll.
 */

import { CHARACTERS_KEY, MEMORIES_KEY, extensionFolderPath } from '../constants.js';
import { deleteMemory as deleteMemoryAction, getOpenVaultData, updateMemory as updateMemoryAction } from '../store/chat-data.js';
import { escapeHtml, showToast } from '../utils/dom.js';
import { buildCharacterStateData, filterEntities, formatMemoryDate, formatMemoryImportance } from './helpers.js';
import {
    renderCharacterState,
    renderCommunityAccordion,
    renderEntityCard,
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
}

function getSideMemoryById(id) {
    const data = getOpenVaultData();
    return data?.[MEMORIES_KEY]?.find((m) => m.id === id) || null;
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

function renderSideMemoryItem(memory) {
    const id = escapeHtml(memory.id);
    const date = formatMemoryDate(memory.created_at);
    const stars = formatMemoryImportance(memory.importance || 3);
    const anchorHtml = memory.temporal_anchor
        ? `<span class="openvault-side-mem-date" style="color: var(--SmartThemeQuoteColor);"><i class="fa-solid fa-clock"></i> ${escapeHtml(memory.temporal_anchor)}</span>`
        : '';

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

    const html = ids.map((id) => renderCommunityAccordion(id, communities[id])).join('');
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
