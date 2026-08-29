import { CHAT_LIFECYCLE } from '../../constants.js';

/**
 * V4 deliberately does not translate legacy retrieval state. Old chats must be
 * rebuilt from source messages so immutable archives cannot inherit ambiguous
 * fingerprints or hidden-history gaps.
 * @param {Object} data OpenVault chat data
 * @returns {boolean}
 */
export function migrateToV4(data) {
    data.lifecycle = {
        status: CHAT_LIFECYCLE.NEEDS_REBUILD,
        reason: 'legacy_format',
        detected_at: 0,
    };
    data.archives = { revision: 0, segments: [], next_sequence: 1, rollups: [] };
    data.diagnostics = { archive: {}, volatile: {}, compaction: {}, rebuild: {} };
    return true;
}
