const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const readRepoFile = (file) =>
  readFileSync(existsSync(file) ? file : path.resolve(__dirname, '../../../', file), 'utf8');
const { PGlite } = require('@electric-sql/pglite');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function load(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    queueMicrotask,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test('notification migration protects tokens and activity while enforcing valid records', async () => {
  const db = new PGlite();
  const user = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      insert into auth.users values ('${user}');`);
    await db.exec(readRepoFile('supabase/migrations/202609200001_community_relay.sql'));
    await db.exec(readRepoFile('supabase/migrations/202609200002_notifications.sql'));
    const request = (
      await db.query(
        `insert into public.lost_item_requests(owner_id,local_ride_id,vehicle_digest,item_description) values($1,'ride','${'a'.repeat(64)}','Bag') returning id`,
        [user],
      )
    ).rows[0];
    await db.query(
      `insert into public.push_tokens(user_id,token,platform) values($1,'ExponentPushToken[test_token]','android')`,
      [user],
    );
    await db.query(
      `insert into public.relay_notifications(user_id,request_id,kind) values($1,$2,'helper_offered')`,
      [user, request.id],
    );
    await db.query(
      `update public.lost_item_requests set created_at=now()-interval '8 days', expires_at=now()-interval '1 day' where id=$1`,
      [request.id],
    );
    assert.equal(
      (await db.query('select public.expire_lost_item_requests() as count')).rows[0].count,
      1,
    );
    assert.equal(
      (
        await db.query(
          `select count(*)::int as count from public.relay_notifications where kind='request_expired'`,
        )
      ).rows[0].count,
      1,
    );
    await assert.rejects(
      db.query(
        `insert into public.push_tokens(user_id,token,platform) values($1,'not-a-token','android')`,
        [user],
      ),
      /check constraint/,
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}';`);
    for (const table of ['push_tokens', 'notification_preferences', 'relay_notifications'])
      await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(
      db.query(
        `insert into public.push_tokens(user_id,token,platform) values($1,'ExponentPushToken[attack]','android')`,
        [user],
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test('notification provider requests permission explicitly, registers physical devices and routes safe responses', async () => {
  let permission = 'undetermined';
  let listener;
  const calls = [];
  const routes = [];
  const module = load('src/notifications/NotificationProvider.tsx', {
    react: React,
    'expo-constants': { __esModule: true, default: { easConfig: { projectId: 'project-id' } } },
    'expo-device': { isDevice: true },
    'expo-router': { router: { replace: (route) => routes.push(route) } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-notifications': {
      AndroidImportance: { DEFAULT: 3 },
      AndroidNotificationVisibility: { PRIVATE: 0 },
      setNotificationHandler: () => {},
      setNotificationChannelAsync: async (_, config) =>
        calls.push(['channel', config.lockscreenVisibility]),
      getPermissionsAsync: async () => ({ status: permission }),
      requestPermissionsAsync: async () => ({ status: (permission = 'granted') }),
      getExpoPushTokenAsync: async ({ projectId }) => ({ data: `ExponentPushToken[${projectId}]` }),
      addNotificationResponseReceivedListener: (callback) => {
        listener = callback;
        return { remove() {} };
      },
    },
    '@/auth/AuthProvider': {
      useAuth: () => ({ session: { user: { id: 'user-a' } }, recovery: false }),
    },
    '@/relay/api': {
      listRelayNotifications: async () => [],
      getNotificationPreference: async () => true,
      markRelayNotificationRead: async () => {},
      setNotificationPreference: async (enabled) => enabled,
      registerPushToken: async (...args) => calls.push(['register', ...args]),
    },
  });
  let state;
  function Probe() {
    state = module.useNotifications();
    return null;
  }
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(module.NotificationProvider, null, React.createElement(Probe)),
    );
  });
  assert.equal(state.permission, 'undetermined');
  await act(async () => {
    await state.enable();
  });
  assert.equal(state.permission, 'granted');
  assert.deepEqual(calls.at(-1), ['register', 'ExponentPushToken[project-id]', 'android']);
  await act(async () => {
    listener({
      notification: { request: { content: { data: { route: '/activity?tab=notifications' } } } },
    });
  });
  assert.deepEqual(routes, ['/activity?tab=notifications']);
  await act(async () => {
    tree.unmount();
  });
});

test('server push payload is generic and dispatch remains authenticated and server-side', () => {
  const source = readRepoFile('supabase/functions/community-relay/index.ts');
  assert.match(source, /auth\.auth\.getUser\(\)/);
  assert.match(source, /https:\/\/exp\.host\/--\/api\/v2\/push\/send/);
  assert.match(source, /Open TalaRide to view a private lost-item relay update\./);
  assert.doesNotMatch(source, /body:\s*item\.item_description/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
});

test('notification provider hides prior-account data and ignores stale account responses', async () => {
  let userId = 'user-a';
  let resolveUserA;
  const userAResult = new Promise((resolve) => {
    resolveUserA = resolve;
  });
  const item = (id) => ({
    id,
    requestId: `request-${id}`,
    title: 'Relay',
    message: 'Private activity',
    date: '2026-09-22T00:00:00Z',
    unread: true,
    kind: 'relay_prompt',
  });
  const module = load('src/notifications/NotificationProvider.tsx', {
    react: React,
    'expo-constants': { __esModule: true, default: {} },
    'expo-device': { isDevice: true },
    'expo-router': { router: { replace() {} } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-notifications': {
      setNotificationHandler() {},
      getPermissionsAsync: async () => ({ status: 'granted' }),
      addNotificationResponseReceivedListener: () => ({ remove() {} }),
    },
    '@/auth/AuthProvider': {
      useAuth: () => ({ session: { user: { id: userId } }, recovery: false }),
    },
    '@/relay/api': {
      listRelayNotifications: async () =>
        userId === 'user-a' ? userAResult : [item('notification-b')],
      getNotificationPreference: async () => true,
      markRelayNotificationRead: async () => {},
      setNotificationPreference: async (enabled) => enabled,
      registerPushToken: async () => {},
    },
  });
  let state;
  function Probe() {
    state = module.useNotifications();
    return null;
  }
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(module.NotificationProvider, null, React.createElement(Probe)),
    );
  });
  assert.equal(state.notifications.length, 0);
  userId = 'user-b';
  await act(async () => {
    tree.update(React.createElement(module.NotificationProvider, null, React.createElement(Probe)));
  });
  assert.equal(
    state.notifications.map((notification) => notification.id).join(','),
    'notification-b',
  );
  await act(async () => resolveUserA([item('notification-a')]));
  assert.equal(
    state.notifications.map((notification) => notification.id).join(','),
    'notification-b',
  );
  await act(async () => tree.unmount());
});
