import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';

describe('Driver Shifts & Single Active Shift Constraint (Section 5 & 7)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ active shift exists for seed driver DR-000481', async () => {
    const res = await request('/api/drivers/DR-000481');
    assert.equal(res.status, 200);
    assert.ok(res.body.activeShift);
    assert.equal(res.body.activeShift.vehicle_code, 'TR-01842');
  });

  test('✓ cannot start a second active shift for the same driver → 409', async () => {
    const res = await request('/api/shift-start', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-00421'
      }
    });
    assert.equal(res.status, 409, 'Must reject starting second concurrent active shift');
    assert.equal(res.body.error, 'Shift conflict');
  });

  test('✓ ending active shift closes shift cleanly → 200', async () => {
    const res = await request('/api/shift-end', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481'
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.shift.status, 'ended');
    assert.ok(res.body.shift.end_time);

    // Verify driver is now ended
    const driverRes = await request('/api/drivers/DR-000481');
    assert.equal(driverRes.body.activeShift, null);
  });

  test('✓ can start new shift once previous shift is closed → 201', async () => {
    const res = await request('/api/shift-start', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842'
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.shift.status, 'active');
    assert.equal(res.body.shift.driver_code, 'DR-000481');
  });
});
