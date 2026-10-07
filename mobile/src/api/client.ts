import { supabase } from '@/auth/client';

export type PaymentMode = 'mock-local' | 'mock-server' | 'live';

export function getPaymentMode(): PaymentMode {
  const configured = process.env.EXPO_PUBLIC_PAYMENT_MODE?.trim();
  return configured === 'mock-local' || configured === 'mock-server' ? configured : 'live';
}

const DEFAULT_WEB_API = 'https://talaride-backend.onrender.com/api';

export function getWebApiBase(): string {
  return (process.env.EXPO_PUBLIC_WEB_API ?? DEFAULT_WEB_API).trim().replace(/\/$/, '');
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthCredential {
  userId: string;
  accessToken: string;
}

export async function getCurrentAuthCredential(): Promise<AuthCredential | null> {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user.id || !session.access_token) return null;
    return { userId: session.user.id, accessToken: session.access_token };
  } catch {
    return null;
  }
}

async function accessToken(): Promise<string | null> {
  return (await getCurrentAuthCredential())?.accessToken ?? null;
}

// Single JSON client: JWT attached, timeout 15s, failures never silent.
// Offline synchronization may provide an immutable owner-bound access token so
// an account switch cannot change credentials between ownership validation and
// the actual HTTP request.
export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  accessTokenOverride?: string,
): Promise<T> {
  const base = getWebApiBase();
  const token = accessTokenOverride ?? (await accessToken());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `Request failed (${res.status}).`;
      throw new ApiError(res.status, message);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;

    throw new Error(
      e instanceof Error && e.name === 'AbortError' ? 'Request timed out.' : 'Network unavailable.',
    );
  } finally {
    clearTimeout(timer);
  }
}
