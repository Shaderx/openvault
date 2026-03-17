// tests/ui/advanced-structure.test.js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Advanced Tab Structure', () => {
  const html = readFileSync(
    resolve(process.cwd(), 'templates/settings_panel.html'),
    'utf-8'
  );

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
