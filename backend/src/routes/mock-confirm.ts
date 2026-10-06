import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { repository } from '../lib/repository.js';
import { sse } from '../sse.js';
import { optionalAuth } from '../lib/auth.js';

export const mockConfirmRouter = Router();

const MockConfirmSchema = z.object({
  payment_id: z.string().min(1, 'payment_id is required'),
  provider: z.enum(['gcash', 'maya', 'gotyme', 'qrph_bank', 'mock']).default('gcash'),
  passenger_id: z.string().optional()
});

// POST /api/mock-confirm
mockConfirmRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    // 1. Strict guard: Mock confirmation prohibited in live production mode
    if (env.NODE_ENV !== 'test' || env.PAYMENT_MODE !== 'mock') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Mock payment confirmation is disabled in production live mode. Provider webhook required.'
      });
    }

    const rawBody = {
      payment_id: req.body.payment_id || req.body.paymentId,
      provider: req.body.provider || 'gcash',
      passenger_id: req.body.passenger_id || req.body.passengerId || req.user?.id
    };

    const parsed = MockConfirmSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { payment_id, provider, passenger_id } = parsed.data;

    // 2. Fetch payment record
    const payment = await repository.getPayment(payment_id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // 3. Idempotent check
    if (payment.payment_status === 'confirmed') {
      const ride = await repository.getRide(payment.ride_id);
      const driver = await repository.getDriver(payment.driver_code);
      const rewardsAwarded = await repository.mintRideRewards({
        passengerUserId: ride?.passenger_id,
        driverUserId: driver?.user_id,
        rideId: payment.ride_id,
        environment: payment.payment_environment ?? env.PAYMENT_ENVIRONMENT
      });
      return res.json({
        success: true,
        message: 'Payment was already confirmed',
        payment,
        ride,
        points_awarded: rewardsAwarded.passengerPointsAwarded,
        driver_points_awarded: rewardsAwarded.driverPointsAwarded
      });
    }

    // 4. Verify QR expiration (300 seconds)
    const isExpired = new Date(payment.expires_at).getTime() < Date.now();
    if (isExpired) {
      payment.payment_status = 'expired';
      return res.status(400).json({
        error: 'Payment expired',
        message: 'The QR payment session has expired (300s limit). Please ask driver to generate a new QR.'
      });
    }

    // 5. Atomic confirmation. The commuter is attached to the pending ride here,
    // never when the driver creates the payment intent.
    const providerRef = `${provider.toUpperCase()}-REF-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const confirmedAt = new Date().toISOString();
    const finalPassengerId = req.user?.id || passenger_id;
    const passengerProfile = finalPassengerId
      ? await repository.getProfile(finalPassengerId)
      : null;

    const result = await repository.updatePaymentConfirmation({
      paymentId: payment_id,
      provider,
      providerRef,
      confirmedAt,
      passengerId: finalPassengerId,
      passengerName: req.user?.full_name || passengerProfile?.full_name || null,
      passengerMobile: req.user?.mobile_number || passengerProfile?.mobile_number || null
    });

    // 6. Mint a point for both participants as one durable write.
    const driver = await repository.getDriver(result.payment.driver_code);
    const rewardsAwarded = await repository.mintRideRewards({
      passengerUserId: finalPassengerId,
      driverUserId: driver?.user_id,
      rideId: result.payment.ride_id,
      environment: result.payment.payment_environment ?? env.PAYMENT_ENVIRONMENT
    });

    // 7. Secure SSE push to authenticated driver
    sse.notifyDriver(result.payment.driver_code, 'payment_confirmed', {
      payment_id: result.payment.payment_id,
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
      message: 'Payment confirmed successfully',
      payment: result.payment,
      ride: result.ride,
      points_awarded: rewardsAwarded.passengerPointsAwarded,
      driver_points_awarded: rewardsAwarded.driverPointsAwarded
    });
  } catch (err: any) {
    console.error('Error in mock confirmation:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
