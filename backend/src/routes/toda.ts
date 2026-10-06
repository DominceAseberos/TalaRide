import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../lib/auth.js';
import { repository } from '../lib/repository.js';

export const todaRouter = Router();
todaRouter.use(requireRole('operator'));
todaRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.user?.toda_group) return res.status(403).json({ message: 'Your operator account needs an assigned TODA group. Contact the TalaRide administrator.' });
  next();
});

todaRouter.get('/members', async (req, res, next) => {
  try {
    const group = req.user!.toda_group!;
    const members = (await repository.getAllDrivers()).filter(driver => driver.toda_group_id === group.id);
    res.json({ group, members });
  } catch (error) { next(error); }
});

const AddMember = z.object({ driver_code: z.string().trim().toUpperCase().regex(/^DR-\d{6}$/) }).strict();
todaRouter.post('/members', async (req, res, next) => {
  const parsed = AddMember.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter the registered driver code, for example DR-123456.' });
  try {
    const group = req.user!.toda_group!;
    const driver = await repository.addDriverToToda(parsed.data.driver_code, group, req.user!.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found. Ask the driver to register in the mobile app first.' });
    res.json({ group, driver });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Driver already belongs')) return res.status(409).json({ message: error.message });
    next(error);
  }
});
