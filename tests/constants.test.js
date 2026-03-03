import { describe, it, expect } from 'vitest';
import { defaultSettings } from '../src/constants.js';

describe('defaultSettings after smart retrieval removal', () => {
    it('does not contain smartRetrievalEnabled', () => {
        expect(defaultSettings).not.toHaveProperty('smartRetrievalEnabled');
    });

    it('does not contain retrievalProfile', () => {
        expect(defaultSettings).not.toHaveProperty('retrievalProfile');
    });
});
