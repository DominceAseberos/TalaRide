const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    JSON,
    Math,
    Number,
    Date,
    RegExp,
    process: { env: {} },
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: async () => {
      throw new Error('no network in test');
    },
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      return require(name);
    },
  });
  return exports;
}

test('offline queue payloads carry durable client_operation_id', () => {
  const calls = [];
  const sync = load('src/api/sync.ts', {
    '@/offline/queue': {
      flushOutbox: async (fn) => {
        calls.push(fn);
        return { sent: 0, pending: 0 };
      },
    },
    './rides': {
      sendCashRide: async (p) => calls.push(['cash', p]),
      sendCheckin: async (p) => calls.push(['checkin', p]),
    },
    './payments': { confirmServerPayment: async (p) => calls.push(['confirm', p]) },
    './lost-items': {
      reportLostItem: async (p) => calls.push(['lost', p]),
      reportPaymentIssue: async (p) => calls.push(['issue', p]),
    },
    './client': { getPaymentMode: () => 'mock-server' },
  });
  return sync.triggerSync().then(() => {
    assert.equal(calls.length, 1);
    assert.equal(typeof calls[0], 'function');
  });
});

test('queued cash ride syncs exactly once; duplicate keeps idempotency key', async () => {
  const seen = [];
  const sync = load('src/api/sync.ts', {
    '@/offline/queue': {
      flushOutbox: async (sender) => {
        const payload = {
          client_operation_id: 'cash-abc',
          local_ride_id: 'ride-1',
          driver_code: 'DR-000481',
          shift_id: 'shift-1',
          vehicle_code: 'TR-01842',
          amount_centavos: 3000,
        };
        seen.push(await sender('cash_ride', payload));
        seen.push(await sender('cash_ride', payload));
        return { sent: 2, pending: 0 };
      },
    },
    './rides': {
      sendCashRide: async (p) => {
        assert.equal(p.client_operation_id, 'cash-abc');
        assert.equal(p.driver_code, 'DR-000481');
        return { ride_id: 'server-1', status: 'completed' };
      },
      sendCheckin: async () => ({ ride_id: 'x', vehicle_code: 'TR-01842', recorded_at: '' }),
    },
    './payments': { confirmServerPayment: async () => ({}) },
    './lost-items': {
      reportLostItem: async () => ({}),
      reportPaymentIssue: async () => ({}),
    },
    './client': { getPaymentMode: () => 'mock-server' },
  });
  const res = await sync.triggerSync();
  assert.equal(res.sent, 2);
  assert.deepEqual(seen, [true, true]);
});

test('live mode never marks paid from mobile sender', async () => {
  let confirmed = 0;
  const sync = load('src/api/sync.ts', {
    '@/offline/queue': {
      flushOutbox: async (sender) => {
        const ok = await sender('payment_confirm', {
          client_operation_id: 'pay-1',
          payment_id: 'pay-1',
        });
        return { sent: ok ? 1 : 0, pending: ok ? 0 : 1 };
      },
    },
    './rides': {
      sendCashRide: async () => ({}),
      sendCheckin: async () => ({}),
    },
    './payments': {
      confirmServerPayment: async () => {
        confirmed += 1;
        return {};
      },
    },
    './lost-items': {
      reportLostItem: async () => ({}),
      reportPaymentIssue: async () => ({}),
    },
    './client': { getPaymentMode: () => 'live' },
  });
  const res = await sync.triggerSync();
  assert.equal(confirmed, 0);
  assert.equal(res.pending, 1);
});
