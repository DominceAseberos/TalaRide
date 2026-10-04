import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';

export const faresRouter = Router();

// GET /api/fares
faresRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await repository.getFareConfig();
    return res.json({
      standard_fares_centavos: config.standard_fares_centavos,
      min_custom_fare_centavos: config.min_custom_fare_centavos,
      max_custom_fare_centavos: config.max_custom_fare_centavos,
      provider_fee_basis_points: config.provider_fee_basis_points,
      talaride_fee_basis_points: config.talaride_fee_basis_points
    });
  } catch (err: any) {
    console.error('Error fetching fares:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
