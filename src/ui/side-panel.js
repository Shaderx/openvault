/**
 * OpenVault Side Panel
 *
 * Persistent panel on the left side of the chat showing memories,
 * communities, and entities with infinite scroll.
 */

import { CHARACTERS_KEY, MEMORIES_KEY, extensionFolderPath } from '../constants.js';
import { getOpenVaultData } from '../store/chat-data.js';
import { escapeHtml } from '../utils/dom.js';
import { buildCharacterStateData, filterEntities } from './helpers.js';
import {
    renderCharacterState,
    renderCommunityAccordion,
    renderEntityCard,
    renderMemoryItem,
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
    // Tab switching
    $(document).on('click', '.openvault-side-tab', function () {
        const tabId = $(this).data('side-tab');
        $('.openvault-side-tab').removeClass('active');
        $(this).addClass('active');
        $('.openvault-side-tab-content').removeClass('active');
        $(`.openvault-side-tab-content[data-side-tab-content="${tabId}"]`).addClass('active');
    });

    // Close button
    $(document).on('click', '#openvault_side_panel_close', () => {
        closeSidePanel();
    });

    // Entity filters
    $(document).on('input', '#openvault_side_entity_search', () => {
        clearTimeout(_entitySearchTimeout);
        _entitySearchTimeout = setTimeout(renderSideEntities, 200);
    });
    $(document).on('change', '#openvault_side_entity_type', renderSideEntities);
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
    const html = sorted.map(renderMemoryItem).join('');
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
