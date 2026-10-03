import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { driversRouter } from './routes/drivers.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { ridesRouter } from './routes/rides.js';
import { paymentsRouter } from './routes/payments.js';
import { lostItemsRouter } from './routes/lostItems.js';
import { rewardsRouter } from './routes/rewards.js';
import { adminRouter } from './routes/admin.js';
import { sse } from './sse.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for frontend development and production origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Real-time Server-Sent Events stream for driver audio/vibration alerts & UI updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const driverId = req.query.driverId as string | undefined;
  const role = req.query.role as string | undefined;

  sse.addClient(clientId, res, role, driverId);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'talaride-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0-mvp'
  });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/lost-items', lostItemsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/admin', adminRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 TalaRide Backend API running on http://localhost:${PORT}`);
  console.log(`📡 Real-time SSE stream available at http://localhost:${PORT}/api/events`);
});
