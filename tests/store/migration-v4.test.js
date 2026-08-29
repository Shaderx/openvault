import { describe, expect, it } from 'vitest';
import { migrateToV4 } from '../../src/store/migrations/v4.js';

describe('mandatory v4 rebuild migration', () => {
    it('gates legacy data without activating legacy retrieval', () => {
        const data = { schema_version: 3, memories: [{ id: 'legacy' }], communities: { C0: { summary: 'old' } } };
        expect(migrateToV4(data)).toBe(true);
        expect(data.lifecycle.status).toBe('needs_rebuild');
        expect(data.archives.segments).toEqual([]);
        expect(data.memories).toHaveLength(1);
    });
});
