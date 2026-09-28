const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('local ride repository persists, filters, edits, deletes, and isolates accounts offline', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'talaride-test-'));
  const filename = join(directory, 'rides.db');
  let connection = new DatabaseSync(filename);
  const storage = new Map();
  const adapter = {
    withTransactionAsync: async (task) => {
      connection.exec('BEGIN');
      try {
        await task();
        connection.exec('COMMIT');
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    },
    execAsync: async (sql) => connection.exec(sql),
    getAllAsync: async (sql, params) => connection.prepare(sql).all(...params),
    runAsync: async (sql, params) => connection.prepare(sql).run(...params),
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync('src/db/rides.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
      if (name === 'expo-crypto') return { randomUUID };
      if (name === '@react-native-async-storage/async-storage')
        return {
          getItem: async (key) => storage.get(key) ?? null,
          setItem: async (key, value) => storage.set(key, value),
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  try {
    await exports.initializeRideDatabase();
    await exports.initializeRideDatabase();
    const account = await exports.getLocalAccountId();
    assert.equal(await exports.getLocalAccountId(), account);
    assert.equal((await exports.listRides(account)).length, 0);
    const first = await exports.createRide(account, ' ab-123 ', 'Plate #');
    const second = await exports.createRide(account, 'AB-123', 'MTOP');
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.id, first.number);
    await exports.createRide('another-account', 'AB-123', 'Body #');
    assert.equal((await exports.listRides(account)).length, 2);
    assert.equal((await exports.listRides(account, 'ab-123', 'Plate #')).length, 1);
    assert.equal((await exports.listRides(account, "' OR 1=1 --")).length, 0);
    await exports.updateRide(account, first.id, "Passenger's bag", 'Tagum');
    assert.equal((await exports.listRides(account, 'bag'))[0].note, "Passenger's bag");
    await assert.rejects(exports.updateRide('another-account', first.id, 'wrong', ''));
    await assert.rejects(exports.deleteRide('another-account', first.id));
    connection.close();
    connection = new DatabaseSync(filename);
    assert.equal((await exports.listRides(account)).length, 2);
    assert.equal((await exports.listRides(account, 'Tagum'))[0].location, 'Tagum');
    await exports.deleteRide(account, first.id);
    assert.equal((await exports.listRides(account)).length, 1);
    assert.equal((await exports.listRides('another-account')).length, 1);
    assert.equal(await exports.clearRides(account), 1);
    assert.equal((await exports.listRides(account)).length, 0);
    assert.equal((await exports.listRides('another-account')).length, 1);
    await assert.rejects(exports.clearRides(''));
    await assert.rejects(exports.createRide(account, '', 'MTOP'));
  } finally {
    connection.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
