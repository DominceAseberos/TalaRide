import crypto from 'node:crypto';
import { env } from '../env.js';

export interface DynamicQRPayload {
  v: number;
  payment_id: string;
  ride_id: string;
  vehicle_code: string;
  amount_centavos: number;
  expires_at: string;
  nonce: string;
  sig: string;
}

export function generatePaymentQR(params: {
  paymentId: string;
  rideId: string;
  vehicleCode: string;
  amountCentavos: number;
  expiresInSeconds?: number;
}): { qrPayload: string; expiresAt: string; signature: string } {
  const expiresInSeconds = params.expiresInSeconds ?? 300; // 300 seconds canonical QR expiry
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const nonce = crypto.randomBytes(6).toString('hex');

  const message = `${params.paymentId}:${params.rideId}:${params.vehicleCode}:${params.amountCentavos}:${expiresAt}:${nonce}`;
  const signature = crypto
    .createHmac('sha256', env.QR_INTENT_SECRET)
    .update(message)
    .digest('hex');

  const payload: DynamicQRPayload = {
    v: 1,
    payment_id: params.paymentId,
    ride_id: params.rideId,
    vehicle_code: params.vehicleCode,
    amount_centavos: params.amountCentavos,
    expires_at: expiresAt,
    nonce,
    sig: signature
  };

  return {
    qrPayload: JSON.stringify(payload),
    expiresAt,
    signature
  };
}

export function verifyPaymentQR(payloadString: string): {
  valid: boolean;
  expired: boolean;
  payload?: DynamicQRPayload;
  error?: string;
} {
  try {
    const payload: DynamicQRPayload = JSON.parse(payloadString);
    if (!payload.v || !payload.payment_id || !payload.ride_id || !payload.sig) {
      return { valid: false, expired: false, error: 'Malformed QR payload' };
    }

    const message = `${payload.payment_id}:${payload.ride_id}:${payload.vehicle_code}:${payload.amount_centavos}:${payload.expires_at}:${payload.nonce}`;
    const expectedSig = crypto
      .createHmac('sha256', env.QR_INTENT_SECRET)
      .update(message)
      .digest('hex');

    if (expectedSig !== payload.sig) {
      return { valid: false, expired: false, error: 'Invalid QR signature' };
    }

    const isExpired = new Date(payload.expires_at).getTime() < Date.now();
    return {
      valid: !isExpired,
      expired: isExpired,
      payload,
      error: isExpired ? 'QR code has expired' : undefined
    };
  } catch (err: any) {
    return { valid: false, expired: false, error: err.message };
  }
}

/**
 * Generate HMAC checksum for permanent vehicle sticker
 */
export function generateVehicleChecksum(vehicleCode: string): string {
  return crypto
    .createHmac('sha256', env.QR_INTENT_SECRET)
    .update(`VEHICLE:${vehicleCode}`)
    .digest('hex')
    .slice(0, 12);
}

export function verifyVehicleChecksum(vehicleCode: string, checksum: string): boolean {
  if (!vehicleCode || !checksum) return false;
  const expected = generateVehicleChecksum(vehicleCode);
  return expected.toLowerCase() === checksum.toLowerCase();
}

export function generateVehicleStickerUrl(vehicleCode: string, webOrigin: string = 'https://web.talaride.ph'): string {
  const checksum = generateVehicleChecksum(vehicleCode);
  return `${webOrigin}/v/${vehicleCode}?c=${checksum}`;
}
