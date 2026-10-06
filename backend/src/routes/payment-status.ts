import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';

export const paymentStatusRouter = Router();

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

    return res.json({
      payment_id: payment.payment_id,
      payment_environment: payment.payment_environment ?? 'live',
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
