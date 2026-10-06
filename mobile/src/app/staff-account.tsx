import { Linking, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Brand, Button, Copy, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useMock } from '@/mocks/MockProvider';
import { colors } from '@/constants/theme';

const WEB_PORTAL = 'https://talaride-web-frontend.vercel.app/';
export default function StaffAccountScreen() {
  const { profile, signOut } = useAuth();
  const { ready } = useMock();
  return <Screen>
    <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 26 }}><Brand large /></View>
    <Title style={{ textAlign: 'center', color: colors.darkGreen }}>TalaRide web portal</Title>
    <Copy style={{ marginTop: 10, textAlign: 'center', color: colors.muted }}>
      This {profile?.role === 'admin' ? 'admin' : 'TODA operator'} account uses the web portal. Driver and passenger features are not available for this role.
    </Copy>
    <View style={{ gap: 12, marginTop: 28 }}>
      <Button label="Open TODA portal" onPress={() => void Linking.openURL(WEB_PORTAL)} />
      <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
    </View>
    {!ready && <Copy style={{ marginTop: 12, textAlign: 'center' }}>Restoring your app session…</Copy>}
  </Screen>;
}
