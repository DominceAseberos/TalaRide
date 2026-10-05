import { requireSupabase } from './client';
export type UserProfile = { id: string; display_name: string };
export async function loadProfile(id: string): Promise<UserProfile> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, display_name')
    .eq('id', id)
    .single();
  if (error)
    throw new Error(
      'Your cloud profile could not be loaded. Check your connection and the profile migration.',
    );
  return data as UserProfile;
}
export async function saveProfile(id: string, name: string) {
  name = name.trim();
  if (!name || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
  const { data, error } = await requireSupabase()
    .from('profiles')
    .update({ display_name: name })
    .eq('id', id)
    .select('id, display_name')
    .single();
  if (error)
    throw new Error('Your profile could not be saved. Check your connection and try again.');
  return data as UserProfile;
}
