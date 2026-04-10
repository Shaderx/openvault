// tests/ui/structure.test.js

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('UI structure', () => {
    const html = readFileSync(resolve(process.cwd(), 'templates/settings_panel.html'), 'utf-8');

    describe('Dashboard Tab', () => {
        // Extract dashboard tab content
        const dashboardMatch = html.match(
            /<div class="openvault-tab-content[^"]*" data-tab="dashboard-connections">([\s\S]*?)<div class="openvault-tab-content"/i
        );
        const dashboardHtml = dashboardMatch ? dashboardMatch[1] : html;

        it('has Quick Toggles before Connection Settings', () => {
            const quickTogglesIndex = dashboardHtml.indexOf('Quick Toggles');
            const connectionSettingsIndex = dashboardHtml.indexOf('Connection Settings');

            expect(quickTogglesIndex).toBeGreaterThan(-1);
            expect(connectionSettingsIndex).toBeGreaterThan(-1);
            expect(quickTogglesIndex).toBeLessThan(connectionSettingsIndex);
        });

        it('has Emergency Cut button in Extraction Progress card', () => {
            const progressMatch = dashboardHtml.match(
                /Extraction Progress[\s\S]*?<div class="openvault-button-row[^"]*">([\s\S]*?)<\/div>\s*<\/div>/
            );
            expect(progressMatch).toBeTruthy();

            const buttonHtml = progressMatch[1];

            // Emergency Cut button exists
            expect(buttonHtml).toContain('id="openvault_emergency_cut_btn"');
            expect(buttonHtml).toContain('fa-scissors');
            expect(buttonHtml).toContain('Emergency Cut');

            // Has danger styling
            expect(buttonHtml).toContain('danger');

            // Has tooltip explaining purpose
            expect(buttonHtml).toContain('title=');
            expect(buttonHtml).toContain('repetition');
        });

        it('has Emergency Cut modal at correct location', () => {
            // Modal should exist in the HTML
            expect(html).toContain('id="openvault_emergency_cut_modal"');
            expect(html).toContain('openvault-modal-content');
            expect(html).toContain('id="openvault_emergency_cancel"');
        });
    });

    describe('Advanced Tab', () => {
        const advancedMatch = html.match(
            /<div class="openvault-tab-content[^"]*" data-tab="advanced">([\s\S]*?)<div class="openvault-tab-content"/i
        );
        const advancedHtml = advancedMatch ? advancedMatch[1] : '';

        it('has Expert Tuning warning banner at top', () => {
            expect(advancedHtml).toContain('Expert Tuning');
            expect(advancedHtml).toContain('pre-calibrated');
            expect(advancedHtml).toContain('openvault-warning-banner');
        });
    });

    describe('Memories Tab', () => {
        const memoriesMatch = html.match(
            /<div class="openvault-tab-content[^"]*" data-tab="memory-bank">([\s\S]*?)<div class="openvault-tab-content"/i
        );
        const memoriesHtml = memoriesMatch ? memoriesMatch[1] : '';

        it('has Memory Browser before any settings', () => {
            const searchIndex = memoriesHtml.indexOf('openvault_memory_search');
            const firstDetailsIndex = memoriesHtml.indexOf('<details');

            expect(searchIndex).toBeGreaterThan(-1);
            expect(searchIndex).toBeLessThan(firstDetailsIndex);
        });
    });

    describe('Tab Structure (Entities + Communities)', () => {
        it('has Entity browser with search and type filter', () => {
            const entitiesMatch = html.match(
                /<div class="openvault-tab-content[^"]*" data-tab="entities">([\s\S]*?)<div class="openvault-tab-content"/i
            );
            const entitiesHtml = entitiesMatch ? entitiesMatch[1] : '';
            expect(entitiesHtml).toContain('openvault_entity_list');
            expect(entitiesHtml).toContain('openvault_entity_search');
            expect(entitiesHtml).toContain('openvault_entity_type_filter');
            expect(entitiesHtml).toContain('openvault_entity_count');
        });

        it('has Communities browser in its own tab', () => {
            const communitiesMatch = html.match(
                /<div class="openvault-tab-content[^"]*" data-tab="communities">([\s\S]*?)<\/div>\s*<\/div>\s*<!-- =/i
            );
            const communitiesHtml = communitiesMatch ? communitiesMatch[1] : '';
            expect(communitiesHtml).toContain('openvault_community_list');
            expect(communitiesHtml).toContain('openvault_community_count');
        });

        it('has correct entity type options', () => {
            const expectedTypes = ['PERSON', 'PLACE', 'ORGANIZATION', 'OBJECT', 'CONCEPT'];
            for (const type of expectedTypes) {
                expect(html).toContain(
                    `<option value="${type}">${type.charAt(0) + type.slice(1).toLowerCase()}</option>`
                );
            }
        });

        it('does not have invalid entity types', () => {
            const invalidTypes = ['EVENT', 'ORG', 'THING'];
            for (const type of invalidTypes) {
                expect(html).not.toContain(`<option value="${type}">`);
            }
        });
    });
});

// Integration test verifying the complete progressive disclosure structure.
// This test reads the actual HTML template file to verify structure.

describe('Progressive Disclosure Integration', () => {
    const html = readFileSync(resolve(process.cwd(), 'templates/settings_panel.html'), 'utf-8');

    // Helper to extract tab content
    function extractTabContent(tabName) {
        const match = html.match(
            new RegExp(
                `<div class="openvault-tab-content[^"]*" data-tab="${tabName}">([\\s\\S]*?)(?=<div class="openvault-tab-content|</div>\\s*$)`,
                'i'
            )
        );
        return match ? match[1] : '';
    }

    it('Dashboard has Quick Toggles before collapsible sections', () => {
        const dashboardHtml = extractTabContent('dashboard-connections');
        const quickTogglesIndex = dashboardHtml.indexOf('Quick Toggles');
        const detailsIndex = dashboardHtml.indexOf('<details');

        expect(quickTogglesIndex).toBeGreaterThan(-1);
        expect(detailsIndex).toBeGreaterThan(-1);
        expect(quickTogglesIndex).toBeLessThan(detailsIndex);
    });

    it('Memories has browser before settings', () => {
        const memoriesHtml = extractTabContent('memory-bank');
        const searchIndex = memoriesHtml.indexOf('memory_search');
        const detailsIndex = memoriesHtml.indexOf('<details');

        expect(searchIndex).toBeGreaterThan(-1);
        expect(detailsIndex).toBeGreaterThan(-1);
        expect(searchIndex).toBeLessThan(detailsIndex);
    });

    it('Advanced has warning banner', () => {
        const advancedHtml = extractTabContent('advanced');
        expect(advancedHtml).toContain('Expert Tuning');
        expect(advancedHtml).toContain('openvault-warning-banner');
    });
});
