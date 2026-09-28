import { authRedirectUrl, requireSupabase } from './client';
export type EmailAction = 'signin' | 'register' | 'recover' | 'reset';
export async function performEmailAction(
  action: EmailAction,
  email: string,
  password: string,
  name = '',
) {
  const client = requireSupabase();
  email = email.trim();
  if (action !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address.');
  if (
    action !== 'recover' &&
    (!password || ((action === 'register' || action === 'reset') && password.length < 8))
  )
    throw new Error(
      action === 'signin' ? 'Enter your password.' : 'Use a password with at least 8 characters.',
    );
  if (action === 'register' && (!name.trim() || name.trim().length > 80))
    throw new Error('Enter a name between 1 and 80 characters.');
  if (action === 'signin') {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return 'authenticated' as const;
  }
  if (action === 'register') {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
    return data.session ? ('authenticated' as const) : ('confirmation-required' as const);
  }
  if (action === 'recover') {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl(),
    });
    if (error) throw error;
    return 'recovery-sent' as const;
  }
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return 'authenticated' as const;
}
