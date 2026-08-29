import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getArchiveText,
    persistArchiveDeactivations,
    recoverPreparedArchive,
    sealAndHide,
} from '../../src/archive/archive.js';
import { resetDeps } from '../../src/deps.js';
import { getMessageRevision } from '../../src/extraction/scheduler.js';

function setupArchiveContext(saveChatConditional) {
    const chat = [
        { mes: 'User establishes a durable fact.', name: 'User', is_user: true, is_system: false, send_date: '1' },
        { mes: 'The guide confirms that fact.', name: 'Guide', is_user: false, is_system: false, send_date: '2' },
    ];
    const data = {
        schema_version: 4,
        lifecycle: { status: 'ready' },
        memories: [],
        processed_message_ids: chat.map(getMessageRevision),
        graph: { nodes: {}, edges: {} },
        communities: {},
        archives: { revision: 0, segments: [], next_sequence: 1, rollups: [] },
        diagnostics: { archive: {}, volatile: {}, compaction: {}, rebuild: {} },
    };
    setupTestContext({
        context: { chatId: 'archive-chat', chat, chatMetadata: { openvault: data } },
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
});
