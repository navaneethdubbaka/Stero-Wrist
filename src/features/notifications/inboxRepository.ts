import type { HermesNotification } from './types';
import { getInboxDb } from './inboxDb';
import type {
  DeliveryStatus,
  InboxFilter,
  InboxListOptions,
  InboxNotification,
  UpsertIncomingResult,
} from './inboxTypes';

type InboxRow = {
  notification_id: string;
  title: string;
  message: string;
  priority: string;
  source: string | null;
  timestamp: string;
  dedupe_key: string | null;
  delivery_status: string;
  spoken: number;
  acknowledged: number;
  dismissed: number;
  remind_at: string | null;
  is_batch: number;
  batch_id: string | null;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: InboxRow): InboxNotification {
  return {
    notificationId: row.notification_id,
    title: row.title,
    message: row.message,
    priority: row.priority as InboxNotification['priority'],
    source: row.source,
    timestamp: row.timestamp,
    dedupeKey: row.dedupe_key,
    deliveryStatus: row.delivery_status as DeliveryStatus,
    spoken: row.spoken === 1,
    acknowledged: row.acknowledged === 1,
    dismissed: row.dismissed === 1,
    remindAt: row.remind_at,
    isBatch: row.is_batch === 1,
    batchId: row.batch_id,
    rawJson: row.raw_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getById(
  notificationId: string,
): Promise<InboxNotification | null> {
  const db = await getInboxDb();
  const row = await db.getFirstAsync<InboxRow>(
    'SELECT * FROM inbox_notifications WHERE notification_id = ?',
    [notificationId],
  );
  return row ? mapRow(row) : null;
}

async function findByDedupeKey(
  dedupeKey: string,
): Promise<InboxNotification | null> {
  const db = await getInboxDb();
  const row = await db.getFirstAsync<InboxRow>(
    'SELECT * FROM inbox_notifications WHERE dedupe_key = ? LIMIT 1',
    [dedupeKey],
  );
  return row ? mapRow(row) : null;
}

/**
 * Insert or update. Duplicate by notification_id or dedupe_key → isDuplicate true
 * (update fields; caller must not re-speak).
 */
export async function upsertIncoming(
  note: HermesNotification,
  options?: { dedupeKey?: string | null; raw?: unknown },
): Promise<UpsertIncomingResult> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  const timestamp = note.timestamp || now;
  const dedupeKey = options?.dedupeKey?.trim() || null;
  const rawJson =
    options?.raw !== undefined ? JSON.stringify(options.raw) : JSON.stringify(note);

  const existingById = await getById(note.notification_id);
  let existing = existingById;
  if (!existing && dedupeKey) {
    existing = await findByDedupeKey(dedupeKey);
  }

  if (existing) {
    await db.runAsync(
      `UPDATE inbox_notifications SET
        title = ?, message = ?, priority = ?, source = ?,
        timestamp = ?, dedupe_key = COALESCE(?, dedupe_key),
        raw_json = ?, updated_at = ?
       WHERE notification_id = ?`,
      [
        note.title,
        note.message,
        note.priority,
        note.source ?? null,
        timestamp,
        dedupeKey,
        rawJson,
        now,
        existing.notificationId,
      ],
    );
    const row = (await getById(existing.notificationId))!;
    return { isDuplicate: true, row };
  }

  await db.runAsync(
    `INSERT INTO inbox_notifications (
      notification_id, title, message, priority, source, timestamp, dedupe_key,
      delivery_status, spoken, acknowledged, dismissed, remind_at,
      is_batch, batch_id, raw_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 0, 0, 0, NULL, 0, NULL, ?, ?, ?)`,
    [
      note.notification_id,
      note.title,
      note.message,
      note.priority,
      note.source ?? null,
      timestamp,
      dedupeKey,
      rawJson,
      now,
      now,
    ],
  );

  const row = (await getById(note.notification_id))!;
  return { isDuplicate: false, row };
}

export function matchesInboxFilter(
  row: InboxNotification,
  filter: InboxFilter,
): boolean {
  switch (filter) {
    case 'all':
      return !row.dismissed;
    case 'critical':
    case 'high':
    case 'normal':
    case 'low':
      return !row.dismissed && row.priority === filter;
    case 'unread':
      return !row.dismissed && !row.acknowledged;
    case 'acknowledged':
      return !row.dismissed && row.acknowledged;
    default:
      return true;
  }
}

export function matchesInboxQuery(
  row: InboxNotification,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.title.toLowerCase().includes(q) ||
    row.message.toLowerCase().includes(q) ||
    (row.source?.toLowerCase().includes(q) ?? false) ||
    row.notificationId.toLowerCase().includes(q)
  );
}

