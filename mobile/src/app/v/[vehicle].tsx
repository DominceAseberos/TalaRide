import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Copy, replace } from '@/components/ui';

export default function VehicleLinkScreen() {
  const { vehicle, c } = useLocalSearchParams<{ vehicle?: string; c?: string }>();

  useEffect(() => {
    const code = String(vehicle ?? '').trim().toUpperCase();
    const checksum = String(c ?? '').trim();
    if (!/^TR-\d{5}$/.test(code) || !checksum) {
      replace('/scan-ride');
      return;
    }
    replace(
      '/ride-confirm?vehicle_code=' +
        encodeURIComponent(code) +
        '&c=' +
        encodeURIComponent(checksum),
    );
  }, [vehicle, c]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator />
        <Copy>Opening verified TalaRide vehicle…</Copy>
      </View>
    </Screen>
  );
}
