import { describe, expect, it } from 'vitest';
import { renderMemoryItem } from '../src/ui/templates.js';

describe('ui/templates', () => {
    describe('renderMemoryItem', () => {
        it('includes reflection badge for reflection memories', () => {
            const memory = {
                id: 'ref_001',
                type: 'reflection',
                summary: 'Alice has grown suspicious',
                importance: 4,
                characters_involved: ['Alice'],
                source_ids: ['ev_001', 'ev_002', 'ev_003'],
                created_at: Date.now(),
            };
            const html = renderMemoryItem(memory);
            expect(html).toContain('fa-lightbulb');
            expect(html).toContain('Reflection');
        });

        it('includes evidence count for reflection with source_ids', () => {
            const memory = {
                id: 'ref_001',
                type: 'reflection',
                summary: 'Alice has grown suspicious',
                importance: 4,
                characters_involved: ['Alice'],
                source_ids: ['ev_001', 'ev_002', 'ev_003'],
                created_at: Date.now(),
            };
            const html = renderMemoryItem(memory);
            expect(html).toContain('3 evidence');
        });

        it('does not include reflection badge for regular events', () => {
            const memory = {
                id: 'ev_001',
                summary: 'Alice entered the room',
                importance: 3,
                characters_involved: ['Alice'],
                created_at: Date.now(),
            };
            const html = renderMemoryItem(memory);
            expect(html).not.toContain('fa-lightbulb');
            expect(html).not.toContain('Reflection');
        });
    });
});
