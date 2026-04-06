// @ts-check
import { beforeAll, describe, expect, it } from 'vitest';

describe('schemas', () => {
    let schemas;

    beforeAll(async () => {
        schemas = await import('../../src/store/schemas.js');
    });

    describe('MemorySchema', () => {
        it('should export MemorySchema', () => {
            expect(schemas.MemorySchema).toBeDefined();
        });

        it('should validate a valid memory object', () => {
            const validMemory = {
                id: 'abc123',
                summary: 'Test memory summary',
                importance: 3,
                message_id: 100,
                timestamp: Date.now(),
                tokens: ['test', 'memori'],
            };

            const result = schemas.MemorySchema.safeParse(validMemory);
            expect(result.success).toBe(true);
        });

        it('should reject invalid importance values', () => {
            const invalidMemory = {
                id: 'abc123',
                summary: 'Test memory summary',
                importance: 10, // Invalid: max is 5
                message_id: 100,
                timestamp: Date.now(),
                tokens: ['test'],
            };

            const result = schemas.MemorySchema.safeParse(invalidMemory);
            expect(result.success).toBe(false);
        });
    });

    describe('GraphNodeSchema', () => {
        it('should export GraphNodeSchema', () => {
            expect(schemas.GraphNodeSchema).toBeDefined();
        });

        it('should validate a valid graph node', () => {
            const validNode = {
                name: 'Alice',
                type: 'PERSON',
                description: 'A test character',
                mentions: 5,
            };

            const result = schemas.GraphNodeSchema.safeParse(validNode);
            expect(result.success).toBe(true);
        });
    });

    describe('GraphEdgeSchema', () => {
        it('should export GraphEdgeSchema', () => {
            expect(schemas.GraphEdgeSchema).toBeDefined();
        });

        it('should validate a valid graph edge', () => {
            const validEdge = {
                source: 'alice',
                target: 'bob',
                description: 'Friends',
                weight: 3,
            };

            const result = schemas.GraphEdgeSchema.safeParse(validEdge);
            expect(result.success).toBe(true);
        });
    });

    describe('BaseEntitySchema', () => {
        it('should export BaseEntitySchema', () => {
            expect(schemas.BaseEntitySchema).toBeDefined();
        });

        it('should validate a valid entity without .catch fallbacks', () => {
            const validEntity = {
                name: 'Castle',
                type: 'PLACE',
                description: 'A medieval castle',
            };

            const result = schemas.BaseEntitySchema.safeParse(validEntity);
            expect(result.success).toBe(true);
        });

        it('should reject empty name without fallback', () => {
            const invalidEntity = {
                name: '',
                type: 'PLACE',
                description: 'A medieval castle',
            };

            const result = schemas.BaseEntitySchema.safeParse(invalidEntity);
            expect(result.success).toBe(false);
        });
    });

    describe('BaseRelationshipSchema', () => {
        it('should export BaseRelationshipSchema', () => {
            expect(schemas.BaseRelationshipSchema).toBeDefined();
        });

        it('should validate a valid relationship without .catch fallbacks', () => {
            const validRel = {
                source: 'Alice',
                target: 'Bob',
                description: 'Friends since childhood',
            };

            const result = schemas.BaseRelationshipSchema.safeParse(validRel);
            expect(result.success).toBe(true);
        });
    });

    describe('EventSchema', () => {
        it('should validate events with temporal_anchor and is_transient', () => {
            const validEvent = {
                summary: 'A significant event that took place in the story',
                importance: 3,
                temporal_anchor: 'Friday, June 14, 3:40 PM',
                is_transient: true,
            };
            const result = schemas.EventSchema.safeParse(validEvent);
            expect(result.success).toBe(true);
            expect(result.data.temporal_anchor).toBe('Friday, June 14, 3:40 PM');
            expect(result.data.is_transient).toBe(true);
        });

        it('should default temporal_anchor to null when omitted', () => {
            const eventWithoutTime = {
                summary: 'A significant event that took place in the story',
                importance: 3,
            };
            const result = schemas.EventSchema.safeParse(eventWithoutTime);
            expect(result.success).toBe(true);
            expect(result.data.temporal_anchor).toBeNull();
        });

        it('should default is_transient to false when omitted', () => {
            const eventWithoutTransient = {
                summary: 'A significant event that took place in the story',
                importance: 3,
            };
            const result = schemas.EventSchema.safeParse(eventWithoutTransient);
            expect(result.success).toBe(true);
            expect(result.data.is_transient).toBe(false);
        });
    });

    describe('MemoryUpdateSchema', () => {
        it('should allow updating temporal_anchor and is_transient', () => {
            const validUpdate = {
                temporal_anchor: 'Saturday, June 15, 9:00 AM',
                is_transient: false,
            };
            const result = schemas.MemoryUpdateSchema.safeParse(validUpdate);
            expect(result.success).toBe(true);
        });
    });

    describe('ScoringConfigSchema', () => {
        it('should include transientDecayMultiplier', () => {
            const validConfig = {
                forgetfulnessBaseLambda: 0.05,
                forgetfulnessImportance5Floor: 0.3,
                reflectionDecayThreshold: 0.2,
                reflectionLevelMultiplier: 0.5,
                vectorSimilarityThreshold: 0.3,
                alpha: 0.6,
                combinedBoostWeight: 0.4,
                embeddingSource: 'local',
                transientDecayMultiplier: 5.0,
            };
            const result = schemas.ScoringConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
            expect(result.data.transientDecayMultiplier).toBe(5.0);
        });

        it('should default transientDecayMultiplier when omitted', () => {
            const validConfig = {
                forgetfulnessBaseLambda: 0.05,
                forgetfulnessImportance5Floor: 0.3,
                reflectionDecayThreshold: 0.2,
                reflectionLevelMultiplier: 0.5,
                vectorSimilarityThreshold: 0.3,
                alpha: 0.6,
                combinedBoostWeight: 0.4,
                embeddingSource: 'local',
            };
            const result = schemas.ScoringConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
            expect(result.data.transientDecayMultiplier).toBe(5.0);
        });
    });
});
