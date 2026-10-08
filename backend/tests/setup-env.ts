import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DEMO_AUTH = 'true';
process.env.PAYMENT_MODE = 'mock';
process.env.PAYMENT_ENVIRONMENT = 'test';
process.env.ALLOW_EPHEMERAL_STATE = 'true';
// Each test process gets isolated writable persistence, even when the source
// checkout is mounted read-only (CI/sandbox). Persistence tests can still
// construct a second repository instance and read the same on-disk records.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'talaride-backend-test-'));
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
process.env.QR_INTENT_SECRET = 'test-qr-intent-secret-2026';
process.env.PAYMENT_PROVIDER_KEY = '';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-2026';
process.env.PUBLIC_WEB_ORIGIN = 'https://talaride-web-frontend.vercel.app';
process.env.WEB_ORIGIN = 'http://localhost:5173';
