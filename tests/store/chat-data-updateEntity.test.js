// @ts-check
/* global describe, it, expect, beforeEach, vi, setupTestContext */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { METADATA_KEY } from '../../src/constants.js';
import { setDeps } from '../../src/deps.js';
import { normalizeKey } from '../../src/graph/graph.js';
import { getOpenVaultData, updateEntity } from '../../src/store/chat-data.js';
import { buildMockGraphNode } from '../factories.js';

describe('updateEntity', () => {
    let mockContext;

    beforeEach(() => {
        // Use a stable context reference so getOpenVaultData() always returns the same object
        mockContext = { chatMetadata: { [METADATA_KEY]: {} }, chatId: 'test-chat-123' };
        setupTestContext({
            deps: { saveChatConditional: vi.fn() },
        });
        // Override getContext to return stable reference
        setDeps({
            getContext: () => mockContext,
        });
        // Initialize graph data
        mockContext.chatMetadata[METADATA_KEY].graph = {
            nodes: {},
            edges: {},
            _mergeRedirects: {},
        };
    });

    it('should update entity description without rename', async () => {
        const data = getOpenVaultData();
        const key = normalizeKey('Marcus Hale');
        data.graph.nodes[key] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A former soldier',
        });

        const result = await updateEntity(key, {
            description: 'A former soldier turned mercenary',
        });

        expect(result.key).toBe(key);
        expect(data.graph.nodes[key].description).toBe('A former soldier turned mercenary');
    });

    it('should rename entity and rewrite edges', async () => {
        const data = getOpenVaultData();
        const oldKey = normalizeKey('Marcus Hale');
        const newKey = normalizeKey('Marcus the Brave');
        const tavernKey = normalizeKey('The Tavern');
        const oldEdgeKey = `${oldKey}__${tavernKey}`;
        const newEdgeKey = `${newKey}__${tavernKey}`;

        data.graph.nodes[oldKey] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A soldier',
        });
        data.graph.nodes[tavernKey] = buildMockGraphNode({
            name: 'The Tavern',
            type: 'PLACE',
            description: 'A pub',
        });
        data.graph.edges[oldEdgeKey] = {
            source: oldKey,
            target: tavernKey,
            relation: 'frequents',
        };

        const result = await updateEntity(oldKey, {
            name: 'Marcus the Brave',
        });

        expect(result.key).toBe(newKey);
        expect(data.graph.nodes[newKey]).toBeDefined();
        expect(data.graph.nodes[oldKey]).toBeUndefined();
        expect(data.graph.edges[newEdgeKey]).toBeDefined();
        expect(data.graph.edges[oldEdgeKey]).toBeUndefined();
        expect(data.graph._mergeRedirects[oldKey]).toBe(newKey);
    });

    it('should return stChanges.toDelete when renaming synced entity', async () => {
        const data = getOpenVaultData();
        const oldKey = normalizeKey('Marcus Hale');
        const newKey = normalizeKey('Marcus the Brave');

        data.graph.nodes[oldKey] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A soldier',
            _st_synced: true,
        });

        const result = await updateEntity(oldKey, {
            name: 'Marcus the Brave',
        });

        expect(result.key).toBe(newKey);
        expect(result.stChanges?.toDelete).toBeDefined();
        expect(result.stChanges.toDelete.length).toBe(1);
        expect(result.stChanges.toDelete[0]).toHaveProperty('hash');
        expect(typeof result.stChanges.toDelete[0].hash).toBe('number');
    });

    it('should update existing redirects that point to oldKey on rename', async () => {
        const data = getOpenVaultData();
        const oldKey = normalizeKey('Marcus Hale');
        const newKey = normalizeKey('Marcus the Brave');
        const aliasKey = normalizeKey('Marc');

        // Simulate a prior merge: "Marc" was merged into "Marcus Hale"
        data.graph._mergeRedirects[aliasKey] = oldKey;

        data.graph.nodes[oldKey] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A soldier',
        });

        const result = await updateEntity(oldKey, { name: 'Marcus the Brave' });

        expect(result.key).toBe(newKey);
        // The old redirect should be updated, not left orphaned
        expect(data.graph._mergeRedirects[aliasKey]).toBe(newKey);
        expect(data.graph._mergeRedirects[oldKey]).toBe(newKey);
    });

    it('should block rename to existing entity name', async () => {
        const data = getOpenVaultData();
        const marcusKey = normalizeKey('Marcus Hale');
        const johnKey = normalizeKey('John Doe');

        data.graph.nodes[marcusKey] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A soldier',
        });
        data.graph.nodes[johnKey] = buildMockGraphNode({
            name: 'John Doe',
            type: 'PERSON',
            description: 'Another person',
        });

        const result = await updateEntity(marcusKey, {
            name: 'John Doe',
        });

        expect(result).toBeNull();
        expect(data.graph.nodes[marcusKey]).toBeDefined();
    });

    it('should update aliases array', async () => {
        const data = getOpenVaultData();
        const key = normalizeKey('Marcus Hale');
        data.graph.nodes[key] = buildMockGraphNode({
            name: 'Marcus Hale',
            type: 'PERSON',
            description: 'A soldier',
            aliases: ['masked figure'],
        });

        const result = await updateEntity(key, {
            aliases: ['masked figure', 'the stranger'],
        });

        expect(result.key).toBe(key);
        expect(data.graph.nodes[key].aliases).toEqual(['masked figure', 'the stranger']);
    });

    it('returns toSync when updating description without rename', async () => {
        const saveFn = vi.fn(async () => true);
        setupTestContext({
            context: {
                chatMetadata: {
                    openvault: {
                        schema_version: 3,
                        memories: [],
                        character_states: {},
                        processed_message_ids: [],
                        graph: {
                            nodes: {
                                alice: {
                                    name: 'Alice',
                                    type: 'PERSON',
                                    description: 'Old description',
                                    mentions: 1,
                                    aliases: [],
                                },
                            },
                            edges: {},
                            _mergeRedirects: {},
                        },
                    },
                },
            },
            deps: { saveChatConditional: saveFn },
        });

        const { updateEntity } = await import('../../src/store/chat-data.js');
        const result = await updateEntity('alice', { description: 'New description' });

        expect(result).not.toBeNull();
        expect(result.key).toBe('alice');
        // Bug: no stChanges returned for simple field update
        expect(result.stChanges).toBeDefined();
        expect(result.stChanges.toSync).toBeDefined();
        expect(result.stChanges.toSync.length).toBeGreaterThan(0);
    });
});
