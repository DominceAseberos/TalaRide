import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { env } from '../src/env.js';
import { request, resetDatabase, stopTestServer } from './helpers.js';

after(stopTestServer);

test('production checkout accepts explicitly selected test gateway and rejects mismatched keys', async () => {
  const previous = { ...env };
  try {
    env.NODE_ENV = 'production';
    env.PAYMENT_MODE = 'live';
    for (const environment of ['test', 'live'] as const) {
      env.PAYMENT_ENVIRONMENT = environment;
      env.PAYMENT_PROVIDER_KEY = `sk_${environment}_unit_test_only`;
      // Missing fields reach validation only after the gateway configuration gate passes.
      assert.equal((await request('/api/payment-intent', { method: 'POST', body: {} })).status, 400);
      env.PAYMENT_PROVIDER_KEY = `sk_${environment === 'test' ? 'live' : 'test'}_unit_test_only`;
      assert.equal((await request('/api/payment-intent', { method: 'POST', body: {} })).status, 503);
    }
    env.PAYMENT_MODE = 'mock';
    assert.equal((await request('/api/payment-intent', { method: 'POST', body: {} })).status, 503);
  } finally { Object.assign(env, previous); }
});

test('PayMongo test webhook requires a test signature, preserves UUID and ignores failed events', async () => {
  resetDatabase();
  const previous = { ...env };
  try {
    env.PAYMENT_ENVIRONMENT = 'test';
    const intent = await request('/api/payment-intent', { method: 'POST', body: {
      driver_code: 'DR-000481', vehicle_code: 'TR-01842', amount_centavos: 3000,
    } });
    assert.equal(intent.status, 201);
    const id = intent.body.payment_id;
    assert.match(id, /^PAY-[0-9a-f-]{36}$/);
    const payload = (type: string, livemode = false) => ({ data: { type: 'event', attributes: {
      type, livemode, data: { id: 'pay_unit_test', attributes: {
        amount: 3000, metadata: { payment_id: id }, source: { type: 'gcash' },
      } },
    } } });
    const send = (body: unknown, signature: 'te' | 'li' | 'missing' = 'te') => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const digest = crypto.createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
        .update(`${timestamp}.${JSON.stringify(body)}`).digest('hex');
      return request('/api/payment-webhook', { method: 'POST', body,
        headers: signature === 'missing' ? {} : { 'paymongo-signature': `t=${timestamp},${signature}=${digest}` },
      });
    };
    assert.equal((await send(payload('payment.paid'), 'missing')).status, 401);
    assert.equal((await send(payload('payment.paid'), 'li')).status, 401);
    assert.equal((await send(payload('payment.paid', true))).status, 400);
    assert.equal((await send(payload('payment.failed'))).body.ignored, true);
    assert.equal((await request(`/api/payment-status/${id}`)).body.payment_status, 'awaiting_confirmation');
    const confirmed = await send(payload('payment.paid'));
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.payment_id, id);
    const status = (await request(`/api/payment-status/${id}`)).body;
    assert.equal(status.payment_status, 'confirmed');
    assert.equal(status.payment_environment, 'test');
    assert.equal((await send(payload('payment.paid'))).body.message, 'Webhook duplicate already processed');
  } finally { Object.assign(env, previous); }
});
