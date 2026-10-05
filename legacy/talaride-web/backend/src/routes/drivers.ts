import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { optionalAuth } from '../lib/auth.js';
import { shiftsRouter } from './shifts.js';
import { ridesRouter } from './rides.js';

export const driversRouter = Router();

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
