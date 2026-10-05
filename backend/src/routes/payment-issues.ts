import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { idempotencyStore } from '../lib/idempotency.js';
import { optionalAuth } from '../lib/auth.js';
import { PaymentIssueTicket } from '../types.js';

export const paymentIssuesRouter = Router();

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
      reported_by: req.body.reported_by || req.body.reportedBy || req.user?.id,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId
    };

    const parsed = PaymentIssueSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { payment_id, ride_id, issue_type, description, reported_by, client_operation_id } = parsed.data;

    if (client_operation_id) {
      const cached = idempotencyStore.get(client_operation_id);
      if (cached) {
        return res.status(cached.statusCode).json(cached.responseBody);
      }
    }

    const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
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

    if (client_operation_id) {
      idempotencyStore.set(client_operation_id, '/api/payment-issue', 201, responseBody);
    }

    return res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error reporting payment issue:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
