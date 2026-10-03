import { Router } from 'express';
import { db } from '../db.js';
import { Vehicle } from '../types.js';

export const vehiclesRouter = Router();

// List all vehicles
vehiclesRouter.get('/', (req, res) => {
  const vehicles = Array.from(db.vehicles.values());
  return res.json(vehicles);
});

// Get single vehicle
vehiclesRouter.get('/:id', (req, res) => {
  const vehicle = db.vehicles.get(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // Get currently assigned driver if any
  let currentDriver = null;
  if (vehicle.assigned_driver_id) {
    currentDriver = db.drivers.get(vehicle.assigned_driver_id);
  }

  return res.json({
    vehicle,
    currentDriver
  });
});

// Register new vehicle
vehiclesRouter.post('/', (req, res) => {
  const { vehicle_id, plate_body_number, toda } = req.body;

  if (!vehicle_id || !plate_body_number) {
    return res.status(400).json({ error: 'vehicle_id and plate_body_number are required' });
  }

  if (db.vehicles.has(vehicle_id)) {
    return res.status(409).json({ error: 'Vehicle ID already exists' });
  }

  const newVehicle: Vehicle = {
    vehicle_id,
    plate_body_number,
    toda: toda || 'Tagum Poblacion TODA',
    status: 'active',
    assigned_driver_id: null,
    assigned_driver_name: null,
    qr_code_payload: `TALARIDE:VEHICLE:${vehicle_id}`,
    created_at: new Date().toISOString()
  };

  db.vehicles.set(vehicle_id, newVehicle);

  return res.status(201).json({
    success: true,
    vehicle: newVehicle
  });
});
