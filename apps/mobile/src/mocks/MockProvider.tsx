import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  type PropsWithChildren,
} from 'react';
import { initialRequests } from './data';
import {
  clearRides as clearStoredRides,
  createRide,
  deleteRide as deleteStoredRide,
  initializeRideDatabase,
  listRides,
  updateRide as updateStoredRide,
} from '@/db/rides';
import { deleteRemoteAccount } from '@/auth/account';
import type { IdentifierType, LostRequest, RelayPrompt, Ride } from '@/types/models';
import { useAuth } from '@/auth/AuthProvider';
import {
  createLostRequest,
  listLostRequests,
  registerFutureScan,
  resolveLostRequest,
  respondToRelay,
} from '@/relay/api';
type MockState = {
  ready: boolean;
  onboardingComplete: boolean;
  signedIn: boolean;
  completeOnboarding: () => Promise<void>;
  ridesLoading: boolean;
  ridesError: string | null;
  rides: Ride[];
  requests: LostRequest[];
  relayPrompts: RelayPrompt[];
  saveRide: (number: string, identifier: IdentifierType) => Promise<string>;
  updateRide: (id: string, note: string, location: string) => Promise<void>;
  deleteRide: (id: string) => Promise<void>;
  clearRideHistory: () => Promise<number>;
  deleteAccount: () => Promise<void>;
  searchRides: (search: string, identifier: IdentifierType | 'All') => Promise<Ride[]>;
  createRequest: (ride: Ride, description: string, details: string) => Promise<void>;
  respondToPrompt: (matchId: string, response: 'offered' | 'dismissed') => Promise<void>;
  resolveRequest: (requestId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
};
const Context = createContext<MockState | null>(null);
const ONBOARDING_KEY = 'talaride.onboarding.complete';
/** Local ride storage plus in-memory demonstrations for later relay features. */
export function MockProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const { session, recovery, ready: authReady, signOut } = useAuth();
  const localAccountId = session && !recovery ? session.user.id : null;
  const signedIn = !!localAccountId;
  const account = useRef(localAccountId);
  useLayoutEffect(() => {
    account.current = localAccountId;
  }, [localAccountId]);
  const [loadedAccount, setLoadedAccount] = useState<string | null>(null);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [ridesError, setRidesError] = useState<string | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [requests, setRequests] = useState(initialRequests);
  const [relayPrompts, setRelayPrompts] = useState<RelayPrompt[]>([]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (active) setOnboardingComplete(value === 'true');
      })
      .catch(() => {
        // The UI remains usable if device storage is temporarily unavailable.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const accountId = localAccountId;
    async function loadRides() {
      // Schedule initialization before updating state, and honor cancellation on account switches.
      await Promise.resolve();
      if (!active) return;
      setRides([]);
      setLoadedAccount(null);
      setRidesError(null);
      setRidesLoading(!!accountId);
      setRequests(initialRequests);
      setRelayPrompts([]);
      if (!accountId) return;
      try {
        await initializeRideDatabase();
        const items = await listRides(accountId);
        if (!active || account.current !== accountId) return;
        setRides(items);
        setLoadedAccount(accountId);
        listLostRequests()
          .then((value) => {
            if (active && account.current === accountId) setRequests(value);
          })
          .catch(() => {});
      } catch {
        if (active) setRidesError('Your local rides could not be loaded. Please restart the app.');
      } finally {
        if (active) setRidesLoading(false);
      }
    }
    void loadRides();
    return () => {
      active = false;
    };
  }, [localAccountId]);

  const value: MockState = useMemo(
    () => ({
      ready: ready && authReady,
      onboardingComplete,
      signedIn,
      ridesLoading:
        ridesLoading || (!!localAccountId && loadedAccount !== localAccountId && !ridesError),
      ridesError,
      async completeOnboarding() {
        setOnboardingComplete(true);
        try {
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        } catch {
          // Keep the current app session usable; persistence will be retried next onboarding run.
        }
      },
      rides: loadedAccount === localAccountId ? rides : [],
      requests: localAccountId && loadedAccount === localAccountId ? requests : initialRequests,
      relayPrompts: localAccountId && loadedAccount === localAccountId ? relayPrompts : [],
      async saveRide(number, identifier) {
        if (
          !localAccountId ||
          account.current !== localAccountId ||
          loadedAccount !== localAccountId
        )
          throw new Error('Ride storage is still initializing.');
        const ride = await createRide(localAccountId, number, identifier);
        if (account.current !== localAccountId)
          throw new Error('The account changed. Sign in again to view the saved ride.');
        setRides((items) => [ride, ...items]);
        registerFutureScan(ride.id, ride.number)
          .then((prompts) => {
            if (account.current === localAccountId)
              setRelayPrompts((items) => [...prompts, ...items]);
          })
          .catch(() => {
            // A network failure never prevents the private local ride from being saved.
          });
        return ride.id;
      },
      async updateRide(id, note, location) {
        if (!localAccountId || account.current !== localAccountId)
          throw new Error('Ride storage is still initializing.');
        await updateStoredRide(localAccountId, id, note, location);
        if (account.current !== localAccountId) return;
        setRides((items) =>
          items.map((item) => (item.id === id ? { ...item, note, location } : item)),
        );
      },
      async deleteRide(id) {
        if (!localAccountId || account.current !== localAccountId)
          throw new Error('Ride storage is still initializing.');
        const linkedRequest = requests.find(
          (item) =>
            item.rideId === id && (item.status === 'Active' || item.status === 'Helper responding'),
        );
        if (linkedRequest) await resolveLostRequest(linkedRequest.id);
        await deleteStoredRide(localAccountId, id);
        if (account.current !== localAccountId) return;
        setRides((items) => items.filter((item) => item.id !== id));
        setRequests((items) => items.filter((item) => item.rideId !== id));
      },
      async clearRideHistory() {
        if (!localAccountId || account.current !== localAccountId)
          throw new Error('Ride storage is still initializing.');
        const count = await clearStoredRides(localAccountId);
        if (account.current === localAccountId) setRides([]);
        return count;
      },
      async deleteAccount() {
        if (!localAccountId || account.current !== localAccountId)
          throw new Error('Sign in to delete your account.');
        await deleteRemoteAccount();
        await clearStoredRides(localAccountId);
        await signOut();
      },
      async searchRides(search, identifier) {
        if (!localAccountId || account.current !== localAccountId) return [];
        const items = await listRides(localAccountId, search, identifier);
        return account.current === localAccountId ? items : [];
      },
      async createRequest(ride, description, details) {
        if (
          !localAccountId ||
          account.current !== localAccountId ||
          loadedAccount !== localAccountId ||
          !rides.some((item) => item.id === ride.id)
        )
          throw new Error('Ride storage is still initializing.');
        const created = await createLostRequest(ride.id, ride.number, description, details);
        if (account.current === localAccountId)
          setRequests((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      },
      async respondToPrompt(matchId, response) {
        await respondToRelay(matchId, response);
        if (account.current === localAccountId)
          setRelayPrompts((items) => items.filter((item) => item.matchId !== matchId));
      },
      async resolveRequest(requestId) {
        await resolveLostRequest(requestId);
        if (account.current === localAccountId)
          setRequests((items) =>
            items.map((item) => (item.id === requestId ? { ...item, status: 'Resolved' } : item)),
          );
      },
      async refreshRequests() {
        if (!localAccountId || account.current !== localAccountId) return;
        const items = await listLostRequests();
        if (account.current === localAccountId) setRequests(items);
      },
    }),
    [
      localAccountId,
      loadedAccount,
      authReady,
      onboardingComplete,
      ready,
      requests,
      rides,
      ridesError,
      ridesLoading,
      relayPrompts,
      signedIn,
      signOut,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMock() {
  const value = useContext(Context);
  if (!value) throw new Error('useMock must be used within MockProvider');
  return value;
}
