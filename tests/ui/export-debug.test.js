import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import defaultSettings to use as template for mock
const { defaultSettings } = await import('../../src/constants.js');

// Mock deps before import
vi.mock('../../src/deps.js', () => ({
    getDeps: () => ({
        getExtensionSettings: () => ({
            openvault: {
                ...defaultSettings,
                // Override a few for testing
                alpha: 0.7,
                enabled: true,
                debugMode: false,
            },
        }),
        getContext: () => ({
            chat: [{ mes: 'hello', is_system: false, is_user: true }],
            name2: 'Alice',
            chatMetadata: {
                openvault: {
                    memories: [
                        {
                            id: '1',
                            type: 'event',
                            summary: 'Test',
                            importance: 3,
                            characters_involved: ['Alice'],
                            embedding: new Float32Array(384),
                        },
                        {
                            id: '2',
                            type: 'reflection',
                            summary: 'Insight',
                            importance: 4,
                            characters_involved: ['Alice'],
                        },
                    ],
                    character_states: {
                        Alice: { name: 'Alice', current_emotion: 'happy', known_events: ['1'] },
                    },
                    graph: {
                        nodes: {
                            alice: { name: 'Alice', type: 'PERSON', description: 'Main char', mentions: 10 },
                            garden: { name: 'Garden', type: 'PLACE', description: 'A garden', mentions: 5 },
                        },
                        edges: {
                            alice__garden: { source: 'alice', target: 'garden', description: 'visits', weight: 3 },
                        },
                    },
                    communities: {
                        c1: {
                            title: 'Alice World',
                            summary: 'Summary',
                            findings: ['f1'],
                            nodes: ['alice', 'garden'],
                            embedding: new Float32Array(384),
                        },
                    },
                },
            },
        }),
    }),
}));

vi.mock('../../src/embeddings.js', () => ({
    isEmbeddingsEnabled: () => true,
}));

vi.mock('../../src/perf/store.js', () => ({
    getAll: () => ({}),
}));

// Must import after mocks
const { buildExportPayload } = await import('../../src/ui/export-debug.js');
const { cacheRetrievalDebug, clearRetrievalDebug, cacheScoringDetails } = await import(
    '../../src/retrieval/debug-cache.js'
);

