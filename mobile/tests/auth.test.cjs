const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function load(filename, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    URLSearchParams,
    Error,
    Promise,
    ...globals,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const session = (id) => ({
  user: { id, email: `${id}@example.test` },
  access_token: 'test-token',
  refresh_token: 'test-refresh',
  expires_at: 9999999999,
});

test('configuration rejects missing, unsafe URLs and secret/service-role keys', () => {
  const { validateSupabaseConfig } = load('src/auth/config.ts');
  assert.throws(() => validateSupabaseConfig(undefined, undefined), /not configured/);
  for (const url of [
    'http://example.test',
    'https://user:password@example.test',
    'https://example.test/auth',
    'https://example.test?token=abc',
  ])
    assert.throws(() => validateSupabaseConfig(url, 'sb_publishable_test'), /HTTPS/);
  const serviceJwt =
    'eyJhbGciOiJIUzI1NiJ9.' +
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') +
    '.sig';
  for (const key of ['sb_secret_do-not-use', 'service_role', 'eyJhbGciOiJIUzI1NiJ9', serviceJwt])
    assert.throws(() => validateSupabaseConfig('https://example.test', key), /publishable/);
  assert.equal(
    validateSupabaseConfig('https://example.test', 'sb_publishable_test').url,
    'https://example.test',
  );
  const anonJwt =
    'eyJhbGciOiJIUzI1NiJ9.' +
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') +
    '.sig';
  assert.equal(validateSupabaseConfig('https://example.test', anonJwt).key, anonJwt);
});

test('callback parsing supports recovery, confirmation and codes and rejects unrelated/expired links', () => {
  const { parseAuthCallback } = load('src/auth/config.ts');
  const recovery = parseAuthCallback(
    'talaride://auth-callback#access_token=a&refresh_token=b&type=recovery',
  );
  assert.equal(recovery.recovery, true);
  assert.equal(recovery.accessToken, 'a');
  assert.equal(
    parseAuthCallback(
      'http://localhost:8081/auth-callback#access_token=a&refresh_token=b&type=signup',
    ).recovery,
    false,
  );
  assert.equal(parseAuthCallback('https://example.test/auth-callback?code=abc').code, 'abc');
  for (const url of [
    'talaride://home#access_token=a&refresh_token=b',
    'talaride://auth-callback#access_token=a',
    'https://example.test/auth-callback#error_code=otp_expired',
    'javascript:alert(1)',
  ])
    assert.throws(() => parseAuthCallback(url));
});

test('native session storage chunks Unicode, serializes writes, preserves previous session on failure and removes tokens', async () => {
  const { createSessionStorage } = load('src/auth/storage.ts');
  const data = new Map();
  let id = 0;
  let fail = false;
  const driver = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      assert.ok(Buffer.byteLength(value, 'utf8') <= 1600);
      if (fail && key.endsWith('.1')) throw new Error('keychain unavailable');
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
  const storage = createSessionStorage(driver, () => `generation-${++id}`);
  const value = JSON.stringify({
    access_token: 'a'.repeat(3000),
    refresh_token: 'b'.repeat(1200),
    name: '🚲'.repeat(1000),
  });
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
  const oldKeys = [...data.keys()];
  fail = true;
  await assert.rejects(storage.setItem('session', 'c'.repeat(1000)), /keychain/);
  assert.equal(await storage.getItem('session'), value);
  assert.deepEqual([...data.keys()], oldKeys);
  fail = false;
  await Promise.all([storage.setItem('session', 'first'), storage.setItem('session', 'last')]);
  assert.equal(await storage.getItem('session'), 'last');
  assert.equal(data.size, 2);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(data.size, 0);
  data.set('session', 'corrupt metadata');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(data.size, 0);
  await storage.setItem('session', value);
  const item = JSON.parse(data.get('session'));
  data.delete(`session.${item.generation}.0`);
  assert.equal(await storage.getItem('session'), null);
  assert.equal(data.size, 0);
  await storage.setItem('session', 'new valid session');
  assert.equal(await storage.getItem('session'), 'new valid session');
});

test('email actions validate input, use real Auth methods, preserve password whitespace and surface network/Auth failures', async () => {
  const calls = [];
  let failure = null;
  let registeredSession = null;
  const auth = Object.fromEntries(
    ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'updateUser'].map((method) => [
      method,
      async (...args) => {
        calls.push({ method, args });
        return { data: { session: registeredSession }, error: failure };
      },
    ]),
  );
  const { performEmailAction } = load('src/auth/actions.ts', {
    './client': {
      requireSupabase: () => ({ auth }),
      authRedirectUrl: () => 'talaride://auth-callback',
    },
  });
  await assert.rejects(performEmailAction('register', 'bad', 'password123', 'Passenger'), /email/);
  await assert.rejects(
    performEmailAction('register', 'a@example.test', 'short', 'Passenger'),
    /8 characters/,
  );
  await assert.rejects(performEmailAction('register', 'a@example.test', 'password123', ''), /name/);
  assert.equal(calls.length, 0);
  assert.equal(await performEmailAction('signin', ' a@example.test ', ' pass '), 'authenticated');
  assert.equal(calls[0].args[0].email, 'a@example.test');
  assert.equal(calls[0].args[0].password, ' pass ');
  assert.equal(
    await performEmailAction('register', 'a@example.test', 'password123', ' Passenger '),
    'confirmation-required',
  );
  assert.equal(calls[1].args[0].options.data.display_name, 'Passenger');
  assert.equal(calls[1].args[0].options.emailRedirectTo, 'talaride://auth-callback');
  registeredSession = session('a');
  assert.equal(
    await performEmailAction('register', 'a@example.test', 'password123', 'Passenger'),
    'authenticated',
  );
  assert.equal(await performEmailAction('recover', 'a@example.test', ''), 'recovery-sent');
  assert.equal(calls.at(-1).args[1].redirectTo, 'talaride://auth-callback');
  assert.equal(await performEmailAction('reset', '', 'new-password'), 'authenticated');
  failure = new Error('Invalid login credentials');
  await assert.rejects(
    performEmailAction('signin', 'a@example.test', 'password123'),
    /Invalid login/,
  );
  auth.resetPasswordForEmail = async () => {
    throw new Error('Network unavailable');
  };
  await assert.rejects(performEmailAction('recover', 'a@example.test', ''), /Network/);
});

