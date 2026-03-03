import { describe, it, expect, beforeEach } from 'vitest';
import { upsertEntity, upsertRelationship } from '../../src/graph/graph.js';

describe('upsertEntity', () => {
    let graphData;

    beforeEach(() => {
        graphData = { nodes: {}, edges: {} };
    });

    it('adds a new entity node', () => {
        upsertEntity(graphData, 'King Aldric', 'PERSON', 'The aging ruler');
        const key = 'king aldric';
        expect(graphData.nodes[key]).toBeDefined();
        expect(graphData.nodes[key].name).toBe('King Aldric');
        expect(graphData.nodes[key].type).toBe('PERSON');
        expect(graphData.nodes[key].description).toBe('The aging ruler');
        expect(graphData.nodes[key].mentions).toBe(1);
    });

    it('normalizes key to lowercase trimmed', () => {
        upsertEntity(graphData, '  Castle  ', 'PLACE', 'A fortress');
        expect(graphData.nodes['castle']).toBeDefined();
        expect(graphData.nodes['castle'].name).toBe('Castle');
    });

    it('merges descriptions on duplicate by appending with pipe', () => {
        upsertEntity(graphData, 'Castle', 'PLACE', 'An ancient fortress');
        upsertEntity(graphData, 'castle', 'PLACE', 'Seat of power');
        expect(graphData.nodes['castle'].description).toBe('An ancient fortress | Seat of power');
        expect(graphData.nodes['castle'].mentions).toBe(2);
    });

    it('preserves original name casing from first insertion', () => {
        upsertEntity(graphData, 'King Aldric', 'PERSON', 'First');
        upsertEntity(graphData, 'king aldric', 'PERSON', 'Second');
        expect(graphData.nodes['king aldric'].name).toBe('King Aldric');
    });
});

describe('upsertRelationship', () => {
    let graphData;

    beforeEach(() => {
        graphData = { nodes: {}, edges: {} };
        upsertEntity(graphData, 'King Aldric', 'PERSON', 'The ruler');
        upsertEntity(graphData, 'Castle', 'PLACE', 'A fortress');
    });

    it('adds a new edge between existing nodes', () => {
        upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
        const edgeKey = 'king aldric__castle';
        expect(graphData.edges[edgeKey]).toBeDefined();
        expect(graphData.edges[edgeKey].source).toBe('king aldric');
        expect(graphData.edges[edgeKey].target).toBe('castle');
        expect(graphData.edges[edgeKey].description).toBe('Rules from the castle');
        expect(graphData.edges[edgeKey].weight).toBe(1);
    });

    it('increments weight on duplicate edge', () => {
        upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
        upsertRelationship(graphData, 'king aldric', 'castle', 'Rules from the castle');
        expect(graphData.edges['king aldric__castle'].weight).toBe(2);
    });

    it('appends description on duplicate edge when description differs', () => {
        upsertRelationship(graphData, 'King Aldric', 'Castle', 'Rules from the castle');
        upsertRelationship(graphData, 'King Aldric', 'Castle', 'Imprisoned in the castle');
        const edge = graphData.edges['king aldric__castle'];
        expect(edge.weight).toBe(2);
        expect(edge.description).toContain('Rules from the castle');
        expect(edge.description).toContain('Imprisoned in the castle');
    });

    it('silently skips if source node does not exist', () => {
        upsertRelationship(graphData, 'Ghost', 'Castle', 'Haunts');
        expect(Object.keys(graphData.edges)).toHaveLength(0);
    });

    it('silently skips if target node does not exist', () => {
        upsertRelationship(graphData, 'King Aldric', 'Ghost', 'Fears');
        expect(Object.keys(graphData.edges)).toHaveLength(0);
    });

    it('normalizes source and target to lowercase trimmed', () => {
        upsertRelationship(graphData, '  King Aldric  ', '  Castle  ', 'Rules');
        expect(graphData.edges['king aldric__castle']).toBeDefined();
    });
});
