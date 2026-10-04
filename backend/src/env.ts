import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.string().default('https://your-project.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('replace_me'),
  SUPABASE_JWT_SECRET: z.string().default('talaride_test_jwt_secret_2026'),
  QR_INTENT_SECRET: z.string().default('talaride_qr_secret_key_2026_super_secure'),
  PAYMENT_MODE: z.enum(['mock', 'live']).default('mock'),
  PAYMENT_PROVIDER_KEY: z.string().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().default('mock_webhook_secret_key_2026'),
  WEB_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),
  DATA_DIR: z.string().default(''),
  ALLOW_EPHEMERAL_STATE: z.string().default('false').transform((v) => v === 'true'),
  DEMO_AUTH: z.string().default('false').transform((v) => v === 'true')
});

export const env = envSchema.parse(process.env);
