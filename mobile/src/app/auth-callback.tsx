import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Modal, Platform, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Copy, Title, replace } from '@/components/ui';
import { requireSupabase } from '@/auth/client';
import { parseAuthCallback } from '@/auth/config';
import { useAuth } from '@/auth/AuthProvider';
import { loadProfile } from '@/auth/profiles';

export default function AuthCallback() {
  const link = Linking.useURL();
  const { setRecovery } = useAuth();
  const handled = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [verifiedDestination, setVerifiedDestination] = useState<string | null>(null);
  useEffect(() => {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : link;
    if (!url || handled.current === url) return;
    handled.current = url;
    // Let an in-flight exchange survive Strict Effects replay; it must execute exactly once.
    void (async () => {
      try {
        const callback = parseAuthCallback(url);
        setRecovery(callback.recovery);
        const client = requireSupabase();
        const result =
          callback.kind === 'code'
            ? await client.auth.exchangeCodeForSession(callback.code)
            : await client.auth.setSession({
                access_token: callback.accessToken,
                refresh_token: callback.refreshToken,
              });
        if (result.error)
          throw new Error('This authentication link is invalid or expired. Request a new link.');
        if (Platform.OS === 'web') window.history.replaceState({}, '', '/auth-callback');
        const callbackRole = result.data.session ? await loadProfile(result.data.session.user.id) : null;
        if (callback.recovery) {
          replace('/sign-in');
        } else {
          setVerifiedDestination(
            callbackRole?.role === 'driver'
              ? '/driver-portal'
              : callbackRole?.role === 'admin' || callbackRole?.role === 'operator'
                ? '/staff-account'
                : '/home',
          );
        }
      } catch (failure) {
        if (Platform.OS === 'web') window.history.replaceState({}, '', '/auth-callback');
        setRecovery(false);
        setError(failure instanceof Error ? failure.message : 'Authentication failed.');
      }
    })();
  }, [link, setRecovery]);
  return (
    <Screen>
      <Title>Account verification</Title>
      <Copy>{error || 'Verifying your authentication link…'}</Copy>
      {!!error && <Button label="Return to sign in" onPress={() => replace('/sign-in')} />}
      <Modal
        visible={!!verifiedDestination}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View style={{ backgroundColor: 'white', borderRadius: 18, padding: 22, gap: 12 }}>
            <Title>Email verified</Title>
            <Copy>
              Your TalaRide account email was confirmed successfully. Continue to your account.
            </Copy>
            <Button
              label="Continue to TalaRide"
              onPress={() => verifiedDestination && replace(verifiedDestination)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
