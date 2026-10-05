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
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      return require(name);
    },
  });
  return exports;
}

test('payment intent uses centavos, never float fare', () => {
  const { parsePesoToCentavos } = load('../packages/shared/src/money.ts');
  assert.equal(parsePesoToCentavos('₱30'), 3000);
  assert.equal(parsePesoToCentavos('120'), 12000);
  assert.throws(() => parsePesoToCentavos('30.001'), /Invalid fare/);
});

test('canonical dynamic QR required; QRPH-scheme QR rejected', () => {
  const { parseDynamicQr, DYNAMIC_QR_EXPIRY_SEC } = load('../packages/shared/src/qr.ts');
  assert.equal(DYNAMIC_QR_EXPIRY_SEC, 300);
  const canonical = JSON.stringify({
    v: 1,
    payment_id: 'pay-1',
    ride_id: 'ride-1',
    vehicle_code: 'TR-01842',
    amount_centavos: 3000,
    expires_at: new Date(Date.now() + 60000).toISOString(),
    nonce: 'n1',
    sig: 's',
  });
  assert.equal(parseDynamicQr(canonical).payment_id, 'pay-1');
  assert.throws(
    () => parseDynamicQr(JSON.stringify({ scheme: 'QRPH', paymentId: 'pay-1', amount: 30 })),
    /Invalid payment/,
  );
});

test('expired QR rejected; status labels match contract', () => {
  const qr = load('../packages/shared/src/qr.ts');
  const payments = load('src/api/payments.ts', {
    './client': { apiRequest: async () => ({}) },
  });
  const expired = {
    v: 1,
    payment_id: 'p',
    ride_id: 'r',
    vehicle_code: 'TR-01842',
    amount_centavos: 3000,
    expires_at: new Date(Date.now() - 1000).toISOString(),
    nonce: 'n',
    sig: 's',
  };
  assert.equal(qr.isDynamicQrExpired(expired), true);
  assert.equal(payments.statusToLabel('awaiting_confirmation'), 'WAITING FOR PAYMENT');
  assert.equal(payments.statusToLabel('confirmed'), '✓ PAID');
  assert.equal(payments.statusToLabel('expired'), 'PAYMENT EXPIRED');
  assert.equal(payments.statusToLabel('failed'), 'PAYMENT FAILED');
  assert.equal(payments.statusToLabel('refunded'), 'REFUNDED');
});
