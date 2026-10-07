import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';
import { repository } from '../src/lib/repository.js';

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

  test('passenger cash request stays pending until the assigned driver confirms receipt exactly once', async () => {
    const shift = await repository.getActiveShiftForDriver('DR-000481');
    assert.ok(shift);
    const beforeCount = shift.cash_rides_count;
    const beforeGross = shift.cash_gross_centavos;

    const requested = await request('/api/rides/cash-request', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-passenger-token' },
      body: {
        vehicle_code: 'TR-01842',
        amount_centavos: 2500,
        client_operation_id: 'passenger-cash-request-001'
      }
    });
    assert.equal(requested.status, 201);
    assert.equal(requested.body.ride.status, 'pending');
    assert.equal(requested.body.ride.payment_method, 'cash');

    const forbidden = await request('/api/rides/cash-confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-passenger-token' },
      body: { ride_id: requested.body.ride.ride_id }
    });
    assert.equal(forbidden.status, 403);

    const confirmed = await request('/api/rides/cash-confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-driver-token' },
      body: { ride_id: requested.body.ride.ride_id }
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.ride.status, 'completed');

    const duplicate = await request('/api/rides/cash-confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-driver-token' },
      body: { ride_id: requested.body.ride.ride_id }
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);

    const after = await repository.getShift(shift.shift_id);
    assert.ok(after);
    assert.equal(after.cash_rides_count, beforeCount + 1);
    assert.equal(after.cash_gross_centavos, beforeGross + 2500);
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
