import * as SQLite from 'expo-sqlite';

const DB_NAME = 'stero_inbox.db';
const DATABASE_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS inbox_notifications (
      notification_id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL,
      source TEXT,
      timestamp TEXT NOT NULL,
      dedupe_key TEXT,
      delivery_status TEXT NOT NULL,
      spoken INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      remind_at TEXT,
      is_batch INTEGER NOT NULL DEFAULT 0,
      batch_id TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_dedupe_key
      ON inbox_notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inbox_priority ON inbox_notifications(priority);
    CREATE INDEX IF NOT EXISTS idx_inbox_acked ON inbox_notifications(acknowledged);
    CREATE INDEX IF NOT EXISTS idx_inbox_spoken ON inbox_notifications(spoken);
    CREATE INDEX IF NOT EXISTS idx_inbox_source_ts ON inbox_notifications(source, timestamp);
    PRAGMA user_version = ${DATABASE_VERSION};
  `);
}

export async function getInboxDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}
