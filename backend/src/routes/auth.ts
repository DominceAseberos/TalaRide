import { Router } from 'express';
import { db } from '../db.js';
import { User, Driver } from '../types.js';

export const authRouter = Router();

// Request OTP
authRouter.post('/otp-request', (req, res) => {
  const { mobileNumber, role = 'commuter' } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }

  // Simulated OTP for MVP
  const otp = '8842';
  return res.json({
    success: true,
    message: `OTP sent to ${mobileNumber}`,
    otp, // Exposed in demo response for easy testing
    expiresInSeconds: 300
  });
});

// Verify OTP & Login
authRouter.post('/otp-verify', (req, res) => {
  const { mobileNumber, otp, role = 'commuter', name } = req.body;

  if (otp !== '8842' && otp !== '1234') {
    return res.status(400).json({ error: 'Invalid or expired OTP. Use demo OTP 8842.' });
  }

  // Find existing user or register
  let user: User | undefined;
  for (const u of db.users.values()) {
    if (u.mobile_number === mobileNumber) {
      user = u;
      break;
    }
  }

  if (!user) {
    const userId = `USR-${role.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`;
    user = {
      user_id: userId,
      mobile_number: mobileNumber,
      name: name || (role === 'driver' ? 'Juan Driver' : 'Commuter Rider'),
      account_type: role,
      status: 'active',
      created_at: new Date().toISOString()
    };
    db.users.set(user.user_id, user);

    if (role === 'driver') {
      const driverId = `DR-000${Math.floor(100 + Math.random() * 900)}`;
      const driver: Driver = {
        driver_id: driverId,
        user_id: user.user_id,
        name: user.name,
        mobile_number: user.mobile_number,
        verification_status: 'verified',
        toda_operator: 'Tagum Poblacion TODA',
        assigned_vehicle_id: null,
        shift_status: 'ended',
        license_number: 'N01-20-' + Math.floor(100000 + Math.random() * 900000),
        created_at: new Date().toISOString()
      };
      db.drivers.set(driver.driver_id, driver);
    }
  }

  let driverProfile: Driver | undefined;
  if (user.account_type === 'driver') {
    for (const d of db.drivers.values()) {
      if (d.user_id === user.user_id) {
        driverProfile = d;
        break;
      }
    }
  }

  return res.json({
    success: true,
    user,
    driver: driverProfile
  });
});
