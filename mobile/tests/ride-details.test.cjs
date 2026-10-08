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

function rideDetailsHarness(share) {
  const ride = {
    id: 'ride-1',
    number: 'TR-1234',
    identifier: 'MTOP-42',
    date: '2026-10-08T15:00:00+08:00',
    note: 'Private passenger note',
    location: 'Private pickup location',
  };
  const module = load('src/app/ride/[id].tsx', {
    'expo-router': { useLocalSearchParams: () => ({ id: ride.id }) },
    'react-native': { Share: { share }, View: 'view' },
    '@/components/Screen': { Screen: 'screen' },
    '@/components/ui': {
      ActionRow: (props) => React.createElement('action-row', props),
      Button: (props) => React.createElement('button', props),
      Card: (props) => React.createElement('card', props, props.children),
      Copy: (props) => React.createElement('copy', props, props.children),
      Detail: (props) => React.createElement('detail', props),
      Field: (props) => React.createElement('field', props),
      Header: (props) => React.createElement('header', props, props.children),
      IconButton: (props) => React.createElement('icon-button', props),
      Title: (props) => React.createElement('title', props, props.children),
      go() {},
      replace() {},
      s: { row: {} },
    },
    '@/components/ReferenceArt': { ReferenceArt: 'reference-art' },
    '@/components/Notice': {
      Notice: (props) => React.createElement('notice', props, props.children),
    },
    '@/components/MissingRide': { MissingRide: 'missing-ride' },
    '@/mocks/MockProvider': {
      useMock: () => ({
        rides: [ride],
        updateRide: async () => {},
        deleteRide: async () => {},
      }),
    },
    '@/mocks/data': { formatDate: () => 'Oct 8, 2026 · 3:00 PM' },
    '@/constants/theme': {
      colors: { darkGreen: 'dark-green', field: 'field', paleGreen: 'pale-green' },
    },
  });
  return { Component: module.default, ride };
}

async function renderRideDetails(share) {
  const { Component, ride } = rideDetailsHarness(share);
  let tree;
  await act(async () => {
    tree = create(React.createElement(Component));
  });
  return { tree, ride };
}

test('ride details shares a safe text summary through the native share sheet', async () => {
  const calls = [];
  const { tree, ride } = await renderRideDetails(async (payload) => {
    calls.push(payload);
    return { action: 'sharedAction' };
  });

  const shareAction = tree.root
    .findAllByType('action-row')
    .find((item) => item.props.label.startsWith('Share'));
  assert.ok(shareAction);

  await act(async () => {
    await shareAction.props.onPress();
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, 'TalaRide ride summary');
  assert.match(calls[0].message, /Ride: TR-1234/);
  assert.match(calls[0].message, /Date: Oct 8, 2026 · 3:00 PM/);
  assert.match(calls[0].message, /Identifier: MTOP-42/);
  assert.doesNotMatch(calls[0].message, new RegExp(ride.note));
  assert.doesNotMatch(calls[0].message, new RegExp(ride.location));
  assert.equal(tree.root.findAllByType('notice').length, 0);
  await act(async () => tree.unmount());
});

test('ride details shows a retryable message when native sharing fails', async () => {
  const { tree } = await renderRideDetails(async () => {
    throw new Error('Native share unavailable');
  });
  const shareAction = tree.root
    .findAllByType('action-row')
    .find((item) => item.props.label.startsWith('Share'));

  await act(async () => {
    await shareAction.props.onPress();
  });

  const notice = tree.root.findByType('notice');
  assert.equal(notice.props.title, 'Unable to share ride');
  assert.equal(notice.props.message, 'The share sheet could not be opened. Please try again.');
  await act(async () => tree.unmount());
});
