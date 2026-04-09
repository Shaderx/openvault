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

        it('has Status Card visible (not in details)', () => {
            const statusCardMatch = dashboardHtml.match(/openvault-status-card/);
            expect(statusCardMatch).toBeTruthy();

            // Status card should not be inside a details element
            const beforeStatus = dashboardHtml.split('openvault-status-card')[0];
            const detailsOpenCount = (beforeStatus.match(/<details/g) || []).length;
            const detailsCloseCount = (beforeStatus.match(/<\/details>/g) || []).length;
            expect(detailsOpenCount).toBe(detailsCloseCount);
        });

        it('has API Limits section in dashboard', () => {
            expect(dashboardHtml).toContain('API Limits');
            expect(dashboardHtml).toContain('Cloud API Concurrency');
            expect(dashboardHtml).toContain('Backfill RPM');
        });

        it('has collapsible details for Connection Settings', () => {
            expect(dashboardHtml).toContain('<details');
            expect(dashboardHtml).toContain('Connection Settings');
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

        it('has warning banner before any settings', () => {
            const warningIndex = advancedHtml.indexOf('Expert Tuning');
            const firstDetailsIndex = advancedHtml.indexOf('<details');
            expect(warningIndex).toBeLessThan(firstDetailsIndex);
        });

        it('has Scoring & Weights in collapsible details', () => {
            expect(advancedHtml).toContain('Scoring');
            expect(advancedHtml).toContain('Alpha');
        });

        it('has Decay Math section', () => {
            expect(advancedHtml).toContain('Decay');
            expect(advancedHtml).toContain('Lambda');
        });

        it('has Similarity Thresholds section', () => {
            expect(advancedHtml).toContain('Similarity');
            expect(advancedHtml).toContain('Vector Threshold');
        });

        it('renames reset button to clarify scope', () => {
            expect(advancedHtml).toContain('Restore Default Math');
            expect(advancedHtml).toContain('chat memories and connection profiles will not be touched');
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

        it('has Character States section in collapsible details', () => {
            expect(memoriesHtml).toContain('Character States');
            // Should be in a details element after the browser
            const afterBrowser = memoriesHtml.split('openvault_memory_list')[1] || '';
            expect(afterBrowser).toContain('Character States');
            expect(afterBrowser).toContain('<details');
        });

        it('has Extraction & Context section', () => {
            expect(memoriesHtml).toContain('Extraction');
            expect(memoriesHtml).toContain('Batch Size');
            expect(memoriesHtml).toContain('Context Window');
        });

        it('has Reflection Engine section', () => {
            expect(memoriesHtml).toContain('Reflection');
            expect(memoriesHtml).toContain('Threshold');
            expect(memoriesHtml).toContain('Max Insights');
        });

        it('renamed Extraction Token Budget to Extraction Batch Size', () => {
            expect(memoriesHtml).toContain('Extraction Batch Size');
        });
    });

    describe('Tab Structure (Entities + Communities)', () => {
        it('has no World tab', () => {
            expect(html).not.toContain('data-tab="world"');
        });

        it('has Entities tab button', () => {
            expect(html).toContain('data-tab="entities"');
        });

        it('has Communities tab button', () => {
            expect(html).toContain('data-tab="communities"');
        });

        it('has no Graph Stats Card in Entities tab', () => {
            const entitiesMatch = html.match(
                /<div class="openvault-tab-content[^"]*" data-tab="entities">([\s\S]*?)<div class="openvault-tab-content"/i
            );
            const entitiesHtml = entitiesMatch ? entitiesMatch[1] : '';
            expect(entitiesHtml).not.toContain('openvault_graph_stats');
        });

        it('has no visible sliders/inputs in Entities tab', () => {
            const entitiesMatch = html.match(
                /<div class="openvault-tab-content[^"]*" data-tab="entities">([\s\S]*?)<div class="openvault-tab-content"/i
            );
            const entitiesHtml = entitiesMatch ? entitiesMatch[1] : '';
            const inputMatches = entitiesHtml.match(/<input[^>]*type="range"/g);
            if (inputMatches) {
                for (const match of inputMatches) {
                    const beforeInput = entitiesHtml.split(match)[0];
                    const openDetails = (beforeInput.match(/<details/g) || []).length;
                    const closedDetails = (beforeInput.match(/<\/details>/g) || []).length;
                    expect(openDetails).toBeGreaterThan(closedDetails);
                }
            }
        });

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
