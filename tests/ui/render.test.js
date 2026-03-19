import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { METADATA_KEY } from '../../src/constants.js';
import { resetDeps } from '../../src/deps.js';
import { renderGraphStats } from '../../src/ui/render.js';

describe('renderGraphStats', () => {
    beforeEach(() => {
        setupTestContext({
            context: {
                chat: new Array(112).fill({}), // Simulate 112 messages
                chatMetadata: {
                    [METADATA_KEY]: {
                        graph: {
                            // Graph stores nodes/edges as objects (keyed by normalized name)
                            nodes: {
                                alice: { id: '1', name: 'Alice', type: 'PERSON' },
                                bob: { id: '2', name: 'Bob', type: 'PERSON' },
                                castle: { id: '3', name: 'Castle', type: 'PLACE' },
                            },
                            edges: {
                                alice__bob: { source: 'alice', target: 'bob', relation: 'knows' },
                                alice__castle: { source: 'alice', target: 'castle', relation: 'owns' },
                            },
                        },
                        // Communities stored as object (keyed by ID)
                        communities: {
                            c1: { id: 'c1', summary: 'Test community' },
                        },
                        lastCommunityDetection: 100,
                    },
                },
            },
        });
        document.body.innerHTML = '<div id="openvault_graph_stats"></div>';
    });

    afterEach(() => {
        resetDeps();
    });

    it('renders graph stats into container', () => {
        renderGraphStats();
        const container = document.getElementById('openvault_graph_stats');
        expect(container.innerHTML).toContain('3'); // entities
        expect(container.innerHTML).toContain('2'); // relationships
        expect(container.innerHTML).toContain('1'); // communities
    });

    it('calculates messages since last clustering', () => {
        renderGraphStats();
        const container = document.getElementById('openvault_graph_stats');
        expect(container.innerHTML).toContain('msgs ago');
    });

    it('handles missing graph data gracefully', () => {
        setupTestContext({
            context: {
                chat: [],
                chatMetadata: {
                    [METADATA_KEY]: {},
                },
            },
        });
        renderGraphStats();
        const container = document.getElementById('openvault_graph_stats');
        expect(container.innerHTML).toContain('0');
    });
});
