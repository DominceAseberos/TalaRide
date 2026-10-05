import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { sse } from '../sse.js';
import { optionalAuth } from '../lib/auth.js';

export const shiftsRouter = Router();

export const ShiftStartSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format'),
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format')
});

export const ShiftEndSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format')
});

// POST /api/shift-start
shiftsRouter.post('/start', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      driver_code: req.body.driver_code || req.body.driverId || req.user?.driver_code,
      vehicle_code: req.body.vehicle_code || req.body.vehicleId
    };

    const parsed = ShiftStartSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { driver_code, vehicle_code } = parsed.data;

    // Check driver
    const driver = await repository.getDriver(driver_code);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    if (driver.verification_status !== 'verified') {
      return res.status(403).json({ error: 'Driver suspended or unverified' });
    }

    // Check vehicle
    const vehicle = await repository.getVehicle(vehicle_code);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (vehicle.status !== 'active') {
      return res.status(409).json({ error: 'Vehicle not active' });
    }

    // Starting the same driver/vehicle twice is idempotent for reconnecting clients.
    const existingShift = await repository.getActiveShiftForDriver(driver_code);
    if (existingShift) {
      if (existingShift.vehicle_code !== vehicle_code) {
        return res.status(409).json({
          error: 'Shift conflict',
          message: `Driver ${driver_code} already has an active shift on ${existingShift.vehicle_code}`
        });
      }
      return res.json({
        success: true,
        message: 'Existing active shift returned',
        shift: existingShift
      });
    }

    // Start shift
    const shift = await repository.startShift(driver_code, vehicle_code);

    // Broadcast update
    sse.notifyDriver(driver_code, 'shift_updated', {
      shift,
      driver_code,
      vehicle_code
    });

    return res.status(201).json({
      success: true,
      message: `Shift started for driver ${driver_code} with vehicle ${vehicle_code}`,
      shift
    });
  } catch (err: any) {
    if (err.message.includes('already has an active shift') || err.message.includes('already assigned')) {
      return res.status(409).json({ error: 'Shift conflict', message: err.message });
    }
    console.error('Error starting shift:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/shift-end
shiftsRouter.post('/end', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      driver_code: req.body.driver_code || req.body.driverId || req.user?.driver_code
    };

    const parsed = ShiftEndSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { driver_code } = parsed.data;

    const shift = await repository.endShift(driver_code);
    if (!shift) {
      return res.status(404).json({ error: 'No active shift found for driver' });
    }

    sse.notifyDriver(driver_code, 'shift_updated', {
      shift: null,
      driver_code
    });

    return res.json({
      success: true,
      message: 'Shift ended successfully',
      shift
    });
  } catch (err: any) {
    console.error('Error ending shift:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
