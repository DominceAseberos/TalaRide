import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import type { IdentifierType, Ride } from '@/types/models';

const DATABASE_NAME = 'talaride.db';
const LOCAL_ACCOUNT_KEY = 'talaride.local-account-id';

type RideRow = {
  id: string;
  vehicle_number: string;
  identifier_type: IdentifierType;
  ride_datetime: string;
  note: string;
  location: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function newId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function mapRide(row: RideRow): Ride {
  return {
    id: row.id,
    number: row.vehicle_number,
    identifier: row.identifier_type,
    date: row.ride_datetime,
    note: row.note,
    location: row.location,
  };
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        await db.execAsync(
          'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);',
        );
        const versions = await db.getAllAsync<{ version: number }>(
          'SELECT version FROM schema_migrations',
          [],
        );
        if (versions.some((item) => item.version > 1))
          throw new Error('Unsupported database version.');
        if (!versions.some((item) => item.version === 1))
          await db.withTransactionAsync(async () => {
            await db.execAsync(`
        CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS rides (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          vehicle_number TEXT NOT NULL,
          identifier_type TEXT NOT NULL CHECK (identifier_type IN ('MTOP', 'Body #', 'Plate #')),
          ride_datetime TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS rides_account_date_idx ON rides(account_id, ride_datetime DESC);
        CREATE INDEX IF NOT EXISTS rides_account_vehicle_idx ON rides(account_id, vehicle_number);
        INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
      `);
          });
        return db;
      })
      .catch((error) => {
        databasePromise = undefined;
        throw error;
      });
  }
  return databasePromise;
}

export async function getLocalAccountId() {
  const existing = await AsyncStorage.getItem(LOCAL_ACCOUNT_KEY);
  if (existing) return existing;
  const id = newId('local-account');
  await AsyncStorage.setItem(LOCAL_ACCOUNT_KEY, id);
  return id;
}

export async function initializeRideDatabase() {
  await database();
}

export async function listRides(
  accountId: string,
  search = '',
  identifier: IdentifierType | 'All' = 'All',
) {
  const db = await database();
  const term = `%${search.trim().toUpperCase()}%`;
  const rows = await db.getAllAsync<RideRow>(
    `SELECT id, vehicle_number, identifier_type, ride_datetime, note, location
     FROM rides
     WHERE account_id = ? AND (? = 'All' OR identifier_type = ?)
       AND (vehicle_number LIKE ? OR note LIKE ? OR location LIKE ?)
     ORDER BY ride_datetime DESC, created_at DESC`,
    [accountId, identifier, identifier, term, term, term],
  );
  return rows.map(mapRide);
}

export async function createRide(accountId: string, number: string, identifier: IdentifierType) {
  number = number.trim().toUpperCase();
  if (!accountId || !/^[A-Z0-9][A-Z0-9 -]{0,14}$/.test(number))
    throw new Error('Invalid ride input.');
  const db = await database();
  const now = new Date().toISOString();
  const ride: Ride = { id: newId('ride'), number, identifier, date: now, note: '', location: '' };
  await db.runAsync(
    `INSERT INTO rides (id, account_id, vehicle_number, identifier_type, ride_datetime, note, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ride.id, accountId, ride.number, ride.identifier, ride.date, ride.note, ride.location, now],
  );
  return ride;
}

export async function updateRide(accountId: string, id: string, note: string, location: string) {
  if (note.length > 500 || location.length > 150) throw new Error('Ride details are too long.');
  const db = await database();
  const result = await db.runAsync(
    'UPDATE rides SET note = ?, location = ? WHERE id = ? AND account_id = ?',
    [note, location, id, accountId],
  );
  if (result.changes !== 1) throw new Error('Ride was not found for this account.');
}

export async function deleteRide(accountId: string, id: string) {
  const db = await database();
  const result = await db.runAsync('DELETE FROM rides WHERE id = ? AND account_id = ?', [
    id,
    accountId,
  ]);
  if (result.changes !== 1) throw new Error('Ride was not found for this account.');
}

export async function clearRides(accountId: string) {
  if (!accountId) throw new Error('A signed-in account is required.');
  const db = await database();
  const result = await db.runAsync('DELETE FROM rides WHERE account_id = ?', [accountId]);
  return result.changes;
}
