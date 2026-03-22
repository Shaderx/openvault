import { describe, expect, it } from 'vitest';
import { renderPositionBadges } from '../../src/ui/render.js';

describe('position badges', () => {
    it('should render position badges for memory and world', () => {
        const settings = {
            injection: {
                memory: { position: 1 },
                world: { position: 2 },
            },
        };

        const html = renderPositionBadges(settings);
        expect(html).toContain('↓Char');
        expect(html).toContain('↑AN');
    });

    it('should show macro badge for custom position', () => {
        const settings = {
            injection: {
                memory: { position: -1 },
                world: { position: 1 },
            },
        };

        const html = renderPositionBadges(settings);
        expect(html).toContain('{{openvault_memory}}');
    });
});
