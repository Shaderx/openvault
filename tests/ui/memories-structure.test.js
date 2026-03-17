import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Memories Tab Structure', () => {
  const html = readFileSync(
    resolve(process.cwd(), 'templates/settings_panel.html'),
    'utf-8'
  );

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
