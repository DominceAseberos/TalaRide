import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'talaride.db';
let outboxPromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function db() {
  if (!outboxPromise) {
    outboxPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('checkin','cash_ride','payment_confirm','payment_issue','lost_report')),
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS outbox_created_idx ON outbox(created_at);`,
      );
      return database;
    });
  }
  return outboxPromise;
}

export type OutboxKind =
  'checkin' | 'cash_ride' | 'payment_confirm' | 'payment_issue' | 'lost_report';

export async function enqueueOutbox(id: string, kind: OutboxKind, payload: unknown) {
  const database = await db();
  await database.runAsync(
    'INSERT OR REPLACE INTO outbox (id, kind, payload, created_at, attempts, last_error) VALUES (?, ?, ?, ?, 0, ?)',
    [id, kind, JSON.stringify(payload), new Date().toISOString(), ''],
  );
}

export async function listPendingOutbox(limit = 50) {
  const database = await db();
  return database.getAllAsync<{
    id: string;
    kind: string;
    payload: string;
    created_at: string;
    attempts: number;
  }>('SELECT id, kind, payload, created_at, attempts FROM outbox ORDER BY created_at ASC LIMIT ?', [
    limit,
  ]);
}

export async function removeOutbox(id: string) {
  const database = await db();
  await database.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function markOutboxError(id: string, message: string) {
  const database = await db();
  await database.runAsync(
    'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    [message.slice(0, 300), id],
  );
}

// Best-effort flush: caller supplies sender; offline failures stay queued.
export async function flushOutbox(
  send: (kind: OutboxKind, payload: unknown) => Promise<boolean>,
): Promise<{ sent: number; pending: number }> {
  const items = await listPendingOutbox();
  let sent = 0;
  for (const item of items) {
    try {
      const ok = await send(item.kind as OutboxKind, JSON.parse(item.payload));
      if (ok) {
        await removeOutbox(item.id);
        sent += 1;
      }
    } catch (error) {
      await markOutboxError(item.id, error instanceof Error ? error.message : 'Sync failed.');
    }
  }
  const remaining = await listPendingOutbox(1);
  void remaining;
  const all = await listPendingOutbox();
  return { sent, pending: all.length };
}
