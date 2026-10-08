import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Brand, Button, Copy, Title, replace } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/constants/theme';

export default function RoleAccessScreen() {
  const { profile, profileError, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!profile || profileError) return;
    replace(profile.role === 'driver' ? '/driver-portal' : profile.role === 'admin' || profile.role === 'operator' ? '/staff-account' : '/home');
  }, [profile, profileError]);

  useEffect(() => {
    if (profile || profileError) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [profile, profileError, refreshing]);

  async function retry() {
    setRefreshing(true);
    setSlow(false);
    try { await refreshProfile(); } finally { setRefreshing(false); }
  }

  const failed = !!profileError;
  return <Screen>
    <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 26 }}><Brand large /></View>
    <Title style={{ textAlign: 'center', color: colors.darkGreen }}>
      {failed ? "Couldn't load your account" : slow ? 'Still loading your account' : 'Loading your account'}
    </Title>
    <Copy style={{ marginTop: 10, textAlign: 'center', color: colors.muted }}>
      {profileError || (slow ? 'Account verification is taking longer than expected. You can try again or sign out.' : 'Checking your account role and permissions…')}
    </Copy>
    {!failed && <ActivityIndicator style={{ marginTop: 18 }} color={colors.green} />}
    {(failed || slow) && <View style={{ gap: 12, marginTop: 26 }}>
      <Button label={refreshing ? 'Checking…' : 'Try again'} disabled={refreshing} onPress={() => void retry()} />
      <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
    </View>}
  </Screen>;
}
