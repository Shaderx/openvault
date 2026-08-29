// @ts-check

import { compactIfNeeded } from '../archive/archive.js';
import {
    CHARACTERS_KEY,
    CHAT_LIFECYCLE,
    EMBEDDING_SOURCES,
    MEMORIES_KEY,
    PROCESSED_MESSAGES_KEY,
} from '../constants.js';
import { getDeps } from '../deps.js';
import { extractMemories, runPhase2Enrichment } from '../extraction/extract.js';
import { getMessageRevision, getProcessedFingerprints } from '../extraction/scheduler.js';
import { createEmptyGraph } from '../graph/graph.js';
import { purgeSTCollection } from '../services/st-vector.js';
import { getSessionSignal, operationState } from '../state.js';
import { getCurrentChatId, getOpenVaultData, saveOpenVaultData } from '../store/chat-data.js';
import { logInfo } from '../utils/logging.js';
import { getSanitizedTokenCount } from '../utils/message-sanitizer.js';

function backupLegacyData(data) {
    const copy = structuredClone(data);
    delete copy.recovery_backup;
    return copy;
}

function resetDerivedData(data) {
    data[MEMORIES_KEY] = [];
    data[CHARACTERS_KEY] = {};
    data[PROCESSED_MESSAGES_KEY] = [];
    data.reflection_state = {};
    data.graph = createEmptyGraph();
    data.communities = {};
    data.graph_message_count = 0;
    delete data.global_world_state;
    delete data.embedding_model_id;
    data.archives = { revision: 0, segments: [], next_sequence: 1, rollups: [] };
}

function createBatches(chat, boundary, tokenBudget, maxTurns) {
    const ids = [];
    for (let index = 0; index < boundary; index++) {
        if (!chat[index]?.is_system) ids.push(index);
    }
    const batches = [];
    let batch = [];
    let tokens = 0;
    let turns = 0;
    for (const index of ids) {
        batch.push(index);
        tokens += getSanitizedTokenCount(chat, index);
        if (!chat[index].is_user) turns++;
        const next = chat[index + 1];
        const completeTurn = !next || next.is_user;
        if (completeTurn && (tokens >= tokenBudget || turns >= maxTurns)) {
            batches.push(batch);
            batch = [];
            tokens = 0;
            turns = 0;
        }
    }
    if (batch.length > 0) batches.push(batch);
    return batches;
}

function assertSameChat(expectedChatId, signal) {
    if (signal?.aborted || getCurrentChatId() !== expectedChatId) {
        throw new DOMException('Rebuild cancelled by chat switch', 'AbortError');
    }
}

/**
 * Start or resume the mandatory full-chat rebuild. Partial state is never made
 * retrievable; progress and the fixed source boundary remain persisted.
 */
