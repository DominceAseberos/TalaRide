import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { requireRole } from '../lib/auth.js';
import { sse } from '../sse.js';
import { generateVehicleChecksum } from '../lib/qr.js';
import { Driver, Vehicle } from '../types.js';

export const adminRouter = Router();

// Protect ALL admin routes with strict role check (talaride_admin or lgu_admin)
adminRouter.use(requireRole('talaride_admin', 'lgu_admin'));

// GET /api/admin/overview & /api/admin/analytics
adminRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const drivers = await repository.getAllDrivers();
    const vehicles = await repository.getAllVehicles();
    const rides = await repository.getRides();
    const payments = await repository.getAllPayments();
    const lostItems = await repository.getLostItems();
    const paymentIssues = await repository.getPaymentIssues();
    const fareConfig = await repository.getFareConfig();

    const activeDrivers = drivers.filter((d) => d.shift_status === 'active').length;
    const verifiedDrivers = drivers.filter((d) => d.verification_status === 'verified').length;
    const digitalRides = rides.filter((r) => r.payment_method === 'digital');
    const cashRides = rides.filter((r) => r.payment_method === 'cash');

    const confirmedPayments = payments.filter((p) => p.payment_status === 'confirmed');
    const totalDigitalVolumeCentavos = confirmedPayments.reduce((sum, p) => sum + p.amount_centavos, 0);
    const totalFeesCollectedCentavos = confirmedPayments.reduce(
      (sum, p) => sum + p.provider_fee_centavos + p.talaride_fee_centavos,
      0
    );

    const digitalAdoptionPct =
      rides.length > 0 ? Math.round((digitalRides.length / rides.length) * 100) : 0;
    const paymentSuccessRate =
      payments.length > 0 ? Math.round((confirmedPayments.length / payments.length) * 100) : 100;

    return res.json({
      metrics: {
        total_registered_drivers: drivers.length,
        active_drivers_on_shift: activeDrivers,
        verified_drivers: verifiedDrivers,
        total_registered_vehicles: vehicles.length,
        total_rides_completed: rides.length,
        digital_rides_count: digitalRides.length,
        cash_rides_count: cashRides.length,
        digital_adoption_pct: digitalAdoptionPct,
        total_digital_volume_centavos: totalDigitalVolumeCentavos,
        total_fees_collected_centavos: totalFeesCollectedCentavos,
        payment_success_rate: paymentSuccessRate,
        average_confirmation_speed_seconds: null
      },
      fare_config: fareConfig,
      active_lost_items_count: lostItems.filter((l) => l.status !== 'closed' && l.status !== 'found').length,
      pending_payment_issues_count: paymentIssues.filter((p) => p.status === 'pending').length
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

adminRouter.get('/analytics', async (req: Request, res: Response) => {
  // Alias for overview metrics
  return (adminRouter as any).handle(Object.assign(req, { url: '/overview' }), res);
});

// GET /api/admin/drivers
adminRouter.get('/drivers', async (_req: Request, res: Response) => {
  try {
    const drivers = await repository.getAllDrivers();
    return res.json(drivers);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

const DriverCreateSchema = z.object({
  full_name: z.string().min(2),
  mobile_number: z.string().min(10),
  toda_operator: z.string().default('Tagum Poblacion TODA'),
  license_number: z.string().optional()
});

// POST /api/admin/drivers
adminRouter.post('/drivers', async (_req, res) => {
  return res.status(409).json({ error: 'Ask the driver to register at /driver using their own account, then verify their submission here.' });
});

// POST /api/admin/drivers/:id/verify
adminRouter.post('/drivers/:id/verify', requireRole('talaride_admin'), async (req: Request, res: Response) => {
  try {
    const driver = await repository.updateDriverStatus(String(req.params.id), 'verified', req.user!.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    return res.json({ success: true, driver });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/admin/drivers/:id/suspend
adminRouter.post('/drivers/:id/suspend', async (req: Request, res: Response) => {
  try {
    const driver = await repository.updateDriverStatus(String(req.params.id), 'suspended');
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    return res.json({ success: true, driver });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/admin/vehicles
adminRouter.get('/vehicles', async (_req: Request, res: Response) => {
  try {
    const vehicles = await repository.getAllVehicles();
    return res.json(vehicles);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

const VehicleCreateSchema = z.object({
  vehicle_code: z.string().regex(/^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000'),
  plate_body_number: z.string().min(2),
  toda: z.string().default('Tagum Poblacion TODA')
});

// POST /api/admin/vehicles
adminRouter.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const rawBody = {
      vehicle_code: req.body.vehicle_code || req.body.vehicleId,
      plate_body_number: req.body.plate_body_number || req.body.plateBodyNumber,
      toda: req.body.toda
    };

    const parsed = VehicleCreateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const existing = await repository.getVehicle(parsed.data.vehicle_code);
    if (existing) {
      return res.status(409).json({ error: 'Vehicle code already exists' });
    }

    const checksum = generateVehicleChecksum(parsed.data.vehicle_code);
    const vehicle: Vehicle = {
      vehicle_code: parsed.data.vehicle_code,
      plate_body_number: parsed.data.plate_body_number,
      toda: parsed.data.toda,
      status: 'active',
      assigned_driver_code: null,
      assigned_driver_name: null,
      qr_checksum: checksum,
      created_at: new Date().toISOString()
    };

    const created = await repository.createVehicle(vehicle);
    return res.status(201).json({ success: true, vehicle: created });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

const AssignVehicleSchema = z.object({
  driver_id: z.string().regex(/^DR-[0-9]{6}$/),
  vehicle_id: z.string().regex(/^TR-[0-9]{5}$/)
});

// POST /api/admin/assign-vehicle
adminRouter.post('/assign-vehicle', async (req: Request, res: Response) => {
  try {
    const parsed = AssignVehicleSchema.safeParse({
      driver_id: req.body.driver_id || req.body.driverId,
      vehicle_id: req.body.vehicle_id || req.body.vehicleId
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const result = await repository.assignVehicleToDriver(
      parsed.data.driver_id,
      parsed.data.vehicle_id
    );
    return res.json({
      success: true,
      driver: result.driver,
      vehicle: result.vehicle
    });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/admin/transactions
adminRouter.get('/transactions', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string | undefined;
    const status = req.query.status as any;
    const transactions = await repository.getAllPayments({ query, status });
    return res.json(transactions);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/admin/fares
adminRouter.get('/fares', async (_req: Request, res: Response) => {
  try {
    const config = await repository.getFareConfig();
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// PUT /api/admin/fares
adminRouter.put('/fares', async (req: Request, res: Response) => {
  try {
    const { standard_fares_centavos, provider_fee_basis_points } = req.body;
    const updated = await repository.updateFareConfig({
      standard_fares_centavos,
      provider_fee_basis_points
    });
    sse.broadcast('fare_config_updated', updated);
    return res.json({ success: true, fare_config: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/admin/lost-items
adminRouter.get('/lost-items', async (_req: Request, res: Response) => {
  try {
    const items = await repository.getLostItems();
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/admin/payment-issues
adminRouter.get('/payment-issues', async (_req: Request, res: Response) => {
  try {
    const issues = await repository.getPaymentIssues();
    return res.json(issues);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/admin/payment-issues/:id/resolve
adminRouter.post('/payment-issues/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body; // status: 'resolved' | 'refunded'
    if (!['resolved', 'refunded'].includes(status)) {
      return res.status(400).json({ error: "status must be 'resolved' or 'refunded'" });
    }

    const ticket = await repository.resolvePaymentIssue(String(req.params.id), status, notes);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    return res.json({ success: true, ticket });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
