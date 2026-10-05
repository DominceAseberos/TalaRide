import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { request, stopTestServer, resetDatabase } from './helpers.js';
import { env } from '../src/env.js';

describe('Payment Intent & Settlement Verification (Section 8, 10, 11, 12, 14, 15)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ fake driver → 404', async () => {
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-999999',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Driver not found');
  });

  test('✓ fake vehicle → 404', async () => {
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-99999',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Vehicle not found');
  });

  test('✓ suspended driver → 403', async () => {
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000999',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Driver suspended');
  });

  test('✓ inactive shift cannot generate intent → 409', async () => {
    // DR-000512 is verified but has ended shift
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000512',
        vehicle_code: 'TR-00421',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'No active shift');
  });

  test('✓ money is integer centavos & creates pending ride atomically → 201', async () => {
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.payment_id);
    assert.ok(res.body.ride_id);
    assert.equal(res.body.amount_centavos, 3000);
    assert.equal(res.body.provider_fee_centavos, 53); // 1.75% of 3000 = 52.5 -> 53
    assert.equal(res.body.net_centavos, 2947);
    assert.equal(res.body.payment_status, 'awaiting_confirmation');

    // Verify ride created with status pending
    const rideRes = await request(`/api/rides/${res.body.ride_id}`);
    assert.equal(rideRes.status, 200);
    assert.equal(rideRes.body.ride.status, 'pending');
  });

  test('✓ QR expires after 300 seconds (verified via timestamp)', async () => {
    const res = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 201);
    const expiresAt = new Date(res.body.expires_at).getTime();
    const now = Date.now();
    const diffSeconds = Math.round((expiresAt - now) / 1000);
    assert.ok(diffSeconds >= 295 && diffSeconds <= 305, `Expected ~300s expiry, got ${diffSeconds}s`);
  });

  test('✓ mock confirmation succeeds & duplicate confirm is idempotent', async () => {
    const previousMode = env.PAYMENT_MODE;
    env.PAYMENT_MODE = 'mock';
    try {
    // 1. Create intent
    const intentRes = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 2500
      }
    });
    const paymentId = intentRes.body.payment_id;

    // 2. Confirm payment
    const confirmRes1 = await request('/api/mock-confirm', {
      method: 'POST',
      body: {
        payment_id: paymentId,
        provider: 'gcash'
      }
    });
    assert.equal(confirmRes1.status, 200);
    assert.equal(confirmRes1.body.payment.payment_status, 'confirmed');
    assert.equal(confirmRes1.body.ride.status, 'completed');

    // 3. Duplicate confirm is idempotent
    const confirmRes2 = await request('/api/mock-confirm', {
      method: 'POST',
      body: {
        payment_id: paymentId,
        provider: 'gcash'
      }
    });
    assert.equal(confirmRes2.status, 200);
    assert.equal(confirmRes2.body.message, 'Payment was already confirmed');
    } finally {
      env.PAYMENT_MODE = previousMode;
    }
  });

  test('✓ webhook signature mismatch rejected → 401', async () => {
    const res = await request('/api/payment-webhook', {
      method: 'POST',
      headers: {
        'x-provider-signature': 'invalid_signature_hex'
      },
      body: {
        event: 'payment.success',
        provider: 'gcash',
        provider_ref: 'GCASH-111',
        payment_id: 'PAY-111',
        amount_centavos: 3000
      }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid provider signature');
  });

  test('✓ webhook amount mismatch rejected → 400', async () => {
    // 1. Create intent for 3000 centavos
    const intentRes = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000
      }
    });
    const paymentId = intentRes.body.payment_id;

    // 2. Send webhook claiming 2000 centavos
    const payload = {
      event: 'payment.success',
      provider: 'gcash',
      provider_ref: 'GCASH-MISMATCH-1',
      payment_id: paymentId,
      amount_centavos: 2000 // mismatch!
    };
    const signature = crypto
      .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    const webhookRes = await request('/api/payment-webhook', {
      method: 'POST',
      headers: {
        'x-provider-signature': signature
      },
      body: payload
    });

    assert.equal(webhookRes.status, 400);
    assert.equal(webhookRes.body.error, 'Amount mismatch');
  });

  test('✓ confirmed payment completes exactly one ride', async () => {
    const previousMode = env.PAYMENT_MODE;
    env.PAYMENT_MODE = 'mock';
    try {
    const intentRes = await request('/api/payment-intent', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 1500
      }
    });
    const rideId = intentRes.body.ride_id;
    const paymentId = intentRes.body.payment_id;

    await request('/api/mock-confirm', {
      method: 'POST',
      body: {
        payment_id: paymentId,
        provider: 'maya'
      }
    });

    const rideRes = await request(`/api/rides/${rideId}`);
    assert.equal(rideRes.body.ride.status, 'completed');
    assert.equal(rideRes.body.payment.payment_status, 'confirmed');
    } finally {
      env.PAYMENT_MODE = previousMode;
    }
  });
});
