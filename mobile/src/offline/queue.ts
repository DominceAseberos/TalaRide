import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'talaride.db';
let outboxPromise: Promise<SQLite.SQLiteDatabase> | undefined;
const activeFlushes = new Map<string, Promise<{ sent: number; pending: number }>>();

async function db() {
  if (!outboxPromise) {
    outboxPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          owner_id TEXT,
          kind TEXT NOT NULL CHECK (kind IN ('checkin','cash_ride','payment_confirm','payment_issue','lost_report')),
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS outbox_created_idx ON outbox(created_at);`,
      );

      // Add account ownership to databases created by older app versions without
      // deleting their queued work. Legacy owner-less rows remain quarantined and
      // are never submitted under whichever account happens to sign in next.
      const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(outbox)');
      if (!columns.some((column) => column.name === 'owner_id')) {
        await database.execAsync('ALTER TABLE outbox ADD COLUMN owner_id TEXT;');
      }
      await database.execAsync(
        'CREATE INDEX IF NOT EXISTS outbox_owner_created_idx ON outbox(owner_id, created_at);',
      );
      return database;
    });
  }
  return outboxPromise;
}

export type OutboxKind =
  'checkin' | 'cash_ride' | 'payment_confirm' | 'payment_issue' | 'lost_report';

export async function enqueueOutbox(
  ownerId: string,
  id: string,
  kind: OutboxKind,
  payload: unknown,
) {
  if (!ownerId.trim()) throw new Error('Sign in before saving work for synchronization.');
  const database = await db();
  await database.runAsync(
    'INSERT OR REPLACE INTO outbox (id, owner_id, kind, payload, created_at, attempts, last_error) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [id, ownerId, kind, JSON.stringify(payload), new Date().toISOString(), ''],
  );
}

export async function listPendingOutbox(ownerId: string, limit = 50) {
  if (!ownerId.trim()) return [];
  const database = await db();
  return database.getAllAsync<{
    id: string;
    owner_id: string;
    kind: string;
    payload: string;
    created_at: string;
    attempts: number;
  }>(
    'SELECT id, owner_id, kind, payload, created_at, attempts FROM outbox WHERE owner_id = ? ORDER BY created_at ASC LIMIT ?',
    [ownerId, limit],
  );
}

async function removeOutbox(ownerId: string, id: string) {
  const database = await db();
  await database.runAsync('DELETE FROM outbox WHERE owner_id = ? AND id = ?', [ownerId, id]);
}

async function markOutboxError(ownerId: string, id: string, message: string) {
  const database = await db();
  await database.runAsync(
    'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE owner_id = ? AND id = ?',
    [message.slice(0, 300), ownerId, id],
  );
}

async function flushOwnedOutbox(
  ownerId: string,
  send: (kind: OutboxKind, payload: unknown) => Promise<boolean>,
): Promise<{ sent: number; pending: number }> {
  const items = await listPendingOutbox(ownerId);
  let sent = 0;
  for (const item of items) {
    try {
      const ok = await send(item.kind as OutboxKind, JSON.parse(item.payload));
      if (ok) {
        await removeOutbox(ownerId, item.id);
        sent += 1;
      }
    } catch (error) {
      await markOutboxError(
        ownerId,
        item.id,
        error instanceof Error ? error.message : 'Sync failed.',
      );
    }
  }
  const pending = (await listPendingOutbox(ownerId)).length;
  return { sent, pending };
}

// Only one flush per account may run at once. A second caller joins the same
// operation instead of sending the same queued rows concurrently.
export function flushOutbox(
  ownerId: string,
  send: (kind: OutboxKind, payload: unknown) => Promise<boolean>,
): Promise<{ sent: number; pending: number }> {
  if (!ownerId.trim()) return Promise.resolve({ sent: 0, pending: 0 });
  const existing = activeFlushes.get(ownerId);
  if (existing) return existing;
  const running = flushOwnedOutbox(ownerId, send).finally(() => {
    if (activeFlushes.get(ownerId) === running) activeFlushes.delete(ownerId);
  });
  activeFlushes.set(ownerId, running);
  return running;
}