export async function listInbox(
  options: InboxListOptions = {},
): Promise<InboxNotification[]> {
  const db = await getInboxDb();
  const limit = options.limit ?? 200;
  const rows = await db.getAllAsync<InboxRow>(
    `SELECT * FROM inbox_notifications
     ORDER BY timestamp DESC, created_at DESC
     LIMIT ?`,
    [limit * 3],
  );
  const filter = options.filter ?? 'all';
  const query = options.query ?? '';
  return rows
    .map(mapRow)
    .filter((r) => matchesInboxFilter(r, filter))
    .filter((r) => matchesInboxQuery(r, query))
    .slice(0, limit);
}

export async function listRecentSpokenIds(limit = 200): Promise<string[]> {
  const db = await getInboxDb();
  const rows = await db.getAllAsync<{ notification_id: string }>(
    `SELECT notification_id FROM inbox_notifications
     WHERE spoken = 1
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.notification_id);
}

export async function markSpoken(notificationId: string): Promise<void> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inbox_notifications SET spoken = 1, delivery_status = 'spoken', updated_at = ?
     WHERE notification_id = ?`,
    [now, notificationId],
  );
}

export async function setDeliveryStatus(
  notificationId: string,
  status: DeliveryStatus,
): Promise<void> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inbox_notifications SET delivery_status = ?, updated_at = ?
     WHERE notification_id = ?`,
    [status, now, notificationId],
  );
}

export async function acknowledge(notificationId: string): Promise<void> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inbox_notifications SET acknowledged = 1, delivery_status = 'acked', updated_at = ?
     WHERE notification_id = ?`,
    [now, notificationId],
  );
}

export async function dismiss(notificationId: string): Promise<void> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inbox_notifications SET dismissed = 1, delivery_status = 'dismissed', updated_at = ?
     WHERE notification_id = ?`,
    [now, notificationId],
  );
}

export async function setRemindAt(
  notificationId: string,
  remindAt: string,
): Promise<void> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE inbox_notifications SET remind_at = ?, updated_at = ?
     WHERE notification_id = ?`,
    [remindAt, now, notificationId],
  );
}

export async function countUnackedBySourceSince(
  source: string,
  sinceIso: string,
): Promise<InboxNotification[]> {
  const db = await getInboxDb();
  const rows = await db.getAllAsync<InboxRow>(
    `SELECT * FROM inbox_notifications
     WHERE source = ?
       AND is_batch = 0
       AND acknowledged = 0
       AND dismissed = 0
       AND timestamp >= ?
     ORDER BY timestamp ASC`,
    [source, sinceIso],
  );
  return rows.map(mapRow);
}

export async function upsertBatchSummary(options: {
  batchId: string;
  source: string;
  count: number;
  childIds: string[];
  priority: InboxNotification['priority'];
}): Promise<InboxNotification> {
  const db = await getInboxDb();
  const now = new Date().toISOString();
  const existing = await getById(options.batchId);
  const title = `${options.count} alerts from ${options.source}`;
  const message = options.childIds
    .slice(0, 5)
    .map((id) => `• ${id}`)
    .join('\n');

  if (existing) {
    await db.runAsync(
      `UPDATE inbox_notifications SET title = ?, message = ?, priority = ?, updated_at = ?
       WHERE notification_id = ?`,
      [title, message, options.priority, now, options.batchId],
    );
  } else {
    await db.runAsync(
      `INSERT INTO inbox_notifications (
        notification_id, title, message, priority, source, timestamp, dedupe_key,
        delivery_status, spoken, acknowledged, dismissed, remind_at,
        is_batch, batch_id, raw_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'received', 0, 0, 0, NULL, 1, NULL, NULL, ?, ?)`,
      [
        options.batchId,
        title,
        message,
        options.priority,
        options.source,
        now,
        now,
        now,
      ],
    );
  }

  for (const childId of options.childIds) {
    await db.runAsync(
      `UPDATE inbox_notifications SET batch_id = ?, updated_at = ? WHERE notification_id = ?`,
      [options.batchId, now, childId],
    );
  }

  return (await getById(options.batchId))!;
}
