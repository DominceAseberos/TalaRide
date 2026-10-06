import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

type Json = Record<string, unknown>;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const limits = {
  create: [5, 3600],
  scan: [30, 60],
  respond: [20, 3600],
  status: [20, 3600],
  list: [60, 60],
  register_push: [10, 3600],
  notifications: [60, 60],
  read_notification: [60, 60],
  preferences: [20, 3600],
} as const;

async function notify(
  admin: SupabaseClient<any>,
  userId: string,
  requestId: string,
  kind: string,
  matchId?: string,
) {
  const row = { user_id: userId, request_id: requestId, match_id: matchId ?? null, kind };
  const { error } = await admin
    .from('relay_notifications')
    .upsert(row, { onConflict: 'user_id,request_id,kind,match_id', ignoreDuplicates: true });
  if (error) return;
  const { data: preference } = await admin
    .from('notification_preferences')
    .select('relay_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (preference?.relay_enabled === false) return;
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('enabled', true)
    .limit(5);
  if (!tokens?.length) return;
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(
      tokens.map(({ token }) => ({
        to: token,
        title: 'TalaRide activity update',
        body: 'Open TalaRide to view a private lost-item relay update.',
        data: { route: '/activity?tab=notifications' },
        sound: 'default',
      })),
    ),
  }).catch(() => undefined);
}

