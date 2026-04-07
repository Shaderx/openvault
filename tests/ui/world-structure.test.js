import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Tab Structure (Entities + Communities)', () => {
    const html = readFileSync(resolve(process.cwd(), 'templates/settings_panel.html'), 'utf-8');

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
            expect(html).toContain(`<option value="${type}">${type.charAt(0) + type.slice(1).toLowerCase()}</option>`);
        }
    });

    it('does not have invalid entity types', () => {
        const invalidTypes = ['EVENT', 'ORG', 'THING'];
        for (const type of invalidTypes) {
            expect(html).not.toContain(`<option value="${type}">`);
        }
    });
});
