# Fingerprint-Based Message Tracking

**Date**: 2026-03-22
**Status**: Draft
**Scope**: `src/extraction/scheduler.js`, `src/extraction/extract.js`, `src/constants.js`

## Problem

Two issues compound into one bug:

### 1. DRY Violation — Two Tracking Mechanisms

The codebase has two independent systems deciding "is this message already processed?":

- **Scheduler** (worker path): Set-based. `getExtractedMessageIds()` builds a `Set<number>` from `PROCESSED_MESSAGES_KEY` + `memory.message_ids`, then `getUnextractedMessageIds()` checks index membership.
- **Extract.js** (incremental path): Watermark-based. Filters `chat.filter(m.id > data[LAST_PROCESSED_KEY])`.

They serve the same purpose but can disagree when the chat array is modified externally.

### 2. Index Fragility — Array Indices as Message Identity

Both systems store **array indices** as message identifiers. Any extension that splices `context.chat` (deleting, inserting, or reordering messages) makes those stored indices point at wrong messages.

**Concrete example** (InlineSummary extension):

1. OpenVault extracts messages at indices `[0, 1, ..., 37]`, stores them in `PROCESSED_MESSAGES_KEY`
2. InlineSummary summarizes messages 0–20 → deletes 21 messages, inserts 3 summaries
3. Chat shrinks from 100 to 82 messages. All indices after position 2 shift down by 18.
4. Message originally at index 50 is now at index 32
5. `PROCESSED_MESSAGES_KEY` contains `32` (from original processing) → OpenVault thinks index 32 is done
6. The message at new index 32 is a **completely different message** that gets silently skipped

**Note**: Real-time extraction (processing the latest 2 messages after user sends + bot replies) is mostly unaffected — new messages append at the end and their indices don't collide with the processed Set. The breakage affects **backfill** and any situation where stored indices become stale.

### Secondary DRY Issue — `is_system` Filter

- `extract.js` filters `!m.is_system` when selecting candidates
- `scheduler.js` does NOT filter system messages in `getUnextractedMessageIds`

System messages accumulate as "unextracted" in the scheduler's view, inflating batch counts.

## Design

### Core Idea

Replace array indices with **message fingerprints** as identifiers. A fingerprint is derived from stable message properties that don't change when the array is spliced. Use a single `Set<fingerprint>` as the sole source of truth for "has this message been processed?"

### Fingerprint Function

```js
export function getFingerprint(msg) {
    return msg.send_date || '';
}
```

SillyTavern sets `send_date` on every message at creation time (millisecond-precision timestamp string). It never changes when the array is spliced. It's unique per message within a chat.

