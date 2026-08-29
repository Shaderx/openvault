// @ts-check

import { cyrb53 } from './embedding-codec.js';

const SEED_A = 0x4f564c54;
const SEED_B = 0x41524348;

/**
 * Synchronous deterministic integrity digest for v4 source and archive data.
 * Two independently seeded 53-bit hashes plus UTF-16 length make accidental
 * collisions materially less likely than the legacy single-number locator.
 */
export function integrityDigest(value) {
    const text = String(value ?? '');
    return `d2-${text.length.toString(36)}-${cyrb53(text, SEED_A).toString(36)}-${cyrb53(text, SEED_B).toString(36)}`;
}
