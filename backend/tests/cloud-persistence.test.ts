import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repository } from '../src/lib/repository.js';
import { supabaseAdmin } from '../src/lib/supabase-admin.js';
import { env } from '../src/env.js';

test('cloud registration retries a conflicting write and preserves the other account', async t => {
  let state: any = { drivers: [] };
  let revision = 0;
  let attempts = 0;
  t.mock.method(supabaseAdmin, 'from', () => ({
    upsert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ single: async () => ({ data: { state: structuredClone(state), revision }, error: null }) }) }),
  }) as any);
  t.mock.method(supabaseAdmin, 'rpc', async (_name: string, args: any) => {
    attempts++;
    if (attempts === 1) {
      state.drivers.push({ driver_code: 'DR-100000', user_id: 'other-driver' }); revision++;
    }
    if (args.expected_revision !== revision) return { data: false, error: null };
    state = structuredClone(args.next_state); revision++;
    return { data: true, error: null };
  });
  const previous = env.NODE_ENV;
  env.NODE_ENV = 'production';
  try {
    const result: any = await repository.cloudCall('registerDriver', ['new-driver', { full_name: 'Registered driver', mobile_number: '09000000000', toda_operator: 'Test only', license_number: 'TEST-LICENSE' }]);
    assert.equal(attempts, 2);
    assert.equal(state.drivers.length, 2);
    assert.equal(result.user_id, 'new-driver');
    assert.equal(result.verification_status, 'pending');
    result.full_name = 'mutated client value';
    assert.equal(state.drivers.find((d: any) => d.user_id === 'new-driver').full_name, 'Registered driver');
  } finally { env.NODE_ENV = previous; }
});
test('database outages do not acknowledge a local-only registration', async t => {
  t.mock.method(supabaseAdmin, 'from', () => ({ upsert: async () => ({ error: { message: 'Database offline' } }) }) as any);
  await assert.rejects(repository.cloudCall('registerDriver', ['blocked', {}]), /Durable database unavailable/);
});
