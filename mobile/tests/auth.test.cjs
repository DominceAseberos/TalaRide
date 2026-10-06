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
  await performEmailAction('register', 'driver@example.test', 'password123', 'Driver', 'driver');
  assert.equal(calls.at(-1).args[0].options.data.requested_role, 'driver');
  assert.equal(calls.at(-1).args[0].options.data.role, undefined);
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
    '@react-native-async-storage/async-storage': {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
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
  let state = { ready: false, onboardingComplete: false, signedIn: false, profile: null };
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
     '@/auth/AuthProvider': { AuthProvider: wrapper, useAuth: () => ({ profile: state.profile }) },
    '@/notifications/NotificationProvider': { NotificationProvider: wrapper },
    '@/components/ui': { Brand: 'Brand', Copy: 'Copy' },
    '@/constants/theme': { colors: { white: '#FFFFFF', green: '#356653' } },
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
  assert.equal(tree.root.findAllByType('Brand').length, 1);
  state = { ready: true, onboardingComplete: false, signedIn: false, profile: null };
  await act(async () => {
    tree.update(element());
  });
  assert.deepEqual(routes(), [
    'index',
    'auth-callback',
    'v/[vehicle]',
    'ride-confirm',
    'payment-status',
    'onboarding',
  ]);
  state = { ready: true, onboardingComplete: true, signedIn: false, profile: null };
  await act(async () => {
    tree.update(element());
  });
  assert.deepEqual(routes(), [
    'index',
    'auth-callback',
    'v/[vehicle]',
    'ride-confirm',
    'payment-status',
    'sign-in',
  ]);
  state = { ready: true, onboardingComplete: true, signedIn: true, profile: { role: 'passenger' } };
  await act(async () => {
    tree.update(element());
  });
  assert.ok(routes().includes('rides'));
  assert.ok(routes().includes('confirm'));
  assert.ok(routes().includes('profile'));
  assert.ok(!routes().includes('sign-in'));
  assert.ok(!routes().includes('onboarding'));
  assert.ok(!routes().includes('driver-portal'));
  state = { ready: true, onboardingComplete: true, signedIn: true, profile: { role: 'driver' } };
  await act(async () => {
    tree.update(element());
  });
  assert.ok(routes().includes('driver-portal'));
  assert.ok(!routes().includes('home'));
  assert.ok(!routes().includes('staff-account'));
  state = { ready: true, onboardingComplete: true, signedIn: true, profile: { role: 'operator' } };
  await act(async () => {
    tree.update(element());
  });
  assert.deepEqual(routes(), ['index', 'auth-callback', 'staff-account']);
  state = { ready: true, onboardingComplete: true, signedIn: true, profile: null };
  await act(async () => {
    tree.update(element());
  });
  assert.ok(routes().includes('role-access'));
  assert.ok(!routes().includes('home'));
  state = { ready: true, onboardingComplete: true, signedIn: false, profile: null };
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
    '@/components/ConfirmEmail': {
      ConfirmEmail: (props) => React.createElement('confirm-email', props),
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
    '@/auth/profiles': {
      loadProfile: async () => ({ role: calls.at(-1)?.[4] || 'passenger' }),
    },
    '@/auth/client': {
      requireSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) } }),
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
    tree.root
      .findAllByType('pressable')
      .find((item) => item.props.accessibilityLabel === 'Driver account')
      .props.onPress();
  });
  await act(async () => {
    button('Sign In').props.onPress();
  });
  assert.equal(calls.at(-1)[4], 'driver');
  assert.equal(navigations.at(-1), '/driver-portal');
  await act(async () => {
    tree.unmount();
  });
});

