// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('structured.js schema imports', () => {
    let structured;

    beforeEach(async () => {
        // Reset modules to get fresh imports
        vi.resetModules();
        await global.registerCdnOverrides?.();
        structured = await import('../../src/extraction/structured.js');
    });

    it('should export EntitySchema with .catch() fallbacks', () => {
        expect(structured.EntitySchema).toBeDefined();

        // Should accept valid entity
        const valid = { name: 'Alice', type: 'PERSON', description: 'A person' };
        const validResult = structured.EntitySchema.safeParse(valid);
        expect(validResult.success).toBe(true);

        // Should FALLBACK on invalid (empty name) due to .catch()
        const invalid = { name: '', type: 'PERSON', description: 'A person' };
        const fallbackResult = structured.EntitySchema.safeParse(invalid);
        expect(fallbackResult.success).toBe(true);
        expect(fallbackResult.data.name).toBe('Unknown');
    });

    it('should export RelationshipSchema with .catch() fallbacks', () => {
        expect(structured.RelationshipSchema).toBeDefined();

        // Should accept valid relationship
        const valid = { source: 'Alice', target: 'Bob', description: 'Friends' };
        const validResult = structured.RelationshipSchema.safeParse(valid);
        expect(validResult.success).toBe(true);

        // Should FALLBACK on invalid due to .catch()
        const invalid = { source: '', target: '', description: '' };
        const fallbackResult = structured.RelationshipSchema.safeParse(invalid);
        expect(fallbackResult.success).toBe(true);
        expect(fallbackResult.data.source).toBe('Unknown');
    });

    it('should re-export EventSchema from store/schemas.js', () => {
        expect(structured.EventSchema).toBeDefined();
    });

    it('should re-export EventExtractionSchema', () => {
        expect(structured.EventExtractionSchema).toBeDefined();
    });
});
