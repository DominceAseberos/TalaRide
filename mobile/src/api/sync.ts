import { flushOutbox, type OutboxKind } from '@/offline/queue';
import { sendCashRide, sendCheckin } from './rides';
import { confirmServerPayment } from './payments';
import { reportLostItem, reportPaymentIssue } from './lost-items';
import { getCurrentAuthCredential, getPaymentMode } from './client';

type Payload = Record<string, any>;

async function sendOnce(
  kind: OutboxKind,
  payload: Payload,
  accessToken: string,
): Promise<boolean> {
  const op = String(
    payload.client_operation_id ?? payload.local_ride_id ?? payload.payment_id ?? '',
  );
  if (!op) return false;
  if (kind === 'checkin') {
    await sendCheckin({
      vehicle_code: String(payload.vehicle_code),
      pickup_text: payload.pickup_text,
      pickup_lat: payload.pickup_lat,
      pickup_lng: payload.pickup_lng,
      client_operation_id: op,
      local_ride_id: payload.local_ride_id ? String(payload.local_ride_id) : undefined,
    }, accessToken);
    return true;
  }
  if (kind === 'cash_ride') {
    await sendCashRide({
      driver_code: String(payload.driver_code ?? ''),
      vehicle_code: String(payload.vehicle_code),
      amount_centavos: Number(payload.amount_centavos),
      client_operation_id: op,
      local_ride_id: payload.local_ride_id ? String(payload.local_ride_id) : undefined,
    }, accessToken);
    return true;
  }
  if (kind === 'payment_confirm') {
    // Live mode never marks paid from mobile; only mock-server demo confirms.
    if (getPaymentMode() === 'live') return false;
    await confirmServerPayment(
      String(payload.payment_id),
      (payload.provider ? String(payload.provider) : 'gcash') as any,
      accessToken,
    );
    return true;
  }
  if (kind === 'payment_issue') {
    await reportPaymentIssue({
      payment_id: payload.payment_id,
      ride_id: payload.ride_id,
      reason: String(payload.reason ?? 'other'),
      details: payload.details ? String(payload.details) : undefined,
      client_operation_id: op,
    }, accessToken);
    return true;
  }
  await reportLostItem({
    ride_id: String(payload.ride_id),
    category: String(payload.category ?? 'Other'),
    description: String(payload.description ?? ''),
    client_operation_id: op,
  }, accessToken);
  return true;
}

// Backend must accept before local removal. Work is selected by its original
// account. Immediately before each send we read one Supabase session object,
// verify its user owns the queue row, and pass that exact session's immutable
// access token through to the HTTP request. A later account switch therefore
// cannot cause owner A's queued action to be transmitted with owner B's token.
export async function triggerSync() {
  const initialCredential = await getCurrentAuthCredential();
  const ownerId = initialCredential?.userId;
  if (!ownerId) return { sent: 0, pending: 0 };

  return flushOutbox(ownerId, async (kind, payload) => {
    try {
      const credential = await getCurrentAuthCredential();
      if (!credential || credential.userId !== ownerId) return false;
      return await sendOnce(kind, payload as Payload, credential.accessToken);
    } catch {
      return false;
    }
  });
}