test('native driver enrollment validates details and waits for server success without granting verification', async () => {
  const calls = [];
  const saved = [];
  let failure = true;
  const ui = Object.fromEntries(
    ['Button', 'Card', 'Copy', 'Field', 'Title'].map((name) => [
      name,
      (props) => React.createElement(name, props, props.children),
    ]),
  );
  const { DriverEnrollment } = load('src/components/DriverEnrollment.tsx', {
    'react-native': { View: 'view' },
    './ui': ui,
    '@/constants/theme': { colors: {} },
    '@/api/client': {
      apiRequest: async (path, options) => {
        calls.push({ path, details: JSON.parse(options.body) });
        if (failure) throw new Error('Network unavailable');
        return {
          driver: {
            driver_code: 'DR-100001',
            full_name: 'Real Driver',
            verification_status: 'pending',
            shift_status: 'ended',
          },
        };
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(DriverEnrollment, {
        name: 'Real Driver',
        online: true,
        onRegistered: (driver) => saved.push(driver),
      }),
    );
  });
  const submit = () => tree.root.findByType('Button').props.onPress();
  await act(async () => {
    submit();
  });
  assert.equal(calls.length, 0);
  await act(async () => {
    for (const [label, value] of [
      ['Mobile number', '09170000000'],
      ['License number', 'TEST-ONLY'],
    ]) {
      tree.root
        .findAllByType('Field')
        .find((field) => field.props.label === label)
        .props.onChangeText(value);
    }
  });
  await act(async () => {
    submit();
    submit();
  });
  assert.equal(calls.length, 1);
  assert.equal(saved.length, 0);
  assert.equal(calls[0].path, '/drivers/enroll');
  assert.equal(calls[0].details.user_id, undefined);
  assert.equal(calls[0].details.toda_operator, undefined);
  failure = false;
  await act(async () => {
    submit();
  });
  assert.equal(saved[0].verification_status, 'pending');
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

test('confirmation inbox links use known providers and never trust arbitrary email domains', () => {
  for (const file of ['src/auth/emailInbox.ts', '../frontend/src/services/emailInbox.ts']) {
    const { emailInbox } = load(file);
    assert.equal(emailInbox(' User@GMAIL.COM ').url, 'https://mail.google.com/mail/u/0/#inbox');
    assert.equal(emailInbox('user@outlook.com').name, 'Outlook');
    assert.equal(emailInbox('user@gmail.com.attacker.test'), null);
    assert.equal(emailInbox('user@custom.test'), null);
    assert.equal(emailInbox(''), null);
  }
});

test('resending confirmation validates email and preserves the native callback without bypassing verification', async () => {
  let args;
  let error = null;
  const { resendConfirmation } = load('src/auth/actions.ts', {
    './client': {
      authRedirectUrl: () => 'talaride://auth-callback',
      requireSupabase: () => ({
        auth: {
          resend: async (value) => {
            args = value;
            return { error };
          },
        },
      }),
    },
  });
  await assert.rejects(resendConfirmation('bad'), /valid email/);
  assert.equal(args, undefined);
  await resendConfirmation(' passenger@gmail.com ');
  assert.equal(args.type, 'signup');
  assert.equal(args.email, 'passenger@gmail.com');
  assert.equal(args.options.emailRedirectTo, 'talaride://auth-callback');
  error = new Error('Email rate limit exceeded');
  await assert.rejects(resendConfirmation('passenger@gmail.com'), /rate limit/);
});

test('native confirmation modal opens inbox, prevents duplicate sends and surfaces resend failures', async () => {
  const pending = deferred();
  const opened = [];
  let calls = 0;
  let failing = true;
  const ui = Object.fromEntries(
    ['Button', 'Copy', 'Field'].map((name) => [
      name,
      (props) => React.createElement(name, props, props.children),
    ]),
  );
  const { ConfirmEmail } = load('src/components/ConfirmEmail.tsx', {
    'react-native': {
      Linking: {
        openURL: async (url) => {
          opened.push(url);
        },
      },
    },
    '@/auth/actions': {
      resendConfirmation: async () => {
        calls++;
        if (failing) throw new Error('Offline');
        return pending.promise;
      },
    },
    '@/auth/emailInbox': load('src/auth/emailInbox.ts'),
    './Notice': { Notice: (props) => React.createElement('notice', props, props.children) },
    './ui': ui,
  });
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(ConfirmEmail, { email: 'passenger@gmail.com', onClose() {} }),
    );
  });
  const button = (label) =>
    tree.root.findAllByType('Button').find((item) => item.props.label === label);
  await act(async () => {
    button('Open Gmail').props.onPress();
  });
  assert.equal(opened[0], 'https://mail.google.com/mail/u/0/#inbox');
  await act(async () => {
    button('Resend confirmation email').props.onPress();
  });
  assert.ok(JSON.stringify(tree.toJSON()).includes('Offline'));
  failing = false;
  await act(async () => {
    const send = button('Resend confirmation email').props.onPress;
    send();
    send();
  });
  assert.equal(calls, 2);
  assert.equal(button('Sending…').props.disabled, true);
  await act(async () => {
    pending.resolve();
  });
  assert.ok(JSON.stringify(tree.toJSON()).includes('newest link'));
  await act(async () => {
    button('Resend confirmation email').props.onPress();
  });
  assert.equal(calls, 2);
  await act(async () => {
    tree.unmount();
  });
});

