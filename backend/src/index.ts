import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { sse } from './sse.js';
import { repository } from './lib/repository.js';

// Canonical Routers
import { paymentIntentRouter } from './routes/payment-intent.js';
import { mockConfirmRouter } from './routes/mock-confirm.js';
import { paymentWebhookRouter } from './routes/payment-webhook.js';
import { paymentStatusRouter } from './routes/payment-status.js';
import { shiftsRouter } from './routes/shifts.js';
import { faresRouter } from './routes/fares.js';
import { ridesRouter } from './routes/rides.js';
import { lostItemsRouter } from './routes/lost-items.js';
import { rewardsRouter } from './routes/rewards.js';
import { paymentIssuesRouter } from './routes/payment-issues.js';
import { adminRouter } from './routes/admin.js';
import { publicVehiclesRouter } from './routes/public-vehicles.js';

// Compatibility Routers
import { authRouter } from './routes/auth.js';
import { driversRouter } from './routes/drivers.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { paymentsRouter } from './routes/payments.js';

export const app = express();
const PORT = env.PORT || 4000;

// CORS configuration honoring WEB_ORIGIN and development localhost
const allowedOrigins = new Set(
  [...env.WEB_ORIGIN.split(','), env.PUBLIC_WEB_ORIGIN]
    .map((origin) => origin.trim())
    .filter(Boolean)
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow native mobile, curl, server-to-server
      if (allowedOrigins.has('*') || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      if (env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-signature', 'idempotency-key', 'x-ride-owner']
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      // PayMongo signs the exact raw request bytes. Preserve them before JSON parsing.
      const expressReq = req as express.Request & { rawBody?: Buffer };
      if (expressReq.originalUrl?.startsWith('/api/payment-webhook')) {
        expressReq.rawBody = Buffer.from(buf);
      }
    }
  })
);

// Real-time Server-Sent Events stream (Section 19: Authenticated JWT)
app.get('/api/events', (req, res) => {
  sse.handleConnection(req, res);
});

// Liveness Health Check (Section 28)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'talaride-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0-canonical'
  });
});

// Readiness Check verifying database, secrets, and environment (Section 28)
app.get('/api/ready', async (_req, res) => {
  const readiness = await repository.checkReadiness();
  if (readiness.ready) {
    return res.json({
      status: 'ready',
      service: 'talaride-backend',
      timestamp: new Date().toISOString(),
      details: readiness.details
    });
  } else {
    return res.status(503).json({
      status: 'not_ready',
      message: 'Service readiness checks failed',
      details: readiness.details
    });
  }
});

// ==========================================
// CANONICAL BACKEND CONTRACT ROUTES (Section 7)
// ==========================================

// 1. Payment Lifecycle
app.use('/api/payment-intent', paymentIntentRouter);
if (env.NODE_ENV === 'test') app.use('/api/mock-confirm', mockConfirmRouter);
app.use('/api/payment-webhook', paymentWebhookRouter);
app.use('/api/payment-status', paymentStatusRouter);

// 2. Driver Shifts & Meters
app.post('/api/shift-start', (req, res, next) => {
  (shiftsRouter as any).handle(Object.assign(req, { url: '/start' }), res, next);
});
app.post('/api/shift-end', (req, res, next) => {
  (shiftsRouter as any).handle(Object.assign(req, { url: '/end' }), res, next);
});

// 3. Fares
app.use('/api/fares', faresRouter);

// 4. Rides, Cash Record & Safety Checkin
app.post('/api/cash-record', (req, res, next) => {
  (ridesRouter as any).handle(Object.assign(req, { url: '/cash-record' }), res, next);
});
app.post('/api/ride-checkin', (req, res, next) => {
  (ridesRouter as any).handle(Object.assign(req, { url: '/ride-checkin' }), res, next);
});
app.use('/api/rides', ridesRouter);

// 5. Lost Items Mediated Workflow
app.post('/api/lost-item-report', (req, res, next) => {
  (lostItemsRouter as any).handle(Object.assign(req, { url: '/lost-item-report' }), res, next);
});
app.post('/api/lost-item-respond', (req, res, next) => {
  (lostItemsRouter as any).handle(Object.assign(req, { url: '/lost-item-respond' }), res, next);
});
app.use('/api/lost-items', lostItemsRouter);

// 6. Rewards
app.get('/api/rewards-me', (req, res, next) => {
  (rewardsRouter as any).handle(Object.assign(req, { url: '/rewards-me' }), res, next);
});
app.use('/api/rewards', rewardsRouter);

// 7. Payment Issues Dispute
app.post('/api/payment-issue', (req, res, next) => {
  (paymentIssuesRouter as any).handle(Object.assign(req, { url: '/payment-issue' }), res, next);
});

// 8. Protected Admin Endpoints (Section 6)
app.use('/api/admin', adminRouter);

// 9. Public Vehicle Page Validation (Section 21)
app.use('/api/public/vehicles', publicVehiclesRouter);

// ==========================================
// COMPATIBILITY ADAPTER ROUTES
// ==========================================
app.use('/api/auth', authRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/payments', paymentsRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Only start listening if executed directly (not when running in test suites)
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.argv.includes('--test') ||
  process.argv.some((arg) => arg.includes('test'));

if (!isTestEnv) {
  app.listen(PORT, () => {
    console.log(`🚀 TalaRide Canonical Backend running on http://localhost:${PORT}`);
    console.log(`📡 Secure Authenticated SSE stream at http://localhost:${PORT}/api/events`);
    console.log(`🔒 Payment Mode: ${env.PAYMENT_MODE.toUpperCase()}`);
  });
}