export async function startFullRebuild(options = {}) {
    const deps = getDeps();
    const context = deps.getContext();
    const data = getOpenVaultData();
    const chat = context?.chat || [];
    const settings = deps.getExtensionSettings()?.openvault || {};
    const expectedChatId = getCurrentChatId();
    const signal = options.abortSignal || getSessionSignal();
    if (!data || !expectedChatId) throw new Error('No chat loaded');
    if (operationState.extractionInProgress) throw new Error('Another OpenVault extraction is running');

    const isResume = data.lifecycle?.status === CHAT_LIFECYCLE.REBUILD_FAILED && data.lifecycle.rebuild_id;
    if (!isResume) {
        data.recovery_backup = backupLegacyData(data);
        if (settings.embeddingSource === EMBEDDING_SOURCES.ST_VECTOR) {
            const purged = await purgeSTCollection(expectedChatId);
            if (!purged) {
                throw new Error('Could not purge legacy ST vectors; rebuild did not start');
            }
        }
        let restored = 0;
        for (const message of chat) {
            if (message.openvault_hidden) {
                message.is_system = false;
                delete message.openvault_hidden;
                delete message.openvault_archive_id;
                restored++;
            }
        }
        const sourceCount = chat.filter((message) => !message.is_system).length;
        const legacyProcessed = data[PROCESSED_MESSAGES_KEY]?.length || 0;
        const missingSourceWarning = legacyProcessed > sourceCount;
        resetDerivedData(data);
        data.lifecycle = {
            status: CHAT_LIFECYCLE.REBUILDING,
            rebuild_id: `rebuild-${deps.Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            boundary: chat.length,
            processed: 0,
            restored,
            missing_source_warning: missingSourceWarning,
        };
        data.diagnostics.rebuild = { status: 'rebuilding', boundary: chat.length, processed: 0 };

        if (!(await saveOpenVaultData(expectedChatId))) throw new Error('Could not persist rebuild preparation');
    } else {
        data.lifecycle.status = CHAT_LIFECYCLE.REBUILDING;
        delete data.lifecycle.error;
        await saveOpenVaultData(expectedChatId);
    }

    operationState.extractionInProgress = true;
    try {
        const boundary = data.lifecycle.boundary;
        const batches = createBatches(
            chat,
            boundary,
            settings.extractionTokenBudget || 6000,
            settings.extractionMaxTurns || 20
        );
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            assertSameChat(expectedChatId, signal);
            const processedFingerprints = getProcessedFingerprints(data);
            const unprocessed = batches[batchIndex].filter(
                (index) => !processedFingerprints.has(getMessageRevision(chat[index]))
            );
            if (unprocessed.length === 0) continue;
            let result;
            do {
                result = await extractMemories(unprocessed, expectedChatId, {
                    isBackfill: true,
                    silent: true,
                    abortSignal: signal,
                });
            } while (result?.status === 'no_events_retry');
            data.lifecycle.processed = Math.min(boundary, data.lifecycle.processed + unprocessed.length);
            data.diagnostics.rebuild = {
                status: 'rebuilding',
                boundary,
                processed: data.lifecycle.processed,
                batches_complete: batchIndex + 1,
                batches_total: batches.length,
            };
            options.onProgress?.(data.diagnostics.rebuild);
            await saveOpenVaultData(expectedChatId);
        }

        assertSameChat(expectedChatId, signal);
        await runPhase2Enrichment(data, settings, expectedChatId, { abortSignal: signal });
        assertSameChat(expectedChatId, signal);
        const processed = data.lifecycle.processed || boundary;
        data.lifecycle = { status: CHAT_LIFECYCLE.READY, rebuilt_at: deps.Date.now() };
        data.diagnostics.rebuild = { status: 'ready', boundary, processed };
        if (!(await saveOpenVaultData(expectedChatId))) throw new Error('Could not activate rebuilt OpenVault data');
        operationState.extractionInProgress = false;
        await compactIfNeeded(settings);
        logInfo(`OpenVault rebuild completed through message ${boundary}`);
        return { success: true, boundary };
    } catch (error) {
        // Source messages remain visible unless a fully durable archive segment
        // was sealed after activation. Partial derived data stays gated.
        data.lifecycle.status = CHAT_LIFECYCLE.REBUILD_FAILED;
        data.lifecycle.error = error.message;
        data.diagnostics.rebuild = {
            status: 'failed',
            boundary: data.lifecycle.boundary,
            processed: data.lifecycle.processed,
            error: error.message,
        };
        await saveOpenVaultData(expectedChatId);
        throw error;
    } finally {
        operationState.extractionInProgress = false;
    }
}

export function getRebuildNotice(data) {
    const status = data?.lifecycle?.status;
    if (status === CHAT_LIFECYCLE.READY) return '';
    if (status === CHAT_LIFECYCLE.REBUILDING) {
        return 'OpenVault is rebuilding this chat. Retrieval and compaction remain disabled until it finishes.';
    }
    if (status === CHAT_LIFECYCLE.REBUILD_FAILED) {
        return 'OpenVault rebuild did not finish. Source messages remain available; use Resume Full Rebuild.';
    }
    return 'This chat uses an older OpenVault memory format. Run Full Rebuild to recreate memory from the beginning. Retrieval and compaction are disabled until rebuilding completes.';
}
