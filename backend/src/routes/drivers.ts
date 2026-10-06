import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { optionalAuth } from '../lib/auth.js';
import { shiftsRouter } from './shifts.js';
import { ridesRouter } from './rides.js';
import { z } from 'zod';

export const driversRouter = Router();

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

driversRouter.patch('/:id/profile', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const canEdit =
    req.user.driver_code === String(req.params.id) ||
    ['talaride_admin', 'operator', 'lgu_admin'].includes(req.user.role);
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
