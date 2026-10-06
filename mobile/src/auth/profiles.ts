import { requireSupabase, supabase } from './client';
export type UserProfile = { id: string; display_name: string; avatar_url?: string | null };
export async function loadProfile(id: string): Promise<UserProfile> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', id)
    .single();
  if (error)
    throw new Error(
      'Your cloud profile could not be loaded. Check your connection and the profile migration.',
    );
  return data as UserProfile;
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
    .select('id, display_name, avatar_url')
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
  // Demo sessions have no cloud storage; keep the selected local URI for the current session.
  if (!supabase) return uri;
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
