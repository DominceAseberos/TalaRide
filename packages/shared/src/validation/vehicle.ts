import { z } from 'zod';

export const VehicleSchema = z.object({
  bodyNumber: z
    .string()
    .min(1, 'Body number is required')
    .max(15, 'Body number must be 15 characters or less')
    .regex(/^[A-Z0-9][A-Z0-9 -]*$/i, 'Only letters, numbers, spaces, and hyphens allowed'),
  mtopNumber: z.string().max(20).optional(),
  plateNumber: z.string().max(10).optional(),
  unitType: z.enum(['tricycle', 'pedicab']),
  year: z
    .number()
    .int()
    .min(1980)
    .max(new Date().getFullYear() + 1)
    .optional(),
  status: z.enum(['active', 'suspended', 'for_renewal']).default('active'),
  mtopExpiresAt: z.string().date('Must be a valid date (YYYY-MM-DD)').optional(),
  inspectionDueAt: z.string().date('Must be a valid date (YYYY-MM-DD)').optional(),
  photoUrl: z.string().url().optional(),
});

export type VehicleInput = z.infer<typeof VehicleSchema>;
