import { randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth } from '../lib/auth.js';
import { PaymentIssueTicket } from '../types.js';

export const paymentIssuesRouter = Router();
paymentIssuesRouter.use(productionAuth);

export const PaymentIssueSchema = z.object({
  payment_id: z.string().optional(),
  ride_id: z.string().optional(),
  issue_type: z.enum([
    'paid_twice',
    'wrong_amount',
    'deducted_no_driver_confirm',
    'incorrect_custom_fare',
    'other'
  ]),
  description: z.string().min(3, 'description must be at least 3 characters'),
  reported_by: z.string().optional(),
  client_operation_id: z.string().optional()
});

// POST /api/payment-issue
paymentIssuesRouter.post('/payment-issue', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      payment_id: req.body.payment_id || req.body.paymentId,
      ride_id: req.body.ride_id || req.body.rideId,
      issue_type: req.body.issue_type || req.body.issueType,
      description: req.body.description,
      reported_by: req.user?.id,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId
    };

    const parsed = PaymentIssueSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { payment_id, ride_id, issue_type, description, reported_by, client_operation_id } = parsed.data;


    const relatedPayment = payment_id ? await repository.getPayment(payment_id) : null;
    const relatedRide = (ride_id || relatedPayment?.ride_id) ? await repository.getRide(ride_id || relatedPayment!.ride_id) : null;
    if (req.user && !['talaride_admin', 'lgu_admin'].includes(req.user.role) && (!relatedRide || (relatedRide.passenger_id !== req.user.id && relatedRide.driver_code !== req.user.driver_code))) return res.status(403).json({ error: 'You may report issues only for your own ride.' });
    const ticketId = `TKT-${randomUUID()}`;
    const ticket: PaymentIssueTicket = {
      ticket_id: ticketId,
      payment_id: payment_id || null,
      ride_id: ride_id || null,
      issue_type,
      description,
      status: 'pending',
      reported_by: reported_by || null,
      reported_by_name: req.user?.full_name || 'Passenger',
      resolution_notes: null,
      client_operation_id: client_operation_id || null,
      created_at: new Date().toISOString(),
      resolved_at: null
    };

    const createdTicket = await repository.createPaymentIssue(ticket);

    const responseBody = {
      success: true,
      message: 'Payment issue report submitted. TalaRide support will review with payment provider.',
      ticket: createdTicket
    };


    return res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error reporting payment issue:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
