import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { Screen } from '@/components/Screen';
import { Brand, Button, Copy, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/constants/theme';
import { replace } from '@/components/ui';

export default function RoleAccessScreen() {
  const { profile, profileError, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!profile) return;
    replace(profile.role === 'driver' ? '/driver-portal' : profile.role === 'admin' || profile.role === 'operator' ? '/staff-account' : '/home');
  }, [profile]);
  async function retry() { setRefreshing(true); await refreshProfile(); setRefreshing(false); }
  return <Screen>
    <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 26 }}><Brand large /></View>
    <Title style={{ textAlign: 'center', color: colors.darkGreen }}>Account role unavailable</Title>
    <Copy style={{ marginTop: 10, textAlign: 'center', color: colors.muted }}>
      {profileError || 'TalaRide is checking your account role. Please stay on this screen until your profile is available.'}
    </Copy>
    {!profileError && <ActivityIndicator style={{ marginTop: 18 }} color={colors.green} />}
    {!!profileError && <View style={{ gap: 12, marginTop: 26 }}><Button label={refreshing ? 'Checking…' : 'Try again'} disabled={refreshing} onPress={() => void retry()} /><Button label="Sign out" variant="outline" onPress={() => void signOut()} /></View>}
  </Screen>;
}
