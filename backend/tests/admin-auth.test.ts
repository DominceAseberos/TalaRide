import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';

describe('Admin Authentication & RBAC Boundaries (Section 6)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ unauthenticated admin → 401', async () => {
    const res = await request('/api/admin/overview');
    assert.equal(res.status, 401, 'Unauthenticated request to admin route must return 401');
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('✓ passenger cannot call admin API → 403', async () => {
    const res = await request('/api/admin/overview', {
      headers: {
        Authorization: 'Bearer mock-passenger-token'
      }
    });
    assert.equal(res.status, 403, 'Passenger role calling admin route must return 403 Forbidden');
    assert.equal(res.body.error, 'Forbidden');
  });

  test('✓ driver cannot call admin API → 403', async () => {
    const res = await request('/api/admin/transactions', {
      headers: {
        Authorization: 'Bearer mock-driver-token'
      }
    });
    assert.equal(res.status, 403, 'Driver role calling admin route must return 403 Forbidden');
  });

  test('✓ talaride_admin can access admin API → 200', async () => {
    const res = await request('/api/admin/overview', {
      headers: {
        Authorization: 'Bearer mock-admin-token'
      }
    });
    assert.equal(res.status, 200, 'Authenticated admin must access overview');
    assert.ok(res.body.metrics);
    assert.ok(res.body.metrics.total_registered_drivers >= 1);
  });
});
