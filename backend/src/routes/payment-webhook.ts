import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env, paymentProviderConfigured } from '../env.js';
import { repository } from '../lib/repository.js';
import { sse } from '../sse.js';

export const paymentWebhookRouter = Router();

const PaymentWebhookSchema = z.object({
  event: z.string(),
  provider: z.enum(['gcash', 'maya', 'gotyme', 'qrph_bank', 'card', 'mock']),
  provider_ref: z.string().min(1, 'provider_ref is required'),
  payment_id: z.string().min(1, 'payment_id is required'),
  amount_centavos: z.number().int().positive('amount_centavos must be a positive integer'),
  passenger_id: z.string().optional()
});

// POST /api/payment-webhook
paymentWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const xSignature = req.headers['x-provider-signature'] as string | undefined;
    const paymongoSignature = (req.headers['paymongo-signature'] || req.headers['Paymongo-Signature']) as string | undefined;

    let normalizedPayload: any = req.body;
    let nativePayMongo = false;

    // Check if this is a native PayMongo webhook payload
    if (paymongoSignature || req.body?.data?.type === 'event') {
      nativePayMongo = true;
      if (!paymongoSignature || !env.PAYMENT_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET.startsWith('mock_')) {
        return res.status(401).json({ error: 'Signed PayMongo confirmation is required' });
      }
      if (env.NODE_ENV === 'production' && !paymentProviderConfigured()) {
        return res.status(503).json({ error: 'Payment gateway is not configured for this environment' });
      }
      const eventType = req.body?.data?.attributes?.type;
      const eventData = req.body?.data?.attributes?.data;

      // Extract payment ID from reference_number, description, or metadata
      const attrs = eventData?.attributes || {};
      const refNum = attrs.reference_number || attrs.external_reference_number || '';
      const metaPaymentId = attrs.metadata?.payment_id || '';
      const desc = attrs.description || '';
      const matchedPayId = [metaPaymentId, refNum, desc].map(value => String(value).match(/\bPAY-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+)\b/i)?.[0]).find(Boolean);

      // Extract amount in centavos
      const amountCentavos = attrs.amount || attrs.payments?.[0]?.attributes?.amount || 0;
      const providerRef = attrs.payments?.[0]?.id || eventData?.id;
      const methodUsed = attrs.payment_method_used || attrs.source?.type || 'gcash';

      // Verify PayMongo signature if configured
      if (paymongoSignature && env.PAYMENT_WEBHOOK_SECRET && !env.PAYMENT_WEBHOOK_SECRET.startsWith('mock_')) {
        const parts = Object.fromEntries(
          paymongoSignature.split(',').map((p) => p.trim().split('='))
        );
        const t = parts.t;
        const testSig = parts.te;
        const liveSig = parts.li;
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody || !t) {
          return res.status(401).json({ error: 'Invalid PayMongo signature payload' });
        }

        const expectedSig = crypto
          .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
          .update(`${t}.${rawBody.toString('utf8')}`)
          .digest('hex');

        const providedSig = env.PAYMENT_ENVIRONMENT === 'test' ? testSig : liveSig;
        if (!providedSig) {
          return res.status(401).json({ error: 'Missing PayMongo environment signature' });
        }

        const providedBuf = Buffer.from(providedSig, 'hex');
        const expectedBuf = Buffer.from(expectedSig, 'hex');
        const valid =
          providedBuf.length === expectedBuf.length &&
          crypto.timingSafeEqual(providedBuf, expectedBuf);

        if (!valid) {
          return res.status(401).json({ error: 'Invalid PayMongo signature' });
        }
      }

      if (typeof req.body?.data?.attributes?.livemode === 'boolean' &&
        req.body.data.attributes.livemode !== (env.PAYMENT_ENVIRONMENT === 'live')) {
        return res.status(400).json({ error: 'Payment environment mismatch' });
      }
      // Failed, chargeable, refund and unrelated events must never mark a ride paid.
      if (!['payment.paid', 'checkout_session.payment.paid'].includes(eventType)) {
        return res.json({ received: true, ignored: true });
      }
      if (!matchedPayId || !providerRef) {
        return res.status(400).json({ error: 'Could not identify TalaRide payment_id in PayMongo payload' });
      }

      const normalizedProvider =
        methodUsed === 'paymaya' || methodUsed === 'maya'
          ? 'maya'
          : methodUsed === 'qrph'
            ? 'qrph_bank'
            : methodUsed === 'card'
              ? 'card'
              : 'gcash';

      normalizedPayload = {
        event: eventType || 'payment.paid',
        provider: normalizedProvider,
        provider_ref: providerRef,
        payment_id: matchedPayId,
        amount_centavos: amountCentavos
      };
    } else {
      if (env.NODE_ENV !== 'test') {
        return res.status(401).json({ error: 'Signed PayMongo confirmation is required' });
      }
      // 1. Verify standard webhook signature
      if (!xSignature) {
        return res.status(401).json({ error: 'Missing x-provider-signature header' });
      }

      const payloadString = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
        .update(payloadString)
        .digest('hex');

      const sigBuf = Buffer.from(xSignature);
      const expBuf = Buffer.from(expectedSignature);
      const isValidSignature =
        sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

      if (!isValidSignature) {
        return res.status(401).json({ error: 'Invalid provider signature' });
      }
    }

    const parsed = PaymentWebhookSchema.safeParse(normalizedPayload);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed webhook payload', details: parsed.error.format() });
    }

    const { provider, provider_ref, payment_id, amount_centavos, passenger_id } = parsed.data;

    // 2. Verify payment exists
    const payment = await repository.getPayment(payment_id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (nativePayMongo && (payment.payment_environment ?? 'live') !== env.PAYMENT_ENVIRONMENT) {
      return res.status(400).json({ error: 'Payment environment mismatch' });
    }

    // 3. Verify payment amount matches exactly
    if (payment.amount_centavos !== amount_centavos) {
      return res.status(400).json({
        error: 'Amount mismatch',
        message: `Expected amount ${payment.amount_centavos} centavos, received ${amount_centavos} centavos`
      });
    }

    // 4. Verify payment status is not reversed or expired
    if (payment.payment_status === 'reversed' || payment.payment_status === 'refunded') {
      return res.status(400).json({
        error: 'Invalid state',
        message: `Payment is already ${payment.payment_status}`
      });
    }

    // 5. Idempotent check
    if (payment.payment_status === 'confirmed' && payment.provider_ref === provider_ref) {
      return res.json({
        success: true,
        message: 'Webhook duplicate already processed',
        status: 'confirmed',
        payment_id: payment.payment_id
      });
    }

    // 6. Provider reference uniqueness check across other payments
    const existingRefPayment = await repository.getPaymentByProviderRef(provider_ref);
    if (existingRefPayment && existingRefPayment.payment_id !== payment_id) {
      return res.status(409).json({
        error: 'Duplicate provider reference',
        message: `Provider reference ${provider_ref} has already been registered`
      });
    }

    // 7. Atomic confirmation transaction and passenger attachment.
    const confirmedAt = new Date().toISOString();
    const existingRide = await repository.getRide(payment.ride_id);
    const finalPassengerId = passenger_id || existingRide?.passenger_id || null;
    const passengerProfile = finalPassengerId
      ? await repository.getProfile(finalPassengerId)
      : null;
    const result = await repository.updatePaymentConfirmation({
      paymentId: payment_id,
      provider,
      providerRef: provider_ref,
      confirmedAt,
      passengerId: finalPassengerId,
      passengerName: passengerProfile?.full_name || null,
      passengerMobile: passengerProfile?.mobile_number || null
    });

    // 8. Mint reward if passenger attached
    if (finalPassengerId && payment.payment_environment !== 'test') {
      await repository.mintReward({
        userId: finalPassengerId,
        rideId: result.payment.ride_id,
        points: 1
      });
    }

    // 9. Real-time driver notification
    sse.notifyDriver(result.payment.driver_code, 'payment_confirmed', {
      payment_id: result.payment.payment_id,
      payment_environment: result.payment.payment_environment ?? 'live',
      ride_id: result.payment.ride_id,
      amount_centavos: result.payment.amount_centavos,
      net_centavos: result.payment.net_centavos,
      provider: result.payment.provider,
      provider_ref: result.payment.provider_ref,
      vehicle_code: result.payment.vehicle_code,
      confirmed_at: result.payment.confirmed_at
    });

    return res.json({
      success: true,
      status: 'confirmed',
      payment_id: result.payment.payment_id,
      provider_ref: result.payment.provider_ref
    });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
