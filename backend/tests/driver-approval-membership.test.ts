import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/env.js';
import { repository } from '../src/lib/repository.js';
import { supabaseAdmin } from '../src/lib/supabase-admin.js';
import { request, resetDatabase, stopTestServer } from './helpers.js';

after(stopTestServer);
test('only admin approval unlocks a driver; operator membership is scoped, durable and separate', async t => {
  resetDatabase();
  const previous = env.DEMO_AUTH;
  env.DEMO_AUTH = false;
  t.mock.method(supabaseAdmin.auth, 'getUser', async (token: string) => {
    const role = token === 'admin' ? 'talaride_admin' : token === 'driver' ? undefined : token === 'lgu' ? 'lgu_admin' : 'operator';
    return { data: { user: { id: `account-${token}`, email: `${token}@example.invalid`, created_at: new Date().toISOString(),
      app_metadata: { role, ...(token.startsWith('operator') ? { toda_group_id: token === 'operator-b' ? 'group-b' : 'group-a', toda_group_name: token === 'operator-b' ? 'Group B' : 'Group A' } : {}) },
      user_metadata: { full_name: token, toda_group_id: 'forged-group', toda_group_name: 'Forged group' } } }, error: null } as any;
  });
  const call = (token: string, path: string, method = 'GET', body?: unknown) => request(path, { method, body, headers: { Authorization: `Bearer ${token}` } });
  try {
    const registration = await call('driver', '/api/drivers/enroll', 'POST', { full_name: 'Registered driver', mobile_number: '09123456789', toda_operator: 'Requested group', license_number: 'LICENSE-123' });
    assert.equal(registration.status, 201);
    const code = registration.body.driver.driver_code;
    assert.equal(registration.body.driver.verification_status, 'pending');
    const queue = await call('admin', '/api/admin/drivers');
    assert.ok(queue.body.some((driver: any) => driver.driver_code === code && driver.verification_status === 'pending'));
    for (const token of ['operator-a', 'driver', 'lgu']) assert.equal((await call(token, `/api/admin/drivers/${code}/verify`, 'POST')).status, 403);
    assert.equal((await call('unassigned', '/api/toda/members')).status, 403, 'signup group metadata cannot authorize group access');
    assert.equal((await call('driver', '/api/toda/members')).status, 403);
    assert.equal((await call('operator-a', '/api/toda/members', 'POST', { driver_code: code, toda_group_id: 'group-b' })).status, 400);
    const added = await call('operator-a', '/api/toda/members', 'POST', { driver_code: code });
    assert.equal(added.status, 200);
    assert.equal(added.body.driver.verification_status, 'pending');
    assert.equal(added.body.driver.toda_operator, 'Group A');
    assert.equal(added.body.driver.toda_group_id, 'group-a');
    assert.equal(added.body.driver.membership_added_by, 'account-operator-a');
    const repeated = await call('operator-a', '/api/toda/members', 'POST', { driver_code: code });
    assert.equal(repeated.body.driver.membership_added_at, added.body.driver.membership_added_at);
    assert.equal((await call('operator-b', '/api/toda/members')).body.members.length, 0);
    assert.equal((await call('operator-b', '/api/toda/members', 'POST', { driver_code: code })).status, 409);
    const approval = await call('admin', `/api/admin/drivers/${code}/verify`, 'POST');
    assert.equal(approval.status, 200);
    assert.equal(approval.body.driver.verified_by, 'account-admin');
    const account = await call('driver', '/api/auth/me');
    assert.equal(account.body.driver.verification_status, 'verified');
    assert.equal(account.body.driver.toda_operator, 'Group A');
    assert.equal((await call('operator-a', '/api/toda/members')).body.members[0].verification_status, 'verified');
    assert.equal((await call('operator-a', '/api/toda/members', 'POST', { driver_code: 'DR-999999' })).status, 404);
  } finally { env.DEMO_AUTH = previous; }
});
