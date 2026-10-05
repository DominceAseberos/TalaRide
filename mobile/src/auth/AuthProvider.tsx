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

export const DEMO_USERS = {
  passenger: {
    id: 'USR-COM-001',
    aud: 'authenticated',
    role: 'passenger',
    email: 'maria.santos@talaride.ph',
    app_metadata: { provider: 'demo' },
    user_metadata: { display_name: 'Maria Santos' },
    created_at: '2026-09-10T10:00:00.000Z',
  },
  driver: {
    id: 'USR-DRV-001',
    aud: 'authenticated',
    role: 'driver',
    email: 'juan.delacruz@talaride.ph',
    app_metadata: { provider: 'demo' },
    user_metadata: { display_name: 'Juan Dela Cruz' },
    created_at: '2026-09-01T08:00:00.000Z',
  },
};

let inMemoryDemoSession: Session | null = null;

function getStoredDemoSession(): Session | null {
  if (inMemoryDemoSession) return inMemoryDemoSession;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('talaride.demo_session');
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function saveStoredDemoSession(session: Session | null) {
  inMemoryDemoSession = session;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (session) {
        window.localStorage.setItem('talaride.demo_session', JSON.stringify(session));
      } else {
        window.localStorage.removeItem('talaride.demo_session');
      }
    } catch {
      // ignore
    }
  }
}

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
  signInAsDemo: (role?: 'passenger' | 'driver') => Promise<void>;
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
          if (result.session) {
            account.current = result.session?.user.id ?? null;
            setSession(result.session);
          } else {
            const demoSession = getStoredDemoSession();
            if (demoSession && active && !eventReceived) {
              account.current = demoSession.user.id;
              setSession(demoSession);
            }
          }
        }
      })
      .catch(() => {
        if (!active) return;
        const demoSession = getStoredDemoSession();
        if (demoSession && active && !eventReceived) {
          account.current = demoSession.user.id;
          setSession(demoSession);
          return;
        }
        setError('Your saved session could not be restored. Please sign in again.');
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
        async signInAsDemo(role: 'passenger' | 'driver' = 'passenger') {
          const user = DEMO_USERS[role];
          const demoSession: Session = {
            access_token: `demo-${role}-token`,
            refresh_token: `demo-${role}-refresh-token`,
            expires_in: 86400,
            token_type: 'bearer',
            user: user as any,
          };
          account.current = user.id;
          setSession(demoSession);
          setProfile({
            id: user.id,
            display_name: user.user_metadata.display_name,
          });
          setError(null);
          saveStoredDemoSession(demoSession);
        },
        async signOut() {
          saveStoredDemoSession(null);
          try {
            if (supabase) {
              const client = requireSupabase();
              const { error: failure } = await client.auth.signOut({ scope: 'local' });
              if (failure) {
                const restored = await client.auth.getSession();
                if (restored.error || restored.data.session)
                  throw new Error('Sign-out failed. Please try again.');
              }
            }
          } catch {
            // Local sign-out should always succeed on device
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
