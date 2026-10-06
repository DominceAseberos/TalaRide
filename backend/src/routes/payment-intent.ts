import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { calculateFeeBreakdown } from '../lib/money.js';
import { generatePaymentQR } from '../lib/qr.js';
import { optionalAuth } from '../lib/auth.js';
import { paymentIntentRateLimiter } from '../middleware/rate-limit.js';
import { createPayMongoCheckout, createPayMongoDirectGcash } from '../lib/paymongo.js';
import { env } from '../env.js';
import { consumeWebSession, validateWebSession } from '../lib/web-session.js';

export const paymentIntentRouter = Router();

export const PaymentIntentSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format'),
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  amount_centavos: z.number().int().positive('amount_centavos must be a positive integer'),
  payment_method: z.enum(['gcash', 'maya', 'card', 'qrph']).default('gcash'),
  approximate_location: z.string().optional().default('Tagum City'),
  session_id: z.string().min(20).max(128).optional()
});

// POST /api/payment-intent
paymentIntentRouter.post('/', paymentIntentRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
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
      session_id: req.body.session_id || req.body.sessionId
    };

    const parsed = PaymentIntentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Malformed input',
        details: parsed.error.format()
      });
    }

    const { driver_code, vehicle_code, amount_centavos, payment_method, approximate_location, session_id } = parsed.data;

    if (session_id && !validateWebSession(session_id, vehicle_code)) {
      return res.status(410).json({
        error: 'Session expired',
        message: 'This ride session has expired. Scan the vehicle QR code again to start a new payment.'
      });
    }

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

    // 6. Validate minimum fare amount (minimum 1000 centavos = ₱10.00)
    if (amount_centavos < 1000) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Fare amount must be at least 1000 centavos (₱10.00)'
      });
    }

    // 7. Atomic creation: Create Ride (status: pending)
    const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;

    const fareConfig = await repository.getFareConfig();
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
            paymentMethod: 'gcash'
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
            paymentMethod: payment_method
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

    const ride = await repository.createRide({
      ride_id: rideId,
      driver_code,
      driver_name: driver.full_name,
      vehicle_code,
      // Payment intents are created by the driver; passenger identity is attached only
      // when the commuter confirms or the payment provider settles the transaction.
      passenger_id: null,
      passenger_name: null,
      passenger_mobile: null,
      timestamp: new Date().toISOString(),
      approximate_location,
      payment_method: 'digital',
      fare_amount_centavos: amount_centavos,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // 9. Create Payment (status: awaiting_confirmation)
    const payment = await repository.createPayment({
      payment_id: paymentId,
      ride_id: rideId,
      driver_code,
      vehicle_code,
      amount_centavos,
      provider: payment_method === 'qrph' ? 'qrph_bank' : payment_method,
      provider_ref: null,
      checkout_session_id: checkoutSessionId,
      checkout_url: checkoutUrl,
      payment_status: 'awaiting_confirmation',
      provider_fee_centavos: feeBreakdown.providerFeeCentavos,
      talaride_fee_centavos: feeBreakdown.talarideFeeCentavos,
      net_centavos: feeBreakdown.netCentavos,
      qr_payload: qrPayload,
      qr_sig: signature,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      confirmed_at: null
    });

    // Record initiated event in audit trail
    await repository.addPaymentEvent({
      event_id: `EVT-${Date.now().toString().slice(-6)}`,
      payment_id: paymentId,
      event_type: 'intent_created',
      payload: { amount_centavos, ride_id: rideId, payment_method, session_id: session_id ?? null },
      created_at: new Date().toISOString()
    });

    if (session_id) consumeWebSession(session_id, vehicle_code);

    return res.status(201).json({
      success: true,
      payment_id: payment.payment_id,
      ride_id: ride.ride_id,
      driver_code: payment.driver_code,
      vehicle_code: payment.vehicle_code,
      amount_centavos: payment.amount_centavos,
      payment_method,
      provider_fee_centavos: payment.provider_fee_centavos,
      talaride_fee_centavos: payment.talaride_fee_centavos,
      net_centavos: payment.net_centavos,
      payment_status: payment.payment_status,
      expires_at: payment.expires_at,
      qr_payload: payment.qr_payload,
      checkout_url: checkoutUrl,
      session_id: session_id ?? null,
      payment_flow: payment_method === 'gcash' ? 'direct_gcash' : 'paymongo_checkout'
    });
  } catch (err: any) {
    console.error('Error generating payment intent:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
