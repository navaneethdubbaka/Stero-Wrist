import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AckRecord, DeviceRecord, NotificationRecord, Store } from './types.ts';

export class SqliteStore implements Store {
  private db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS devices (device_token TEXT PRIMARY KEY, platform TEXT NOT NULL, app TEXT NOT NULL, profile_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications (notification_id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, detail TEXT, priority TEXT NOT NULL, speak INTEGER NOT NULL, source TEXT, dedupe_key TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS acks (id INTEGER PRIMARY KEY AUTOINCREMENT, notification_id TEXT NOT NULL, event TEXT NOT NULL, timestamp TEXT NOT NULL, received_at TEXT NOT NULL);`);
  }
  upsertDevice(device: Omit<DeviceRecord, 'created_at' | 'updated_at'>): void {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO devices VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(device_token) DO UPDATE SET platform=excluded.platform, app=excluded.app, profile_id=excluded.profile_id, updated_at=excluded.updated_at`).run(device.device_token, device.platform, device.app, device.profile_id, now, now);
  }
  listDevices(): DeviceRecord[] { return this.db.prepare('SELECT * FROM devices').all() as DeviceRecord[]; }
  saveNotification(notification: Omit<NotificationRecord, 'created_at'>): void {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(notification_id) DO UPDATE SET title=excluded.title,message=excluded.message,detail=excluded.detail,priority=excluded.priority,speak=excluded.speak,source=excluded.source,dedupe_key=excluded.dedupe_key,created_at=excluded.created_at`).run(notification.notification_id, notification.title, notification.message, notification.detail, notification.priority, notification.speak ? 1 : 0, notification.source, notification.dedupe_key, now);
    this.db.exec('DELETE FROM notifications WHERE notification_id NOT IN (SELECT notification_id FROM notifications ORDER BY created_at DESC LIMIT 500)');
  }
  getNotification(id: string): NotificationRecord | undefined { const row = this.db.prepare('SELECT * FROM notifications WHERE notification_id = ?').get(id) as (Omit<NotificationRecord, 'speak'> & { speak: number }) | undefined; return row && { ...row, speak: Boolean(row.speak) }; }
  recordAck(ack: AckRecord): void { this.db.prepare('INSERT INTO acks (notification_id,event,timestamp,received_at) VALUES (?, ?, ?, ?)').run(ack.notification_id, ack.event, ack.timestamp, ack.received_at); this.db.exec('DELETE FROM acks WHERE id NOT IN (SELECT id FROM acks ORDER BY id DESC LIMIT 1000)'); }
  close(): void { this.db.close(); }
}
