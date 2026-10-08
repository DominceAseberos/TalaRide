import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { calculateFeeBreakdown } from '../lib/money.js';
import { generatePaymentQR } from '../lib/qr.js';
import { optionalAuth } from '../lib/auth.js';
import { paymentIntentRateLimiter } from '../middleware/rate-limit.js';
import { createPayMongoCheckout, createPayMongoDirectGcash } from '../lib/paymongo.js';
import type { Ride, Payment } from '../types.js';
import { env, paymentProviderConfigured, paymentSimulationConfigured } from '../env.js';
import { attachPaymentToWebSession, hashWebSessionOwner, reserveWebSession, releaseWebSession } from '../lib/web-session.js';

export const paymentIntentRouter = Router();

export const PaymentIntentSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format'),
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  amount_centavos: z.number().int().positive('amount_centavos must be a positive integer'),
  payment_method: z.enum(['gcash', 'maya', 'card', 'qrph']).default('gcash'),
  approximate_location: z.string().optional().default('Tagum City'),
  session_id: z.string().min(20).max(128).optional(),
  client_operation_id: z.string().min(8).max(160).optional()
});

// POST /api/payment-intent
paymentIntentRouter.post('/', paymentIntentRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  let reservedSession: string | undefined;
  let completed = false;
  const owner = req.get('x-ride-owner') || '';
  try {
    if (req.user && req.user.role !== 'passenger') {
      return res.status(403).json({ error: 'Passenger payment QR', message: 'This QR is for passengers paying a fare. Driver and staff accounts cannot make passenger payments.' });
    }
    if (env.PAYMENT_MODE === 'mock' && !paymentSimulationConfigured()) {
      return res.status(503).json({ error: 'Payment simulation is not enabled for this deployment.' });
    }
    if (env.NODE_ENV === 'production' && env.PAYMENT_MODE === 'live' && !paymentProviderConfigured()) {
      return res.status(503).json({ error: 'Payment gateway is not configured for this environment.' });
    }
    // Normalize body if legacy camelCase properties are provided
    const rawBody = {
      driver_code: req.body.driver_code || req.body.driverId,
      vehicle_code: req.body.vehicle_code || req.body.vehicleId,
      amount_centavos:
        req.body.amount_centavos !== undefined
          ? req.body.amount_centavos
          : req.body.fareAmount !== undefined
          ? Math.round(Number(req.body.fareAmount) * 100)
          : undefined,
      payment_method: req.body.payment_method || req.body.paymentMethod || 'gcash',
      approximate_location: req.body.approximate_location || req.body.approximateLocation,
      session_id: req.body.session_id || req.body.sessionId,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId || (req.headers['idempotency-key'] as string)
    };

    const parsed = PaymentIntentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Malformed input',
        details: parsed.error.format()
      });
    }

    const { driver_code, vehicle_code, amount_centavos, payment_method, approximate_location, session_id, client_operation_id } = parsed.data;
    const ownerBrowserHash = owner ? hashWebSessionOwner(owner) : null;
    const operationId = client_operation_id || (session_id ? `guest-payment:${session_id}` : undefined);

    if (env.NODE_ENV !== 'test' && !req.user && !session_id) return res.status(401).json({ error: 'Scan the vehicle QR to start your payment session.' });

    if (operationId && (req.user?.id || ownerBrowserHash)) {
      const existingPayment = await repository.getPaymentByClientOperation({
        clientOperationId: operationId,
        ownerUserId: req.user?.id ?? null,
        ownerBrowserHash,
        environment: env.PAYMENT_ENVIRONMENT,
      });
      if (existingPayment) {
        const existingRide = await repository.getRide(existingPayment.ride_id);
        return res.status(200).json({
          success: true,
          retry: true,
          payment_id: existingPayment.payment_id,
          ride_id: existingPayment.ride_id,
          driver_code: existingPayment.driver_code,
          vehicle_code: existingPayment.vehicle_code,
          amount_centavos: existingPayment.amount_centavos,
          payment_method: existingPayment.provider === 'qrph_bank' ? 'qrph' : existingPayment.provider,
          provider_fee_centavos: existingPayment.provider_fee_centavos,
          talaride_fee_centavos: existingPayment.talaride_fee_centavos,
          net_centavos: existingPayment.net_centavos,
          payment_status: existingPayment.payment_status,
          payment_environment: existingPayment.payment_environment,
          expires_at: existingPayment.expires_at,
          qr_payload: existingPayment.qr_payload,
          checkout_url: existingPayment.checkout_url ?? null,
          session_id: existingPayment.guest_session_id ?? null,
          ride_status: existingRide?.status ?? null,
          payment_flow: env.PAYMENT_MODE === 'mock' ? 'simulated' : existingPayment.provider === 'gcash' ? 'direct_gcash' : 'paymongo_checkout'
        });
      }
    }

    if (session_id && !await reserveWebSession(session_id, vehicle_code, owner)) {
      return res.status(410).json({
        error: 'Session expired',
        message: 'This ride session has expired. Scan the vehicle QR code again to start a new payment.'
      });
    }

    reservedSession = session_id;
    // 1. Validate Driver exists
    const driver = await repository.getDriver(driver_code);
    if (!driver) {
      return res.status(404).json({
        error: 'Driver not found',
        message: `Driver with code ${driver_code} does not exist in registry`
      });
    }

    // 2. Validate Driver status
    if (driver.verification_status === 'suspended') {
      return res.status(403).json({
        error: 'Driver suspended',
        message: 'Suspended drivers are prohibited from generating payment intents'
      });
    }
    if (driver.verification_status !== 'verified') {
      return res.status(403).json({
        error: 'Driver unverified',
        message: 'Driver verification is pending approval'
      });
    }

    // 3. Validate Vehicle exists and is active
    const vehicle = await repository.getVehicle(vehicle_code);
    if (!vehicle) {
      return res.status(404).json({
        error: 'Vehicle not found',
        message: `Vehicle with code ${vehicle_code} does not exist in registry`
      });
    }
    if (vehicle.status !== 'active') {
      return res.status(409).json({
        error: 'Vehicle inactive',
        message: `Vehicle ${vehicle_code} is currently ${vehicle.status}`
      });
    }

    // 4. Validate Driver active shift
    const activeShift = await repository.getActiveShiftForDriver(driver_code);
    if (!activeShift) {
      return res.status(409).json({
        error: 'No active shift',
        message: `Driver ${driver_code} does not currently have an active shift`
      });
    }

    // 5. Validate Vehicle matches shift
    if (activeShift.vehicle_code !== vehicle_code) {
      return res.status(409).json({
        error: 'Vehicle mismatch',
        message: `Active shift is bound to vehicle ${activeShift.vehicle_code}, not ${vehicle_code}`
      });
    }

    const fareConfig = await repository.getFareConfig();
    if (amount_centavos < fareConfig.min_custom_fare_centavos || amount_centavos > fareConfig.max_custom_fare_centavos) {
      return res.status(400).json({ error: 'Fare is outside the supported range.' });
    }
    const rideId = `RIDE-${randomUUID()}`;
    const paymentId = `PAY-${randomUUID()}`;

    const feeBreakdown = calculateFeeBreakdown(
      amount_centavos,
      fareConfig.provider_fee_basis_points,
      fareConfig.talaride_fee_basis_points
    );

    // 8. Generate TalaRide signed QR (expiry: 300 seconds)
    const { qrPayload, expiresAt, signature } = generatePaymentQR({
      paymentId,
      rideId,
      vehicleCode: vehicle_code,
      amountCentavos: amount_centavos,
      expiresInSeconds: 300
    });

    // A provider-return browser gets a capability scoped to this one payment.
    // Only its SHA-256 hash is stored; the raw token exists only in the provider
    // return URL. Guest web checkouts already use their browser-owner capability.
    const returnHandoff = req.user ? randomBytes(32).toString('base64url') : null;
    const returnHandoffHash = returnHandoff
      ? createHash('sha256').update(returnHandoff).digest('hex')
      : null;

    // 9. In provider-authoritative mode, create the PayMongo checkout before
    // persisting a pending ride/payment. This prevents orphaned unpaid records.
    let checkoutSessionId: string | null = null;
    let checkoutUrl: string | null = null;
    if (env.PAYMENT_MODE === 'live') {
      if (!env.PAYMENT_PROVIDER_KEY || !env.PAYMENT_PROVIDER_KEY.startsWith('sk_')) {
        return res.status(503).json({
          error: 'Payment provider unavailable',
          message: 'PayMongo secret key is not configured'
        });
      }
      try {
        if (payment_method === 'gcash') {
          const gcashResult = await createPayMongoDirectGcash({
            paymentId,
            rideId,
            vehicleCode: vehicle_code,
            driverCode: driver_code,
            amountCentavos: amount_centavos,
            paymentMethod: 'gcash',
            returnHandoff
          });
          // Existing persistence column is kept for compatibility; for direct GCash
          // it stores the PayMongo PaymentIntent id instead of a Checkout Session id.
          checkoutSessionId = gcashResult.paymentIntentId;
          checkoutUrl = gcashResult.redirectUrl;
        } else {
          const pmResult = await createPayMongoCheckout({
            paymentId,
            rideId,
            vehicleCode: vehicle_code,
            driverCode: driver_code,
            amountCentavos: amount_centavos,
            paymentMethod: payment_method,
            returnHandoff
          });
          checkoutSessionId = pmResult.checkoutSessionId;
          checkoutUrl = pmResult.checkoutUrl;
        }
      } catch (pmErr: any) {
        console.error('PayMongo payment initialization failed:', pmErr.message);
        return res.status(502).json({
          error: 'Payment provider unavailable',
          message: payment_method === 'gcash'
            ? 'Could not start GCash authorization'
            : 'Could not create PayMongo checkout session'
        });
      }
    }

    const ride: Ride = {
      ride_id: rideId,
      driver_code,
      driver_name: driver.full_name,
      vehicle_code,
      passenger_id: req.user?.role === 'passenger' ? req.user.id : null,
      passenger_name: null,
      passenger_mobile: null,
      timestamp: new Date().toISOString(),
      approximate_location,
      payment_method: 'digital',
      fare_amount_centavos: amount_centavos,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // 9. Create Payment (status: awaiting_confirmation)
    const payment: Payment = {
      payment_id: paymentId,
      ride_id: rideId,
      driver_code,
      vehicle_code,
      shift_id: activeShift.shift_id,
      client_operation_id: operationId || null,
      owner_user_id: req.user?.id ?? null,
      owner_browser_hash: ownerBrowserHash,
      guest_session_id: session_id ?? null,
      return_handoff_hash: returnHandoffHash,
      amount_centavos,
      provider: payment_method === 'qrph' ? 'qrph_bank' : payment_method,
      provider_ref: null,
      checkout_session_id: checkoutSessionId,
      checkout_url: checkoutUrl,
      payment_status: 'awaiting_confirmation',
      payment_environment: env.PAYMENT_ENVIRONMENT,
      provider_fee_centavos: feeBreakdown.providerFeeCentavos,
      talaride_fee_centavos: feeBreakdown.talarideFeeCentavos,
      net_centavos: feeBreakdown.netCentavos,
      qr_payload: qrPayload,
      qr_sig: signature,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      confirmed_at: null
    };

    // Bind the reserved guest session before persisting the payment. If the
    // durable payment write fails, the finally block releases the reservation.
    if (session_id) {
      const attached = await attachPaymentToWebSession(session_id, owner, paymentId);
      if (!attached) throw new Error('Ride session could not be attached to the payment.');
    }

    // Record initiated event in audit trail. The repository performs the
    // idempotency decision inside the same serialized mutation as the insert,
    // so concurrent requests with one operation key resolve to one record.
    const saved = await repository.createRideAndPayment(ride, payment, {
      event_id: `EVT-${randomUUID()}`,
      payment_id: paymentId,
      event_type: 'intent_created',
      payload: { amount_centavos, ride_id: rideId, payment_method },
      created_at: new Date().toISOString()
    });
    completed = true;

    const savedPayment = saved.payment;
    const savedRide = saved.ride;
    return res.status(saved.created ? 201 : 200).json({
      success: true,
      retry: !saved.created,
      payment_id: savedPayment.payment_id,
      ride_id: savedRide.ride_id,
      driver_code: savedPayment.driver_code,
      vehicle_code: savedPayment.vehicle_code,
      amount_centavos: savedPayment.amount_centavos,
      payment_method: savedPayment.provider === 'qrph_bank' ? 'qrph' : savedPayment.provider,
      provider_fee_centavos: savedPayment.provider_fee_centavos,
      talaride_fee_centavos: savedPayment.talaride_fee_centavos,
      net_centavos: savedPayment.net_centavos,
      payment_status: savedPayment.payment_status,
      payment_environment: savedPayment.payment_environment,
      expires_at: savedPayment.expires_at,
      qr_payload: savedPayment.qr_payload,
      checkout_url: savedPayment.checkout_url ?? null,
      session_id: savedPayment.guest_session_id ?? null,
      payment_flow: env.PAYMENT_MODE === 'mock' ? 'simulated' : savedPayment.provider === 'gcash' ? 'direct_gcash' : 'paymongo_checkout'
    });
  } catch (err: any) {
    console.error('Error generating payment intent:', err);
    return res.status(503).json({ error: 'Payment could not be saved. Please contact support before retrying.' });
  } finally {
    if (reservedSession && !completed) await releaseWebSession(reservedSession, owner);
  }
});
