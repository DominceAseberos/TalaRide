const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
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
    Error,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return React;
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function receiptHarness(respondToPrompt) {
  const prompt = {
    matchId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
    rideId: 'ride-1',
    description: 'Black bag',
    details: 'Under the seat',
    createdAt: '2026-09-22T00:00:00Z',
    expiresAt: '2026-09-29T00:00:00Z',
  };
  const module = load('src/app/receipt.tsx', {
    'expo-router': { router: { dismissTo() {} }, useLocalSearchParams: () => ({ id: 'ride-1' }) },
    'react-native': { View: 'view' },
    '@/components/Screen': { Screen: 'screen' },
    '@/components/ui': {
      Button: (props) => React.createElement('button', props),
      Card: 'card',
      Copy: (props) => React.createElement('copy', props),
      Detail: 'detail',
      Icon: 'icon',
      Title: 'title',
      replace() {},
    },
    '@/components/MissingRide': { MissingRide: 'missing-ride' },
    '@/components/Notice': {
      Notice: (props) => React.createElement('notice', props, props.children),
    },
    '@/mocks/MockProvider': {
      useMock: () => ({
        rides: [
          {
            id: 'ride-1',
            number: '1234',
            identifier: 'MTOP',
            date: '2026-09-22T00:00:00Z',
            note: '',
            location: '',
          },
        ],
        relayPrompts: [prompt],
        respondToPrompt,
      }),
    },
    '@/mocks/data': { formatDate: (value) => value },
    '@/constants/theme': {
      colors: { green: 'green', white: 'white', red: 'red' },
    },
  });
  return { Component: module.default, prompt };
}

test('receipt close hides the prompt without submitting a dismissal', async () => {
  const calls = [];
  const { Component } = receiptHarness(async (...args) => calls.push(args));
  let tree;
  await act(async () => {
    tree = create(React.createElement(Component));
  });
  await act(async () => tree.root.findByType('notice').props.onClose());
  assert.deepEqual(calls, []);
  assert.equal(tree.root.findAllByType('notice').length, 0);
  await act(async () => tree.unmount());
});

test('receipt offers and explicitly declines assistance only once', async () => {
  for (const [label, response] of [
    ['Offer Assistance', 'offered'],
    ['Decline Assistance', 'dismissed'],
  ]) {
    const pending = deferred();
    const calls = [];
    const { Component, prompt } = receiptHarness((...args) => {
      calls.push(args);
      return pending.promise;
    });
    let tree;
    await act(async () => {
      tree = create(React.createElement(Component));
    });
    const button = tree.root.findAllByType('button').find((item) => item.props.label === label);
    let first;
    await act(async () => {
      first = button.props.onPress();
      button.props.onPress();
    });
    assert.deepEqual(calls, [[prompt.matchId, response]]);
    await act(async () => {
      pending.resolve();
      await first;
    });
    assert.equal(tree.root.findAllByType('notice').length, 0);
    await act(async () => tree.unmount());
  }
});

test('receipt keeps an unanswered prompt visible after a failed response', async () => {
  const { Component } = receiptHarness(async () => {
    throw new Error('Relay service is unavailable.');
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Component));
  });
  const offer = tree.root
    .findAllByType('button')
    .find((item) => item.props.label === 'Offer Assistance');
  await act(async () => offer.props.onPress());
  assert.equal(tree.root.findAllByType('notice').length, 1);
  assert.equal(
    tree.root
      .findAllByType('copy')
      .some((item) => item.children.includes('Relay service is unavailable.')),
    true,
  );
  assert.equal(offer.props.disabled, false);
  await act(async () => tree.unmount());
});

