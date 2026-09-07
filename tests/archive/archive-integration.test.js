import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildPreparedSegment,
    getArchiveText,
    persistArchiveDeactivations,
    recoverPreparedArchive,
    sealAndHide,
} from '../../src/archive/archive.js';
import { resetDeps } from '../../src/deps.js';
import { getMessageRevision } from '../../src/extraction/scheduler.js';
import { integrityDigest } from '../../src/utils/integrity-digest.js';

function setupArchiveContext(saveChatConditional, settings = {}) {
    const chat = [
        { mes: 'User establishes a durable fact.', name: 'User', is_user: true, is_system: false, send_date: '1' },
        { mes: 'The guide confirms that fact.', name: 'Guide', is_user: false, is_system: false, send_date: '2' },
    ];
    const data = {
        schema_version: 5,
        lifecycle: { status: 'ready' },
        memories: [
            {
                id: 'coverage-event',
                summary: 'The conversation established a durable shared fact.',
                importance: 4,
                message_ids: [0, 1],
                message_fingerprints: chat.map(getMessageRevision),
            },
        ],
        processed_message_ids: chat.map(getMessageRevision),
        graph: { nodes: {}, edges: {} },
        communities: {},
        archives: { revision: 0, segments: [], next_sequence: 1, rollups: [] },
        diagnostics: { archive: {}, volatile: {}, compaction: {}, rebuild: {} },
    };
    setupTestContext({
        context: { chatId: 'archive-chat', chat, chatMetadata: { openvault: data } },
        settings,
        deps: { saveChatConditional },
    });
    return { chat, data };
}

describe('archive two-phase commit', () => {
    afterEach(() => resetDeps());

    it('rolls back in-memory hiding when the sealing save fails and resumes safely', async () => {
        const save = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('disk full'));
        const { chat, data } = setupArchiveContext(save);
        expect(await sealAndHide([0, 1], 'archive-chat')).toBe(false);
        expect(chat.every((message) => !message.is_system)).toBe(true);
        expect(data.archives.segments).toHaveLength(1);
        expect(data.archives.segments[0].state).toBe('prepared');

        save.mockResolvedValue(true);
        expect(await recoverPreparedArchive('archive-chat')).toBe(true);
        expect(chat.every((message) => message.openvault_hidden && message.is_system)).toBe(true);
        expect(data.archives.segments[0].state).toBe('sealed');
    });

    it('does not prepare or hide anything after a chat switch', async () => {
        const { chat, data } = setupArchiveContext(vi.fn().mockResolvedValue(true));
        expect(await sealAndHide([0, 1], 'different-chat')).toBe(false);
        expect(chat.every((message) => !message.is_system)).toBe(true);
        expect(data.archives.segments).toEqual([]);
    });

    it('durably deactivates an archive when its source is restored', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { chat, data } = setupArchiveContext(save);
        expect(await sealAndHide([0, 1], 'archive-chat')).toBe(true);
        const archiveId = data.archives.segments[0].id;
        chat[0].is_system = false;

        expect(await persistArchiveDeactivations('archive-chat')).toBe(true);
        expect(data.archives.segments[0]).toMatchObject({ id: archiveId, active: false, state: 'inactive' });

        const reloaded = structuredClone(data);
        setupTestContext({
            context: { chatId: 'archive-chat', chat: structuredClone(chat), chatMetadata: { openvault: reloaded } },
            deps: { saveChatConditional: vi.fn().mockResolvedValue(undefined) },
        });
        expect(getArchiveText(reloaded)).toBe('');
    });

    it('does not hide a first segment when protected entries require a rollup', async () => {
        const save = vi.fn().mockResolvedValue(true);
        const { chat, data } = setupArchiveContext(save, {
            archivePromptBudget: 1,
            archiveRollupThreshold: 1,
            promptHardTokenLimit: 1000,
            archiveProjectionSafetyTokens: 1,
        });
        data.memories[0].importance = 5;
        data.memories[0].summary = 'Protected fact '.repeat(100);

        expect(await sealAndHide([0, 1], 'archive-chat')).toBe(false);
        expect(chat.every((message) => !message.is_system)).toBe(true);
        expect(data.archives.segments[0]).toMatchObject({ state: 'inactive', active: false, rollup_required: true });
        expect(data.diagnostics.archive.rollup_required).toBe(true);
    });

    it('keeps the previous projection and sources visible on existing-projection overflow', async () => {
        const save = vi.fn().mockResolvedValue(true);
        const { chat, data } = setupArchiveContext(save, {
            archivePromptBudget: 1,
            archiveRollupThreshold: 1,
            promptHardTokenLimit: 1000,
            archiveProjectionSafetyTokens: 1,
        });
        data.memories[0].importance = 5;
        data.memories[0].summary = 'Protected fact '.repeat(100);
        const previous = {
            revision: 0,
            budget: 1000,
            entry_ids: [],
            content: '<previous />',
            content_hash: integrityDigest('<previous />'),
            token_count: 1,
            built_at: 1,
        };
        data.archives.projection = previous;

        expect(await sealAndHide([0, 1], 'archive-chat')).toBe(false);
        expect(chat.every((message) => !message.is_system)).toBe(true);
        expect(data.archives.projection).toBe(previous);
        expect(data.archives.segments[0]).toMatchObject({ state: 'inactive', active: false, rollup_required: true });
        expect(getArchiveText(data, chat)).toBe('<previous />');
    });

    it('recovery preflights a prepared overflow before hiding sources', async () => {
        const save = vi.fn().mockResolvedValue(true);
        const { chat, data } = setupArchiveContext(save, {
            archivePromptBudget: 1,
            archiveRollupThreshold: 1,
            promptHardTokenLimit: 1000,
            archiveProjectionSafetyTokens: 1,
        });
        data.memories[0].importance = 5;
        data.memories[0].summary = 'Protected fact '.repeat(100);
        const prepared = buildPreparedSegment(data, chat, [0, 1]);
        data.archives.segments.push(prepared);
        data.archives.next_sequence++;
        data.archives.revision++;

        expect(await recoverPreparedArchive('archive-chat')).toBe(false);
        expect(chat.every((message) => !message.is_system)).toBe(true);
        expect(prepared).toMatchObject({ state: 'inactive', active: false, rollup_required: true });
        expect(data.archives.projection).toBeUndefined();
    });
});
