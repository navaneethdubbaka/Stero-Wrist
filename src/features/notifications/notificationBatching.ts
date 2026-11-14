import type { InboxNotification } from './inboxTypes';
import {
  countUnackedBySourceSince,
  upsertBatchSummary,
} from './inboxRepository';

export const BATCH_WINDOW_MS = 10 * 60 * 1000;
export const BATCH_THRESHOLD = 3;

/**
 * Pure helper: should we create/update a batch summary for this source group?
 */
export function shouldCreateBatch(count: number, threshold = BATCH_THRESHOLD): boolean {
  return count >= threshold;
}

export function batchIdForSource(source: string, windowStartIso: string): string {
  return `batch:${source}:${windowStartIso}`;
}

/**
 * After a new non-batch item is upserted, maybe create a summary row.
 * Summary does not auto-speak.
 */
export async function maybeBatchAfterInsert(
  row: InboxNotification,
): Promise<InboxNotification | null> {
  if (row.isBatch || !row.source?.trim()) return null;

  const since = new Date(Date.now() - BATCH_WINDOW_MS).toISOString();
  const peers = await countUnackedBySourceSince(row.source, since);
  if (!shouldCreateBatch(peers.length)) return null;

  const windowStart = peers[0]?.timestamp ?? since;
  const batchId = batchIdForSource(row.source, windowStart.slice(0, 16));
  const priorities = peers.map((p) => p.priority);
  const priority =
    priorities.includes('critical')
      ? 'critical'
      : priorities.includes('high')
        ? 'high'
        : priorities.includes('normal')
          ? 'normal'
          : 'low';

  return upsertBatchSummary({
    batchId,
    source: row.source,
    count: peers.length,
    childIds: peers.map((p) => p.notificationId),
    priority,
  });
}
