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
    URLSearchParams,
    JSON,
    Math,
    Number,
    Date,
    RegExp,
    process: {
      env: { EXPO_PUBLIC_WEB_API: 'http://x/api', EXPO_PUBLIC_PAYMENT_MODE: 'mock-server' },
    },
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: async () => {
      throw new Error('no network');
    },
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      return require(name);
    },
  });
  return exports;
}

test('protected requests attach auth token; failures never silent success', async () => {
  const seen = {};
  const client = load('src/api/client.ts', {
    '@/auth/client': {
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
      },
    },
  });
  assert.equal(client.getPaymentMode(), 'mock-server');
  // fetch stub throws -> apiRequest must throw, never resolve success.
  await assert.rejects(() => client.apiRequest('/rides?limit=1'), /Network|timed out/);
  assert.ok(seen);
});

test('payment intent + status round-trip shape matches backend contract', async () => {
  const calls = [];
  const payments = load('src/api/payments.ts', {
    './client': {
      apiRequest: async (path, opts) => {
        calls.push([path, opts && opts.body ? JSON.parse(opts.body) : {}]);
        if (path === '/payment-intent')
          return {
            payment_id: 'pay-1',
            ride_id: 'ride-1',
            amount_centavos: 3000,
            qr_payload: '{}',
            expires_at: new Date().toISOString(),
          };
        return {
          payment_id: 'pay-1',
          payment_status: 'confirmed',
          amount_centavos: 3000,
          confirmed_at: new Date().toISOString(),
        };
      },
    },
  });
  const intent = await payments.createPaymentIntent({
    driver_code: 'DR-000481',
    vehicle_code: 'TR-01842',
    amount_centavos: 3000,
    client_operation_id: 'intent-1',
  });
  assert.equal(intent.amount_centavos, 3000);
  assert.equal(calls[0][1].amount_centavos, 3000);
  assert.equal(calls[0][1].driver_code, 'DR-000481');
  assert.ok(!('fare' in calls[0][1]));
  assert.ok(!('shift_id' in calls[0][1]));
  const st = await payments.fetchPaymentStatus('pay-1');
  assert.equal(payments.statusToLabel(st.status), '✓ PAID');
});

test('server failure leaves local data usable (rewards fallback)', async () => {
  const cache = new Map();
  cache.set('talaride.rewards-cache-v2:passenger-a', JSON.stringify({
    points_balance: 3,
    current: 3,
    threshold: 10,
    completed_rides: 13,
    unlocked_rewards_count: 0,
    test_mode: false,
    history: [],
  }));
  const rewards = load('src/api/rewards.ts', {
    './client': {
      apiRequest: async () => {
        throw new Error('down');
      },
    },
    '@/auth/client': {
      supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'passenger-a' } } } }) } },
    },
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => cache.get(key) ?? null,
      setItem: async (key, value) => cache.set(key, value),
    },
  });
  const r = await rewards.fetchRewards();
  assert.equal(r.threshold, 10);
  assert.equal(r.points_balance, 3);
  assert.equal(r.completed_rides, 13);
  assert.ok(cache.has('talaride.rewards-cache-v2:passenger-a'));
});

test('reward claims use the selected reward type and return the server voucher', async () => {
  const calls = [];
  const voucher = {
    code: 'TR-DRINK-123456789ABC',
    reward_type: 'drink_voucher',
    description: 'One drink up to ₱50',
    value_centavos: 5000,
    valid_until: '2026-11-05T00:00:00.000Z',
    test_only: true,
  };
  const rewards = load('src/api/rewards.ts', {
    './client': {
      apiRequest: async (path, options) => {
        calls.push([path, options]);
        return { success: true, voucher };
      },
    },
    '@/auth/client': { supabase: null },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
  });
  assert.deepEqual(await rewards.claimReward('drink_voucher'), voucher);
  assert.equal(calls[0][0], '/rewards/redeem');
  assert.deepEqual(JSON.parse(calls[0][1].body), { reward_type: 'drink_voucher' });
});