function activityHarness(notification, respondToPrompt = async () => {}) {
  const refreshes = [];
  const module = load('src/app/activity.tsx', {
    'expo-router': {
      router: { setParams() {} },
      useLocalSearchParams: () => ({ tab: 'notifications' }),
    },
    'react-native': { Pressable: 'pressable', View: 'view' },
    '@/components/Screen': { Screen: 'screen' },
    '@/components/BottomNav': { BottomNav: 'bottom-nav' },
    '@/components/ActivityCard': {
      ActivityCard: (props) => React.createElement('activity-card', props, props.children),
    },
    '@/components/Notice': {
      Notice: (props) => React.createElement('notice', props, props.children),
    },
    '@/components/ui': {
      Button: (props) => React.createElement('button', props),
      Copy: (props) => React.createElement('copy', props),
      go() {},
      s: { row: {} },
    },
    '@/mocks/MockProvider': {
      useMock: () => ({
        requests: [],
        relayPrompts: [],
        respondToPrompt,
        resolveRequest: async () => {},
        refreshRequests: async () => refreshes.push('requests'),
      }),
    },
    '@/notifications/NotificationProvider': {
      useNotifications: () => ({
        notifications: [notification],
        error: null,
        read: async () => {},
        refresh: async () => refreshes.push('notifications'),
      }),
    },
    '@/auth/AuthProvider': {
      useAuth: () => ({ session: { user: { id: 'user-a' } }, recovery: false }),
    },
    '@/mocks/data': { formatDate: (value) => value },
    '@/constants/theme': {
      colors: { border: 'border', green: 'green', muted: 'muted', red: 'red' },
    },
  });
  return { Component: module.default, refreshes };
}

function relayNotification(overrides = {}) {
  return {
    id: 'notification-1',
    requestId: '22222222-2222-4222-8222-222222222222',
    matchId: '11111111-1111-4111-8111-111111111111',
    kind: 'relay_prompt',
    title: 'Lost-item relay available',
    message: 'Open TalaRide to view a private relay prompt.',
    date: '2026-09-22T00:00:00Z',
    unread: true,
    description: 'Black bag',
    details: 'Under the seat',
    requestStatus: 'active',
    matchResponse: null,
    expiresAt: '2999-09-29T00:00:00Z',
    ...overrides,
  };
}

async function openNotification(Component) {
  let tree;
  await act(async () => {
    tree = create(React.createElement(Component));
  });
  await act(async () => tree.root.findByType('activity-card').props.onPress());
  return tree;
}

test('activity offers assistance only for an unanswered active relay match', async () => {
  const pending = deferred();
  const calls = [];
  const notification = relayNotification();
  const { Component } = activityHarness(notification, (...args) => {
    calls.push(args);
    return pending.promise;
  });
  const tree = await openNotification(Component);
  const offer = tree.root
    .findAllByType('button')
    .find((item) => item.props.label === 'Offer Assistance');
  let first;
  await act(async () => {
    first = offer.props.onPress();
    offer.props.onPress();
  });
  assert.deepEqual(calls, [[notification.matchId, 'offered']]);
  await act(async () => {
    pending.resolve();
    await first;
  });
  assert.equal(tree.root.findAllByType('notice').length, 0);
  await act(async () => tree.unmount());
});

test('activity preserves history without actions for answered, resolved, and expired prompts', async () => {
  for (const [overrides, message] of [
    [{ matchResponse: 'offered' }, 'You offered assistance.'],
    [{ matchResponse: 'dismissed' }, 'You declined assistance.'],
    [{ requestStatus: 'resolved' }, 'This request is closed.'],
    [{ requestStatus: 'expired' }, 'This request has expired.'],
    [{ expiresAt: '2000-01-01T00:00:00Z' }, 'This request has expired.'],
  ]) {
    const { Component } = activityHarness(relayNotification(overrides));
    const tree = await openNotification(Component);
    assert.equal(
      tree.root.findAllByType('button').some((item) => item.props.label === 'Offer Assistance'),
      false,
    );
    assert.equal(
      tree.root.findAllByType('copy').some((item) => item.children.includes(message)),
      true,
    );
    await act(async () => tree.unmount());
  }
});
