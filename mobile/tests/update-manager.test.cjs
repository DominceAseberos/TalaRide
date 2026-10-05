const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadUpdater(options = {}) {
  const source = ts.transpileModule(readFileSync('src/updates/updateManager.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const exports = {};
  const updates = options.updates || {
    isEnabled: false,
  };
  const requireStub = (id) => {
    if (id === 'expo-constants') {
      return {
        nativeAppVersion: options.currentVersion || '1.2.0',
        expoConfig: { version: options.currentVersion || '1.2.0' },
      };
    }
    if (id === 'expo-file-system/legacy') return {};
    if (id === 'expo-intent-launcher') return {};
    if (id === 'expo-updates') return updates;
    if (id === 'react-native') {
      return {
        Linking: {},
        Platform: { OS: 'android' },
      };
    }
    throw new Error('Unexpected module: ' + id);
  };

  vm.runInNewContext(source, {
    exports,
    require: requireStub,
    fetch: options.fetch || (() => Promise.resolve({ status: 404, ok: false })),
    Promise,
    Error,
    Number,
    String,
    Math,
  });

  return exports;
}

test('update version comparison handles normal semantic versions', () => {
  const updater = loadUpdater();
  assert.equal(updater.compareVersions('1.2.0', '1.1.9'), 1);
  assert.equal(updater.compareVersions('v1.2.0', '1.2.0'), 0);
  assert.equal(updater.compareVersions('1.2.0', '1.2.1'), -1);
  assert.equal(updater.compareVersions('2.0', '1.99.99'), 1);
});

test('GitHub APK release is preferred when it is newer than the installed app', async () => {
  const updater = loadUpdater({
    currentVersion: '1.2.0',
    fetch: async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        tag_name: 'v1.3.0',
        html_url: 'https://github.com/DominceAseberos/TalaRide/releases/tag/v1.3.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'TalaRide-v1.3.0.apk',
            browser_download_url: 'https://github.com/example/TalaRide-v1.3.0.apk',
          },
        ],
      }),
    }),
  });

  const result = await updater.checkForUpdates();
  assert.equal(result.kind, 'apk');
  assert.equal(result.versionLabel, '1.3.0');
});

test('older GitHub release is not offered as an update', async () => {
  const updater = loadUpdater({
    currentVersion: '1.2.0',
    fetch: async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        tag_name: 'v1.1.0',
        html_url: 'https://github.com/DominceAseberos/TalaRide/releases/tag/v1.1.0',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'TalaRide-v1.1.0.apk',
            browser_download_url: 'https://github.com/example/TalaRide-v1.1.0.apk',
          },
        ],
      }),
    }),
  });

  const result = await updater.checkForUpdates();
  assert.equal(result.kind, 'none');
  assert.equal(result.currentVersion, '1.2.0');
});
