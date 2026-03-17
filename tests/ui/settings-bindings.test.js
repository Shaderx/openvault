// tests/ui/settings-bindings.test.js
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defaultSettings, extensionName } from '../../src/constants.js';

describe('Settings Bindings', () => {
    let mockExtensionSettings;
    let mockDeps;

    // Track which bindings were registered
    const boundElements = new Map();

    // Mock jQuery $ function that tracks event bindings
    const mockJQuery = (selector) => {
        const callbacks = [];

        const $obj = {
            on: vi.fn((event, handler) => {
                if (!boundElements.has(selector)) {
                    boundElements.set(selector, []);
                }
                boundElements.get(selector).push({ event, handler });
                return $obj;
            }),
            off: vi.fn(() => $obj),
            val: vi.fn(() => ''),
            prop: vi.fn(() => $obj),
            text: vi.fn(() => $obj),
            html: vi.fn(() => $obj),
            addClass: vi.fn(() => $obj),
            removeClass: vi.fn(() => $obj),
            toggleClass: vi.fn(() => $obj),
            hasClass: vi.fn(() => false),
            css: vi.fn(() => $obj),
            attr: vi.fn(() => $obj),
            data: vi.fn(() => ({})),
            find: vi.fn(() => ({
                remove: vi.fn(() => ({})),
                val: vi.fn(() => ''),
                text: vi.fn(() => ({})),
                html: vi.fn(() => ({})),
                addClass: vi.fn(() => ({})),
                removeClass: vi.fn(() => ({})),
                each: vi.fn(() => ({})),
                on: vi.fn(() => ({})),
                off: vi.fn(() => ({})),
                find: vi.fn(() => ({})),
            })),
            parent: vi.fn(() => $obj),
            closest: vi.fn(() => $obj),
            each: vi.fn((fn) => $obj),
            append: vi.fn(() => $obj),
            empty: vi.fn(() => $obj),
            show: vi.fn(() => $obj),
            hide: vi.fn(() => $obj),
            toggle: vi.fn(() => $obj),
            remove: vi.fn(() => $obj),
            get: vi.fn((url, callback) => { callback(''); return $obj; }),
        };

        return $obj;
    };

    // make sure $.get works for HTML template loading
    mockJQuery.get = vi.fn((url, callback) => {
        if (callback) callback('<div id="extensions_settings2"></div>');
        return Promise.resolve('<div id="extensions_settings2"></div>');
    });

    beforeEach(async () => {
        // Clear module cache and bindings tracker
        vi.resetModules();
        boundElements.clear();
        await global.registerCdnOverrides();

        // Setup DOM with relocated elements
        document.body.innerHTML = `
            <div id="extensions_settings2"></div>
            <div id="openvault_memory_list"></div>
            <input type="range" id="openvault_max_concurrency" />
            <span id="openvault_max_concurrency_value"></span>
            <input type="number" id="openvault_backfill_rpm" />
            <input type="range" id="openvault_final_budget" />
            <span id="openvault_final_budget_value"></span>
            <span id="openvault_final_budget_words"></span>
            <input type="range" id="openvault_visible_chat_budget" />
            <span id="openvault_visible_chat_budget_value"></span>
            <input type="range" id="openvault_extraction_token_budget" />
            <span id="openvault_extraction_token_budget_value"></span>
            <div id="openvault_payload_calculator">
                <span id="openvault_payload_total"></span>
                <span id="openvault_payload_breakdown"></span>
                <span id="openvault_payload_emoji"></span>
            </div>
            <input type="range" id="openvault_extraction_rearview" />
            <span id="openvault_extraction_rearview_value"></span>
            <span id="openvault_extraction_rearview_words"></span>
            <input type="checkbox" id="openvault_enabled" />
            <input type="checkbox" id="openvault_debug" />
            <input type="checkbox" id="openvault_request_logging" />
            <input type="checkbox" id="openvault_auto_hide" />
            <input type="range" id="openvault_alpha" />
            <span id="openvault_alpha_value"></span>
            <input type="range" id="openvault_combined_weight" />
            <span id="openvault_combined_weight_value"></span>
            <input type="range" id="openvault_vector_threshold" />
            <span id="openvault_vector_threshold_value"></span>
            <input type="range" id="openvault_dedup_threshold" />
            <span id="openvault_dedup_threshold_value"></span>
            <input type="range" id="openvault_entity_merge_threshold" />
            <span id="openvault_entity_merge_threshold_value"></span>
            <input type="number" id="openvault_edge_description_cap" />
            <span id="openvault_edge_description_cap_value"></span>
            <input type="number" id="openvault_entity_window" />
            <span id="openvault_entity_window_value"></span>
            <input type="number" id="openvault_embedding_window" />
            <span id="openvault_embedding_window_value"></span>
            <input type="number" id="openvault_top_entities" />
            <span id="openvault_top_entities_value"></span>
            <input type="range" id="openvault_entity_boost" />
            <span id="openvault_entity_boost_value"></span>
            <select id="openvault_ollama_url"></select>
            <select id="openvault_embedding_model"></select>
            <input type="text" id="openvault_embedding_query_prefix" />
            <input type="text" id="openvault_embedding_doc_prefix" />
            <select id="openvault_embedding_source"></select>
            <div id="openvault_ollama_settings"></div>
            <select id="openvault_extraction_profile"></select>
            <select id="openvault_backup_profile"></select>
            <select id="openvault_preamble_language"></select>
            <select id="openvault_output_language"></select>
            <div id="openvault_prefill_selector"></div>
            <input type="number" id="openvault_reflection_threshold" />
            <span id="openvault_reflection_threshold_value"></span>
            <input type="number" id="openvault_max_insights" />
            <span id="openvault_max_insights_value"></span>
            <input type="range" id="openvault_reflection_dedup_threshold" />
            <span id="openvault_reflection_dedup_threshold_value"></span>
            <span id="openvault_reflection_reject_display"></span>
            <span id="openvault_reflection_replace_low"></span>
            <span id="openvault_reflection_replace_high"></span>
            <span id="openvault_reflection_add_display"></span>
            <input type="range" id="openvault_world_context_budget" />
            <span id="openvault_world_context_budget_value"></span>
            <span id="openvault_world_context_budget_words"></span>
            <input type="number" id="openvault_community_interval" />
            <span id="openvault_community_interval_value"></span>
            <input type="range" id="openvault_forgetfulness_lambda" />
            <span id="openvault_forgetfulness_lambda_value"></span>
            <input type="range" id="openvault_importance5_floor" />
            <span id="openvault_importance5_floor_value"></span>
            <input type="number" id="openvault_reflection_decay_threshold" />
            <span id="openvault_reflection_decay_threshold_value"></span>
            <input type="number" id="openvault_entity_description_cap" />
            <span id="openvault_entity_description_cap_value"></span>
            <input type="number" id="openvault_max_reflections" />
            <span id="openvault_max_reflections_value"></span>
            <input type="number" id="openvault_community_staleness" />
            <span id="openvault_community_staleness_value"></span>
            <input type="range" id="openvault_dedup_jaccard" />
            <span id="openvault_dedup_jaccard_value"></span>
            <button id="openvault_backfill_embeddings_btn"></button>
            <button id="openvault_extract_all_btn"></button>
            <button id="openvault_reset_settings_btn"></button>
            <button id="openvault_delete_chat_btn"></button>
            <button id="openvault_export_debug_btn"></button>
            <button id="openvault_prev_page"></button>
            <button id="openvault_next_page"></button>
            <select id="openvault_filter_type"></select>
            <select id="openvault_filter_character"></select>
            <button id="openvault_test_ollama_btn"></button>
            <button id="openvault_copy_perf_btn"></button>
            <span class="openvault-default-hint" data-default-key="test"></span>
            <tbody id="openvault_perf_tbody"></tbody>
            <div id="openvault_extraction_budget_text"></div>
            <div id="openvault_visible_budget_text"></div>
            <div id="openvault_extraction_budget_fill"></div>
            <div id="openvault_visible_budget_fill"></div>
            <div id="openvault_version"></div>
            <div class="openvault-tab-btn" data-tab="dashboard"></div>
            <div class="openvault-tab-btn" data-tab="memories"></div>
            <div class="openvault-tab-btn" data-tab="world"></div>
            <div class="openvault-tab-btn" data-tab="advanced"></div>
            <div class="openvault-tab-btn" data-tab="performance"></div>
            <div class="openvault-tab-content" data-tab="dashboard"></div>
            <div class="openvault-tab-content" data-tab="memories"></div>
            <div class="openvault-tab-content" data-tab="world"></div>
            <div class="openvault-tab-content" data-tab="advanced"></div>
            <div class="openvault-tab-content" data-tab="performance"></div>
        `;

        // Initialize mock settings
        mockExtensionSettings = {
            openvault: {
                ...defaultSettings,
                // Add missing properties used in settings.js but not in defaultSettings
                reflectionDedupThreshold: 0.90,
                combinedBoostWeight: 1.5,
                entityMergeSimilarityThreshold: 0.85,
                edgeDescriptionCap: 3,
                forgetfulnessImportance5Floor: 0.3,
                reflectionDecayThreshold: 750,
                entityDescriptionCap: 5,
                communityStalenessThreshold: 200,
            },
        };

        mockDeps = {
            getExtensionSettings: () => mockExtensionSettings,
            saveSettingsDebounced: vi.fn(),
            getContext: () => ({
                chat: [],
                name1: 'User',
                name2: 'Alice',
                chatId: 'test-chat-123',
                chatMetadata: { openvault: {} },
            }),
            Date: { now: () => 1000000 },
        };

        const { setDeps } = await import('../../src/deps.js');
        setDeps(mockDeps);

        // Set global $ before importing settings.js
        global.$ = mockJQuery;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    function hasBinding(selector, eventType) {
        const bindings = boundElements.get(selector);
        return bindings && bindings.some((b) => b.event === eventType);
    }

    it('binds relocated max_concurrency from Memories to Dashboard', async () => {
        // Mock the template loading - $.get returns a promise
        global.$.get = vi.fn(() => Promise.resolve('<div></div>'));

        // Mock JSON loading
        global.$.getJSON = vi.fn(() => Promise.resolve({ version: '1.0.0' }));

        const { loadSettings } = await import('../../src/ui/settings.js');
        await loadSettings();

        // max_concurrency should have an input binding
        expect(hasBinding('#openvault_max_concurrency', 'input')).toBe(true);
    });

    it('binds relocated backfill_rpm from Memories to Dashboard', async () => {
        global.$.get = vi.fn(() => Promise.resolve('<div></div>'));
        global.$.getJSON = vi.fn(() => Promise.resolve({ version: '1.0.0' }));

        const { loadSettings } = await import('../../src/ui/settings.js');
        await loadSettings();

        expect(hasBinding('#openvault_backfill_rpm', 'change')).toBe(true);
    });

    it('binds relocated final_budget from World to Memories', async () => {
        global.$.get = vi.fn(() => Promise.resolve('<div></div>'));
        global.$.getJSON = vi.fn(() => Promise.resolve({ version: '1.0.0' }));

        const { loadSettings } = await import('../../src/ui/settings.js');
        await loadSettings();

        expect(hasBinding('#openvault_final_budget', 'input')).toBe(true);
    });

    it('binds relocated visible_chat_budget from World to Memories', async () => {
        global.$.get = vi.fn(() => Promise.resolve('<div></div>'));
        global.$.getJSON = vi.fn(() => Promise.resolve({ version: '1.0.0' }));

        const { loadSettings } = await import('../../src/ui/settings.js');
        await loadSettings();

        expect(hasBinding('#openvault_visible_chat_budget', 'input')).toBe(true);
    });
});
