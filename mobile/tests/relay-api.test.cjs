const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} = require('@supabase/supabase-js');

function loadApi(result) {
  const exports = {};
  const source = ts.transpileModule(readFileSync('src/relay/api.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    Error,
    Response,
    require(name) {
      if (name === '@supabase/supabase-js')
        return { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError };
      if (name === '@/auth/client')
        return { requireSupabase: () => ({ functions: { invoke: async () => result } }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

test('relay API surfaces safe structured Edge Function errors', async () => {
  const response = new Response(JSON.stringify({ error: 'This prompt is no longer available.' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });
  const api = loadApi({ data: null, error: new FunctionsHttpError(response) });
  await assert.rejects(
    api.respondToRelay('11111111-1111-4111-8111-111111111111', 'offered'),
    /This prompt is no longer available\./,
  );
  assert.deepEqual(await response.json(), { error: 'This prompt is no longer available.' });
});

test('relay API uses safe fallbacks for invalid sessions, rate limits, outages, and networks', async () => {
  for (const [error, expected] of [
    [
      new FunctionsHttpError(new Response('not json', { status: 401 })),
      /session is no longer valid/,
    ],
    [new FunctionsHttpError(new Response('', { status: 429 })), /Too many requests/],
    [new FunctionsHttpError(new Response('', { status: 503 })), /temporarily unavailable/],
    [new FunctionsFetchError(new Error('private network detail')), /Check your connection/],
    [new FunctionsRelayError(new Response('', { status: 502 })), /temporarily unavailable/],
  ]) {
    const api = loadApi({ data: null, error });
    await assert.rejects(
      api.respondToRelay('11111111-1111-4111-8111-111111111111', 'offered'),
      expected,
    );
  }
});

test('relay API rejects unsafe or unexpected server error bodies', async () => {
  const api = loadApi({
    data: null,
    error: new FunctionsHttpError(
      new Response(JSON.stringify({ error: 'internal\nsecret' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  });
  await assert.rejects(
    api.respondToRelay('11111111-1111-4111-8111-111111111111', 'offered'),
    /relay request could not be completed/,
  );
});

test('relay API maps notification response and request eligibility metadata', async () => {
  const api = loadApi({
    error: null,
    data: {
      notifications: [
        {
          id: 'notification-1',
          request_id: 'request-1',
          match_id: 'match-1',
          kind: 'relay_prompt',
          is_read: false,
          created_at: '2026-09-22T00:00:00Z',
          item_description: 'Bag',
          additional_details: 'Black',
          match_response: 'dismissed',
          request_status: 'active',
          expires_at: '2026-09-29T00:00:00Z',
        },
      ],
    },
  });
  const [notification] = await api.listRelayNotifications();
  assert.equal(notification.matchResponse, 'dismissed');
  assert.equal(notification.requestStatus, 'active');
  assert.equal(notification.expiresAt, '2026-09-29T00:00:00Z');
});
