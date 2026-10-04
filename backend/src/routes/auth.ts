import { Router, Request, Response } from 'express';
import { env } from '../env.js';
import { repository } from '../lib/repository.js';
import { otpRateLimiter } from '../middleware/rate-limit.js';

export const authRouter = Router();

// POST /api/auth/otp-request
authRouter.post('/otp-request', otpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { mobileNumber, role = 'commuter' } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    if (!env.DEMO_AUTH) {
      return res.status(501).json({
        error: 'Production auth required',
        message: 'Direct demo OTP generation is disabled in production. Use Supabase Auth SMS provider.'
      });
    }

    // Demo Mode OTP
    const otp = '8842';
    return res.json({
      success: true,
      message: `OTP sent to ${mobileNumber}`,
      otp, // Exposed only when DEMO_AUTH=true
      expiresInSeconds: 300
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/auth/otp-verify
authRouter.post('/otp-verify', async (req: Request, res: Response) => {
  try {
    const { mobileNumber, otp, role = 'commuter', pin } = req.body;

    if (!env.DEMO_AUTH) {
      return res.status(501).json({
        error: 'Production auth required',
        message: 'Direct demo OTP verification is disabled in production. Verify through Supabase Auth.'
      });
    }

    // Strict validation
    if (otp !== '8842' && otp !== '1234') {
      return res.status(401).json({ error: 'Invalid or expired OTP. Use demo OTP 8842.' });
    }

    // Driver PIN validation - driver authentication fails closed if PIN is missing or invalid.
    if (role === 'driver') {
      if (!pin) {
        return res.status(400).json({ error: 'Driver PIN is required' });
      }
      if (pin !== '8842' && pin !== '1234') {
        return res.status(401).json({ error: 'Invalid Driver PIN' });
      }
    }

    // Find profile
    let profile = await repository.getProfileByMobile(mobileNumber);
    if (!profile) {
      const isDriver = role === 'driver';
      const userId = isDriver ? 'USR-DRV-001' : 'USR-COM-001';
      profile = await repository.getProfile(userId);
    }

    const driver = role === 'driver' ? await repository.getDriver('DR-000481') : null;
    const token = role === 'driver' ? 'demo-driver-token' : 'demo-passenger-token';

    return res.json({
      success: true,
      token,
      user: profile,
      driver
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
