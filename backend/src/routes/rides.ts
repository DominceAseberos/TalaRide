import { randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth, canManageDriver } from '../lib/auth.js';
import { Ride } from '../types.js';

export const ridesRouter = Router();
ridesRouter.use(productionAuth);

export const CashRecordSchema = z.object({
  driver_code: z.string().regex(/^DR-[0-9]{6}$/, 'driver_code must match DR-000000 format'),
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  amount_centavos: z.number().int().positive('amount_centavos must be a positive integer'),
  approximate_location: z.string().optional().default('Tagum City Center'),
  client_operation_id: z.string().optional()
});

export const RideCheckinSchema = z.object({
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000 format'),
  passenger_name: z.string().optional(),
  approximate_location: z.string().optional().default('Tagum City'),
  client_operation_id: z.string().optional()
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
    if (req.user && !['driver', 'talaride_admin', 'lgu_admin'].includes(req.user.role)) {
      passengerId = req.user.id;
      driverCode = undefined;
    } else if (req.user?.role === 'driver') {
      driverCode = req.user.driver_code || undefined;
      passengerId = undefined;
    }

    const rides = await repository.getRides({
      driver_code: driverCode,
      passenger_id: passengerId,
      vehicle_code: vehicleCode
    });

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

    if (req.user && !['talaride_admin', 'lgu_admin'].includes(req.user.role) && ride.passenger_id !== req.user.id && ride.driver_code !== req.user.driver_code) return res.status(403).json({ error: 'You cannot view this ride.' });
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
