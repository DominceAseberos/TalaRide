import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { requireSupabase } from '@/auth/client';
import type { LostRequest, Notification, RelayPrompt } from '@/types/models';

type RelayEnvelope = {
  error?: string;
  request?: Record<string, unknown>;
  requests?: Record<string, unknown>[];
  prompts?: Record<string, unknown>[];
  notifications?: Record<string, unknown>[];
  enabled?: boolean;
};

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke<RelayEnvelope>(
    'community-relay',
    { body },
  );
  if (error) throw new Error(await relayErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

function safeServerMessage(value: unknown) {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  return message && message.length <= 200 && !/[\u0000-\u001f\u007f]/.test(message)
    ? message
    : null;
}

async function relayErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context instanceof Response ? error.context : null;
    if (response) {
      try {
        const payload = (await response.clone().json()) as { error?: unknown };
        const message = safeServerMessage(payload?.error);
        if (message) return message;
      } catch {
        // Use a status-specific safe fallback when the response is not valid JSON.
      }
      if (response.status === 401) return 'Your session is no longer valid. Please sign in again.';
      if (response.status === 429) return 'Too many requests. Try again later.';
      if (response.status === 503) return 'Relay service is temporarily unavailable.';
    }
    return 'The relay request could not be completed.';
  }
  if (error instanceof FunctionsFetchError)
    return 'Could not reach the relay service. Check your connection and try again.';
  if (error instanceof FunctionsRelayError) return 'Relay service is temporarily unavailable.';
  return 'Relay service is unavailable.';
}
function status(value: unknown): LostRequest['status'] {
  if (value === 'active') return 'Active';
  if (value === 'helper_responding') return 'Helper responding';
  if (value === 'resolved') return 'Resolved';
  return 'Expired';
}
function request(row: Record<string, unknown>): LostRequest {
  return {
    id: String(row.id),
    rideId: String(row.local_ride_id),
    description: String(row.item_description),
    details: String(row.additional_details ?? ''),
    date: String(row.created_at),
    expiresAt: String(row.expires_at),
    status: status(row.status),
  };
}
function prompt(row: Record<string, unknown>, rideId: string): RelayPrompt {
  return {
    matchId: String(row.matchId),
    requestId: String(row.requestId),
    rideId,
    description: String(row.description),
    details: String(row.details ?? ''),
    createdAt: String(row.createdAt),
    expiresAt: String(row.expiresAt),
  };
}

export async function createLostRequest(
  rideId: string,
  vehicle: string,
  description: string,
  details: string,
) {
  const data = await invoke({ action: 'create', rideId, vehicle, description, details });
  if (!data.request) throw new Error('The relay returned an invalid response.');
  return request(data.request);
}
export async function registerFutureScan(rideId: string, vehicle: string) {
  const data = await invoke({ action: 'scan', vehicle });
  return (data.prompts ?? []).map((item) => prompt(item, rideId));
}
export async function respondToRelay(matchId: string, response: 'offered' | 'dismissed') {
  await invoke({ action: 'respond', matchId, response });
}
export async function resolveLostRequest(requestId: string) {
  await invoke({ action: 'status', requestId, status: 'resolved' });
}
export async function listLostRequests() {
  const data = await invoke({ action: 'list' });
  return (data.requests ?? []).map(request);
}
function notification(row: Record<string, unknown>): Notification {
  const kind = row.kind as Notification['kind'];
  const copy =
    kind === 'helper_offered'
      ? ['Someone offered assistance', 'Open TalaRide to review your lost-item request.']
      : kind === 'request_resolved'
        ? ['Request resolved', 'The lost-item request is now closed.']
        : kind === 'request_expired'
          ? ['Request expired', 'Your seven-day lost-item request has expired.']
          : ['Lost-item relay available', 'Open TalaRide to view a private relay prompt.'];
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    title: copy[0],
    message: copy[1],
    date: String(row.created_at),
    unread: !row.is_read,
    kind,
    matchId: row.match_id ? String(row.match_id) : undefined,
    description: row.item_description ? String(row.item_description) : undefined,
    details: row.additional_details ? String(row.additional_details) : undefined,
    matchResponse:
      row.match_response === 'offered' || row.match_response === 'dismissed'
        ? row.match_response
        : null,
    requestStatus:
      row.request_status === 'active' ||
      row.request_status === 'helper_responding' ||
      row.request_status === 'resolved' ||
      row.request_status === 'expired'
        ? row.request_status
        : undefined,
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
  };
}
export async function registerPushToken(token: string, platform: 'android' | 'ios') {
  await invoke({ action: 'register_push', token, platform });
}
export async function listRelayNotifications() {
  const data = await invoke({ action: 'notifications' });
  return (data.notifications ?? []).map(notification);
}
export async function markRelayNotificationRead(notificationId: string) {
  await invoke({ action: 'read_notification', notificationId });
}
export async function getNotificationPreference() {
  const data = await invoke({ action: 'preferences' });
  return data.enabled !== false;
}
export async function setNotificationPreference(enabled: boolean) {
  const data = await invoke({ action: 'preferences', enabled });
  return data.enabled !== false;
}
