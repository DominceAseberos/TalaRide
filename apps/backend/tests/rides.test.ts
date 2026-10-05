import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';

describe('Rides, Cash Trips & Offline Idempotency (Section 27)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ duplicate offline cash request creates exactly one ride', async () => {
    const operationId = 'client-offline-op-8842109';
    const payload = {
      driver_code: 'DR-000481',
      vehicle_code: 'TR-01842',
      amount_centavos: 2500,
      client_operation_id: operationId
    };

    // First request
    const res1 = await request('/api/cash-record', {
      method: 'POST',
      body: payload
    });
    assert.equal(res1.status, 201);
    const rideId1 = res1.body.ride.ride_id;

    // Duplicate retry with same client_operation_id
    const res2 = await request('/api/cash-record', {
      method: 'POST',
      body: payload
    });
    assert.equal(res2.status, 201);
    const rideId2 = res2.body.ride.ride_id;

    assert.equal(rideId1, rideId2, 'Duplicate offline cash sync must return identical ride resource');

    // Verify all rides count
    const listRes = await request(`/api/rides?driver_code=DR-000481`);
    const matchingRides = listRes.body.filter((r: any) => r.client_operation_id === operationId);
    assert.equal(matchingRides.length, 1, 'Only one ride must be stored in database');
  });

  test('✓ commuter safety check-in records trip with 0 fare and checkin flag', async () => {
    const res = await request('/api/ride-checkin', {
      method: 'POST',
      body: {
        vehicle_code: 'TR-01842',
        approximate_location: 'Tagum Poblacion TODA Station'
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.ride.fare_amount_centavos, 0);
    assert.equal(res.body.ride.is_checkin_only, true);
    assert.equal(res.body.ride.payment_method, 'cash');
  });
});
