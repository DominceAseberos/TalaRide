import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { app } from '../src/index.js';
import { env } from '../src/env.js';

async function json(
  base: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, init);
  const body = await res.json();
  return { status: res.status, body };
}

test('Expo/mobile-facing HTTP contract completes a payment end to end', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));

  try {
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api`;
    const driverHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-driver-token',
    };
    const passengerHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-passenger-token',
    };

    const health = await json(base, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'healthy');

    const shift = await json(base, '/shift-start', {
      method: 'POST',
      headers: driverHeaders,
      body: JSON.stringify({
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
      }),
    });
    assert.ok([200, 201].includes(shift.status));
    assert.equal(shift.body.shift.driver_code, 'DR-000481');
    assert.equal(shift.body.shift.vehicle_code, 'TR-01842');

    const intent = await json(base, '/payment-intent', {
      method: 'POST',
      headers: passengerHeaders,
      body: JSON.stringify({
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 3000,
      }),
    });
    assert.equal(intent.status, 201);
    assert.equal(intent.body.amount_centavos, 3000);
    assert.equal(intent.body.payment_status, 'awaiting_confirmation');
    assert.ok(intent.body.payment_id);
    assert.ok(intent.body.ride_id);
    assert.equal(intent.body.checkout_url, null, 'mock payment mode must not call an external provider');

    const qr = JSON.parse(intent.body.qr_payload);
    assert.equal(qr.v, 1);
    assert.equal(qr.payment_id, intent.body.payment_id);
    assert.equal(qr.ride_id, intent.body.ride_id);
    assert.equal(qr.vehicle_code, 'TR-01842');
    assert.equal(qr.amount_centavos, 3000);
    assert.equal(typeof qr.sig, 'string');
    assert.ok(qr.sig.length > 10);

    const before = await json(
      base,
      `/payment-status?payment_id=${encodeURIComponent(intent.body.payment_id)}`,
      { headers: driverHeaders },
    );
    assert.equal(before.status, 200);
    assert.equal(before.body.payment_status, 'awaiting_confirmation');

    const webhookPayload = {
      event: 'payment.paid',
      provider: 'gcash',
      provider_ref: `test-provider-${intent.body.payment_id}`,
      payment_id: intent.body.payment_id,
      amount_centavos: 3000,
      passenger_id: 'USR-COM-001',
    };
    const webhookBody = JSON.stringify(webhookPayload);
    const webhookSignature = crypto
      .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');
    const confirm = await json(base, '/payment-webhook', {
      method: 'POST',
      headers: {
        ...passengerHeaders,
        'x-provider-signature': webhookSignature,
      },
      body: webhookBody,
    });
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.status, 'confirmed');

    const after = await json(
      base,
      `/payment-status?payment_id=${encodeURIComponent(intent.body.payment_id)}`,
      { headers: passengerHeaders },
    );
    assert.equal(after.body.payment_status, 'confirmed');
    assert.equal(after.body.amount_centavos, 3000);

    // This mirrors the Expo client exactly: no passenger_id query parameter.
    // The backend must scope history from the authenticated passenger token.
    const rides = await json(base, '/rides', {
      headers: passengerHeaders,
    });
    assert.equal(rides.status, 200);
    assert.ok(Array.isArray(rides.body));
    assert.ok(
      rides.body.some(
        (ride: any) =>
          ride.ride_id === intent.body.ride_id &&
          ride.fare_amount_centavos === 3000 &&
          ride.status === 'completed',
      ),
    );

    const rewards = await json(base, '/rewards-me', { headers: passengerHeaders });
    assert.equal(rewards.status, 200);
    assert.equal(typeof rewards.body.current_points, 'number');
    assert.ok(rewards.body.current_points >= 1);

    const fares = await json(base, '/fares', { headers: driverHeaders });
    assert.equal(fares.status, 200);
    assert.ok(Array.isArray(fares.body.standard_fares_centavos));
    assert.ok(fares.body.standard_fares_centavos.includes(3000));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