Fallback to empty string for edge-case messages without `send_date` (shouldn't happen in practice — all user/character messages have it).

### Changes

#### `src/extraction/scheduler.js`

**Remove**: `getExtractedMessageIds(data)` (returns `Set<number>` from indices)

**Add**: `getProcessedFingerprints(data)` — returns `Set<string>` from stored fingerprints:

```js
export function getProcessedFingerprints(data) {
    return new Set(data[PROCESSED_MESSAGES_KEY] || []);
}
```

**Change**: `getUnextractedMessageIds(chat, processedFps)` — check fingerprint membership instead of index membership. Add `is_system` filter:

```js
export function getUnextractedMessageIds(chat, processedFps) {
    const unextracted = [];
    for (let i = 0; i < chat.length; i++) {
        if (!chat[i].is_system && !processedFps.has(getFingerprint(chat[i]))) {
            unextracted.push(i);
        }
    }
    return unextracted;
}
```

**Update callers**: `isBatchReady`, `getNextBatch`, `getBackfillStats`, `getBackfillMessageIds` — all call `getProcessedFingerprints` instead of `getExtractedMessageIds`.

#### `src/extraction/extract.js`

**Remove**: Incremental mode (watermark path). The `if (messageIds) / else` branch in `extractMemories` — always require message IDs from caller:

```js
// BEFORE (two paths):
if (messageIds && messageIds.length > 0) {
    messagesToExtract = messageIds.map(id => ({ id, ...chat[id] })).filter(m => m != null);
} else {
    const lastProcessedId = data[LAST_PROCESSED_KEY] || -1;
    // ... watermark logic ...
}

// AFTER (one path):
messagesToExtract = messageIds.map(id => ({ id, ...chat[id] })).filter(m => m != null);
```

**Remove**: `LAST_PROCESSED_KEY` usage entirely.

**Change**: After processing, store fingerprints instead of indices:

```js
// BEFORE:
data[PROCESSED_MESSAGES_KEY] = data[PROCESSED_MESSAGES_KEY] || [];
data[PROCESSED_MESSAGES_KEY].push(...processedIds);           // indices
data[LAST_PROCESSED_KEY] = Math.max(data[LAST_PROCESSED_KEY] || -1, maxId);

// AFTER:
data[PROCESSED_MESSAGES_KEY] = data[PROCESSED_MESSAGES_KEY] || [];
const processedFps = messages.map(m => getFingerprint(m));
data[PROCESSED_MESSAGES_KEY].push(...processedFps);           // fingerprints
// No LAST_PROCESSED_KEY
```

**Keep unchanged**: `memory.message_ids` — stays as array indices. Used only for:
- `sequence` computation (`minMessageId * 1000 + index`)
- Informational metadata on events

It is **decoupled from tracking**. `getProcessedFingerprints` does NOT read `memory.message_ids`.

#### `src/constants.js`

**Remove**: `LAST_PROCESSED_KEY` export.

### Migration

Auto-detect old index-based format and clear:

```js
// In scheduler.js or extract.js, on data access:
export function migrateProcessedMessages(data) {
    const processed = data[PROCESSED_MESSAGES_KEY];
    if (processed?.length > 0 && typeof processed[0] === 'number') {
        data[PROCESSED_MESSAGES_KEY] = [];
        delete data[LAST_PROCESSED_KEY];
        return true; // migrated
    }
    return false;
}
```

**Cost**: Some messages re-extracted on first run after upgrade. `filterSimilarEvents` (cosine + Jaccard dedup) prevents duplicate memories. One-time, automatic, no user action needed.

### Data Flow (After)

```
new message arrives
  → worker wakes
  → getNextBatch(chat, data, tokenBudget)
      → getProcessedFingerprints(data) → Set<send_date>
      → getUnextractedMessageIds(chat, fps) → [indices of unprocessed messages]
      → accumulate oldest until token budget → return batch indices
  → extractMemories(batch, chatId, { silent: true })
      → process messages via LLM
      → store fingerprints in PROCESSED_MESSAGES_KEY
      → save
  → next iteration: those fingerprints in Set → messages skipped
```

One path. One source of truth. No watermark.

## What Stays Unchanged

- **`memory.message_ids`** — indices, metadata only, not used for tracking
- **Worker loop** — still calls `getNextBatch()` → `extractMemories(batch, ...)`
- **Backfill flow** — still calls `getBackfillMessageIds()` → processes batches
- **Dedup, embeddings, graph, reflections, communities** — untouched
- **UI, settings, prompts** — untouched

## Edge Cases

| Case | Behavior |
|------|----------|
| Extension inserts summary messages | Summary has its own `send_date` → treated as new unprocessed message → extracted if in a batch → dedup catches overlap with already-extracted events |
| Extension deletes messages | Fingerprints of deleted messages stay in Set (dead entries, harmless). No incorrect skipping of other messages. |
| Two messages with identical `send_date` | Extremely unlikely (ms precision in ST). If it happens, second message is skipped. Acceptable risk. |
| Message content edited by user | `send_date` unchanged → stays "processed". Same behavior as before. Correct — the message identity didn't change. |
| Old data with index-based format | Auto-detected (`typeof [0] === 'number'`), cleared. Re-extraction with dedup. One-time cost. |
| `send_date` missing on a message | `getFingerprint` returns `''` → all such messages share a fingerprint → only one gets processed. Edge case for system/injected messages, not user content. |

## Testing Strategy

- **Unit**: `getFingerprint` — returns `send_date`, handles missing
- **Unit**: `getProcessedFingerprints` — builds Set from stored fingerprints
- **Unit**: `getUnextractedMessageIds` — fingerprint checking, `is_system` filtering
- **Unit**: `migrateProcessedMessages` — detects old format, clears indices
- **Unit**: `getNextBatch` / `isBatchReady` / `getBackfillStats` — work with fingerprints
- **Integration**: Simulate chat modified by extension (spliced array), verify correct messages identified as unextracted
- **Regression**: Existing scheduler and extract tests updated for new function signatures

## Files Changed

| File | Nature of Change |
|------|-----------------|
| `src/extraction/scheduler.js` | Add `getFingerprint`, rename `getExtractedMessageIds` → `getProcessedFingerprints`, update `getUnextractedMessageIds` to use fingerprints + `is_system` filter, add `migrateProcessedMessages` |
| `src/extraction/extract.js` | Remove watermark/incremental path, store fingerprints instead of indices, remove `LAST_PROCESSED_KEY` imports/usage |
| `src/constants.js` | Remove `LAST_PROCESSED_KEY` export |
| `tests/scheduler.test.js` | Update for new function signatures and fingerprint-based tracking |
| `tests/extract.test.js` | Update for removed incremental mode, fingerprint storage |
