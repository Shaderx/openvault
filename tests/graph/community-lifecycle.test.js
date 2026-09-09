import { afterEach, describe, expect, it } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { synthesizeCommunities } from '../../src/extraction/extract.js';
import {
    assignStableCommunityIds,
    buildCommunityGroups,
    getCommunityRetrievalText,
    updateCommunitySummaries,
    validateCommunitySubdivisions,
} from '../../src/graph/communities.js';

const graph = {
    nodes: {
        a: { name: 'A', type: 'PERSON', description: 'A', mentions: 1 },
        b: { name: 'B', type: 'PERSON', description: 'B', mentions: 1 },
        c: { name: 'C', type: 'PERSON', description: 'C', mentions: 1 },
        d: { name: 'D', type: 'PERSON', description: 'D', mentions: 1 },
    },
    edges: {
        a__b: { source: 'a', target: 'b', description: 'allied', weight: 2, status: 'active' },
        c__d: { source: 'c', target: 'd', description: 'rivals', weight: 2, status: 'active' },
        b__c: { source: 'b', target: 'c', description: 'weak bridge', weight: 1, status: 'weakened' },
    },
};

describe('dynamic community lifecycle', () => {
    afterEach(() => resetDeps());

    it('keeps stable identity when Louvain numeric labels change', () => {
        const groups = buildCommunityGroups(graph, { a: 9, b: 9, c: 4, d: 4 });
        const existing = {
            'community-left': { nodeKeys: ['a', 'b'], status: 'active' },
            'community-right': { nodeKeys: ['c', 'd'], status: 'active' },
        };
        const assigned = assignStableCommunityIds(groups, existing);
        expect(assigned['9'].id).toBe('community-left');
        expect(assigned['4'].id).toBe('community-right');
    });

    it('changes the canonical input hash when a same-membership edge changes', () => {
        const first = buildCommunityGroups(graph, { a: 0, b: 0, c: 1, d: 1 });
        const changed = structuredClone(graph);
        changed.edges.a__b.description = 'alliance weakened by betrayal';
        const second = buildCommunityGroups(changed, { a: 0, b: 0, c: 1, d: 1 });
        expect(second[0].inputHash).not.toBe(first[0].inputHash);
    });

    it('never promotes a stored child community to a top-level Louvain identity', () => {
        const groups = buildCommunityGroups(graph, { a: 7, b: 7, c: 8, d: 8 });
        const existing = {
            'community-child': { nodeKeys: ['a', 'b'], status: 'active', parentId: 'community-parent' },
            'community-parent': { nodeKeys: ['a', 'b'], status: 'active' },
            'community-right': { nodeKeys: ['c', 'd'], status: 'active' },
        };
        const assigned = assignStableCommunityIds(groups, existing);
        expect(assigned['7'].id).toBe('community-parent');
        expect(assigned['7'].id).not.toBe('community-child');
    });

    it('dissolves all invalid communities, clears global output, and deletes old vectors', async () => {
        setupTestContext();
        const existing = {
            'community-old': {
                id: 'community-old',
                nodeKeys: ['a', 'b'],
                title: 'Old state',
                summary: 'This state no longer exists.',
                findings: [],
                status: 'active',
                _st_synced: true,
            },
        };
        const result = await updateCommunitySummaries(graph, {}, existing, 10, 100, false);
        expect(result.communities).toEqual({});
        expect(result.global_world_state).toBeNull();
        expect(result.stChanges.toSync).toEqual([]);
        expect(result.stChanges.toDelete).toEqual([{ hash: expect.any(Number) }]);
        expect(getCommunityRetrievalText('community-old', existing['community-old'])).toContain('Old state');
    });

    it('clears stale global state when detection yields no valid communities', async () => {
        setupTestContext({ settings: { embeddingSource: 'ollama' } });
        const data = {
            graph: { nodes: { a: graph.nodes.a, b: graph.nodes.b }, edges: {} },
            communities: {
                old: {
                    id: 'old',
                    nodeKeys: ['a', 'b'],
                    title: 'Old',
                    summary: 'No longer valid',
                    findings: [],
                    status: 'active',
                    _st_synced: true,
                },
            },
            global_world_state: { summary: 'stale', last_updated: 1, community_count: 1 },
            community_state_revision: 3,
        };
        await synthesizeCommunities(data, {}, 'A', 'User');
        expect(data.communities).toEqual({});
        expect(data.global_world_state).toBeUndefined();
        expect(data.community_state_revision).toBe(4);
    });

    it('accepts only complete, connected, non-invented subdivisions', () => {
        const group = buildCommunityGroups(graph, { a: 0, b: 0, c: 0, d: 0 })[0];
        const valid = [{ entity_ids: ['a', 'b'] }, { entity_ids: ['c', 'd'] }];
        expect(validateCommunitySubdivisions(valid, group, graph)).toEqual(valid);
        expect(
            validateCommunitySubdivisions([{ entity_ids: ['a', 'invented'] }, { entity_ids: ['b', 'c'] }], group, graph)
        ).toEqual([]);
        expect(
            validateCommunitySubdivisions([{ entity_ids: ['a', 'c'] }, { entity_ids: ['b', 'd'] }], group, graph)
        ).toEqual([]);
    });
});
