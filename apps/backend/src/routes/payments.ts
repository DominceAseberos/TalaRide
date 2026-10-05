import { Router } from 'express';
import { paymentIntentRouter } from './payment-intent.js';
import { mockConfirmRouter } from './mock-confirm.js';
import { paymentStatusRouter } from './payment-status.js';
import { paymentIssuesRouter } from './payment-issues.js';

export const paymentsRouter = Router();

// Legacy compatibility routes
paymentsRouter.post('/create-qr', (req, res, next) => {
  (paymentIntentRouter as any).handle(Object.assign(req, { url: '/' }), res, next);
});

paymentsRouter.post('/confirm-payment', (req, res, next) => {
  (mockConfirmRouter as any).handle(Object.assign(req, { url: '/' }), res, next);
});

paymentsRouter.post('/issues', (req, res, next) => {
  (paymentIssuesRouter as any).handle(Object.assign(req, { url: '/payment-issue' }), res, next);
});

paymentsRouter.get('/:id', (req, res, next) => {
  (paymentStatusRouter as any).handle(Object.assign(req, { url: `/${req.params.id}` }), res, next);
});
