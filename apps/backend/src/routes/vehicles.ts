import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { generateVehicleChecksum, verifyVehicleChecksum } from '../lib/qr.js';
import { publicVehiclesRouter } from './public-vehicles.js';

export const vehiclesRouter = Router();

// Mount public vehicle verification router
vehiclesRouter.use('/', publicVehiclesRouter);

// GET /api/vehicles
vehiclesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const vehicles = await repository.getAllVehicles();
    return res.json(vehicles);
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/vehicles/:id
vehiclesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const vehicle = await repository.getVehicle(String(req.params.id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    let currentDriver = null;
    if (vehicle.assigned_driver_code) {
      currentDriver = await repository.getDriver(vehicle.assigned_driver_code);
    }

    return res.json({
      vehicle,
      currentDriver
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/vehicles
vehiclesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { vehicle_id, plate_body_number, toda } = req.body;
    const vehicleCode = vehicle_id || req.body.vehicle_code;

    if (!vehicleCode || !plate_body_number) {
      return res.status(400).json({ error: 'vehicle_id and plate_body_number are required' });
    }

    const existing = await repository.getVehicle(vehicleCode);
    if (existing) {
      return res.status(409).json({ error: 'Vehicle ID already exists' });
    }

    const checksum = generateVehicleChecksum(vehicleCode);
    const vehicle = await repository.createVehicle({
      vehicle_code: vehicleCode,
      plate_body_number,
      toda: toda || 'Tagum Poblacion TODA',
      status: 'active',
      assigned_driver_code: null,
      assigned_driver_name: null,
      qr_checksum: checksum,
      created_at: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      vehicle
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