test('Auth provider restores sessions, handles refresh/recovery/sign-out and ignores stale startup/profile results', async () => {
  let listener;
  let appListener;
  let unsubscribe = false;
  let clears = 0;
  let starts = 0;
  let stops = 0;
  const initial = deferred();
  const profiles = new Map();
  let state;
  const auth = {
    onAuthStateChange: (callback) => {
      listener = callback;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribe = true;
            },
          },
        },
      };
    },
    getSession: () => initial.promise,
    startAutoRefresh: () => {
      starts++;
    },
    stopAutoRefresh: () => {
      stops++;
    },
    signOut: async (options) => {
      assert.equal(options.scope, 'local');
      listener('SIGNED_OUT', null);
      return { error: null };
    },
  };
  const provider = load('src/auth/AuthProvider.tsx', {
    'react-native': {
      Platform: { OS: 'android' },
      AppState: {
        currentState: 'active',
        addEventListener: (_, callback) => {
          appListener = callback;
          return { remove() {} };
        },
      },
    },
    './client': {
      authConfigurationError: null,
      supabase: { auth },
      requireSupabase: () => ({ auth }),
    },
    './profiles': {
      loadProfile: (id) => {
        const result = deferred();
        profiles.set(id, result);
        return result.promise;
      },
      saveProfile: async (id, name) => ({ id, display_name: name }),
    },
    '@/scan/draft': {
      clearDraft: async () => {
        clears++;
      },
    },
  });
  function Probe() {
    state = provider.useAuth();
    return null;
  }
  let tree;
  await act(async () => {
    tree = create(React.createElement(provider.AuthProvider, null, React.createElement(Probe)));
  });
  assert.equal(state.ready, false);
  assert.equal(starts, 1);
  await act(async () => {
    listener('SIGNED_IN', session('user-a'));
  });
  assert.equal(state.session.user.id, 'user-a');
  await act(async () => {
    initial.resolve({ data: { session: session('stale-user') }, error: null });
  });
  assert.equal(state.session.user.id, 'user-a');
  await act(async () => {
    listener('TOKEN_REFRESHED', session('user-b'));
  });
  await act(async () => {
    profiles.get('user-a').resolve({ id: 'user-a', display_name: 'Private A' });
    profiles.get('user-b').resolve({ id: 'user-b', display_name: 'Passenger B' });
  });
  assert.equal(state.displayName, 'Passenger B');
  await act(async () => {
    appListener('background');
    appListener('active');
    listener('PASSWORD_RECOVERY', session('user-b'));
  });
  assert.equal(state.recovery, true);
  assert.equal(starts, 2);
  assert.equal(stops, 1);
  await act(async () => {
    await state.signOut();
  });
  assert.equal(state.session, null);
  assert.equal(state.recovery, false);
  assert.equal(state.profile, null);
  assert.ok(clears > 0);
  await act(async () => {
    tree.unmount();
  });
  assert.equal(unsubscribe, true);
});