test('web confirmation resend uses the deployed origin and handles provider errors without claiming success', async () => {
  const calls = [];
  let failure = new Error('Email rate limit exceeded');
  const { ConfirmEmail } = load(
    '../frontend/src/components/auth/ConfirmEmail.tsx',
    {
      '../../services/auth': {
        getAuthClient: async () => ({
          auth: {
            resend: async (args) => {
              calls.push(args);
              return { error: failure };
            },
          },
        }),
      },
      '../../services/emailInbox': load('../frontend/src/services/emailInbox.ts'),
    },
    { window: { location: { origin: 'https://talaride-web-frontend.vercel.app' } } },
  );
  let tree;
  await act(async () => {
    tree = create(React.createElement(ConfirmEmail, { email: 'operator@gmail.com', onClose() {} }));
  });
  await act(async () => {
    await tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(calls[0].options.emailRedirectTo, 'https://talaride-web-frontend.vercel.app');
  assert.ok(JSON.stringify(tree.toJSON()).includes('rate limit'));
  failure = null;
  await act(async () => {
    await tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.ok(JSON.stringify(tree.toJSON()).includes('newest link'));
  assert.equal(tree.root.findByType('a').props.rel, 'noopener noreferrer');
  await act(async () => {
    tree.unmount();
  });
});

test('returning users skip the splash animation and signed-out users go straight to sign-in', async () => {
  let state = { ready: true, onboardingComplete: true, signedIn: false };
  let scheduled = 0;
  const screen = load(
    'src/app/index.tsx',
    {
      'expo-router': { Redirect: 'Redirect' },
      'react-native': {
        Animated: { Value: class {} },
        Easing: {},
        Text: 'Text',
        View: 'View',
        useWindowDimensions: () => ({ width: 390 }),
      },
      '@/components/TalaIllustration': { TalaIllustration: 'TalaIllustration' },
      '@/components/Screen': { Screen: 'Screen' },
      '@/components/ui': {
        replace() {
          throw new Error('Unexpected animated redirect');
        },
      },
      '@/mocks/MockProvider': { useMock: () => state },
      '@/auth/AuthProvider': { useAuth: () => ({ profile: { role: 'passenger' } }) },
      '@/constants/theme': { colors: {} },
    },
    {
      setTimeout() {
        scheduled++;
        return 1;
      },
      clearTimeout() {},
    },
  );
  let tree;
  await act(async () => {
    tree = create(React.createElement(screen.default));
  });
  assert.equal(tree.root.findByType('Redirect').props.href, '/sign-in');
  assert.equal(scheduled, 0);
  assert.equal(tree.root.findAllByType('TalaIllustration').length, 0);
  await act(async () => {
    state = { ...state, signedIn: true };
    tree.update(React.createElement(screen.default));
  });
  assert.equal(tree.root.findByType('Redirect').props.href, '/home');
  await act(async () => {
    state = { ...state, signedIn: false };
    tree.update(React.createElement(screen.default));
  });
  assert.equal(tree.root.findByType('Redirect').props.href, '/sign-in');
  assert.equal(scheduled, 0);
  await act(async () => tree.unmount());
});

test('driver waits for admin approval then dashboard and saved membership update automatically', async () => {
  let account = {
    driver: {
      driver_code: 'DR-123456',
      full_name: 'Registered driver',
      verification_status: 'pending',
      shift_status: 'ended',
    },
    vehicle: { vehicle_code: 'TR-12345', qr_checksum: 'checksum' },
  };
  let tick;
  let approvalPollMs;
  let foreground;
  const stored = new Map();
  let unavailable = false;
  const vehicleRegistrations = [];
  const ui = Object.fromEntries(
    ['Button', 'Card', 'Copy', 'Detail', 'Field', 'Header', 'Icon', 'Title'].map((name) => [name, name]),
  );
  const screen = load(
    'src/app/driver.tsx',
    {
      'react-native': {
        Image: 'Image',
        TextInput: 'TextInput',
        View: 'View',
        AppState: {
          addEventListener: (_event, fn) => {
            foreground = fn;
            return { remove() {} };
          },
        },
      },
      '@react-native-async-storage/async-storage': {
        getItem: async (key) => stored.get(key),
        setItem: async (key, value) => stored.set(key, value),
        removeItem: async (key) => stored.delete(key),
      },
      '@/components/Screen': { Screen: 'Screen' },
      '@/components/ui': { ...ui, replace() {} },
      '@/components/DriverEnrollment': { DriverEnrollment: 'DriverEnrollment' },
      '@/components/QrImage': { QrImage: 'QrImage' },
      '@/components/RewardsPanel': { RewardsPanel: 'RewardsPanel' },
      '@/api/client': {
        ApiError: class extends Error {},
        apiRequest: async () => {
          if (unavailable) throw new Error('Offline');
          return structuredClone(account);
        },
      },
      '@/api/shifts': { startShift() {}, endShift() {} },
      '@/api/drivers': {
        fetchDriverNotifications: async () => {
          throw new Error('Notifications unavailable');
        },
        fetchDriverSummary: async () => ({ rides: [], payments: [] }),
        registerDriverVehicle: async (plateBodyNumber) => {
          vehicleRegistrations.push(plateBodyNumber);
          const vehicle = { vehicle_code: 'TR-77777', plate_body_number: plateBodyNumber, qr_checksum: 'created-checksum' };
          account = { ...account, vehicle };
          return { driver: account.driver, vehicle, created: true };
        },
        updateDriverPhoto: async () => ({}),
      },
      '@/api/fares': { fetchFares: async () => [] },
      '@/auth/profiles': { uploadProfileImage: async (_id, uri) => uri },
      'expo-image-picker': {
        requestMediaLibraryPermissionsAsync: async () => ({ granted: false }),
        launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
      },
      '@/mocks/MockProvider': { useMock: () => ({ saveRide() {} }) },
      '@/offline/queue': { enqueueOutbox() {} },
      '@/api/sync': { triggerSync: async () => {} },
      '@/auth/AuthProvider': {
        useAuth: () => ({ session: session('driver'), displayName: 'Registered driver', profile: null, updateProfile: async () => {}, signOut: async () => {} }),
      },
      '@/constants/theme': { colors: {} },
    },
    {
      structuredClone,
      setInterval: (fn, ms) => {
        tick = fn;
        approvalPollMs = ms;
        return 1;
      },
      clearInterval() {},
    },
  );
  let tree;
  await act(async () => {
    tree = create(React.createElement(screen.default));
  });
  let rendered = JSON.stringify(tree.toJSON());
  assert.ok(rendered.includes('Verification pending'));
  assert.ok(!rendered.includes('Driver portal'), 'driver screen has no back-navigation header');
  assert.ok(!rendered.includes('Check approval'), 'approval refreshes automatically');
  assert.equal(approvalPollMs, 5000, 'pending approval is checked every five seconds');
  assert.equal(tree.root.findAllByType('QrImage').length, 0);
  account.driver = { ...account.driver, toda_group_id: 'group-a', toda_operator: 'Group A' };
  await act(async () => {
    tick();
  });
  assert.ok(JSON.stringify(tree.toJSON()).includes('Group A'));
  assert.equal(
    tree.root.findAllByType('QrImage').length,
    0,
    'membership never unlocks the dashboard',
  );
  account.driver = { ...account.driver, verification_status: 'verified' };
  await act(async () => {
    foreground('active');
  });
  assert.equal(tree.root.findAllByType('QrImage').length, 1);
  rendered = JSON.stringify(tree.toJSON());
  assert.ok(rendered.includes('Verified driver'));
  assert.ok(!rendered.includes('Verification pending'));
  assert.ok(!rendered.includes('Driver portal'));
  assert.equal(tree.root.findAllByType('RewardsPanel').length, 1);
  assert.equal(
    JSON.parse(stored.get('talaride.driver-account:driver')).driver.toda_operator,
    'Group A',
  );
  unavailable = true;
  await act(async () => {
    foreground('active');
  });
  assert.ok(
    JSON.stringify(tree.toJSON()).includes('Group A'),
    'offline view retains saved membership',
  );
  assert.ok(JSON.stringify(tree.toJSON()).includes('Saved QR'));
  unavailable = false;
  account.driver = { ...account.driver, verification_status: 'verified', toda_group_id: undefined, toda_operator: undefined };
  await act(async () => {
    foreground('active');
  });
  rendered = JSON.stringify(tree.toJSON());
  assert.ok(rendered.includes('Registered driver'));
  assert.ok(!rendered.includes('TODA group'));
  assert.equal(tree.root.findAllByType('QrImage').length, 1);
  assert.ok(!rendered.includes('Verification pending'), 'verified driver stays on dashboard without a group');
  account = { ...account, vehicle: null };
  await act(async () => {
    foreground('active');
  });
  rendered = JSON.stringify(tree.toJSON());
  assert.ok(rendered.includes('Set up your tricycle'));
  await act(async () => {
    tree.root.findByType('Field').props.onChangeText('TAG-777');
  });
  await act(async () => {
    tree.root.findAllByType('Button').find((item) => item.props.label === 'Register tricycle and create QR').props.onPress();
  });
  assert.deepEqual(vehicleRegistrations, ['TAG-777']);
  assert.equal(tree.root.findAllByType('QrImage').length, 1);
  await act(async () => {
    tree.unmount();
  });
});

test('passenger and driver can claim only their own tenth-ride rewards', async () => {
  for (const audience of ['passenger', 'driver']) {
    let claimedType;
    let claimed = false;
    const screen = load(
      'src/components/RewardsPanel.tsx',
      {
        'react-native': {
          AppState: { addEventListener: () => ({ remove() {} }) },
          View: 'View',
        },
        '@/components/ui': {
          Button: 'Button',
          Card: 'Card',
          Copy: 'Copy',
          Detail: 'Detail',
          Title: 'Title',
        },
        '@/auth/AuthProvider': { useAuth: () => ({ session: session(`${audience}-reward-user`) }) },
        '@/api/rewards': {
          fetchRewards: async () => ({
            points_balance: claimed ? 0 : 10,
            current: 0,
            threshold: 10,
            completed_rides: 10,
            unlocked_rewards_count: claimed ? 0 : 1,
            test_mode: true,
            history: claimed ? [{
              status: 'redeemed',
              reward_type: claimedType,
              voucher_code: `TR-${audience.toUpperCase()}-TEST-CODE`,
              voucher_description: 'Test reward voucher',
              voucher_valid_until: '2026-11-05T00:00:00.000Z',
            }] : [],
          }),
          claimReward: async (type) => {
            claimed = true;
            claimedType = type;
            return {
              code: `TR-${audience.toUpperCase()}-TEST-CODE`,
              description: 'Test reward voucher',
              valid_until: '2026-11-05T00:00:00.000Z',
              reward_type: type,
              value_centavos: 5000,
              test_only: true,
            };
          },
        },
        '@/constants/theme': { colors: { muted: '#777', red: '#f00' } },
      },
      { setInterval: () => 1, clearInterval() {} },
    );
    let tree;
    await act(async () => {
      tree = create(React.createElement(screen.RewardsPanel, { audience }));
    });
    const expectedType = audience === 'passenger' ? 'drink_voucher' : 'fuel_discount';
    const expectedClaim = audience === 'passenger' ? 'Claim drink voucher' : 'Claim fuel discount';
    assert.ok(JSON.stringify(tree.toJSON()).includes(expectedClaim));
    assert.ok(JSON.stringify(tree.toJSON()).includes('no real drink or fuel discount'));
    const button = tree.root.findAllByType('Button').find((item) => item.props.label === expectedClaim);
    await act(async () => button.props.onPress());
    assert.equal(claimedType, expectedType);
    assert.ok(JSON.stringify(tree.toJSON()).includes(`TR-${audience.toUpperCase()}-TEST-CODE`));
    await act(async () => tree.unmount());
  }
});

test('TODA operator dashboard shows assigned members and lost-item notices read-only', async () => {
  const group = { id: 'group-a', name: 'Group A' };
  const members = [{ driver_id: 'DR-123456', name: 'Registered driver', verification_status: 'pending' }];
  const lostItems = [{ report_id: 'lost-1', vehicle_code: 'TR-100', driver_code: 'DR-123456', item_category: 'bag', description: 'Blue backpack left on seat', status: 'open', created_at: '2026-10-06T00:00:00.000Z' }];
  let memberReads = 0;
  let lostItemReads = 0;
  const OpsLayout = ({ children, sections, onSelect }) => React.createElement(
    'ops-layout',
    null,
    ...sections.map((section) => React.createElement('button', {
      key: section.id,
      onClick: () => onSelect(section.id),
    }, section.label)),
    children,
  );
  const icon = () => null;
  const { TodaDashboard } = load(
    '../frontend/src/components/toda/TodaDashboard.tsx',
    {
      react: React,
      'lucide-react': { Bell: icon, CircleAlert: icon, Save: icon, Users: icon },
      '../../services/api': {
        api: {
          getTodaMembers: async () => { memberReads++; return { group, members }; },
          getTodaLostItems: async () => { lostItemReads++; return lostItems; },
          renameTodaGroup: async (name) => ({ group: { ...group, name } }),
        },
      },
      '../ops/OpsLayout': { OpsLayout },
    },
    { window: { setInterval: () => 1, clearInterval() {} } },
  );
  let tree;
  await act(async () => {
    tree = create(React.createElement(TodaDashboard, { operatorName: 'Operator', onSignOut() {} }));
  });
  const rendered = JSON.stringify(tree.toJSON());
  assert.equal(memberReads, 1);
  assert.equal(lostItemReads, 1);
  assert.ok(rendered.includes('Group A'));
  assert.ok(rendered.includes('Group members'));
  await act(async () => {
    tree.root.findAllByType('button').find((button) => button.children.includes('Members')).props.onClick();
  });
  const roster = JSON.stringify(tree.toJSON());
  assert.ok(roster.includes('DR-123456'));
  assert.ok(roster.includes('Pending admin review'));
  await act(async () => {
    tree.root.findAllByType('button').find((button) => button.children.includes('Lost item notices')).props.onClick();
  });
  const notices = JSON.stringify(tree.toJSON());
  assert.ok(notices.includes('Blue backpack left on seat'));
  assert.equal(tree.root.findAllByType('form').length, 1, 'operators can rename only their own TODA group');
  assert.ok(!notices.includes('Add driver'), 'operators still cannot add drivers');
  assert.ok(!notices.includes('Assign driver'), 'operators still cannot assign drivers');
  await act(async () => {
    tree.unmount();
  });
});
