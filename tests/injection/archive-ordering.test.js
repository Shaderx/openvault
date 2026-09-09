import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/constants.js';
import { resetDeps } from '../../src/deps.js';
import { injectContext } from '../../src/retrieval/retrieve.js';

describe('final SillyTavern prompt tier ordering', () => {
    afterEach(() => resetDeps());

    it('keeps the archive at TOP_OF_CHAT and volatile tiers at depth 4 with frozen replies', () => {
        const setExtensionPrompt = vi.fn();
        setupTestContext({
            context: {
                chatId: 'ordering-chat',
                chat: [{ mes: 'visible', is_user: true }],
                chatMetadata: {
                    openvault: {
                        schema_version: 4,
                        lifecycle: { status: 'ready' },
                        memories: [],
                        graph: { nodes: {}, edges: {} },
                        communities: {},
                        diagnostics: { archive: {}, volatile: {}, compaction: {}, rebuild: {} },
                        archives: {
                            revision: 1,
                            next_sequence: 2,
                            rollups: [],
                            segments: [
                                {
                                    id: 'archive-1',
                                    sequence: 1,
                                    state: 'sealed',
                                    active: true,
                                    sources: [],
                                    memory_ids: [],
                                    content: '<segment sequence="1">stable</segment>',
                                    content_hash: 'hash',
                                    token_count: 1,
                                    prepared_at: 1,
                                    sealed_at: 2,
                                },
                            ],
                        },
                    },
                },
            },
            settings: {
                ...defaultSettings,
                frozenReplies: 10,
                injection: {
                    memory: { position: 4, depth: 4 },
                    world: { position: 4, depth: 4 },
                },
            },
            deps: { setExtensionPrompt },
        });

        injectContext('recall', 'world', 'entities');

        const archive = setExtensionPrompt.mock.calls.find((call) => call[0] === 'openvault_archive');
        const memory = setExtensionPrompt.mock.calls.find((call) => call[0] === 'openvault');
        const world = setExtensionPrompt.mock.calls.find((call) => call[0] === 'openvault_world');
        const entities = setExtensionPrompt.mock.calls.find((call) => call[0] === 'openvault_entities');
        expect(archive.slice(2)).toEqual([1, 10000]);
        expect(memory.slice(2)).toEqual([1, 4]);
        expect(world.slice(2)).toEqual([1, 4]);
        expect(entities.slice(2)).toEqual([1, 4]);
        expect(setExtensionPrompt.mock.calls.indexOf(archive)).toBeLessThan(
            setExtensionPrompt.mock.calls.indexOf(memory)
        );
    });
});
