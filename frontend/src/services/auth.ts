import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let clientPromise: Promise<SupabaseClient> | null = null;
export function getAuthClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/config`);
      if (!response.ok) throw new Error('Account service is unavailable. Please try again later.');
      const config = await response.json();
      if (!config.url || !config.publishableKey) throw new Error('Account service is not configured.');
      return createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    })().catch(error => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

export async function authToken(): Promise<string> {
  const client = await getAuthClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || '';
}

export async function signOut() {
  const client = await getAuthClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
