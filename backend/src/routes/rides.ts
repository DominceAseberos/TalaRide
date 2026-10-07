import { randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth, canManageDriver } from '../lib/auth.js';
import { Ride } from '../types.js';
import { env } from '../env.js';

export const ridesRouter = Router();
ridesRouter.use(productionAuth);

async function operatorDriverCodes(req: Request): Promise<Set<string> | null> {
  if (req.user?.role !== 'operator') return null;
  const groupId = req.user.toda_group?.id;
  if (!groupId) return new Set();
  return new Set(
    (await repository.getAllDrivers())
      .filter((driver) => driver.toda_group_id === groupId)
      .map((driver) => driver.driver_code),
  );
}

export const CashRecordSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format'),
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  amount_centavos: z.number().int().positive('amount_centavos must be a positive integer'),
  approximate_location: z.string().optional().default('Tagum City Center'),
  client_operation_id: z.string().optional()
});

export const CashRequestSchema = z.object({
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  amount_centavos: z.number().int().min(100).max(50000),
  approximate_location: z.string().optional().default('Tagum City'),
  client_operation_id: z.string().min(8).max(160)
});

export const CashConfirmSchema = z.object({
  ride_id: z.string().min(8)
});

export const RideCheckinSchema = z.object({
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  passenger_name: z.string().optional(),
  approximate_location: z.string().optional().default('Tagum City'),
  client_operation_id: z.string().optional()
});