describe('buildExportPayload', () => {
    beforeEach(() => {
        clearRetrievalDebug();
    });

    describe('graph filtering', () => {
        it('shows relevant section with matched entities when retrieval cached', () => {
            cacheRetrievalDebug({
                queryContext: {
                    entities: ['Alice'],
                    embeddingQuery: 'test',
                    bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 },
                },
            });
            const payload = buildExportPayload();
            expect(payload.state.graph.relevant).toBeDefined();
            expect(payload.state.graph.relevant.matchedEntities).toEqual(['Alice']);
            expect(payload.state.graph.relevant.nodes.alice).toBeDefined();
            expect(payload.state.graph.relevant.nodes.alice.name).toBe('Alice');
            // alice__garden edge involves alice, so should be included
            expect(payload.state.graph.relevant.edges.alice__garden).toBeDefined();
        });

        it('omits graph.raw (replaced by relevant)', () => {
            cacheRetrievalDebug({
                queryContext: {
                    entities: ['Alice'],
                    embeddingQuery: 'test',
                    bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 },
                },
            });
            const payload = buildExportPayload();
            expect(payload.state.graph.raw).toBeUndefined();
        });

        it('falls back to summary-only when no retrieval cached', () => {
            const payload = buildExportPayload();
            expect(payload.state.graph.summary.nodeCount).toBe(2);
            expect(payload.state.graph.relevant).toBeUndefined();
        });

        it('excludes embeddings from relevant graph nodes', () => {
            cacheRetrievalDebug({
                queryContext: {
                    entities: ['Alice'],
                    embeddingQuery: '',
                    bm25Tokens: { total: 0, entityStems: 0, grounded: 0, nonGrounded: 0 },
                },
            });
            const payload = buildExportPayload();
            expect(payload.state.graph.relevant.nodes.alice).toBeDefined();
            expect(payload.state.graph.relevant.nodes.alice.embedding).toBeUndefined();
        });
    });

    describe('scoring section', () => {
        beforeEach(() => {
            clearRetrievalDebug();
        });

        function setupScoringCache() {
            const results = [
                {
                    memory: {
                        id: 's1',
                        type: 'event',
                        summary: 'Selected memory one',
                        retrieval_hits: 3,
                        mentions: 2,
                        characters_involved: ['Alice'],
                    },
                    score: 5.12345,
                    breakdown: {
                        base: 2.34567,
                        baseAfterFloor: 2.34567,
                        recencyPenalty: 0,
                        vectorSimilarity: 0.71234,
                        vectorBonus: 1.56789,
                        bm25Score: 0.45678,
                        bm25Bonus: 1.23456,
                        hitDamping: 0.67,
                        frequencyFactor: 1.035,
                        total: 5.12345,
                        distance: 42,
                        importance: 4,
                    },
                },
                {
                    memory: {
                        id: 'r1',
                        type: 'event',
                        summary: 'Rejected memory',
                        retrieval_hits: 0,
                        mentions: 1,
                        characters_involved: ['Bob'],
                    },
                    score: 1.0,
                    breakdown: {
                        base: 0.98765,
                        baseAfterFloor: 0.98765,
                        recencyPenalty: 0,
                        vectorSimilarity: 0,
                        vectorBonus: 0,
                        bm25Score: 0,
                        bm25Bonus: 0,
                        hitDamping: 1,
                        frequencyFactor: 1,
                        total: 1.0,
                        distance: 150,
                        importance: 2,
                    },
                },
            ];
            cacheScoringDetails(results, new Set(['s1']));
        }

        it('rounds all floats to 2 decimal places', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.total).toBe(5.12);
            expect(selected.base).toBe(2.35);
        });

        it('omits zero/default scoring fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const rejected = payload.scoring.rejected[0];
            // Zero fields should be omitted
            expect(rejected.vectorSimilarity).toBeUndefined();
            expect(rejected.vectorBonus).toBeUndefined();
            expect(rejected.bm25Score).toBeUndefined();
            expect(rejected.bm25Bonus).toBeUndefined();
            expect(rejected.recencyPenalty).toBeUndefined();
            expect(rejected.hitDamping).toBeUndefined();
            expect(rejected.frequencyFactor).toBeUndefined();
            // Non-default fields should be present
            expect(rejected.total).toBeDefined();
            expect(rejected.base).toBeDefined();
            expect(rejected.distance).toBeDefined();
        });

        it('includes non-zero optional fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.vectorSimilarity).toBe(0.71);
            expect(selected.vectorBonus).toBe(1.57);
            expect(selected.hitDamping).toBe(0.67);
            expect(selected.frequencyFactor).toBe(1.03); // r2(1.035)
        });

        it('includes decayPct on all entries', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            // decayPct = base / importance = 2.34567 / 4 ≈ 0.59
            expect(selected.decayPct).toBe(0.59);
            const rejected = payload.scoring.rejected[0];
            // decayPct = 0.98765 / 2 ≈ 0.49
            expect(rejected.decayPct).toBe(0.49);
        });

        it('includes retrieval_hits, mentions, characters_involved', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            const selected = payload.scoring.selected[0];
            expect(selected.retrieval_hits).toBe(3);
            expect(selected.mentions).toBe(2);
            expect(selected.characters_involved).toEqual(['Alice']);
        });

        it('splits into selected and rejected arrays', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            expect(payload.scoring.selected).toHaveLength(1);
            expect(payload.scoring.rejected).toHaveLength(1);
            expect(payload.scoring.selected[0].id).toBe('s1');
            expect(payload.scoring.rejected[0].id).toBe('r1');
        });

        it('includes _note about omitted fields', () => {
            setupScoringCache();
            const payload = buildExportPayload();
            expect(payload.scoring._note).toContain('Default-value');
        });
    });
});
