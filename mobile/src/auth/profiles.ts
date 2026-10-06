import { requireSupabase } from './client';
export type AppRole = 'admin' | 'operator' | 'passenger' | 'driver';
export type UserProfile = { id: string; display_name: string; avatar_url?: string | null; role: AppRole };
function canonicalRole(value: unknown): AppRole | null {
  if (value === 'admin' || value === 'talaride_admin' || value === 'lgu_admin') return 'admin';
  if (value === 'operator' || value === 'passenger' || value === 'driver') return value;
  if (value === 'toda_operator') return 'operator';
  if (value === 'commuter') return 'passenger';
  return null;
}
export async function loadProfile(id: string): Promise<UserProfile> {
  const client = requireSupabase();
  const [{ data, error }, { data: authData }] = await Promise.all([client
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('id', id)
    .single(), client.auth.getUser()]);
  if (error)
    throw new Error(
      'Your cloud profile could not be loaded. Check your connection and the profile migration.',
    );
  const savedRole = canonicalRole(data.role) || 'passenger';
  const authRole = authData.user?.id === id ? canonicalRole(authData.user.app_metadata?.role) : null;
  const role = authRole === 'admin' || authRole === 'operator' || authRole === 'driver'
    ? authRole
    : savedRole;
  return { ...data, role } as UserProfile;
}
export async function saveProfile(id: string, name: string, avatarUrl?: string | null) {
  name = name.trim();
  if (!name || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
  const updates: { display_name: string; avatar_url?: string | null; avatar_updated_at?: string } = {
    display_name: name,
  };
  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
    updates.avatar_updated_at = new Date().toISOString();
  }
  const { data, error } = await requireSupabase()
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, display_name, avatar_url, role')
    .single();
  if (error)
    throw new Error('Your profile could not be saved. Check your connection and try again.');
  return data as UserProfile;
}

export async function uploadProfileImage(
  id: string,
  uri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  requireSupabase();
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected profile image could not be read.');
  const bytes = await response.arrayBuffer();
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${id}/profile.${extension}`;
  const { error } = await requireSupabase().storage.from('avatars').upload(path, bytes, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw new Error('Your profile image could not be uploaded. Try again.');
  const { data } = requireSupabase().storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadLostItemImage(
  id: string,
  uri: string,
  mimeType = 'image/jpeg',
): Promise<string> {
  requireSupabase();
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected lost-item image could not be read.');
  const bytes = await response.arrayBuffer();
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await requireSupabase().storage.from('lost-item-images').upload(path, bytes, {
    contentType: mimeType,
    cacheControl: '604800',
    upsert: false,
  });
  if (error) throw new Error('The lost-item image could not be uploaded. Try again.');
  const { data } = requireSupabase().storage.from('lost-item-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
