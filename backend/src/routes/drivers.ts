import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { optionalAuth, requireAuth } from '../lib/auth.js';
import { shiftsRouter } from './shifts.js';
import { ridesRouter } from './rides.js';
import { z } from 'zod';

export const driversRouter = Router();
driversRouter.post('/enroll', requireAuth, async (req, res) => {
  try {
    const parsed = z.object({ full_name: z.string().trim().min(2).max(100), mobile_number: z.string().trim().min(10).max(20), toda_operator: z.string().trim().min(2).max(100), license_number: z.string().trim().min(3).max(50) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Complete your driver details.' });
    const existing = await repository.getDriverByUserId(req.user!.id);
    if (existing) return res.status(409).json({ error: 'Driver registration already exists.' });
    const driver = await repository.registerDriver(req.user!.id, parsed.data);
    return res.status(201).json({ driver });
  } catch { return res.status(503).json({ error: 'Could not save driver registration. Please retry.' }); }
});

// Every driver's private records are scoped to their verified Auth identity.
driversRouter.use(async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  const { env } = await import('../env.js');
  if (env.NODE_ENV === 'test') return next();
  if (!req.user) return res.status(401).json({ error: 'Sign in to view driver records.' });
  const code = req.path.split('/')[1];
  if (/^DR-/.test(code) && req.user.driver_code !== code && req.user.role !== 'admin') return res.status(403).json({ error: 'This driver record belongs to another account.' });
  next();
});

const DriverPhotoSchema = z.object({
  photo_url: z.string().url().max(1000).nullable(),
});

// GET /api/drivers/:id
driversRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const driver = await repository.getDriver(String(req.params.id));
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const assignedVehicle = driver.assigned_vehicle_code
      ? await repository.getVehicle(driver.assigned_vehicle_code)
      : null;

    const activeShift = await repository.getActiveShiftForDriver(driver.driver_code);

    return res.json({
      driver,
      vehicle: assignedVehicle,
      activeShift
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/drivers/:id/summary
driversRouter.get('/:id/summary', optionalAuth, async (req: Request, res: Response) => {
  try {
    const driverId = String(req.params.id);
    const driver = await repository.getDriver(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const activeShift = await repository.getActiveShiftForDriver(driver.driver_code);
    const rides = await repository.getRides({ driver_code: driver.driver_code });
    const payments = await repository.getAllPayments({ query: driver.driver_code });

    return res.json({
      driver,
      activeShift,
      rides,
      payments
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/drivers/:id/notifications
// Mobile driver mode uses this polling fallback when native SSE is unavailable.
driversRouter.get('/:id/notifications', optionalAuth, async (req: Request, res: Response) => {
  try {
    const driver = await repository.getDriver(String(req.params.id));
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    const since = String(req.query.since ?? '');
    const sinceTime = since ? new Date(since).getTime() : 0;
    const [lostItems, payments] = await Promise.all([
      repository.getLostItems({ driver_code: driver.driver_code }),
      repository.getAllPayments({ query: driver.driver_code }),
    ]);
    const notifications = [
      ...lostItems.map((item) => ({
        id: item.report_id,
        kind: 'lost_item_reported' as const,
        title: 'Lost-item report received',
        message: `${item.item_category}: ${item.description}`,
        created_at: item.created_at,
        payload: item,
      })),
      ...payments
        .filter((payment) => payment.payment_status === 'confirmed' && payment.confirmed_at)
        .map((payment) => ({
          id: payment.payment_id,
          kind: 'payment_confirmed' as const,
          title: 'Payment received',
          message: `₱${(payment.amount_centavos / 100).toFixed(2)} confirmed for ${payment.vehicle_code}`,
          created_at: payment.confirmed_at as string,
          payload: payment,
        })),
    ]
      .filter((item) => new Date(item.created_at).getTime() > sinceTime)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json({ notifications });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// Driver self-service profile update. The server resolves the driver's code
// from the authenticated account so clients never need to trust a path value.
driversRouter.patch('/me/profile', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.driver_code) return res.status(403).json({ error: 'Driver account required' });
  const parsed = DriverPhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid profile image URL is required.' });
  const driver = await repository.updateDriverPhoto(req.user.driver_code, parsed.data.photo_url);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  return res.json({ driver });
});

driversRouter.patch('/:id/profile', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const canEdit =
    req.user.driver_code === String(req.params.id) ||
    ['admin', 'operator'].includes(req.user.role);
  if (!canEdit) return res.status(403).json({ error: 'You cannot edit this driver profile' });
  const parsed = DriverPhotoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid profile image URL is required.' });
  const driver = await repository.updateDriverPhoto(String(req.params.id), parsed.data.photo_url);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  return res.json({ driver });
});

// Compatibility forwarding for legacy frontend paths
driversRouter.post('/shifts/start', (req, res, next) => {
  (shiftsRouter as any).handle(Object.assign(req, { url: '/start' }), res, next);
});

driversRouter.post('/shifts/end', (req, res, next) => {
  (shiftsRouter as any).handle(Object.assign(req, { url: '/end' }), res, next);
});

driversRouter.post('/cash-ride', (req, res, next) => {
  (ridesRouter as any).handle(Object.assign(req, { url: '/cash-record' }), res, next);
});
