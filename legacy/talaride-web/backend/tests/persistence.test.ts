import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';
import { TalaRideRepository } from '../src/lib/repository.js';

describe('Server Restart & Durable Persistence (Section 2 & 29)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ server restart preserves data (survives process restart)', async () => {
    // 1. Record a specific ride via API
    const uniqueLocation = `Tagum Overland Terminal - ${Date.now()}`;
    const res = await request('/api/cash-record', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3500,
        approximate_location: uniqueLocation,
        client_operation_id: `restart-test-${Date.now()}`
      }
    });
    assert.equal(res.status, 201);
    const recordedRideId = res.body.ride.ride_id;

    // 2. Simulate server restart: construct a brand new TalaRideRepository instance from disk
    const restartedRepository = new TalaRideRepository();

    // 3. Verify the ride persisted across simulated restart
    const persistedRide = await restartedRepository.getRide(recordedRideId);
    assert.ok(persistedRide, 'Data must survive process restart');
    assert.equal(persistedRide.ride_id, recordedRideId);
    assert.equal(persistedRide.approximate_location, uniqueLocation);
    assert.equal(persistedRide.fare_amount_centavos, 3500);
  });
});