// POST /api/rides/cash-request
// Passenger declares the fare as cash, but the ride remains pending until the
// assigned driver explicitly confirms that cash was actually received.
ridesRouter.post('/cash-request', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sign in to request a cash payment.' });
    if (req.user.role !== 'passenger') {
      return res.status(403).json({ error: 'Only passengers can request a cash payment.' });
    }

    const parsed = CashRequestSchema.safeParse({
      vehicle_code: req.body.vehicle_code || req.body.vehicleId,
      amount_centavos: req.body.amount_centavos,
      approximate_location: req.body.approximate_location || req.body.approximateLocation,
      client_operation_id:
        req.body.client_operation_id ||
        req.body.clientOperationId ||
        (req.headers['idempotency-key'] as string)
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { vehicle_code, amount_centavos, approximate_location, client_operation_id } = parsed.data;
    const vehicle = await repository.getVehicle(vehicle_code);
    if (!vehicle || vehicle.status !== 'active') {
      return res.status(404).json({ error: 'Active vehicle not found.' });
    }
    const activeShift = await repository.getActiveShiftForVehicle(vehicle_code);
    if (!activeShift) return res.status(409).json({ error: 'No active driver shift for this vehicle.' });
    const driver = await repository.getDriver(activeShift.driver_code);
    if (!driver || driver.verification_status !== 'verified') {
      return res.status(409).json({ error: 'No verified driver is currently active.' });
    }

    const rideId = `RIDE-${randomUUID()}`;
    const newRide: Ride = {
      ride_id: rideId,
      driver_code: driver.driver_code,
      driver_name: driver.full_name,
      vehicle_code,
      shift_id: activeShift.shift_id,
      passenger_id: req.user.id,
      passenger_name: req.user.full_name || 'Passenger',
      passenger_mobile: req.user.mobile_number || null,
      timestamp: new Date().toISOString(),
      approximate_location,
      payment_method: 'cash',
      fare_amount_centavos: amount_centavos,
      status: 'pending',
      is_checkin_only: false,
      client_operation_id,
      created_at: new Date().toISOString()
    };

    const ride = await repository.createRide(newRide);
    const retry = ride.ride_id !== rideId;
    return res.status(retry ? 200 : 201).json({
      success: true,
      retry,
      message: 'Cash payment is waiting for driver confirmation.',
      ride
    });
  } catch (err: any) {
    console.error('Error requesting cash payment:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/rides/cash-confirm
ridesRouter.post('/cash-confirm', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = CashConfirmSchema.safeParse({
      ride_id: req.body.ride_id || req.body.rideId
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const ride = await repository.getRide(parsed.data.ride_id);
    if (!ride) return res.status(404).json({ error: 'Cash ride not found.' });
    if (!req.user) return res.status(401).json({ error: 'Driver sign-in required.' });
    const assignedDriver =
      req.user.role === 'driver' && req.user.driver_code === ride.driver_code;
    if (!assignedDriver && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned driver can confirm this cash payment.' });
    }

    const driver = await repository.getDriver(ride.driver_code);
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });
    const alreadyCompleted = ride.status === 'completed';
    const confirmedRide = await repository.confirmPendingCashRide(ride.ride_id, ride.driver_code);
    if (!confirmedRide) return res.status(404).json({ error: 'Cash ride not found.' });

    const rewards = alreadyCompleted
      ? { passengerPointsAwarded: 0, driverPointsAwarded: 0 }
      : await repository.mintRideRewards({
          passengerUserId: confirmedRide.passenger_id,
          driverUserId: driver.user_id,
          rideId: confirmedRide.ride_id,
          environment: env.PAYMENT_ENVIRONMENT
        });

    return res.json({
      success: true,
      duplicate: alreadyCompleted,
      ride: confirmedRide,
      points_awarded: rewards.passengerPointsAwarded,
      driver_points_awarded: rewards.driverPointsAwarded
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Could not confirm cash payment.';
    if (message.includes('does not belong') || message.includes('not awaiting')) {
      return res.status(409).json({ error: message });
    }
    console.error('Error confirming cash payment:', err);
    return res.status(500).json({ error: 'Server error', message });
  }
});

// POST /api/cash-record
ridesRouter.post('/cash-record', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      driver_code: req.body.driver_code || req.body.driverId || req.user?.driver_code,
      vehicle_code: req.body.vehicle_code || req.body.vehicleId,
      amount_centavos:
        req.body.amount_centavos !== undefined
          ? req.body.amount_centavos
          : req.body.fareAmount !== undefined
          ? Math.round(Number(req.body.fareAmount) * 100)
          : undefined,
      approximate_location: req.body.approximate_location || req.body.approximateLocation,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId || (req.headers['idempotency-key'] as string)
    };

    const parsed = CashRecordSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { driver_code, vehicle_code, amount_centavos, approximate_location, client_operation_id } = parsed.data;

    if (!canManageDriver(req, driver_code)) return res.status(403).json({ error: 'Driver account does not match.' });
    // Validate driver
    const driver = await repository.getDriver(driver_code);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const vehicle = await repository.getVehicle(vehicle_code);
    if (driver.verification_status !== 'verified' || !vehicle || vehicle.status !== 'active' || vehicle.assigned_driver_code !== driver_code) {
      return res.status(403).json({ error: 'A verified driver and assigned active vehicle are required.' });
    }
    // Cash entries can synchronize after the shift ends. They never mark digital payments paid.
    const rideId = `RIDE-${randomUUID()}`;
    const newRide: Ride = {
      ride_id: rideId,
      driver_code,
      driver_name: driver.full_name,
      vehicle_code,
      passenger_id: null,
      passenger_name: null,
      passenger_mobile: null,
      timestamp: new Date().toISOString(),
      approximate_location,
      payment_method: 'cash',
      fare_amount_centavos: amount_centavos,
      status: 'completed',
      is_checkin_only: false,
      client_operation_id: client_operation_id || null,
      created_at: new Date().toISOString()
    };

    const createdRide = await repository.createRide(newRide);

    const responseBody = {
      success: true,
      message: `Cash ride recorded: ₱${(amount_centavos / 100).toFixed(2)}`,
      ride: createdRide
    };


    return res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error recording cash ride:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/ride-checkin
ridesRouter.post('/ride-checkin', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      vehicle_code: req.body.vehicle_code || req.body.vehicleId,
      passenger_name: req.body.passenger_name || req.body.passengerName || req.user?.full_name,
      approximate_location: req.body.approximate_location || req.body.approximateLocation,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId || (req.headers['idempotency-key'] as string)
    };

    const parsed = RideCheckinSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { vehicle_code, passenger_name, approximate_location, client_operation_id } = parsed.data;


    const vehicle = await repository.getVehicle(vehicle_code);
    if (!vehicle) {
      return res.status(404).json({ error: `Vehicle ${vehicle_code} not found in registry` });
    }

    const driver = vehicle.assigned_driver_code
      ? await repository.getDriver(vehicle.assigned_driver_code)
      : null;

    if (!driver || driver.verification_status !== 'verified' || vehicle.status !== 'active') return res.status(409).json({ error: 'No verified driver is assigned to this vehicle.' });
    const rideId = `RIDE-${randomUUID()}`;
    const newRide: Ride = {
      ride_id: rideId,
      driver_code: driver.driver_code,
      driver_name: driver.full_name,
      vehicle_code,
      passenger_id: req.user?.id || null,
      passenger_name: passenger_name || req.user?.full_name || 'Commuter',
      passenger_mobile: req.user?.mobile_number || null,
      timestamp: new Date().toISOString(),
      approximate_location,
      payment_method: 'cash',
      fare_amount_centavos: 0,
      status: 'completed',
      is_checkin_only: true,
      client_operation_id: client_operation_id || null,
      created_at: new Date().toISOString()
    };

    const createdRide = await repository.createRide(newRide);

    const responseBody = {
      success: true,
      message: `Safety check-in recorded for vehicle ${vehicle_code}`,
      ride: createdRide
    };


    return res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error during safety check-in:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/rides
ridesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    let driverCode = (req.query.driver_code || req.query.driverId) as string | undefined;
    let passengerId = (req.query.passenger_id || req.query.passengerId) as string | undefined;
    const vehicleCode = (req.query.vehicle_code || req.query.vehicleId) as string | undefined;

    // Authenticated clients are always scoped to their own history. Query filters are
    // retained for admin/test compatibility only when there is no end-user identity.
    if (req.user && !['driver', 'admin', 'operator'].includes(req.user.role)) {
      passengerId = req.user.id;
      driverCode = undefined;
    } else if (req.user?.role === 'driver') {
      driverCode = req.user.driver_code || undefined;
      passengerId = undefined;
    }

    const operatorScope = await operatorDriverCodes(req);
    if (operatorScope && operatorScope.size === 0) {
      return res.status(403).json({ error: 'No TODA group assigned.' });
    }
    if (operatorScope && driverCode && !operatorScope.has(driverCode)) {
      return res.status(403).json({ error: 'Ride belongs to another TODA group.' });
    }

    let rides = await repository.getRides({
      driver_code: driverCode,
      passenger_id: passengerId,
      vehicle_code: vehicleCode
    });
    if (operatorScope) rides = rides.filter((ride) => operatorScope.has(ride.driver_code));

    return res.json(rides);
  } catch (err: any) {
    console.error('Error fetching rides:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/rides/:id
ridesRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const ride = await repository.getRide(String(req.params.id));
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (req.user && !['admin', 'operator'].includes(req.user.role) && ride.passenger_id !== req.user.id && ride.driver_code !== req.user.driver_code) return res.status(403).json({ error: 'You cannot view this ride.' });
    if (req.user?.role === 'operator') {
      const operatorScope = await operatorDriverCodes(req);
      if (!operatorScope || !operatorScope.has(ride.driver_code)) return res.status(403).json({ error: 'Ride belongs to another TODA group.' });
    }
    const driver = await repository.getDriver(ride.driver_code);
    const vehicle = await repository.getVehicle(ride.vehicle_code);
    const payment = await repository.getPaymentByRideId(ride.ride_id);

    return res.json({
      ride,
      driver,
      vehicle,
      payment
    });
  } catch (err: any) {
    console.error('Error fetching ride detail:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
