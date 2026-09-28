import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { authConfigurationError, requireSupabase, supabase } from './client';
import { loadProfile, saveProfile, type UserProfile } from './profiles';
import { clearDraft } from '@/scan/draft';

type AuthState = {
  ready: boolean;
  session: Session | null;
  recovery: boolean;
  error: string | null;
  profile: UserProfile | null;
  profileError: string | null;
  displayName: string;
  setRecovery: (value: boolean) => void;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(authConfigurationError);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileFailure, setProfileFailure] = useState<{ id: string; message: string } | null>(
    null,
  );
  const account = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    let eventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((event, value) => {
      if (!active) return;
      eventReceived = true;
      const nextAccount = value?.user.id ?? null;
      if (account.current !== nextAccount) void clearDraft();
      account.current = nextAccount;
      setSession(value);
      if (value) setError(null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!value) {
        setRecovery(false);
        void clearDraft();
      }
      setReady(true);
    });
    void supabase.auth
      .getSession()
      .then(({ data: result, error: failure }) => {
        if (!active) return;
        if (failure) setError('Your saved session could not be restored. Please sign in again.');
        if (!eventReceived) {
          account.current = result.session?.user.id ?? null;
          setSession(result.session);
        }
      })
      .catch(() => {
        if (active) setError('Your saved session could not be restored. Please sign in again.');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const refresh = (state: string | null) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    return () => {
      active = false;
      data.subscription.unsubscribe();
      listener?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, []);
  const id = session?.user.id ?? null;
  useEffect(() => {
    let active = true;
    if (id)
      void loadProfile(id)
        .then((value) => {
          if (active && account.current === id) {
            setProfile(value);
            setProfileFailure(null);
          }
        })
        .catch((failure) => {
          if (active && account.current === id) setProfileFailure({ id, message: failure.message });
        });
    return () => {
      active = false;
    };
  }, [id]);
  const currentProfile = profile?.id === id ? profile : null;
  return (
    <Context.Provider
      value={{
        ready,
        session,
        recovery,
        error,
        profile: currentProfile,
        profileError: profileFailure?.id === id ? profileFailure.message : null,
        displayName: currentProfile?.display_name || 'Passenger',
        setRecovery,
        async signOut() {
          // Local sign-out works offline and removes this device's persisted session.
          const client = requireSupabase();
          const { error: failure } = await client.auth.signOut({ scope: 'local' });
          if (failure) {
            // Current SDK clears device storage even when server revocation fails offline.
            const restored = await client.auth.getSession();
            if (restored.error || restored.data.session)
              throw new Error('Sign-out failed. Please try again.');
          }
          setSession(null);
          setRecovery(false);
          await clearDraft();
        },
        async updateProfile(name) {
          if (!id) throw new Error('Sign in to update your profile.');
          const value = await saveProfile(id, name);
          if (account.current === id) {
            setProfile(value);
            setProfileFailure(null);
          }
        },
        async refreshProfile() {
          if (!id) return;
          try {
            const value = await loadProfile(id);
            if (account.current === id) {
              setProfile(value);
              setProfileFailure(null);
            }
          } catch (failure) {
            if (account.current === id)
              setProfileFailure({
                id,
                message: failure instanceof Error ? failure.message : 'Profile unavailable.',
              });
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
