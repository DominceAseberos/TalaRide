import { apiRequest } from './client';

export type PaymentMethod = 'gcash' | 'maya' | 'card' | 'qrph';

export interface IntentResponse {
  payment_id: string;
  ride_id: string;
  amount_centavos: number;
  qr_payload: string;
  expires_at: string;
  checkout_url: string | null;
  payment_method?: PaymentMethod;
  payment_flow?: 'direct_gcash' | 'paymongo_checkout' | 'simulated';
}

export interface StatusResponse {
  payment_environment?: 'test' | 'live';
  payment_mode?: 'mock' | 'live';
  payment_id: string;
  status: string;
  amount_centavos: number;
  confirmed_at: string | null;
  checkout_url: string | null;
}

export function createPaymentIntent(input: {
  driver_code: string;
  vehicle_code: string;
  amount_centavos: number;
  payment_method?: PaymentMethod;
  client_operation_id?: string;
}) {
  return apiRequest<IntentResponse>('/payment-intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Server-authorized simulation only. Live provider mode never calls this from mobile.
export async function confirmServerPayment(
  payment_id: string,
  provider: PaymentMethod | 'mock' = 'gcash',
  accessToken?: string,
) {
  const normalizedProvider = provider === 'qrph' ? 'qrph_bank' : provider;
  const data = await apiRequest<{
    payment: { payment_id: string; payment_status: string };
  }>('/mock-confirm', {
    method: 'POST',
    body: JSON.stringify({ payment_id, provider: normalizedProvider }),
  }, accessToken);
  return { payment_id: data.payment.payment_id, status: data.payment.payment_status };
}

export async function claimPayment(qr_payload: string) {
  return apiRequest<{
    payment_id: string;
    ride_id: string;
    payment_status: string;
  }>('/payment-claim', {
    method: 'POST',
    body: JSON.stringify({ qr_payload }),
  });
}

export async function fetchPaymentStatus(payment_id: string): Promise<StatusResponse> {
  const data = await apiRequest<{
    payment_environment?: 'test' | 'live';
    payment_mode?: 'mock' | 'live';
    payment_id: string;
    payment_status: string;
    amount_centavos: number;
    confirmed_at: string | null;
    checkout_url?: string | null;
  }>('/payment-status?payment_id=' + encodeURIComponent(payment_id));
  return {
    payment_environment: data.payment_environment,
    payment_mode: data.payment_mode,
    payment_id: data.payment_id,
    status: data.payment_status,
    amount_centavos: data.amount_centavos,
    confirmed_at: data.confirmed_at,
    checkout_url: data.checkout_url ?? null,
  };
}

export function statusToLabel(status: string): string {
  if (status === 'confirmed') return '✓ PAID';
  if (status === 'expired') return 'PAYMENT EXPIRED';
  if (status === 'cancelled') return 'PAYMENT CANCELLED';
  if (status === 'failed') return 'PAYMENT FAILED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'awaiting_confirmation' || status === 'initiated') return 'WAITING FOR PAYMENT';
  return 'Status: ' + status;
}
