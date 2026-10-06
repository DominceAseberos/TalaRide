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
  const groupA = await repository.createTodaGroup('Group A', 'account-admin');
  const groupB = await repository.createTodaGroup('Group B', 'account-admin');
  t.mock.method(supabaseAdmin.auth, 'getUser', async (token: string) => {
    const role = token === 'admin' ? 'admin' : token === 'driver' ? undefined : token === 'lgu' ? 'lgu_admin' : 'operator';
    return { data: { user: { id: `account-${token}`, email: `${token}@example.invalid`, created_at: new Date().toISOString(),
      app_metadata: { role, ...(token.startsWith('operator') ? { toda_group_id: token === 'operator-b' ? groupB.id : groupA.id, toda_group_name: token === 'operator-b' ? groupB.name : groupA.name } : {}) },
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
    const autoProvisioned = await call('unassigned', '/api/toda/members');
    assert.equal(autoProvisioned.status, 200);
    assert.equal(autoProvisioned.body.group.name, 'Untitled TODA');
    assert.equal(autoProvisioned.body.group.is_placeholder, true);
    const renamedPlaceholder = await call('unassigned', '/api/toda/group', 'PUT', { name: 'Sunrise TODA' });
    assert.equal(renamedPlaceholder.status, 200);
    assert.equal(renamedPlaceholder.body.group.name, 'Sunrise TODA');
    assert.equal(renamedPlaceholder.body.group.is_placeholder, false);
    assert.equal((await call('unassigned', '/api/toda/members')).body.group.name, 'Sunrise TODA');
    assert.equal((await call('driver', '/api/toda/members')).status, 403);
    assert.equal((await call('operator-a', '/api/toda/members')).body.members.length, 0);
    assert.equal((await call('operator-a', '/api/toda/members', 'POST', { driver_code: code })).status, 404, 'TODA operators have read-only membership access');
    const added = await call('admin', `/api/admin/toda-groups/${groupA.id}/members/${code}`, 'POST');
    assert.equal(added.status, 200);
    assert.equal(added.body.driver.verification_status, 'pending');
    assert.equal(added.body.driver.toda_operator, groupA.name);
    assert.equal(added.body.driver.toda_group_id, groupA.id);
    assert.equal((await call('operator-a', '/api/toda/members')).body.members.length, 1);
    assert.equal((await call('operator-b', '/api/toda/members')).body.members.length, 0);
    assert.equal((await call('operator-b', `/api/admin/toda-groups/${groupB.id}/members/${code}`, 'POST')).status, 403);
    const approval = await call('admin', `/api/admin/drivers/${code}/verify`, 'POST');
    assert.equal(approval.status, 200);
    assert.equal(approval.body.driver.verified_by, 'account-admin');
    const renamedAssignedGroup = await call('operator-a', '/api/toda/group', 'PUT', { name: 'Group A Renamed' });
    assert.equal(renamedAssignedGroup.status, 200);
    assert.equal(renamedAssignedGroup.body.group.name, 'Group A Renamed');
    const account = await call('driver', '/api/auth/me');
    assert.equal(account.body.driver.verification_status, 'verified');
    assert.equal(account.body.driver.toda_operator, 'Group A Renamed');
    const operatorView = await call('operator-a', '/api/toda/members');
    assert.equal(operatorView.body.group.name, 'Group A Renamed');
    assert.equal(operatorView.body.members[0].verification_status, 'verified');
    assert.equal((await call('operator-a', '/api/toda/members', 'POST', { driver_code: 'DR-999999' })).status, 404);
  } finally { env.DEMO_AUTH = previous; }
});
