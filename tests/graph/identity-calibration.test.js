import { describe, expect, it } from 'vitest';
import { ENTITY_MATCH_THRESHOLDS } from '../../src/constants.js';
import {
    createEmptyGraph,
    mergeOrInsertEntity,
    normalizeKey,
    shouldMergeEntities,
    upsertEntity,
} from '../../src/graph/graph.js';
import observations from '../fixtures/identity-webgpu.json';

describe('measured WebGPU identity operating points', () => {
    for (const [model, observation] of Object.entries(observations.models)) {
        it(`${model} rejects measured hard negatives at the selected operating point`, () => {
            const threshold = ENTITY_MATCH_THRESHOLDS[model];
            observations.pairs.forEach((pair, index) => {
                if (pair.positive) return;
                const left = normalizeKey(pair.left);
                const right = normalizeKey(pair.right);
                expect(observation.cosines[index]).toBeLessThan(threshold);
                expect(
                    shouldMergeEntities(
                        observation.cosines[index],
                        threshold,
                        new Set(left.split(' ')),
                        left,
                        right,
                        'PERSON'
                    )
                ).toBe(false);
            });
        });
    }

    it.each([
        ['Red', 'Reddington Steele'],
        ['Captain Voss', 'Alexander Voss'],
        ['The Iron Duke', 'Duke Harlan'],
        ['Reddigton Steele', 'Reddington Steele'],
    ])('resolves established alias %s without depending on model cosine', async (alias, canonical) => {
        setupTestContext();
        const graph = createEmptyGraph();
        upsertEntity(graph, canonical, 'PERSON', 'A resident involved in the current story.', 3);
        graph.nodes[normalizeKey(canonical)].aliases = [alias];
        const result = await mergeOrInsertEntity(
            graph,
            alias,
            'PERSON',
            'A resident involved in the current story.',
            3,
            {}
        );
        expect(result.key).toBe(normalizeKey(canonical));
        expect(Object.keys(graph.nodes)).toHaveLength(1);
    });
});
