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

test('cloud membership and admin approval survive reloads and preserve an independent group update', async t => {
  let state: any = { drivers: [{ driver_code: 'DR-123456', user_id: 'driver', verification_status: 'pending', toda_operator: 'Requested group' }] };
  let revision = 0;
  let attempts = 0;
  t.mock.method(supabaseAdmin, 'from', () => ({
    upsert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ single: async () => ({ data: { state: structuredClone(state), revision }, error: null }) }) }),
  }) as any);
  t.mock.method(supabaseAdmin, 'rpc', async (_name: string, args: any) => {
    if (++attempts === 1) { state.drivers[0].verification_status = 'verified'; state.drivers[0].verified_by = 'admin'; revision++; }
    if (args.expected_revision !== revision) return { data: false, error: null };
    state = structuredClone(args.next_state); revision++;
    return { data: true, error: null };
  });
  const previous = env.NODE_ENV;
  env.NODE_ENV = 'production';
  try {
    const member: any = await repository.cloudCall('addDriverToToda', ['DR-123456', { id: 'group-a', name: 'Group A' }, 'operator']);
    assert.equal(attempts, 2);
    assert.equal(member.verification_status, 'verified');
    assert.equal(member.verified_by, 'admin');
    const restored: any = await repository.cloudCall('getDriverByUserId', ['driver']);
    assert.equal(restored.toda_operator, 'Group A');
    assert.equal(restored.membership_added_by, 'operator');
    assert.equal(restored.toda_group_id, 'group-a');
    await repository.cloudCall('updateDriverStatus', ['DR-123456', 'verified', 'admin']);
    const approved: any = await repository.cloudCall('getDriverByUserId', ['driver']);
    assert.equal(approved.toda_group_id, 'group-a');
    assert.ok(approved.verified_at);
  } finally { env.NODE_ENV = previous; }
});
