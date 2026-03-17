import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/constants.js';

describe('defaultSettings', () => {
  const REMOVED_KEYS = [
    'reflectionDedupThreshold',
    'entityDescriptionCap',
    'edgeDescriptionCap',
    'communityStalenessThreshold',
    'combinedBoostWeight',
    'forgetfulnessImportance5Floor',
    'entityMergeSimilarityThreshold',
    'reflectionDecayThreshold',
  ];

  it.each(REMOVED_KEYS)('should not contain removed key: %s', (key) => {
    expect(defaultSettings).not.toHaveProperty(key);
  });

  it('should still contain essential user-facing settings', () => {
    expect(defaultSettings).toHaveProperty('enabled');
    expect(defaultSettings).toHaveProperty('extractionTokenBudget');
    expect(defaultSettings).toHaveProperty('reflectionThreshold');
    expect(defaultSettings).toHaveProperty('alpha');
  });
});
