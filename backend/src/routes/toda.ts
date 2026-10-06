import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../lib/auth.js';
import { repository } from '../lib/repository.js';

export const todaRouter = Router();
todaRouter.use(requireRole('operator'));
todaRouter.use(async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication is required.' });
    if (!req.user.toda_group) {
      const group = await repository.ensureOperatorTodaGroup(req.user.id);
      req.user.toda_group = { id: group.id, name: group.name, is_placeholder: group.is_placeholder };
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

todaRouter.put('/group', async (req, res, next) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a TODA group name between 2 and 120 characters.' });
  try {
    const group = await repository.renameTodaGroup(req.user!.toda_group!.id, parsed.data.name);
    if (!group) return res.status(404).json({ message: 'TODA group not found.' });
    req.user!.toda_group = { id: group.id, name: group.name, is_placeholder: group.is_placeholder };
    return res.json({ group });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
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
