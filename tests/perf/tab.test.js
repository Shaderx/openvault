import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('perf tab HTML', () => {
    const html = readFileSync(resolve(__dirname, '../../templates/settings_panel.html'), 'utf-8');

    it('has a 5th tab button for perf', () => {
        expect(html).toContain('data-tab="perf"');
    });

    it('has the perf tab content container', () => {
        expect(html).toContain('openvault-tab-content" data-tab="perf"');
    });

    it('has the perf table container', () => {
        expect(html).toContain('id="openvault_perf_table"');
    });

    it('has the clipboard copy button', () => {
        expect(html).toContain('id="openvault_copy_perf_btn"');
    });
});

describe('perf tab CSS', () => {
    const css = readFileSync(resolve(__dirname, '../../css/perf.css'), 'utf-8');

    it('has the perf table base class', () => {
        expect(css).toContain('.openvault-perf-table');
    });

    it('has green and red health indicator classes', () => {
        expect(css).toContain('.openvault-perf-ok');
        expect(css).toContain('.openvault-perf-warn');
    });
});

// =============================================================================
// renderPerfTab Tests
// =============================================================================
import { afterEach, beforeEach } from 'vitest';
import { resetDeps } from '../../src/deps.js';
import { _resetForTest, record } from '../../src/perf/store.js';

describe('renderPerfTab', () => {
    beforeEach(() => {
        // Reset and set up DOM with perf table structure
        document.body.innerHTML = '';
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = `
            <table>
                <tbody id="openvault_perf_tbody"></tbody>
            </table>
            <button id="openvault_copy_perf_btn"></button>
        `;
        document.body.appendChild(tableContainer);

        setupTestContext({
            context: { chatMetadata: { openvault: { memories: [] } } },
            settings: { debugMode: true },
        });
        _resetForTest();
    });

    afterEach(() => {
        resetDeps();
        document.body.innerHTML = '';
    });

    it('renders a row for each recorded metric', async () => {
        record('memory_scoring', 42.5, '100 memories');
        record('llm_events', 5200);

        const { renderPerfTab } = await import('../../src/ui/settings.js');
        renderPerfTab();

        const rows = document.querySelectorAll('#openvault_perf_tbody tr');
        expect(rows.length).toBe(2);
    });

    it('shows green class when value is within threshold', async () => {
        record('memory_scoring', 50); // threshold is 200

        const { renderPerfTab } = await import('../../src/ui/settings.js');
        renderPerfTab();

        const statusCell = document.querySelector('#openvault_perf_tbody .openvault-perf-status');
        expect(statusCell.classList.contains('openvault-perf-ok')).toBe(true);
    });

    it('shows red class when value exceeds threshold', async () => {
        record('memory_scoring', 500); // threshold is 200

        const { renderPerfTab } = await import('../../src/ui/settings.js');
        renderPerfTab();

        const statusCell = document.querySelector('#openvault_perf_tbody .openvault-perf-status');
        expect(statusCell.classList.contains('openvault-perf-warn')).toBe(true);
    });

    it('shows placeholder when no data recorded', async () => {
        const { renderPerfTab } = await import('../../src/ui/settings.js');
        renderPerfTab();

        const tbody = document.getElementById('openvault_perf_tbody');
        expect(tbody.innerHTML).toContain('No perf data');
    });
});
