import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';
import { env } from '../src/env.js';

describe('Server-Minted Rewards & Anti-Abuse (Section 16)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ duplicate webhook / confirmation does not double reward (ride_id UNIQUE)', async () => {
    const previousMode = env.PAYMENT_MODE;
    env.PAYMENT_MODE = 'mock';
    try {
    // 1. Create intent with passenger
    const intentRes = await request('/api/payment-intent', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock-passenger-token'
      },
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    const paymentId = intentRes.body.payment_id;

    // 2. First confirmation -> points awarded = 1
    const confirm1 = await request('/api/mock-confirm', {
      method: 'POST',
      body: {
        payment_id: paymentId,
        passenger_id: 'USR-COM-001'
      }
    });
    assert.equal(confirm1.status, 200);
    assert.equal(confirm1.body.points_awarded, 1);

    // Check rewards ledger
    const rewardsBefore = await request('/api/rewards-me', {
      headers: {
        Authorization: 'Bearer mock-passenger-token'
      }
    });
    const points1 = rewardsBefore.body.current_points;

    // 3. Repeated duplicate confirmation -> points awarded = 0
    const confirm2 = await request('/api/mock-confirm', {
      method: 'POST',
      body: {
        payment_id: paymentId,
        passenger_id: 'USR-COM-001'
      }
    });
    assert.equal(confirm2.status, 200);
    assert.equal(confirm2.body.points_awarded, 0);

    const rewardsAfter = await request('/api/rewards-me', {
      headers: {
        Authorization: 'Bearer mock-passenger-token'
      }
    });
    assert.equal(rewardsAfter.body.current_points, points1, 'Points balance must not increase upon duplicate confirmation');
    } finally {
      env.PAYMENT_MODE = previousMode;
    }
  });
});
