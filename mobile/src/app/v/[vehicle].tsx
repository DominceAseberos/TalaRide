import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Copy, replace, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';

export default function VehicleLinkScreen() {
  const { vehicle, c } = useLocalSearchParams<{ vehicle?: string; c?: string }>();
  const { session, profile } = useAuth();
  const isStaff = !!session && !!profile && profile.role !== 'passenger';

  useEffect(() => {
    if (isStaff || (session && !profile)) return;
    const code = String(vehicle ?? '').trim().toUpperCase();
    const checksum = String(c ?? '').trim();
    if (!/^TR-\d{5}$/.test(code) || !checksum) {
      replace('/scan-ride');
      return;
    }
    replace('/ride-confirm?vehicle_code=' + encodeURIComponent(code) + '&c=' + encodeURIComponent(checksum));
  }, [vehicle, c, session, profile, isStaff]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {isStaff ? (
          <>
            <Title>Passenger payment QR</Title>
            <Copy>This QR is for passengers paying a fare. Driver and staff accounts cannot make passenger payments.</Copy>
            <Button label="Return to dashboard" onPress={() => replace(profile?.role === 'driver' ? '/driver-portal' : '/staff-account')} />
          </>
        ) : (
          <>
            <ActivityIndicator />
            <Copy>{session && !profile ? 'Checking your account role…' : 'Opening verified TalaRide vehicle…'}</Copy>
          </>
        )}
      </View>
    </Screen>
  );
}