function reply(status: number, body: Json) {
  return new Response(JSON.stringify(body), { status, headers });
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string')
    throw new Error(required ? 'A required field is missing.' : 'Invalid text.');
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error('Invalid text length.');
  return result;
}
function uuid(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error('Invalid identifier.');
  return value;
}
function vehicle(value: unknown) {
  const normalized = text(value, 15, true).toUpperCase().replace(/[ -]+/g, '');
  if (!/^[A-Z0-9]{1,15}$/.test(normalized)) throw new Error('Invalid vehicle identifier.');
  return normalized;
}
async function digest(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  const url = Deno.env.get('SUPABASE_URL');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const matchSecret = Deno.env.get('RELAY_MATCH_SECRET');
  if (!url || !publicKey || !serviceKey || !matchSecret || matchSecret.length < 32)
    return reply(503, { error: 'Relay service is not configured.' });
  const bearer = request.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ')) return reply(401, { error: 'Authentication required.' });
  const auth = createClient(url, publicKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) return reply(401, { error: 'Invalid session.' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  let body: Json;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: 'Invalid JSON.' });
  }
  const action = body.action;
  if (typeof action !== 'string' || !(action in limits))
    return reply(400, { error: 'Invalid action.' });

  const [maximum, seconds] = limits[action as keyof typeof limits];
  const now = new Date();
  const { data: allowed, error: rateError } = await admin.rpc('check_relay_rate_limit', {
    p_user: user.id,
    p_operation: action,
    p_maximum: maximum,
    p_window_seconds: seconds,
  });
  if (rateError) return reply(503, { error: 'Relay service is temporarily unavailable.' });
  if (!allowed) return reply(429, { error: 'Too many requests. Try again later.' });

  try {
    await admin.rpc('expire_lost_item_requests');
    await admin.rpc('purge_stale_relay_data');
    if (action === 'register_push') {
      const token = text(body.token, 200, true);
      const platform =
        body.platform === 'android' || body.platform === 'ios' ? body.platform : null;
      if (!platform || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(token))
        return reply(400, { error: 'Invalid push token.' });
      const { error } = await admin
        .from('push_tokens')
        .upsert(
          { user_id: user.id, token, platform, enabled: true, updated_at: now.toISOString() },
          { onConflict: 'token' },
        );
      if (error) throw error;
      return reply(200, { registered: true });
    }
    if (action === 'preferences') {
      if (typeof body.enabled === 'boolean') {
        const { error } = await admin
          .from('notification_preferences')
          .upsert({ user_id: user.id, relay_enabled: body.enabled, updated_at: now.toISOString() });
        if (error) throw error;
        if (!body.enabled)
          await admin
            .from('push_tokens')
            .update({ enabled: false, updated_at: now.toISOString() })
            .eq('user_id', user.id);
        return reply(200, { enabled: body.enabled });
      }
      const { data } = await admin
        .from('notification_preferences')
        .select('relay_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      return reply(200, { enabled: data?.relay_enabled ?? true });
    }
    if (action === 'notifications') {
      const { data, error } = await admin
        .from('relay_notifications')
        .select(
          'id, request_id, match_id, kind, is_read, created_at, lost_item_requests!inner(item_description, additional_details, image_url, status, expires_at), relay_matches(response)',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return reply(200, {
        notifications: (data ?? []).map((item) => {
          const requestRow = Array.isArray(item.lost_item_requests)
            ? item.lost_item_requests[0]
            : item.lost_item_requests;
          const matchRow = Array.isArray(item.relay_matches)
            ? item.relay_matches[0]
            : item.relay_matches;
          return {
            ...item,
            lost_item_requests: undefined,
            relay_matches: undefined,
            item_description:
              item.kind === 'relay_prompt' ? requestRow?.item_description : undefined,
            additional_details:
              item.kind === 'relay_prompt' ? requestRow?.additional_details : undefined,
            image_url: item.kind === 'relay_prompt' ? requestRow?.image_url : undefined,
            request_status: requestRow?.status,
            expires_at: requestRow?.expires_at,
            match_response: matchRow?.response ?? null,
          };
        }),
      });
    }
    if (action === 'read_notification') {
      const notificationId = uuid(body.notificationId);
      const { data, error } = await admin
        .from('relay_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply(404, { error: 'Notification not found.' });
      return reply(200, { read: true });
    }
    if (action === 'list') {
      const { data, error } = await admin
        .from('lost_item_requests')
        .select(
          'id, local_ride_id, item_description, additional_details, image_url, status, created_at, expires_at',
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return reply(200, { requests: data ?? [] });
    }
    if (action === 'create') {
      const item = text(body.description, 150, true);
      const details = text(body.details ?? '', 500);
      const localRideId = text(body.rideId, 100, true);
      const imageUrl = body.imageUrl == null ? null : text(body.imageUrl, 1200);
      if (imageUrl && !imageUrl.startsWith(`${url}/storage/v1/object/public/lost-item-images/`))
        return reply(400, { error: 'Invalid lost-item image.' });
      const vehicleDigest = await digest(vehicle(body.vehicle), matchSecret);
      const { data, error } = await admin
        .from('lost_item_requests')
        .insert({
          owner_id: user.id,
          local_ride_id: localRideId,
          vehicle_digest: vehicleDigest,
          item_description: item,
          additional_details: details,
          image_url: imageUrl,
        })
        .select(
          'id, local_ride_id, item_description, additional_details, image_url, status, created_at, expires_at',
        )
        .single();
      if (error?.code === '23505')
        return reply(409, { error: 'This ride already has an active request.' });
      if (error) throw error;
      return reply(201, { request: data });
    }
    if (action === 'scan') {
      const vehicleDigest = await digest(vehicle(body.vehicle), matchSecret);
      const { data: requests, error } = await admin
        .from('lost_item_requests')
        .select('id, owner_id, item_description, additional_details, image_url, created_at, expires_at')
        .eq('vehicle_digest', vehicleDigest)
        .eq('status', 'active')
        .lt('created_at', now.toISOString())
        .gt('expires_at', now.toISOString())
        .neq('owner_id', user.id)
        .limit(3);
      if (error) throw error;
      const prompts = [];
      for (const item of requests ?? []) {
        const { data: match, error: matchError } = await admin
          .from('relay_matches')
          .upsert(
            { request_id: item.id, helper_id: user.id, scanned_at: now.toISOString() },
            { onConflict: 'request_id,helper_id', ignoreDuplicates: true },
          )
          .select('id')
          .maybeSingle();
        if (matchError) throw matchError;
        if (match)
          prompts.push({
            matchId: match.id,
            requestId: item.id,
            description: item.item_description,
            details: item.additional_details,
            image_url: item.image_url,
            createdAt: item.created_at,
            expiresAt: item.expires_at,
          });
        if (match) await notify(admin, user.id, item.id, 'relay_prompt', match.id);
      }
      return reply(200, { prompts });
    }
    if (action === 'respond') {
      const matchId = uuid(body.matchId);
      const response =
        body.response === 'offered' || body.response === 'dismissed' ? body.response : null;
      if (!response) return reply(400, { error: 'Invalid response.' });
      const { data: match, error: matchError } = await admin
        .from('relay_matches')
        .select('id, request_id, response, lost_item_requests!inner(status, expires_at)')
        .eq('id', matchId)
        .eq('helper_id', user.id)
        .maybeSingle();
      if (matchError) throw matchError;
      const requestRow = Array.isArray(match?.lost_item_requests)
        ? match.lost_item_requests[0]
        : match?.lost_item_requests;
      if (
        !match ||
        match.response ||
        !requestRow ||
        requestRow.status !== 'active' ||
        new Date(requestRow.expires_at) <= now
      )
        return reply(409, { error: 'This prompt is no longer available.' });
      const { data: respondedRequestId, error } = await admin.rpc('respond_to_relay_match', {
        p_match_id: matchId,
        p_helper_id: user.id,
        p_response: response,
      });
      if (error) throw error;
      if (!respondedRequestId) return reply(409, { error: 'This prompt is no longer available.' });
      if (response === 'offered') {
        const { data: owner } = await admin
          .from('lost_item_requests')
          .select('owner_id')
          .eq('id', respondedRequestId)
          .single();
        if (owner)
          await notify(admin, owner.owner_id, respondedRequestId, 'helper_offered', match.id);
      }
      return reply(200, { response });
    }
    if (action === 'status') {
      const requestId = uuid(body.requestId);
      if (body.status !== 'resolved') return reply(400, { error: 'Invalid status transition.' });
      const { data, error } = await admin
        .from('lost_item_requests')
        .update({ status: 'resolved', resolved_at: now.toISOString() })
        .eq('id', requestId)
        .eq('owner_id', user.id)
        .in('status', ['active', 'helper_responding'])
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply(409, { error: 'Request cannot be resolved.' });
      const { data: helpers } = await admin
        .from('relay_matches')
        .select('id, helper_id')
        .eq('request_id', requestId)
        .eq('response', 'offered');
      for (const helper of helpers ?? [])
        await notify(admin, helper.helper_id, requestId, 'request_resolved', helper.id);
      return reply(200, { status: 'resolved' });
    }
  } catch (error) {
    const message =
      error instanceof Error && /Invalid|required|length/.test(error.message)
        ? error.message
        : 'Relay operation failed.';
    return reply(message === 'Relay operation failed.' ? 500 : 400, { error: message });
  }
  return reply(400, { error: 'Invalid action.' });
});
