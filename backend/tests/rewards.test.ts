import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';
import { env } from '../src/env.js';
import { repository } from '../src/lib/repository.js';

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
      headers: { Authorization: 'Bearer mock-passenger-token' },
      body: {
        payment_id: paymentId,
        passenger_id: 'USR-COM-001'
      }
    });
    assert.equal(confirm1.status, 200);
    assert.equal(confirm1.body.points_awarded, 1);
    assert.equal(confirm1.body.driver_points_awarded, 1);

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
      headers: { Authorization: 'Bearer mock-passenger-token' },
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
    const driverRewards = await request('/api/rewards-me', {
      headers: { Authorization: 'Bearer mock-driver-token' },
    });
    assert.equal(driverRewards.body.current_points, 1, 'the assigned driver earns the same confirmed ride once');
    } finally {
      env.PAYMENT_MODE = previousMode;
    }
  });

  test('10 completed rides unlock role-specific, capped and environment-isolated claims', async () => {
    const enviro = env.PAYMENT_ENVIRONMENT;
    const passengerId = 'USR-COM-001';
    const driverId = 'USR-DRV-001';
    try {
      const earlyClaim = await request('/api/rewards/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-passenger-token' },
        body: { reward_type: 'drink_voucher', client_operation_id: 'claim-too-early' },
      });
      assert.equal(earlyClaim.status, 400, 'a reward cannot be claimed before the tenth ride');

      // The first completed payment in the test above earned one point for each account.
      for (let index = 2; index <= 10; index++) {
        await repository.mintRideRewards({
          passengerUserId: passengerId,
          driverUserId: driverId,
          rideId: `REWARD-RIDE-${index}`,
          environment: enviro,
        });
      }

      const passengerBefore = await request('/api/rewards-me', {
        headers: { Authorization: 'Bearer mock-passenger-token' },
      });
      assert.equal(passengerBefore.body.completed_rides, 10);
      assert.equal(passengerBefore.body.unlocked_rewards_count, 1);

      // There is no hidden daily earning cap: ride 11 must still count.
      await repository.mintRideRewards({
        passengerUserId: passengerId,
        driverUserId: driverId,
        rideId: 'REWARD-RIDE-11',
        environment: enviro,
      });
      const passengerAfterEleven = await request('/api/rewards-me', {
        headers: { Authorization: 'Bearer mock-passenger-token' },
      });
      assert.equal(passengerAfterEleven.body.completed_rides, 11);
      assert.equal(passengerAfterEleven.body.current_points, 11);
      assert.equal(passengerAfterEleven.body.progress_towards_milestone, 1);
      assert.equal(passengerAfterEleven.body.unlocked_rewards_count, 1);
      const otherEnvironment = await repository.getRewardsForUser(passengerId, enviro === 'test' ? 'live' : 'test');
      assert.equal(otherEnvironment.completedRides, 0, 'test rides cannot become live voucher credit');

      const wrongRole = await request('/api/rewards/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-passenger-token' },
        body: { reward_type: 'fuel_discount', client_operation_id: 'wrong-role-claim' },
      });
      assert.equal(wrongRole.status, 403);

      const drink = await request('/api/rewards/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-passenger-token' },
        body: { reward_type: 'drink_voucher', user_id: driverId, client_operation_id: 'passenger-claim-001' },
      });
      assert.equal(drink.status, 200);
      assert.match(drink.body.voucher.code, /^TR-DRINK-[A-F0-9]{12}$/);
      assert.equal(drink.body.voucher.value_centavos, 5000);
      assert.equal(drink.body.voucher.test_only, enviro === 'test');
      assert.ok(Date.parse(drink.body.voucher.valid_until) > Date.now());
      assert.equal(drink.body.rewards.currentPoints, 1);

      const drinkRetry = await request('/api/rewards/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-passenger-token' },
        body: { reward_type: 'drink_voucher', client_operation_id: 'passenger-claim-001' },
      });
      assert.equal(drinkRetry.status, 200);
      assert.equal(drinkRetry.body.voucher.code, drink.body.voucher.code);
      assert.equal(drinkRetry.body.rewards.currentPoints, 1, 'claim retry must not consume another 10 points');

      const fuel = await request('/api/rewards/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-driver-token' },
        body: { reward_type: 'fuel_discount', client_operation_id: 'driver-claim-001' },
      });
      assert.equal(fuel.status, 200);
      assert.match(fuel.body.voucher.code, /^TR-FUEL-[A-F0-9]{12}$/);
      assert.equal(fuel.body.voucher.value_centavos, 5000);
      assert.match(fuel.body.voucher.description, /10% off eligible Petron gasoline/);

      const passengerAfter = await request('/api/rewards-me', {
        headers: { Authorization: 'Bearer mock-passenger-token' },
      });
      assert.equal(passengerAfter.body.completed_rides, 11);
      assert.equal(passengerAfter.body.current_points, 1);
      assert.equal(passengerAfter.body.unlocked_rewards_count, 0);
      assert.equal(passengerAfter.body.history[0].voucher_code, drink.body.voucher.code);
    } finally {
      env.PAYMENT_ENVIRONMENT = enviro;
    }
  });
});
