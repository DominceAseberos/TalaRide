import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createSessionStorage } from './storage';
import { validateSupabaseConfig } from './config';

const secureStorage = createSessionStorage(
  {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) =>
      SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  },
  randomUUID,
);

export let authConfigurationError: string | null = null;
function initializeClient() {
  try {
    const { url, key } = validateSupabaseConfig(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    return createClient(url, key, {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: secureStorage }),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    authConfigurationError =
      error instanceof Error ? error.message : 'Supabase configuration is invalid.';
    return null;
  }
}
export const supabase = initializeClient();
export function requireSupabase() {
  if (!supabase) throw new Error(authConfigurationError ?? 'Supabase is unavailable.');
  return supabase;
}
export function authRedirectUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth-callback`
    : 'talaride://auth-callback';
}
