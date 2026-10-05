import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import * as Crypto from 'expo-crypto';
import {
  DYNAMIC_QR_EXPIRY_SEC,
  buildDynamicQrPayload,
  dynamicIntentString,
  isDynamicQrExpired,
  parseDynamicQr,
  type DynamicQr,
} from '@talaride/shared';

// Mock provider: signed dynamic QR with zero network. Swap to Edge payment-intent
// by replacing createMockIntent/resolveMockIntent with fetch calls — payload shape stays.
const STORE_KEY = 'talaride.mock-intents-v1';
// DEMO secret only. Live HMAC lives in Edge secrets, never in client.
const MOCK_SECRET = 'talaride-demo-mock-secret';

export async function mockSignature(intent: Omit<DynamicQr, 'v' | 'sig'>): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${dynamicIntentString(intent)}|${MOCK_SECRET}`,
  );
  return digest.replace(/:/g, '').toLowerCase();
}

async function readStore(): Promise<Record<string, { payload: DynamicQr; status: string }>> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { payload: DynamicQr; status: string }>) : {};
  } catch {
    return {};
  }
}

async function writeStore(value: Record<string, { payload: DynamicQr; status: string }>) {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(value));
}

export async function createMockIntent(vehicleCode: string, amountCentavos: number) {
  const code = vehicleCode.trim().toUpperCase();
  if (!/^TR-\d{5}$/.test(code)) throw new Error('Select a valid vehicle.');
  if (!Number.isInteger(amountCentavos) || amountCentavos < 100 || amountCentavos > 99990000)
    throw new Error('Invalid fare.');
  const payment_id = `pay-${randomUUID()}`;
  const ride_id = `ride-${randomUUID()}`;
  const intent = {
    payment_id,
    ride_id,
    vehicle_code: code,
    amount_centavos: amountCentavos,
    expires_at: new Date(Date.now() + DYNAMIC_QR_EXPIRY_SEC * 1000).toISOString(),
    nonce: randomUUID().slice(0, 8),
  };
  const sig = await mockSignature(intent);
  const qrPayload = buildDynamicQrPayload(intent, sig);
  const payload: DynamicQr = { v: 1, ...intent, sig };
  const store = await readStore();
  store[payment_id] = { payload, status: 'awaiting_confirmation' };
  await writeStore(store);
  return { payment_id, ride_id, qrPayload, expiresAt: intent.expires_at, payload };
}

// Offline-capable verify: signature + shape + expiry, no network.
export async function verifyMockPayload(input: string): Promise<DynamicQr> {
  const parsed = parseDynamicQr(input);
  if (isDynamicQrExpired(parsed)) throw new Error('This QR expired. Ask for a new one.');
  const { sig, ...intent } = parsed;
  const expected = await mockSignature(intent);
  if (expected !== sig.toLowerCase()) throw new Error('Invalid QR signature.');
  return parsed;
}

export async function getMockStatus(paymentId: string) {
  const store = await readStore();
  const row = store[paymentId];
  if (!row) return 'unknown';
  if (row.status === 'awaiting_confirmation' && isDynamicQrExpired(row.payload)) return 'expired';
  return row.status;
}

// Simulates provider webhook confirm. Live mode replaces with server webhook.
export async function confirmMockIntent(paymentId: string) {
  const store = await readStore();
  const row = store[paymentId];
  if (!row) throw new Error('Payment not found.');
  if (isDynamicQrExpired(row.payload)) {
    row.status = 'expired';
    await writeStore(store);
    throw new Error('This QR expired.');
  }
  if (row.status !== 'awaiting_confirmation') return row.status;
  row.status = 'confirmed';
  await writeStore(store);
  return row.status;
}

export async function expireMockIntent(paymentId: string) {
  const store = await readStore();
  const row = store[paymentId];
  if (row) {
    row.status = 'expired';
    await writeStore(store);
  }
}
