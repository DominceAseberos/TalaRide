import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

// Server-only Supabase Service Role Client
// This client bypasses Row Level Security when server-level authority is required
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
