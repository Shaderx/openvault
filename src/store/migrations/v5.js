import { CHAT_LIFECYCLE } from '../../constants.js';

/**
 * Archive projections and source attribution are not safely inferable from
 * v4's batch-wide provenance/raw fallback layout. Require a full rebuild and
 * discard only the legacy retrieval/archive representation.
 */
export function migrateToV5(data) {
    data.lifecycle = {
        status: CHAT_LIFECYCLE.NEEDS_REBUILD,
        reason: 'archive_projection_format',
        detected_at: 0,
    };
    data.archives = { revision: 0, segments: [], next_sequence: 1, rollups: [] };
    data.diagnostics = { archive: {}, volatile: {}, compaction: {}, rebuild: {} };
    return true;
}
