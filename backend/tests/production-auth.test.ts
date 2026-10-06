import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateRequest } from '../src/lib/auth.js';
import { supabaseAdmin } from '../src/lib/supabase-admin.js';
import { repository } from '../src/lib/repository.js';
import { env } from '../src/env.js';
import { request, stopTestServer } from './helpers.js';

after(stopTestServer);
test('production rejects demo credentials and protects private data without a session', async t => {
  const previous = env.NODE_ENV;
  env.NODE_ENV = 'production';
  t.mock.method(supabaseAdmin.auth, 'getUser', async () => ({ data: { user: null }, error: new Error('Invalid token') }));
  try {
    const identity = await authenticateRequest({ headers: { authorization: 'Bearer demo-admin-token' }, query: {} } as any);
    assert.equal(identity, null);
    for (const route of ['/api/admin/metrics', '/api/drivers/DR-000481', '/api/rides', '/api/lost-items', '/api/rewards-me']) {
      assert.equal((await request(route)).status, 401, route);
    }
    assert.equal((await request('/api/payments/confirm-payment', { method: 'POST', body: { payment_id: 'demo' } })).status, 403);
  } finally { env.NODE_ENV = previous; }
});
test('signup metadata cannot grant dashboard access; only server-managed role can', async t => {
  const previous = env.DEMO_AUTH;
  env.DEMO_AUTH = false;
  const user = { id: 'real-auth-user', email: 'owner@example.invalid', created_at: new Date().toISOString(), user_metadata: { role: 'talaride_admin', requested_role: 'operator' }, app_metadata: {} as Record<string, string> };
  t.mock.method(supabaseAdmin.auth, 'getUser', async () => ({ data: { user }, error: null }));
  t.mock.method(repository, 'getProfile', async () => null);
  t.mock.method(repository, 'getDriverByUserId', async () => null);
  t.mock.method(repository, 'createProfile', async (profile: any) => profile);
  try {
    const req = { headers: { authorization: 'Bearer verified-by-test-auth-service' }, query: {} } as any;
    assert.equal((await authenticateRequest(req))?.role, 'passenger');
    user.app_metadata.role = 'talaride_admin';
    assert.equal((await authenticateRequest(req))?.role, 'passenger');
    user.app_metadata.role = 'admin';
    assert.equal((await authenticateRequest(req))?.role, 'admin');
  } finally { env.DEMO_AUTH = previous; }
});
