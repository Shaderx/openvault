import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionName } from '../../src/constants.js';
import { setDeps } from '../../src/deps.js';
import { filterDuplicateReflections } from '../../src/reflection/reflect.js';

describe('filterDuplicateReflections - 3-Tier Replacement', () => {
    let existingMemories;

    beforeEach(() => {
        // Mock dependencies with debugMode enabled to enable logging
        setDeps({
            console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
            getExtensionSettings: () => ({
                [extensionName]: { debugMode: true },
            }),
        });

        existingMemories = [
            {
                id: 'ref_001',
                type: 'reflection',
                character: 'Alice',
                summary: 'Alice struggles with trust issues due to past betrayal',
                // Unit vector: [1, 0, 0, 0, 0]
                embedding: [1, 0, 0, 0, 0],
            },
            {
                id: 'ref_002',
                type: 'reflection',
                character: 'Alice',
                summary: 'Alice shows vulnerability around Bob',
                // Orthogonal unit vector: [0, 1, 0, 0, 0]
                embedding: [0, 1, 0, 0, 0],
            },
        ];
    });

    it('should reject reflections >= 90% similar', () => {
        const newReflections = [
            {
                id: 'ref_new_1',
                type: 'reflection',
                character: 'Alice',
                summary: 'Alice struggles with trust issues due to past betrayal',
                // 95% similar to ref_001: cos([1,0,0], [0.95,0.31,0]) = 0.95
                embedding: [0.95, 0.31, 0, 0, 0],
            },
        ];

        const result = filterDuplicateReflections(newReflections, existingMemories);

        expect(result.toAdd).toHaveLength(0);
        expect(result.toArchiveIds).toHaveLength(0);
    });

    it('should replace reflections 80-89% similar', () => {
        const newReflections = [
            {
                id: 'ref_new_2',
                type: 'reflection',
                character: 'Alice',
                summary: 'Alice has deep trust problems because of previous betrayal',
                // 85% similar to ref_001: cos([1,0,0], [0.85,0.53,0]) = 0.85
                embedding: [0.85, 0.53, 0, 0, 0],
            },
        ];

        const result = filterDuplicateReflections(newReflections, existingMemories);

        expect(result.toAdd).toHaveLength(1);
        expect(result.toArchiveIds).toEqual(['ref_001']);
    });

    it('should add reflections < 80% similar', () => {
        const newReflections = [
            {
                id: 'ref_new_3',
                type: 'reflection',
                character: 'Alice',
                summary: 'Alice enjoys painting landscapes',
                // 70% similar to ref_001: cos([1,0,0], [0.7,0.71,0]) = 0.70
                embedding: [0.7, 0.71, 0, 0, 0],
            },
        ];

        const result = filterDuplicateReflections(newReflections, existingMemories);

        expect(result.toAdd).toHaveLength(1);
        expect(result.toArchiveIds).toHaveLength(0);
    });

    it('should handle reflections without embeddings by passing them through', () => {
        const newReflections = [
            {
                id: 'ref_new_no_emb',
                type: 'reflection',
                character: 'Alice',
                summary: 'A reflection without embedding',
                // No embedding field
            },
        ];

        const result = filterDuplicateReflections(newReflections, existingMemories);

        expect(result.toAdd).toHaveLength(1);
        expect(result.toArchiveIds).toHaveLength(0);
    });

    it('should use custom thresholds when provided', () => {
        const newReflections = [
            {
                id: 'ref_new_custom',
                type: 'reflection',
                character: 'Alice',
                summary: 'Custom threshold test',
                // 88% similar - should be rejected with 0.85 threshold, replaced with 0.80
                embedding: [0.88, 0.47, 0, 0, 0],
            },
        ];

        // With 0.85 reject threshold, 88% should be rejected
        const result1 = filterDuplicateReflections(newReflections, existingMemories, 0.85, 0.75);
        expect(result1.toAdd).toHaveLength(0);
        expect(result1.toArchiveIds).toHaveLength(0);

        // With 0.90 reject threshold, 88% should trigger replace
        const result2 = filterDuplicateReflections(newReflections, existingMemories, 0.9, 0.8);
        expect(result2.toAdd).toHaveLength(1);
        expect(result2.toArchiveIds).toEqual(['ref_001']);
    });
});
