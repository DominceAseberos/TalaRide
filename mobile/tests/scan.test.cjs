const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test('identifier extraction supports multiple formats and labels without changing OCR characters', () => {
  const { extractIdentifiers } = load('src/scan/identifiers.ts', {});
  assert.deepEqual(
    Array.from(extractIdentifiers('MTOP #1234\nBody No. 12-A\nPlate: ABC 123\nTAGUM\n1234')),
    ['1234', '12-A', 'ABC 123'],
  );
  assert.equal(extractIdentifiers('unreadable\n').length, 0);
  assert.equal(extractIdentifiers('PLATE: AB0-12O')[0], 'AB0-12O');
  assert.ok(
    extractIdentifiers(Array.from({ length: 30 }, (_, i) => `A${i}`).join('\n')).length <= 8,
  );
});

test('web draft releases its temporary blob URL after cancellation or save', () => {
  const { resolveObjectURL } = require('node:buffer');
  const { publishDraft, clearDraft } = load('src/scan/draft.ts', {
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-native': { Platform: { OS: 'web' } },
    'expo-crypto': { randomUUID: () => 'web-draft' },
    'expo-file-system/legacy': { cacheDirectory: null },
  });
  const uri = URL.createObjectURL(new Blob(['temporary image']));
  publishDraft({ uri, candidates: [], message: '' });
  assert.ok(resolveObjectURL(uri));
  clearDraft();
  assert.equal(resolveObjectURL(uri), undefined);
});

test('OCR adapter handles recognition, empty results, native failures, unsupported devices, and web', async () => {
  const identifiers = load('src/scan/identifiers.ts', {});
  let native = {
    isSupported: () => true,
    recognizeText: async () => ({ text: 'MTOP 1234\nPLATE ABC-123' }),
  };
  const platform = { OS: 'android' };
  const { recognizeVehicle } = load('src/scan/ocr.ts', {
    expo: { requireOptionalNativeModule: () => native },
    'react-native': { Platform: platform },
    './identifiers': identifiers,
    './webOcr': { recognizeTextOnWeb: async () => 'PLATE WEB-123' },
  });
  assert.equal((await recognizeVehicle('file:///cache/photo.jpg')).candidates[0], '1234');
  native.recognizeText = async () => ({ text: '' });
  assert.match((await recognizeVehicle('photo')).message, /manually/);
  native.recognizeText = async () => {
    throw new Error('bad image');
  };
  assert.match((await recognizeVehicle('photo')).message, /manually/);
  native.isSupported = () => false;
  assert.equal((await recognizeVehicle('photo')).candidates.length, 0);
  native = null;
  assert.match((await recognizeVehicle('photo')).message, /unavailable/);
  platform.OS = 'web';
  assert.equal((await recognizeVehicle('photo')).candidates[0], 'WEB-123');
});

test('photo lifecycle deletes only cached copies and protects a newer draft from stale cleanup', async () => {
  const deleted = [];
  const copies = [];
  let sequence = 0;
  const {
    prepareScanCache,
    retainScanPhoto,
    discardCapture,
    publishDraft,
    clearDraft,
    useScanDraft,
  } = load('src/scan/draft.ts', {
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-native': { Platform: { OS: 'android' } },
    'expo-crypto': { randomUUID: () => `id-${++sequence}` },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///app/cache/',
      deleteAsync: async (uri) => deleted.push(uri),
      makeDirectoryAsync: async () => {},
      copyAsync: async (options) => copies.push(options),
    },
  });
  await Promise.all([prepareScanCache(), prepareScanCache()]);
  assert.equal(deleted.filter((uri) => uri.endsWith('talaride-scans/')).length, 1);
  const uri = await retainScanPhoto('file:///app/cache/Camera/photo.jpg');
  assert.ok(uri.startsWith('file:///app/cache/talaride-scans/'));
  assert.equal(copies.length, 1);
  assert.ok(deleted.includes('file:///app/cache/Camera/photo.jpg'));
  await discardCapture('file:///user/gallery/original.jpg');
  assert.ok(!deleted.includes('file:///user/gallery/original.jpg'));
  publishDraft({ uri, candidates: ['1234'], message: '' });
  const oldId = useScanDraft().id;
  publishDraft({ candidates: ['5678'], message: '' });
  const newId = useScanDraft().id;
  clearDraft(oldId);
  assert.equal(useScanDraft().id, newId);
  assert.ok(deleted.includes(uri));
  clearDraft(newId);
  assert.equal(useScanDraft(), null);
});
