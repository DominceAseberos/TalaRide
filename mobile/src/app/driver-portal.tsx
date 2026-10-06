import { Linking, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, go, Header, Icon, Title } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';

const DRIVER_PORTAL_URL = 'https://talaride-web-frontend.vercel.app/driver';

export default function DriverPortalScreen() {
  const { session, displayName } = useAuth();
  const isDriver =
    session?.user.role === 'driver' ||
    session?.user.user_metadata?.role === 'driver' ||
    session?.user.app_metadata?.role === 'driver';

  return (
    <Screen>
      <Header title="Driver portal" />
      <View style={{ gap: 8, marginTop: 8 }}>
        <Title>Drive with TalaRide</Title>
        <Copy style={{ color: colors.muted }}>
          {isDriver
            ? `Welcome, ${displayName}. Your driver access is active.`
            : 'Create or connect a verified driver account before starting a shift or receiving fare notifications.'}
        </Copy>
      </View>

      <Card style={{ marginTop: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon
            name={isDriver ? 'checkmark-circle' : 'car-outline'}
            size={28}
            color={isDriver ? colors.green : colors.darkGreen}
          />
          <View style={{ flex: 1 }}>
            <Copy bold style={{ fontSize: 16 }}>
              {isDriver ? 'Verified driver access' : 'Driver access is not active'}
            </Copy>
            <Copy style={{ color: colors.muted, marginTop: 3 }}>
              {isDriver
                ? 'Open the driver dashboard to start a shift, show your vehicle QR, and see payment alerts.'
                : 'Driver accounts are verified and linked to a driver code and vehicle by TalaRide or your TODA operator.'}
            </Copy>
          </View>
        </View>
        {isDriver ? (
          <Button label="Open driver dashboard" icon="speedometer-outline" onPress={() => go('/driver')} />
        ) : (
          <>
            <Button
              label="Create or connect driver account"
              icon="open-outline"
              onPress={() => void Linking.openURL(DRIVER_PORTAL_URL)}
            />
            <Copy style={{ fontSize: 12, color: colors.muted }}>
              The web portal is where a driver is registered, verified, and assigned a driver code. After approval, sign in here with that account to unlock the dashboard.
            </Copy>
          </>
        )}
      </Card>

      <Card style={{ marginTop: 14, gap: 8, backgroundColor: colors.paleGreen }}>
        <Copy bold>What drivers can do in the app</Copy>
        <Copy style={{ color: colors.muted }}>• Start and end a shift for an assigned vehicle</Copy>
        <Copy style={{ color: colors.muted }}>• Show the permanent vehicle QR for commuters</Copy>
        <Copy style={{ color: colors.muted }}>• See payment and lost-item notifications</Copy>
        <Copy style={{ color: colors.muted }}>• Record cash fares while offline and sync later</Copy>
      </Card>

      {!isDriver && (
        <Button
          label="Back to commuter account"
          variant="subtle"
          onPress={() => go('/profile')}
          style={{ marginTop: 16 }}
        />
      )}
    </Screen>
  );
}
