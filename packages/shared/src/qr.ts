// QR payload contracts. Static vehicle QR works offline. Dynamic payment QR is
// per-intent, single-use, expiring. Mock mode uses signed JSON until QR Ph acquirer live.
export const VEHICLE_QR_VERSION = 1;
export const DYNAMIC_QR_VERSION = 1;
export const DYNAMIC_QR_EXPIRY_SEC = 300;

export interface VehicleQr {
  v: 1;
  vehicle_code: string;
  c: string; // qr_checksum short
}

export interface DynamicQr {
  v: 1;
  payment_id: string;
  ride_id: string;
  vehicle_code: string;
  amount_centavos: number;
  expires_at: string; // ISO
  nonce: string;
  sig: string; // hex sha256(intent_string + secret) in mock; HMAC in Edge
}

export function buildVehicleQrUrl(base: string, vehicleCode: string, checksum: string): string {
  const code = vehicleCode.trim().toUpperCase();
  if (!/^TR-\d{5}$/.test(code)) throw new Error('Invalid vehicle_code.');
  if (!/^[a-f0-9]{4,16}$/i.test(checksum)) throw new Error('Invalid checksum.');
  return `${base.replace(/\/$/, '')}/${code}?c=${checksum.toLowerCase()}`;
}

export function parseVehicleQr(input: string): VehicleQr {
  const text = input.trim();
  // Accept full URL, deep link, or bare code.
  const m = text.match(/(TR-\d{5})/i);
  if (!m) throw new Error('Not a TalaRide vehicle QR.');
  const vehicle_code = m[1].toUpperCase();
  const c = text.match(/[?&]c=([a-f0-9]{4,16})/i)?.[1]?.toLowerCase() ?? '';
  if (!c) throw new Error('Vehicle QR checksum missing.');
  return { v: 1, vehicle_code, c };
}

export function buildDynamicQrPayload(p: Omit<DynamicQr, 'v' | 'sig'>, sig: string): string {
  const payload: DynamicQr = { v: 1, ...p, sig };
  return JSON.stringify(payload);
}

export function parseDynamicQr(input: string): DynamicQr {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('Not a TalaRide payment QR.');
  }
  const p = raw as Record<string, unknown>;
  if (
    p.v !== 1 ||
    typeof p.payment_id !== 'string' ||
    typeof p.ride_id !== 'string' ||
    typeof p.vehicle_code !== 'string' ||
    typeof p.amount_centavos !== 'number' ||
    typeof p.expires_at !== 'string' ||
    typeof p.nonce !== 'string' ||
    typeof p.sig !== 'string'
  )
    throw new Error('Invalid payment QR.');
  if (!Number.isInteger(p.amount_centavos) || p.amount_centavos < 100)
    throw new Error('Invalid payment amount.');
  return p as unknown as DynamicQr;
}

export function isDynamicQrExpired(p: DynamicQr, now = new Date()): boolean {
  return new Date(p.expires_at).getTime() <= now.getTime();
}

// Deterministic intent string for mock signing. Edge uses HMAC-SHA256 with secret.
export function dynamicIntentString(p: Omit<DynamicQr, 'v' | 'sig'>): string {
  return [p.payment_id, p.ride_id, p.vehicle_code, p.amount_centavos, p.expires_at, p.nonce].join(
    '|',
  );
}
