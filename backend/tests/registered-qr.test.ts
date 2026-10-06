import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, resetDatabase, stopTestServer } from './helpers.js';

after(stopTestServer);
test('manual vehicle entry requires authentication and returns only public driver details', async () => {
  resetDatabase();
  assert.equal((await request('/api/vehicles/TR-01842/lookup')).status, 401);
  const result = await request('/api/vehicles/TR-01842/lookup', { headers: { Authorization: 'Bearer demo-passenger-token' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.vehicle_code, 'TR-01842');
  assert.equal(result.body.driver_code, 'DR-000481');
  assert.equal(result.body.license_number, undefined);
  assert.equal(result.body.mobile_number, undefined);
  assert.equal((await request('/api/vehicles/TR-99999/lookup', { headers: { Authorization: 'Bearer demo-passenger-token' } })).status, 404);
});
