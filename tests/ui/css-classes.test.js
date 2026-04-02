import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('CSS Classes', () => {
    it('warning banner has red/amber border styling', () => {
        const detailsCss = readFileSync(resolve(process.cwd(), 'css/details.css'), 'utf-8');
        expect(detailsCss).toContain('.openvault-warning-banner');
        expect(detailsCss).toContain('border-left');
    });

    it('payload calculator has color classes', () => {
        const budgetCss = readFileSync(resolve(process.cwd(), 'css/budget.css'), 'utf-8');
        expect(budgetCss).toContain('payload-safe');
        expect(budgetCss).toContain('payload-caution');
        expect(budgetCss).toContain('payload-warning');
        expect(budgetCss).toContain('payload-danger');
    });

    it('defines emergency cut modal classes', () => {
        const dashboardCss = readFileSync(resolve(process.cwd(), 'css/dashboard.css'), 'utf-8');

        // Modal overlay
        expect(dashboardCss).toContain('.openvault-modal');
        expect(dashboardCss).toContain('position: fixed');
        expect(dashboardCss).toContain('z-index: 9999');

        // Hidden state
        expect(dashboardCss).toContain('.openvault-modal.hidden');

        // Button stack
        expect(dashboardCss).toContain('.openvault-button-stack');

        // Danger button
        expect(dashboardCss).toContain('#openvault_emergency_cut_btn');

        // Disabled cancel button
        expect(dashboardCss).toContain('#openvault_emergency_cancel:disabled');
    });
});
