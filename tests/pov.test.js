/**
 * Tests for src/pov.js
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS_KEY, MEMORIES_KEY } from '../src/constants.js';
import { resetDeps } from '../src/deps.js';
import {
    detectPresentCharactersFromMessages,
    filterMemoriesByPOV,
    getActiveCharacters,
    getPOVContext,
} from '../src/pov.js';
import { buildMockMemory } from './factories.js';

describe('detectPresentCharactersFromMessages Cyrillic support', () => {
    let mockContext;

    beforeEach(() => {
        mockContext = {
            name1: 'User',
            name2: 'Alice',
            chat: [],
            chatMetadata: {
                openvault: {
                    memories: [],
                    character_states: {},
                },
            },
        };
        setupTestContext({
            deps: {
                console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
                getContext: () => mockContext,
            },
        });
    });

    afterEach(() => {
        resetDeps();
    });

    it('should detect Cyrillic character names in messages', () => {
        mockContext.chat = [
            { name: 'User', is_user: true, mes: 'Привет Сузи, как дела?', is_system: false }
        ];
        mockContext.chatMetadata.openvault = {
            [MEMORIES_KEY]: [{ characters_involved: ['Сузи', 'Анна'] }],
            [CHARACTERS_KEY]: { Сузи: { name: 'Сузи' }, Анна: { name: 'Анна' } },
        };

        const result = detectPresentCharactersFromMessages(5);

        expect(result).toContain('Сузи');
    });

    it('should detect Cyrillic names at start of message', () => {
        mockContext.chat = [
            { name: 'User', is_user: true, mes: 'Сузи, ты здесь?', is_system: false }
        ];
        mockContext.chatMetadata.openvault = {
            [MEMORIES_KEY]: [{ characters_involved: ['Сузи'] }],
            [CHARACTERS_KEY]: { Сузи: { name: 'Сузи' } },
        };

        const result = detectPresentCharactersFromMessages(5);

        expect(result).toContain('Сузи');
    });

    it('should detect Cyrillic names at end of message', () => {
        mockContext.chat = [
            { name: 'User', is_user: true, mes: 'Я говорю с Анна', is_system: false }
        ];
        mockContext.chatMetadata.openvault = {
            [MEMORIES_KEY]: [{ characters_involved: ['Анна'] }],
            [CHARACTERS_KEY]: { Анна: { name: 'Анна' } },
        };

        const result = detectPresentCharactersFromMessages(5);

        expect(result).toContain('Анна');
    });

    it('should still work with ASCII names', () => {
        mockContext.chat = [
            { name: 'User', is_user: true, mes: 'Hello Alice, how are you?', is_system: false }
        ];
        mockContext.chatMetadata.openvault = {
            [MEMORIES_KEY]: [{ characters_involved: ['Alice', 'Bob'] }],
            [CHARACTERS_KEY]: { Alice: { name: 'Alice' }, Bob: { name: 'Bob' } },
        };

        const result = detectPresentCharactersFromMessages(5);

        expect(result).toContain('Alice');
        expect(result).not.toContain('Bob');
    });
});

describe('filterMemoriesByPOV', () => {
    it('returns all memories when no POV characters specified', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['Bob'] }),
            buildMockMemory({ id: '2', witnesses: ['Charlie'] }),
        ];
        const result = filterMemoriesByPOV(memories, [], {});
        expect(result).toHaveLength(2);
    });

    it('returns empty array for empty memories', () => {
        const result = filterMemoriesByPOV([], ['Alice'], {});
        expect(result).toEqual([]);
    });

    it('returns empty array for null memories', () => {
        const result = filterMemoriesByPOV(null, ['Alice'], {});
        expect(result).toEqual([]);
    });

    it('includes memories where POV character is witness', () => {
        const memories = [
            buildMockMemory({ id: '1', summary: 'Alice saw this', witnesses: ['Alice'], characters_involved: [] }),
            buildMockMemory({ id: '2', summary: 'Bob only', witnesses: ['Bob'], characters_involved: [] }),
        ];
        const result = filterMemoriesByPOV(memories, ['Alice'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('performs case-insensitive witness matching', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['ALICE'] }),
            buildMockMemory({ id: '2', witnesses: ['alice'] }),
        ];
        const result = filterMemoriesByPOV(memories, ['Alice'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(2);
    });

    it('includes memories where POV character is involved regardless of is_secret', () => {
        const memories = [
            buildMockMemory({ id: '1', characters_involved: ['Alice', 'Bob'], is_secret: false, witnesses: [] }),
            buildMockMemory({ id: '2', characters_involved: ['Alice'], is_secret: true, witnesses: [] }),
        ];
        const result = filterMemoriesByPOV(memories, ['Alice'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(2);
    });

    it('excludes secret memories from characters not involved', () => {
        const memories = [
            buildMockMemory({ id: '1', characters_involved: ['Alice', 'Bob'], is_secret: true, witnesses: [] }),
            buildMockMemory({ id: '2', characters_involved: ['Alice'], is_secret: false, witnesses: [] }),
        ];
        const result = filterMemoriesByPOV(memories, ['Charlie'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(0);
    });

    it('includes memories in POV character known_events', () => {
        const memories = [
            buildMockMemory({ id: 'known-evt', summary: 'Known event', witnesses: ['Bob'], characters_involved: [] }),
            buildMockMemory({
                id: 'unknown-evt',
                summary: 'Unknown event',
                witnesses: ['Charlie'],
                characters_involved: [],
            }),
        ];
        const data = {
            [CHARACTERS_KEY]: {
                Alice: {
                    name: 'Alice',
                    known_events: ['known-evt'],
                },
            },
        };
        const result = filterMemoriesByPOV(memories, ['Alice'], data);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('known-evt');
    });

    it('handles multiple POV characters', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['Alice'], characters_involved: [] }),
            buildMockMemory({ id: '2', witnesses: ['Bob'], characters_involved: [] }),
            buildMockMemory({ id: '3', witnesses: ['Charlie'], characters_involved: [] }),
        ];
        const result = filterMemoriesByPOV(memories, ['Alice', 'Bob'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(2);
        expect(result.map((m) => m.id)).toContain('1');
        expect(result.map((m) => m.id)).toContain('2');
    });

    it('combines known_events from multiple POV characters', () => {
        const memories = [
            buildMockMemory({ id: 'evt-1', witnesses: ['X'] }),
            buildMockMemory({ id: 'evt-2', witnesses: ['Y'] }),
        ];
        const data = {
            [CHARACTERS_KEY]: {
                Alice: { known_events: ['evt-1'] },
                Bob: { known_events: ['evt-2'] },
            },
        };
        const result = filterMemoriesByPOV(memories, ['Alice', 'Bob'], data);
        expect(result).toHaveLength(2);
    });

    it('handles memories without witnesses array', () => {
        const memories = [
            buildMockMemory({ id: '1', characters_involved: ['Alice'], is_secret: false, witnesses: undefined }),
        ];
        const result = filterMemoriesByPOV(memories, ['Alice'], { [CHARACTERS_KEY]: {} });
        expect(result).toHaveLength(1);
    });

    it('matches witness aliases from graph nodes (cross-script names)', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['\u0421\u0443\u0437\u0438'], characters_involved: [] }),
            buildMockMemory({ id: '2', witnesses: ['Unknown'], characters_involved: [] }),
        ];
        const data = {
            [CHARACTERS_KEY]: {},
            graph: {
                nodes: {
                    suzy: { name: 'Suzy', aliases: ['\u0421\u0443\u0437\u0438'] },
                },
            },
        };
        const result = filterMemoriesByPOV(memories, ['Suzy'], data);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('matches characters_involved aliases from graph nodes', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: [], characters_involved: ['\u0412\u043e\u0432\u0430'] }),
        ];
        const data = {
            [CHARACTERS_KEY]: {},
            graph: {
                nodes: {
                    vova: { name: 'Vova', aliases: ['\u0412\u043e\u0432\u0430'] },
                },
            },
        };
        const result = filterMemoriesByPOV(memories, ['Vova'], data);
        expect(result).toHaveLength(1);
    });

    it('falls back to exact matching when graph has no aliases', () => {
        const memories = [
            buildMockMemory({ id: '1', witnesses: ['Alice'], characters_involved: [] }),
            buildMockMemory({ id: '2', witnesses: ['\u0410\u043b\u0438\u0441\u0430'], characters_involved: [] }),
        ];
        const data = {
            [CHARACTERS_KEY]: {},
            graph: { nodes: { alice: { name: 'Alice' } } },
        };
        const result = filterMemoriesByPOV(memories, ['Alice'], data);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });
});

describe('pov (deps-requiring)', () => {
    let mockConsole;
    let mockContext;

    beforeEach(() => {
        mockConsole = {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        mockContext = {
            name1: 'User',
            name2: 'Alice',
            groupId: null,
            groups: [],
            characters: [],
            chat: [],
            chatMetadata: {},
        };
        setupTestContext({
            deps: {
                console: mockConsole,
                getContext: () => mockContext,
            },
        });
    });

    afterEach(() => {
        resetDeps();
    });

    describe('getActiveCharacters', () => {
        it('returns main character and user in solo chat', () => {
            const result = getActiveCharacters();
            expect(result).toContain('Alice');
            expect(result).toContain('User');
        });

        it('returns main character even without user name', () => {
            mockContext.name1 = null;
            const result = getActiveCharacters();
            expect(result).toContain('Alice');
            expect(result).not.toContain(null);
        });

        it('includes group members in group chat', () => {
            mockContext.groupId = 'group-123';
            mockContext.groups = [
                {
                    id: 'group-123',
                    members: ['avatar1.png', 'avatar2.png'],
                },
            ];
            mockContext.characters = [
                { avatar: 'avatar1.png', name: 'Bob' },
                { avatar: 'avatar2.png', name: 'Charlie' },
            ];

            const result = getActiveCharacters();
            expect(result).toContain('Alice'); // main character
            expect(result).toContain('User');
            expect(result).toContain('Bob');
            expect(result).toContain('Charlie');
        });

        it('does not duplicate character names', () => {
            mockContext.groupId = 'group-123';
            mockContext.groups = [
                {
                    id: 'group-123',
                    members: ['avatar1.png'],
                },
            ];
            mockContext.characters = [
                { avatar: 'avatar1.png', name: 'Alice' }, // same as name2
            ];

            const result = getActiveCharacters();
            const aliceCount = result.filter((n) => n === 'Alice').length;
            expect(aliceCount).toBe(1);
        });

        it('handles group without members', () => {
            mockContext.groupId = 'group-123';
            mockContext.groups = [
                {
                    id: 'group-123',
                    // no members
                },
            ];

            const result = getActiveCharacters();
            expect(result).toContain('Alice');
        });
    });

    describe('detectPresentCharactersFromMessages', () => {
        it('returns basic names when no OpenVault data', () => {
            // When context has no chat messages and no existing openvault data,
            // getOpenVaultData will create a new empty structure (not null)
            // So we test the path where there are no recent messages to scan
            mockContext.chat = [];
            mockContext.chatMetadata = {
                openvault: {
                    memories: [],
                    character_states: {},
                },
            };
            const result = detectPresentCharactersFromMessages(2);
            // No messages to scan, no characters detected
            expect(result).toEqual([]);
        });

        it('detects character from message sender', () => {
            mockContext.chat = [{ name: 'Bob', mes: 'Hello', is_system: false }];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [],
                [CHARACTERS_KEY]: { Bob: { name: 'Bob' } },
            };

            const result = detectPresentCharactersFromMessages(2);
            expect(result).toContain('Bob');
        });

        it('detects character mentioned in message content', () => {
            mockContext.chat = [
                { name: 'Narrator', mes: 'Alice walked into the room where Bob was waiting.', is_system: false },
            ];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [{ characters_involved: ['Alice', 'Bob'] }],
                [CHARACTERS_KEY]: { Alice: { name: 'Alice' }, Bob: { name: 'Bob' } },
            };

            const result = detectPresentCharactersFromMessages(2);
            expect(result).toContain('Alice');
            expect(result).toContain('Bob');
        });

        it('skips system messages', () => {
            mockContext.chat = [
                { name: 'System', mes: 'Charlie joined', is_system: true },
                { name: 'Alice', mes: 'Hi', is_system: false },
            ];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [{ characters_involved: ['Charlie'] }],
                [CHARACTERS_KEY]: { Charlie: { name: 'Charlie' } },
            };

            const result = detectPresentCharactersFromMessages(2);
            expect(result).not.toContain('Charlie');
        });

        it('respects messageCount limit', () => {
            mockContext.chat = [
                { name: 'Alice', mes: 'First message mentions Bob', is_system: false },
                { name: 'Alice', mes: 'Second message', is_system: false },
                { name: 'Alice', mes: 'Third message', is_system: false },
            ];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [{ characters_involved: ['Bob'] }],
                [CHARACTERS_KEY]: { Bob: { name: 'Bob' } },
            };

            // Only scan last 2 messages, Bob is mentioned in first (not included)
            const result = detectPresentCharactersFromMessages(2);
            expect(result).not.toContain('Bob');
        });

        it('preserves original case from character states', () => {
            mockContext.chat = [{ name: 'narrator', mes: 'ALICE arrived', is_system: false }];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [],
                [CHARACTERS_KEY]: { Alice: { name: 'Alice' } },
            };

            const result = detectPresentCharactersFromMessages(2);
            expect(result).toContain('Alice'); // original case, not 'ALICE' or 'alice'
        });
    });

    describe('getPOVContext', () => {
        it('returns single POV character in group chat', () => {
            mockContext.groupId = 'group-123';
            const result = getPOVContext();

            expect(result.isGroupChat).toBe(true);
            expect(result.povCharacters).toEqual(['Alice']);
        });

        it('detects characters in solo chat (narrator mode)', () => {
            mockContext.groupId = null;
            mockContext.chat = [{ name: 'Bob', mes: 'Test', is_system: false }];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [],
                [CHARACTERS_KEY]: { Bob: { name: 'Bob' } },
            };

            const result = getPOVContext();

            expect(result.isGroupChat).toBe(false);
            expect(result.povCharacters).toContain('Bob');
        });

        it('falls back to context names when no characters detected', () => {
            mockContext.groupId = null;
            mockContext.chat = [];
            mockContext.chatMetadata.openvault = {
                [MEMORIES_KEY]: [],
                [CHARACTERS_KEY]: {},
            };

            const result = getPOVContext();

            expect(result.povCharacters).toContain('Alice');
            expect(result.povCharacters).toContain('User');
        });
    });
});
