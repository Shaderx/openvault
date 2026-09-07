import { afterEach, describe, expect, it } from 'vitest';
import { getArchiveText, rebuildArchiveProjection } from '../../src/archive/archive.js';
import { resetDeps } from '../../src/deps.js';
import { countTokens } from '../../src/utils/tokens.js';

function archiveData(entries) {
    return {
        archives: {
            revision: 1,
            next_sequence: 2,
            rollups: [],
            segments: [
                {
                    id: 'archive-1',
                    sequence: 1,
                    state: 'sealed',
                    active: true,
                    sources: entries.map((entry, index) => ({
                        index: entry.source_end ?? index,
                        fingerprint: `fp-${index}`,
                        role: 'user',
                    })),
                    entries,
                    memory_ids: entries.map((entry) => entry.memory_id),
                    content: '<segment>immutable ledger</segment>',
                    content_hash: 'unused',
                    token_count: 1,
                    prepared_at: 1,
                    sealed_at: 2,
                },
            ],
        },
        diagnostics: { archive: {} },
    };
}

function entry(memory_id, importance, source_end, kind = 'event', summary = `${memory_id} happened`) {
    return {
        memory_id,
        importance,
        source_start: source_end,
        source_end,
        kind,
        summary,
        source_fingerprints: [`fp-${source_end}`],
        witnesses: [],
    };
}

describe('bounded immutable archive projection', () => {
    afterEach(() => resetDeps());

    it('protects five-star entries and drops fallback coverage first', () => {
        setupTestContext({ context: { chat: [] } });
        const data = archiveData([
            entry('critical', 5, 0, 'event', 'A critical durable story fact is preserved.'),
            entry('fallback', 1, 1, 'fallback', 'A very long fallback summary '.repeat(20)),
        ]);
        const projection = rebuildArchiveProjection(data, { archivePromptBudget: 120, bucketMinRepresentation: 0.2 });
        expect(projection.entry_ids).toContain('critical');
        expect(projection.entry_ids).not.toContain('fallback');
        expect(getArchiveText(data)).toContain('critical durable story fact');
        expect(getArchiveText(data)).not.toContain('very long fallback');
    });

    it('represents old, middle, and recent buckets independently of protected tokens', () => {
        setupTestContext({ context: { chat: [] } });
        const entries = [entry('protected', 5, 700, 'event', 'A protected fact.')];
        for (const [bucket, sourceBase] of [
            ['old', 0],
            ['middle', 300],
            ['recent', 700],
        ]) {
            for (let index = 0; index < 5; index++) {
                entries.push(entry(`${bucket}-${index}`, 4, sourceBase + index, 'event', `${bucket} fact ${index}.`));
            }
        }
        const data = archiveData(entries);
        const projection = rebuildArchiveProjection(data, { archivePromptBudget: 250, bucketMinRepresentation: 0.2 });
        for (const bucket of ['old', 'middle', 'recent']) {
            expect(projection.entry_ids.some((id) => id.startsWith(`${bucket}-`))).toBe(true);
        }
    });

    it('renders selected entries in chronological source order', () => {
        setupTestContext({ context: { chat: [] } });
        const data = archiveData([entry('new', 4, 200), entry('old', 4, 0)]);
        const projection = rebuildArchiveProjection(data, { archivePromptBudget: 1000 });
        expect(projection.content.indexOf('old happened')).toBeLessThan(projection.content.indexOf('new happened'));
    });

    it('orders correction entries after earlier history by segment sequence', () => {
        setupTestContext({ context: { chat: [] } });
        const data = archiveData([entry('history', 4, 500)]);
        data.archives.next_sequence = 3;
        data.archives.segments.push({
            id: 'archive-2',
            sequence: 2,
            state: 'sealed',
            active: true,
            sources: [],
            entries: [entry('correction', 5, 0, 'correction', 'Correction follows history.')],
            memory_ids: ['correction'],
        });
        const projection = rebuildArchiveProjection(data, { archivePromptBudget: 1000 });
        expect(projection.content.indexOf('history happened')).toBeLessThan(
            projection.content.indexOf('Correction follows history')
        );
    });

    it('keeps the previous projection when protected entries exceed budget', () => {
        setupTestContext({ context: { chat: [] } });
        const data = archiveData([entry('critical', 5, 0, 'event', 'Critical '.repeat(100))]);
        data.archives.projection = {
            revision: 0,
            budget: 1000,
            entry_ids: ['old'],
            content: '<previous />',
            content_hash: 'unused',
            token_count: 1,
            built_at: 1,
        };
        const previous = data.archives.projection;
        rebuildArchiveProjection(data, { archivePromptBudget: 10 });
        expect(data.archives.projection).toBe(previous);
        expect(data.diagnostics.archive.rollup_required).toBe(true);
    });

    it('counts projection tokens from rendered content', () => {
        setupTestContext({ context: { chat: [] } });
        const data = archiveData([entry('one', 5, 0)]);
        const projection = rebuildArchiveProjection(data, { archivePromptBudget: 1000 });
        expect(projection.token_count).toBe(countTokens(projection.content));
    });
});
