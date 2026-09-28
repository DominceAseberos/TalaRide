import { z } from 'zod';

export const DriverSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name is required')
    .max(100, 'Name must be 100 characters or less'),
  vehicleId: z.string().uuid().optional(),
  licenseNumber: z.string().max(20).optional(),
  licenseExpiresAt: z.string().date('Must be a valid date (YYYY-MM-DD)').optional(),
  contactNumber: z
    .string()
    .regex(/^[0-9+\-() ]{7,20}$/, 'Invalid contact number format')
    .optional(),
  emergencyContact: z.string().max(150).optional(),
  photoUrl: z.string().url().optional(),
});

export type DriverInput = z.infer<typeof DriverSchema>;
