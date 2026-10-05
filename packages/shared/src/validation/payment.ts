import { z } from 'zod';

export const AmountCentavosSchema = z
  .number()
  .int()
  .min(100, 'Minimum fare is ₱1.')
  .max(99990000, 'Maximum fare is ₱999,900.');

export const PaymentIntentSchema = z.object({
  shift_id: z.string().min(1),
  vehicle_code: z.string().regex(/^TR-\d{5}$/i, 'Invalid vehicle code.'),
  amount_centavos: AmountCentavosSchema,
  payment_method: z.literal('digital'),
});

export const CashRecordSchema = z.object({
  shift_id: z.string().min(1),
  vehicle_code: z.string().regex(/^TR-\d{5}$/i),
  amount_centavos: AmountCentavosSchema,
});

export const CheckinSchema = z.object({
  vehicle_code: z.string().regex(/^TR-\d{5}$/i),
  pickup_text: z.string().max(150).optional(),
  pickup_lat: z.number().min(-90).max(90).optional(),
  pickup_lng: z.number().min(-180).max(180).optional(),
});

export type PaymentIntentInput = z.infer<typeof PaymentIntentSchema>;
