import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { verifyVehicleChecksum } from '../lib/qr.js';

export const publicVehiclesRouter = Router();

function formatSafeDriverName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// GET /api/vehicles/:code/public?c=...
publicVehiclesRouter.get('/:code/public', async (req: Request, res: Response) => {
  try {
    const vehicleCode = String(req.params.code);
    const checksum = req.query.c as string | undefined;

    // Verify HMAC checksum
    if (!checksum || !verifyVehicleChecksum(vehicleCode, checksum)) {
      return res.status(400).json({
        error: 'Invalid checksum',
        message: 'Vehicle QR could not be verified'
      });
    }

    const vehicle = await repository.getVehicle(vehicleCode);
    if (!vehicle) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Vehicle not found'
      });
    }

    const activeShift = await repository.getActiveShiftForVehicle(vehicleCode);
    let driverName: string | null = null;

    if (vehicle.assigned_driver_code) {
      const driver = await repository.getDriver(vehicle.assigned_driver_code);
      if (driver) {
        driverName = formatSafeDriverName(driver.full_name);
      }
    }

    // Strictly safe public metadata: no phone numbers, no license number, no addresses
    return res.json({
      vehicle_code: vehicle.vehicle_code,
      plate_body_number: vehicle.plate_body_number,
      toda: vehicle.toda,
      status: vehicle.status === 'active' ? 'Active' : 'Inactive',
      shift_status: activeShift ? 'Active' : 'Not currently active',
      driver_name: driverName || 'No driver assigned'
    });
  } catch (err: any) {
    console.error('Error in public vehicle lookup:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
