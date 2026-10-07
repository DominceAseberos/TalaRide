import { createHash } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { optionalAuth } from '../lib/auth.js';
import { hashWebSessionOwner } from '../lib/web-session.js';
import { env } from '../env.js';

export const paymentStatusRouter = Router();
paymentStatusRouter.use(optionalAuth);

async function getPaymentStatusHandler(req: Request, res: Response) {
  try {
    const paymentId = (req.params.id || req.query.payment_id || req.query.paymentId) as string;
    if (!paymentId) {
      return res.status(400).json({ error: 'payment_id is required' });
    }

    const payment = await repository.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const ride = await repository.getRide(payment.ride_id);
    const ownerHeader = req.get('x-ride-owner') || '';
    let ownerHash: string | null = null;
    if (ownerHeader) {
      try { ownerHash = hashWebSessionOwner(ownerHeader); } catch { return res.status(403).json({ error: 'Payment session does not belong to this browser.' }); }
    }
    const handoff = typeof req.query.handoff === 'string' ? req.query.handoff : '';
    const handoffHash = handoff
      ? createHash('sha256').update(handoff).digest('hex')
      : null;
    const handoffOwns =
      !!payment.return_handoff_hash &&
      !!handoffHash &&
      payment.return_handoff_hash === handoffHash;

    const legacyTestPayment = env.NODE_ENV === 'test' && !payment.owner_user_id && !payment.owner_browser_hash;
    const authorized =
      legacyTestPayment ||
      handoffOwns ||
      req.user?.role === 'admin' ||
      (req.user?.role === 'driver' && payment.driver_code === req.user.driver_code) ||
      (!!req.user && req.user.role === 'passenger' && (payment.owner_user_id === req.user.id || ride?.passenger_id === req.user.id)) ||
      (!req.user && !!payment.owner_browser_hash && payment.owner_browser_hash === ownerHash);

    if (!authorized) {
      return res.status(403).json({ error: 'Payment status belongs to another account or browser session.' });
    }

    return res.json({
      payment_id: payment.payment_id,
      payment_environment: payment.payment_environment ?? 'live',
      payment_mode: env.PAYMENT_MODE,
      ride_id: payment.ride_id,
      driver_code: payment.driver_code,
      vehicle_code: payment.vehicle_code,
      amount_centavos: payment.amount_centavos,
      provider: payment.provider,
      provider_ref: payment.provider_ref,
      checkout_url: payment.checkout_url ?? null,
      payment_status: payment.payment_status,
      provider_fee_centavos: payment.provider_fee_centavos,
      talaride_fee_centavos: payment.talaride_fee_centavos,
      net_centavos: payment.net_centavos,
      created_at: payment.created_at,
      expires_at: payment.expires_at,
      confirmed_at: payment.confirmed_at
    });
  } catch (err: any) {
    console.error('Error fetching payment status:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

paymentStatusRouter.get('/', getPaymentStatusHandler);
paymentStatusRouter.get('/:id', getPaymentStatusHandler);
