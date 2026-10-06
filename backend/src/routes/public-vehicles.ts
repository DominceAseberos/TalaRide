import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { verifyVehicleChecksum } from '../lib/qr.js';
import { createWebSession, getWebSessionExpiry, validateWebSession } from '../lib/web-session.js';

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
    const requestedSessionId = typeof req.query.sid === 'string' ? req.query.sid : undefined;

    // Verify HMAC checksum
    if (!checksum || !verifyVehicleChecksum(vehicleCode, checksum)) {
      return res.status(400).json({
        error: 'Invalid checksum',
        message: 'Vehicle QR could not be verified'
      });
    }

    let webSession = requestedSessionId
      ? (validateWebSession(requestedSessionId, vehicleCode)
        ? { sessionId: requestedSessionId, expiresAt: getWebSessionExpiry(requestedSessionId, vehicleCode) }
        : null)
      : createWebSession(vehicleCode);
    if (!webSession) {
      return res.status(410).json({
        error: 'Session expired',
        message: 'This ride link has expired. Scan the vehicle QR code again to start a new session.'
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
    const publicDriverCode = activeShift?.driver_code || vehicle.assigned_driver_code || null;
    let driverName: string | null = null;
    let verificationStatus: 'verified' | 'pending' | 'suspended' = 'pending';
    let driverPhotoUrl: string | null = null;

    if (publicDriverCode) {
      const driver = await repository.getDriver(publicDriverCode);
      if (driver) {
        driverName = formatSafeDriverName(driver.full_name);
        verificationStatus = driver.verification_status;
        driverPhotoUrl = driver.photo_url ?? null;
      }
    }

    // Strictly safe public metadata: no phone numbers, no license number, no addresses
    return res.json({
      vehicle_code: vehicle.vehicle_code,
      plate_body_number: vehicle.plate_body_number,
      toda: vehicle.toda,
      status: vehicle.status === 'active' ? 'Active' : 'Inactive',
      shift_status: activeShift ? 'Active' : 'Not currently active',
      driver_code: publicDriverCode,
      driver_name: driverName || 'No driver assigned',
      verification_status: verificationStatus,
      driver_photo_url: driverPhotoUrl,
      fare_config: await repository.getFareConfig(),
      session_id: webSession.sessionId,
      session_expires_at: webSession.expiresAt ?? null
    });
  } catch (err: any) {
    console.error('Error in public vehicle lookup:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
