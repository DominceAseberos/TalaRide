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
    Uint8ClampedArray,
    process: { env: {} },
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      return require(name);
    },
  });
  return exports;
}

// Rasterize a QR matrix into RGBA pixels (quiet zone + scale), no canvas needed.
function rasterize(text, scale = 6) {
  const qrcode = require('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const size = (count + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < count; y += 1)
    for (let x = 0; x < count; x += 1)
      if (qr.isDark(y, x))
        for (let dy = 0; dy < scale; dy += 1)
          for (let dx = 0; dx < scale; dx += 1) {
            const px = (x + quiet) * scale + dx;
            const py = (y + quiet) * scale + dy;
            const i = (py * size + px) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
            data[i + 3] = 255;
          }
  return { data, width: size, height: size };
}

test('uploaded vehicle sticker QR decodes end-to-end without camera', () => {
  const { decodeQrFromPixels } = load('src/scan/decodeImage.ts', {
    'react-native': { Platform: { OS: 'web' } },
    jsqr: require('jsqr'),
  });
  const { buildVehicleQrUrl } = load('../packages/shared/src/qr.ts');
  const url = buildVehicleQrUrl('https://web.talaride.ph/v', 'TR-01842', 'ab12');
  const { data, width, height } = rasterize(url);
  assert.equal(decodeQrFromPixels(data, width, height), url);
});

test('uploaded dynamic payment QR decodes and parses', () => {
  const { decodeQrFromPixels } = load('src/scan/decodeImage.ts', {
    'react-native': { Platform: { OS: 'web' } },
    jsqr: require('jsqr'),
  });
  const shared = load('../packages/shared/src/qr.ts');
  const payload = shared.buildDynamicQrPayload(
    {
      payment_id: 'pay-e2e-1',
      ride_id: 'ride-e2e-1',
      vehicle_code: 'TR-01842',
      amount_centavos: 3000,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      nonce: 'e2e123',
    },
    'sig-e2e',
  );
  const { data, width, height } = rasterize(payload);
  const parsed = shared.parseDynamicQr(decodeQrFromPixels(data, width, height));
  assert.equal(parsed.payment_id, 'pay-e2e-1');
  assert.equal(parsed.amount_centavos, 3000);
});

test('non-QR image rejected with clear error', () => {
  const { decodeQrFromPixels } = load('src/scan/decodeImage.ts', {
    'react-native': { Platform: { OS: 'web' } },
    jsqr: require('jsqr'),
  });
  const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
  assert.throws(() => decodeQrFromPixels(blank, 100, 100), /No QR code/);
});
