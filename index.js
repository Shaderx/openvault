/**
 * OpenVault - Agentic Memory Extension for SillyTavern
 *
 * Provides POV-aware memory with witness tracking, relationship dynamics,
 * and emotional continuity for roleplay conversations.
 *
 * All data is stored in chatMetadata - no external services required.
 */

// Import from modular structure
console.log('[OpenVault:boot] Stage 0 — module evaluation start (static imports resolving)');
import { extensionName, MEMORIES_KEY } from './src/constants.js';
import { getDeps } from './src/deps.js';
import { updateEventListeners } from './src/events.js';
import { isSessionDisabled, setChatLoadingCooldown } from './src/state.js';
import { getOpenVaultData } from './src/store/chat-data.js';
import { refreshAllUI } from './src/ui/render.js';
import { loadSettings } from './src/ui/settings.js';
import { setStatus } from './src/ui/status.js';
import { showToast } from './src/utils/dom.js';
import { logDebug, logError, logInfo } from './src/utils/logging.js';
console.log('[OpenVault:boot] Stage 1 — static imports resolved, module body executing');

// Re-export extensionName for external use
export { extensionName };

/**
 * Register slash commands
 */
function registerCommands() {
    const context = getDeps().getContext();
    const parser = context.SlashCommandParser;
    const command = context.SlashCommand;

    // /openvault-extract - Extract memories from recent messages
    parser.addCommandObject(
        command.fromProps({
            name: 'openvault-extract',
            callback: async () => {
                if (isSessionDisabled()) {
                    showToast('warning', 'OpenVault is disabled for this chat due to a data migration failure.');
                    return '';
                }
                const { extractMemories } = await import('./src/extraction/extract.js');
                setStatus('extracting');
                try {
                    const result = await extractMemories();
                    if (result.status === 'success' && result.events_created > 0) {
                        showToast('success', `Extracted ${result.events_created} memory events`);
                        refreshAllUI();
                    } else if (result.status === 'no_events_retry') {
                        showToast(
                            'info',
                            `No events found (attempt ${result.attempt}/${result.max_attempts}), messages kept for retry`
                        );
                    } else if (result.status === 'skipped') {
                        showToast(
                            'info',
                            result.reason === 'disabled'
                                ? 'OpenVault is disabled'
                                : result.reason === 'no_new_messages'
                                  ? 'No new messages to extract'
                                  : 'Cannot extract'
                        );
                    }
                } catch (error) {
                    showToast('error', `Extraction failed: ${error.message}`);
                }
                setStatus('ready');
                return '';
            },
            helpString: 'Extract memories from recent messages',
        })
    );

    // /openvault-retrieve - Retrieve and inject context
    parser.addCommandObject(
        command.fromProps({
            name: 'openvault-retrieve',
            callback: async () => {
                if (isSessionDisabled()) {
                    showToast('warning', 'OpenVault is disabled for this chat due to a data migration failure.');
                    return '';
                }
                const { retrieveAndInjectContext } = await import('./src/retrieval/retrieve.js');
                setStatus('retrieving');
                try {
                    const result = await retrieveAndInjectContext();
                    if (result) {
                        showToast('success', `Retrieved ${result.memories.length} relevant memories`);
                    } else {
                        showToast('info', 'No memories to retrieve');
                    }
                } catch (error) {
                    showToast('error', `Retrieval failed: ${error.message}`);
                }
                setStatus('ready');
                return '';
            },
            helpString: 'Retrieve relevant context and inject into prompt',
        })
    );

    // /openvault-status - Show current status
    parser.addCommandObject(
        command.fromProps({
            name: 'openvault-status',
            callback: async () => {
                const settings = getDeps().getExtensionSettings()[extensionName];
                const data = getOpenVaultData();
                const memoriesCount = data?.[MEMORIES_KEY]?.length || 0;
                const status = `OpenVault: ${settings.enabled ? 'Enabled' : 'Disabled'}, Memories: ${memoriesCount}`;
                showToast('info', status);
                return status;
            },
            helpString: 'Show OpenVault status',
        })
    );

    logDebug('Slash commands registered');
}

/**
 * Core initialization — called by APP_READY or the safety-net fallback timer.
 * Guarded so it only runs once.
 */
let _initDone = false;
async function initExtension(source) {
    if (_initDone) return;
    _initDone = true;
    console.log(`[OpenVault:boot] Stage 4 — init starting (source: ${source})`);

    try {
        const response = await fetch('/version');
        const version = await response.json();
        const [_major, minor] = version.pkgVersion.split('.').map(Number);
        console.log(`[OpenVault:boot] Stage 5 — version check passed (1.${minor})`);

        if (minor < 13) {
            showToast('error', 'OpenVault requires SillyTavern 1.13.0 or later');
            return;
        }
    } catch (error) {
        console.error('[OpenVault:boot] FAILED at Stage 5 — version check:', error);
        logError('Failed to check SillyTavern version', error);
        showToast('error', 'OpenVault failed to verify SillyTavern version');
        return;
    }

    try {
        await loadSettings();
        console.log('[OpenVault:boot] Stage 6 — loadSettings() complete');
    } catch (error) {
        console.error('[OpenVault:boot] FAILED at Stage 6 — loadSettings():', error);
        return;
    }

    try {
        registerCommands();
        console.log('[OpenVault:boot] Stage 7 — registerCommands() complete');
    } catch (error) {
        console.error('[OpenVault:boot] FAILED at Stage 7 — registerCommands():', error);
    }

    try {
        const { initSidePanel, openSidePanel, toggleSidePanel } = await import('./src/ui/side-panel.js');
        await initSidePanel();
        $('#openvault_side_panel_toggle').off('click').on('click', (e) => {
            e.stopPropagation();
            toggleSidePanel();
        });
        openSidePanel();
        console.log('[OpenVault:boot] Stage 8 — side panel initialized');
    } catch (error) {
        console.error('[OpenVault:boot] FAILED at Stage 8 — side panel:', error);
    }

    try {
        const { loadFromChat } = await import('./src/perf/store.js');
        loadFromChat();
        console.log('[OpenVault:boot] Stage 9 — perf data loaded');
    } catch (error) {
        console.error('[OpenVault:boot] FAILED at Stage 9 — perf store:', error);
    }

    setChatLoadingCooldown(2000, logDebug);
    updateEventListeners();
    setStatus('ready');
    console.log('[OpenVault:boot] Stage 10 — INIT COMPLETE ✓');
    logInfo('Extension initialized successfully');
}

/**
 * Initialize the extension
 *
 * Registers for APP_READY (normal path) and starts a fallback timer.
 * If SillyTavern's init pipeline stalls before emitting APP_READY,
 * the fallback self-initializes after FALLBACK_TIMEOUT_MS.
 */
const FALLBACK_TIMEOUT_MS = 15_000;

jQuery(() => {
    console.log('[OpenVault:boot] Stage 2 — jQuery DOM-ready fired');
    const { eventSource, eventTypes } = getDeps();
    console.log('[OpenVault:boot] Stage 3 — getDeps() OK, registering APP_READY listener');

    // Normal path: APP_READY
    eventSource.on(eventTypes.APP_READY, () => initExtension('APP_READY'));

    // Safety net: if APP_READY never fires, self-initialize after timeout
    setTimeout(() => {
        if (!_initDone) {
            console.warn(`[OpenVault:boot] APP_READY not received after ${FALLBACK_TIMEOUT_MS / 1000}s — forcing init`);
            initExtension('fallback-timer');
        }
    }, FALLBACK_TIMEOUT_MS);
});
