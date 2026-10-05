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

test('native intent normalizes permanent QR and custom scheme links', () => {
  const nativeIntent = load('src/app/+native-intent.tsx');

  assert.equal(
    nativeIntent.redirectSystemPath({
      path: 'https://talaride-web-frontend.vercel.app/v/TR-01842?c=abc123',
      initial: true,
    }),
    '/ride-confirm?vehicle_code=TR-01842&c=abc123',
  );

  assert.equal(
    nativeIntent.redirectSystemPath({
      path: 'talaride://ride-confirm?vehicle_code=TR-01842&c=abc123',
      initial: true,
    }),
    '/ride-confirm?vehicle_code=TR-01842&c=abc123',
  );

  assert.equal(
    nativeIntent.redirectSystemPath({
      path: 'talaride:///payment-status?payment_id=PAY-123',
      initial: false,
    }),
    '/payment-status?payment_id=PAY-123',
  );
});
