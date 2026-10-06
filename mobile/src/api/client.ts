import { supabase } from '@/auth/client';

export type PaymentMode = 'mock-local' | 'mock-server' | 'live';

export function getPaymentMode(): PaymentMode {
  return 'live';
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

async function accessToken(): Promise<string | null> {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Single JSON client: JWT attached, timeout 15s, failures never silent.
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getWebApiBase();
  const token = await accessToken();
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
