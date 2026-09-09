import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMBEDDING_SOURCES } from '../../src/constants.js';
import { resetDeps } from '../../src/deps.js';
import { operationState } from '../../src/state.js';

const mocks = vi.hoisted(() => ({
    compactIfNeeded: vi.fn(),
    extractMemories: vi.fn(),
    purgeSTCollection: vi.fn(),
    runPhase2Enrichment: vi.fn(),
}));

vi.mock('../../src/archive/archive.js', () => ({ compactIfNeeded: mocks.compactIfNeeded }));
vi.mock('../../src/extraction/extract.js', () => ({
    extractMemories: mocks.extractMemories,
    runPhase2Enrichment: mocks.runPhase2Enrichment,
}));
vi.mock('../../src/services/st-vector.js', () => ({ purgeSTCollection: mocks.purgeSTCollection }));

import { startFullRebuild } from '../../src/rebuild/rebuild.js';

function legacyData() {
    return {
        schema_version: 4,
        lifecycle: { status: 'needs_rebuild' },
        memories: [{ id: 'legacy-memory', summary: 'Old data' }],
        characters: { legacy: { name: 'Legacy' } },
        processed_message_ids: ['legacy-fingerprint'],
        graph: { nodes: { legacy: { id: 'legacy' } }, edges: {} },
        communities: { legacy: { id: 'legacy' } },
        diagnostics: { archive: {}, volatile: {}, compaction: {}, rebuild: {} },
    };
}

describe('mandatory full rebuild', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        operationState.extractionInProgress = false;
        mocks.purgeSTCollection.mockResolvedValue(true);
        mocks.extractMemories.mockResolvedValue({ status: 'success' });
        mocks.runPhase2Enrichment.mockResolvedValue(undefined);
        mocks.compactIfNeeded.mockResolvedValue(undefined);
    });

    afterEach(() => {
        operationState.extractionInProgress = false;
        resetDeps();
    });

    it('refuses to mutate source history when legacy ST vector purge fails', async () => {
        const data = legacyData();
        const chat = [
            { mes: 'Archived by OpenVault', is_user: true, is_system: true, openvault_hidden: true },
            { mes: 'Real system message', is_user: false, is_system: true },
        ];
        mocks.purgeSTCollection.mockResolvedValue(false);
        setupTestContext({
            context: { chatId: 'legacy-chat', chat, chatMetadata: { openvault: data } },
            settings: { embeddingSource: EMBEDDING_SOURCES.ST_VECTOR },
            deps: { saveChatConditional: vi.fn().mockResolvedValue(undefined) },
        });

        await expect(startFullRebuild()).rejects.toThrow('rebuild did not start');
        expect(chat[0]).toMatchObject({ is_system: true, openvault_hidden: true });
        expect(chat[1]).toMatchObject({ is_system: true });
        expect(data.lifecycle.status).toBe('needs_rebuild');
        expect(mocks.extractMemories).not.toHaveBeenCalled();
    });

    it('restores only OpenVault-hidden messages and activates after synthesis', async () => {
        const data = legacyData();
        const chat = [
            { mes: 'Recovered source', name: 'User', is_user: true, is_system: true, openvault_hidden: true },
            { mes: 'Genuine system instruction', name: 'System', is_user: false, is_system: true },
        ];
        const save = vi.fn().mockResolvedValue(undefined);
        setupTestContext({
            context: { chatId: 'legacy-chat', chat, chatMetadata: { openvault: data } },
            settings: { embeddingSource: EMBEDDING_SOURCES.OLLAMA },
            deps: { saveChatConditional: save },
        });

        await expect(startFullRebuild()).resolves.toEqual({ success: true, boundary: 2 });
        expect(chat[0].is_system).toBe(false);
        expect(chat[0].openvault_hidden).toBeUndefined();
        expect(chat[1].is_system).toBe(true);
        expect(data.recovery_backup.memories[0].id).toBe('legacy-memory');
        expect(data.lifecycle.status).toBe('ready');
        expect(mocks.runPhase2Enrichment).toHaveBeenCalledOnce();
        expect(mocks.compactIfNeeded).toHaveBeenCalledOnce();
        expect(mocks.purgeSTCollection).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalled();
    });
});
