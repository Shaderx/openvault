import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('World Tab Structure', () => {
  const html = readFileSync(
    resolve(process.cwd(), 'templates/settings_panel.html'),
    'utf-8'
  );

  const worldMatch = html.match(
    /<div class="openvault-tab-content[^"]*" data-tab="world">([\s\S]*?)<div class="openvault-tab-content"/i
  );
  const worldHtml = worldMatch ? worldMatch[1] : '';

  it('has Graph Stats Card at top', () => {
    expect(worldHtml).toContain('openvault_graph_stats');
    const graphStatsIndex = worldHtml.indexOf('openvault_graph_stats');
    const communitiesIndex = worldHtml.indexOf('Communities');
    expect(graphStatsIndex).toBeLessThan(communitiesIndex);
  });

  it('has no visible sliders/inputs for settings', () => {
    // Should not have visible range inputs (they would be in collapsed sections if any)
    const inputMatches = worldHtml.match(/<input[^>]*type="range"/g);
    // If there are any, they must be inside <details> elements
    if (inputMatches) {
      for (const match of inputMatches) {
        const beforeInput = worldHtml.split(match)[0];
        const openDetails = (beforeInput.match(/<details/g) || []).length;
        const closedDetails = (beforeInput.match(/<\/details>/g) || []).length;
        // Input should be inside closed details (not directly visible)
        expect(openDetails).toBeGreaterThan(closedDetails);
      }
    }
  });

  it('has Communities browser', () => {
    expect(worldHtml).toContain('Communities');
    expect(worldHtml).toContain('openvault_community_list');
  });

  it('has Entity browser', () => {
    expect(worldHtml).toContain('Entities');
    expect(worldHtml).toContain('openvault_entity_list');
  });

  it('has entity search and type filter', () => {
    expect(worldHtml).toContain('openvault_entity_search');
    expect(worldHtml).toContain('openvault_entity_type_filter');
  });
});
