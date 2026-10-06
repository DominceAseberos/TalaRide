// Deno Edge runtime; NOT bundled into the mobile app.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

Deno.serve(async (request: Request) => {
  const respond = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!['GET', 'PATCH', 'DELETE'].includes(request.method))
    return respond(405, { error: 'Method not allowed' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return respond(401, { error: 'Authentication required' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) return respond(503, { error: 'Service unavailable' });
  // The caller's JWT applies RLS. No service-role bypass is used.
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser(authorization.slice(7));
    if (error || !user) return respond(401, { error: 'Invalid session' });
    if (request.method === 'DELETE') {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceKey) return respond(503, { error: 'Account deletion is unavailable' });
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: failure } = await admin.auth.admin.deleteUser(user.id);
      return failure
        ? respond(503, { error: 'Account deletion failed' })
        : new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method === 'PATCH') {
      const length = Number(request.headers.get('content-length'));
      if (length > 2048) return respond(413, { error: 'Body too large' });
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) {
            await reader.cancel();
            return respond(413, { error: 'Body too large' });
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const text = new TextDecoder().decode(bytes);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return respond(400, { error: 'Invalid JSON' });
      }
      const name = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
      const avatarUrl =
        body?.avatar_url === null
          ? null
          : typeof body?.avatar_url === 'string' && body.avatar_url.length <= 1000
            ? body.avatar_url
            : undefined;
      if (
        (!name && avatarUrl === undefined) ||
        (name && name.length > 80) ||
        Object.keys(body).some((key) => !['display_name', 'avatar_url'].includes(key))
      )
        return respond(400, { error: 'Invalid display name' });
      const updates: { display_name?: string; avatar_url?: string | null; avatar_updated_at?: string } = {};
      if (name) updates.display_name = name;
      if (avatarUrl !== undefined) {
        updates.avatar_url = avatarUrl;
        updates.avatar_updated_at = new Date().toISOString();
      }
      const { data, error: failure } = await client
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('id, display_name, avatar_url')
        .single();
      return failure ? respond(503, { error: 'Profile unavailable' }) : respond(200, data);
    }
    const { data, error: failure } = await client
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', user.id)
      .single();
    return failure ? respond(503, { error: 'Profile unavailable' }) : respond(200, data);
  } catch {
    return respond(503, { error: 'Service unavailable' });
  }
});