test('local provider scopes all operations to Auth user, hides account-switch results and denies signed-out/recovery writes', async () => {
  let authState = {
    ready: true,
    session: session('user-a'),
    recovery: false,
    signOut: async () => {},
  };
  let state;
  const queries = [];
  const creates = [];
  const updates = [];
  const deletes = [];
  const clears = [];
  const provider = load('src/mocks/MockProvider.tsx', {
    '@react-native-async-storage/async-storage': {
      getItem: async () => 'true',
      setItem: async () => {},
    },
    './data': { initialRequests: [], initialNotifications: [] },
    '@/auth/AuthProvider': { useAuth: () => authState },
    '@/auth/account': { deleteRemoteAccount: async () => {} },
    '@/db/rides': {
      initializeRideDatabase: async () => {},
      listRides: (id) => {
        const result = deferred();
        queries.push({ id, result });
        return result.promise;
      },
      createRide: async (id, number, identifier) => {
        creates.push(id);
        return { id: 'new-ride', number, identifier };
      },
      updateRide: async (id) => {
        updates.push(id);
      },
      deleteRide: async (id) => {
        deletes.push(id);
      },
      clearRides: async (id) => {
        clears.push(id);
        return 2;
      },
    },
    '@/relay/api': {
      createLostRequest: async () => ({}),
      listLostRequests: async () => [],
      registerFutureScan: async () => [],
      resolveLostRequest: async () => {},
      respondToRelay: async () => {},
    },
  });
  function Probe() {
    state = provider.useMock();
    return null;
  }
  const element = () =>
    React.createElement(provider.MockProvider, null, React.createElement(Probe));
  let tree;
  await act(async () => {
    tree = create(element());
  });
  assert.equal(queries[0].id, 'user-a');
  await act(async () => {
    queries[0].result.resolve([{ id: 'a-ride', number: '1234' }]);
  });
  assert.equal(state.rides[0].id, 'a-ride');
  await act(async () => {
    await state.saveRide('4321', 'MTOP');
    await state.updateRide('a-ride', '', '');
    await state.deleteRide('new-ride');
  });
  assert.deepEqual(creates, ['user-a']);
  assert.deepEqual(updates, ['user-a']);
  assert.deepEqual(deletes, ['user-a']);
  await act(async () => {
    assert.equal(await state.clearRideHistory(), 2);
  });
  assert.deepEqual(clears, ['user-a']);
  assert.equal(state.rides.length, 0);
  let staleSearch;
  const staleSave = state.saveRide;
  const staleUpdate = state.updateRide;
  await act(async () => {
    staleSearch = state.searchRides('', 'All');
  });
  authState = { ...authState, session: session('user-b') };
  await act(async () => {
    tree.update(element());
  });
  assert.equal(state.rides.length, 0);
  await assert.rejects(staleSave('1234', 'MTOP'), /initializing/);
  await assert.rejects(staleUpdate('a-ride', 'wrong-account', ''), /initializing/);
  assert.equal(creates.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(queries.at(-1).id, 'user-b');
  let result;
  await act(async () => {
    queries[1].result.resolve([{ id: 'a-private-search' }]);
    result = await staleSearch;
    queries[2].result.resolve([{ id: 'b-ride' }]);
  });
  assert.equal(result.length, 0);
  assert.equal(state.rides[0].id, 'b-ride');
  authState = { ...authState, recovery: true };
  await act(async () => {
    tree.update(element());
  });
  assert.equal(state.rides.length, 0);
  assert.equal(state.signedIn, false);
  await assert.rejects(state.saveRide('1234', 'MTOP'), /initializing/);
  authState = { ...authState, session: null, recovery: false };
  await act(async () => {
    tree.update(element());
  });
  await assert.rejects(state.updateRide('a-ride', '', ''), /initializing/);
  assert.equal((await state.searchRides('', 'All')).length, 0);
  await act(async () => {
    tree.unmount();
  });
});

test('protected route declarations hide private screens during initialization, onboarding and sign-out', async () => {
  let state = { ready: false, onboardingComplete: false, signedIn: false };
  function Stack({ children }) {
    return React.createElement('stack', null, children);
  }
  Stack.Screen = ({ name }) => React.createElement('route', { name });
  Stack.Protected = ({ guard, children }) => (guard ? children : null);
  const wrapper = ({ children }) => children;
  const layout = load('src/app/_layout.tsx', {
    'expo-router': { Stack },
    'expo-status-bar': { StatusBar: () => null },
    '@/mocks/MockProvider': { MockProvider: wrapper, useMock: () => state },
    'expo-font': { useFonts: () => {} },
    '@expo-google-fonts/roboto/400Regular': {},
    '@expo-google-fonts/roboto/500Medium': {},
    '@expo-google-fonts/roboto/700Bold': {},
    '@/scan/draft': { prepareScanCache: async () => {} },
    '@/api/sync': { triggerSync: async () => ({ sent: 0, pending: 0 }) },
    '@/auth/AuthProvider': { AuthProvider: wrapper },
    '@/notifications/NotificationProvider': { NotificationProvider: wrapper },
    'react-native': {
      View: 'view',
      ActivityIndicator: 'spinner',
      AppState: { addEventListener: () => ({ remove: () => {} }) },
    },
  });
  let tree;
  const element = () => React.createElement(layout.default);
  const routes = () => tree.root.findAllByType('route').map((route) => route.props.name);
  await act(async () => {
    tree = create(element());
  });
  assert.equal(routes().length, 0);
  state = { ready: true, onboardingComplete: false, signedIn: false };
  await act(async () => {
    tree.update(element());
  });
  assert.deepEqual(routes(), ['index', 'auth-callback', 'v/[vehicle]', 'ride-confirm', 'payment-status', 'onboarding']);
  state = { ready: true, onboardingComplete: true, signedIn: false };
  await act(async () => {
    tree.update(element());
  });
  assert.deepEqual(routes(), ['index', 'auth-callback', 'v/[vehicle]', 'ride-confirm', 'payment-status', 'sign-in']);
  state = { ready: true, onboardingComplete: true, signedIn: true };
  await act(async () => {
    tree.update(element());
  });
  assert.ok(routes().includes('rides'));
  assert.ok(routes().includes('confirm'));
  assert.ok(routes().includes('profile'));
  assert.ok(!routes().includes('sign-in'));
  assert.ok(!routes().includes('onboarding'));
  state = { ready: true, onboardingComplete: true, signedIn: false };
  await act(async () => {
    tree.update(element());
  });
  assert.ok(!routes().includes('rides'));
  await act(async () => {
    tree.unmount();
  });
});

test('sign-in UI submits real actions, blocks repeated taps and shows unavailable provider information', async () => {
  let recovery = false;
  const calls = [];
  const navigations = [];
  const pending = deferred();
  const ui = Object.fromEntries(
    ['Brand', 'Button', 'Copy', 'Field', 'Icon', 'IconButton', 'Title'].map((name) => [
      name,
      (props) => React.createElement(name, props, props.children),
    ]),
  );
  const screen = load('src/app/sign-in.tsx', {
    'react-native': { View: 'view', Pressable: 'pressable' },
    '@/components/Screen': {
      Screen: (props) => React.createElement('screen', props, props.children),
    },
    '@/components/ui': { ...ui, replace: (path) => navigations.push(path), s: { row: {} } },
    '@/components/Notice': {
      Notice: (props) => React.createElement('notice', props, props.children),
    },
    '@/constants/theme': { colors: {} },
    '@/auth/AuthProvider': {
      useAuth: () => ({
        recovery,
        setRecovery: (value) => {
          recovery = value;
        },
        signOut: async () => {},
        error: null,
      }),
    },
    '@/auth/actions': {
      performEmailAction: async (...args) => {
        calls.push(args);
        return pending.promise;
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(screen.default));
  });
  const fields = () => tree.root.findAllByType('Field');
  const button = (label) =>
    tree.root.findAllByType('Button').find((item) => item.props.label === label);
  await act(async () => {
    fields()
      .find((field) => field.props.label === 'Email address')
      .props.onChangeText('a@example.test');
    fields()
      .find((field) => field.props.label === 'Password')
      .props.onChangeText('password123');
  });
  await act(async () => {
    const submit = button('Sign In').props.onPress;
    submit();
    submit();
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'signin');
  assert.equal(button('Please wait…').props.disabled, true);
  await act(async () => {
    pending.resolve('authenticated');
  });
  assert.deepEqual(navigations, ['/home']);
  const google = tree.root
    .findAllByType('pressable')
    .find(
      (pressable) => pressable.props.accessibilityLabel === 'Continue with Google — not configured',
    );
  await act(async () => {
    google.props.onPress();
  });
  assert.match(tree.root.findByType('notice').props.message, /not configured/);
  assert.equal(calls.length, 1);
  await act(async () => {
    tree.unmount();
  });
});

test('installed Supabase SDK persists through the secure adapter, restores a session and removes it on offline sign-out', async () => {
  const { createClient } = require('@supabase/supabase-js');
  const { createSessionStorage } = load('src/auth/storage.ts');
  const data = new Map();
  let generation = 0;
  let offline = false;
  const storage = createSessionStorage(
    {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, value);
      },
      removeItem: async (key) => {
        data.delete(key);
      },
    },
    () => `sdk-${++generation}`,
  );
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'sdk-user', exp })).toString('base64url')}.test-signature`;
  const user = { id: 'sdk-user', email: 'sdk@example.test', app_metadata: {}, user_metadata: {} };
  const fetch = async (url) => {
    if (offline) throw new TypeError('Network unavailable');
    if (String(url).includes('/token?grant_type=password'))
      return Response.json({
        access_token: jwt,
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        user,
      });
    throw new Error('Unexpected network operation');
  };
  const options = {
    global: { fetch },
    auth: {
      storage,
      storageKey: 'sdk.session',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const first = createClient('https://sdk-test.example.test', 'sb_publishable_test', options);
  let second;
  try {
    const login = await first.auth.signInWithPassword({
      email: user.email,
      password: 'password123',
    });
    assert.equal(login.error, null);
    assert.equal(login.data.session.user.id, 'sdk-user');
    assert.ok(data.size > 0);
    first.auth.stopAutoRefresh();
    second = createClient('https://sdk-test.example.test', 'sb_publishable_test', options);
    const restored = await second.auth.getSession();
    assert.equal(restored.error, null);
    assert.equal(restored.data.session.user.id, 'sdk-user');
    offline = true;
    const logout = await second.auth.signOut({ scope: 'local' });
    // The SDK reports the failed server request, but it must still remove the device session.
    assert.ok(logout.error);
    assert.equal((await second.auth.getSession()).data.session, null);
    assert.equal(data.size, 0);
  } finally {
    first.auth.stopAutoRefresh();
    second?.auth.stopAutoRefresh();
  }
});
