import { Router } from 'express';
import { requireRole } from '../lib/auth.js';
import { repository } from '../lib/repository.js';

export const todaRouter = Router();
todaRouter.use(requireRole('operator'));
todaRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication is required.' });
    if (!req.user.toda_group) {
      return res.status(409).json({
        error: 'No group assigned',
        message: 'This operator account has no TODA group assigned. Ask an administrator to assign one.'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

todaRouter.get('/group', async (req, res) => {
  const group = await repository.getTodaGroup(req.user!.toda_group!.id);
  if (!group) return res.status(404).json({ message: 'TODA group not found.' });
  return res.json({ group });
});

todaRouter.put('/group', async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'Enter a TODA group name from 2 to 120 characters.' });
    }
    const group = await repository.renameTodaGroup(req.user!.toda_group!.id, name);
    if (!group) return res.status(404).json({ error: 'TODA group not found.' });
    return res.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not rename TODA group.';
    if (message.includes('already exists')) return res.status(409).json({ error: message });
    return res.status(500).json({ error: 'Could not rename TODA group.', message });
  }
});

todaRouter.get('/members', async (req, res, next) => {
  try {
    const group = req.user!.toda_group!;
    const members = (await repository.getAllDrivers()).filter(driver => driver.toda_group_id === group.id).map(driver => ({
      driver_code: driver.driver_code, full_name: driver.full_name,
      verification_status: driver.verification_status, toda_operator: driver.toda_operator,
      assigned_vehicle_code: driver.assigned_vehicle_code, shift_status: driver.shift_status,
      active_shift_id: driver.active_shift_id, photo_url: driver.photo_url, created_at: driver.created_at,
    }));
    res.json({ group, members });
  } catch (error) { next(error); }
});
todaRouter.get('/transactions', async (req, res, next) => {
  try {
    const group = req.user!.toda_group!;
    const driverCodes = new Set(
      (await repository.getAllDrivers())
        .filter(driver => driver.toda_group_id === group.id)
        .map(driver => driver.driver_code),
    );
    const [rides, payments] = await Promise.all([
      repository.getRides({}),
      repository.getAllPayments(),
    ]);
    const paymentByRide = new Map(payments.map(payment => [payment.ride_id, payment]));

    const transactions = rides
      .filter(ride => driverCodes.has(ride.driver_code) && !ride.is_checkin_only)
      .map(ride => {
        const payment = paymentByRide.get(ride.ride_id);
        return {
          ride_id: ride.ride_id,
          payment_id: payment?.payment_id ?? null,
          driver_code: ride.driver_code,
          vehicle_code: ride.vehicle_code,
          timestamp: ride.timestamp,
          amount_centavos: ride.fare_amount_centavos,
          payment_method: ride.payment_method,
          provider: payment?.provider ?? (ride.payment_method === 'cash' ? 'cash' : null),
          payment_status:
            payment?.payment_status ??
            (ride.payment_method === 'cash'
              ? ride.status === 'completed'
                ? 'confirmed'
                : 'awaiting_confirmation'
              : null),
          ride_status: ride.status,
          payment_environment: payment?.payment_environment ?? null,
        };
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 250);

    return res.json({ group, transactions });
  } catch (error) {
    next(error);
  }
});

todaRouter.get('/lost-items', async (req, res, next) => {
  try {
    const group = req.user!.toda_group!;
    const driverCodes = new Set((await repository.getAllDrivers()).filter(driver => driver.toda_group_id === group.id).map(driver => driver.driver_code));
    const items = (await repository.getLostItems()).filter(item => driverCodes.has(item.driver_code)).map(item => ({
      report_id: item.report_id, ride_id: item.ride_id, vehicle_code: item.vehicle_code,
      driver_code: item.driver_code, item_category: item.item_category, description: item.description,
      status: item.status, driver_response: item.driver_response, created_at: item.created_at,
    }));
    res.json({ group, items });
  } catch (error) { next(error); }
});
