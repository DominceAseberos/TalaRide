const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, require, JSON, Math, Number, Date, RegExp });
  return exports;
}

test('money formats centavos and parses pesos with ₱1 floor', () => {
  const { formatCentavos, parsePesoToCentavos } = load('../../packages/shared/src/money.ts');
  assert.equal(formatCentavos(3000), '₱30');
  assert.equal(formatCentavos(1550), '₱15.50');
  assert.equal(parsePesoToCentavos('₱30'), 3000);
  assert.throws(() => parsePesoToCentavos('0.50'), /Fare/);
});

test('vehicle QR builds and parses offline, rejects bad checksum', () => {
  const { buildVehicleQrUrl, parseVehicleQr } = load('../../packages/shared/src/qr.ts');
  const url = buildVehicleQrUrl('https://talaride.ph/v', 'TR-01842', 'ab12');
  assert.equal(url, 'https://talaride.ph/v/TR-01842?c=ab12');
  assert.equal(parseVehicleQr(url).vehicle_code, 'TR-01842');
  assert.throws(() => parseVehicleQr('hello'), /vehicle/i);
  assert.throws(() => parseVehicleQr('TR-01842'), /checksum/i);
});

test('dynamic QR parses, detects expiry and intent string stable', () => {
  const { parseDynamicQr, isDynamicQrExpired, dynamicIntentString } = load(
    '../../packages/shared/src/qr.ts',
  );
  const base = {
    payment_id: 'pay-1',
    ride_id: 'ride-1',
    vehicle_code: 'TR-01842',
    amount_centavos: 3000,
    expires_at: new Date(Date.now() + 60000).toISOString(),
    nonce: 'abc123',
    sig: 'deadbeef',
    v: 1,
  };
  const parsed = parseDynamicQr(JSON.stringify(base));
  assert.equal(isDynamicQrExpired(parsed), false);
  assert.ok(dynamicIntentString(base).includes('pay-1|ride-1|TR-01842|3000'));
  const expired = { ...base, expires_at: new Date(Date.now() - 1000).toISOString() };
  assert.equal(isDynamicQrExpired(expired), true);
  assert.throws(() => parseDynamicQr('{}'), /Invalid payment/);
});
