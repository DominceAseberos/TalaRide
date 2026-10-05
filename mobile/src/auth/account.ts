import { requireSupabase } from './client';

export async function deleteRemoteAccount() {
  const { error } = await requireSupabase().functions.invoke('account-profile', {
    method: 'DELETE',
  });
  if (error)
    throw new Error('Your account could not be deleted. Check your connection and try again.');
}
