import { Pressable, View } from 'react-native';
import { Copy, Icon, IconButton, Title, go } from '@/components/ui';
import { PortalShell } from '@/components/PortalShell';
import { RideRow } from '@/components/RideRow';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';
import { useMock } from '@/mocks/MockProvider';

const REWARD_THRESHOLD = 10;

export default function HomeScreen() {
  const { displayName } = useAuth();
  const { rides, ridesLoading, ridesError } = useMock();
  const recent = rides.slice(0, 1);
  const progress = Math.min(rides.length % (REWARD_THRESHOLD + 1), REWARD_THRESHOLD);
  return (
    <PortalShell
      activeTab="home"
      headerAction={
        <IconButton
          name="notifications-outline"
          label="Open notifications"
          onPress={() => go('/activity?tab=notifications')}
        />
      }
    >
      <Title style={{ fontSize: 25, lineHeight: 30, color: colors.darkGreen }}>
        Ready for your next ride?
      </Title>
      <Copy style={{ fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 20 }}>
        Hi {displayName.split(' ')[0]}. Scan the vehicle QR, verify your ride, then choose your fare
        and payment.
      </Copy>
      {/* Primary CTA — SCAN RIDE */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan ride"
        onPress={() => go('/scan-ride')}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.paleGreen,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 18,
            minHeight: 120,
            gap: 8,
          }}
        >
          <Icon name="scan-outline" size={38} color={colors.green} />
          <Copy bold style={{ color: colors.darkGreen, fontSize: 17 }}>
            Scan a ride
          </Copy>
          <Copy style={{ color: colors.muted, fontSize: 12 }}>
            Verify the driver and fare before paying
          </Copy>
        </View>
      </Pressable>
      <View style={{ marginTop: 16, gap: 12 }}>
        <Copy bold>Recent ride</Copy>
        {recent.map((ride) => (
          <RideRow key={ride.id} ride={ride} />
        ))}
        {!recent.length && (
          <Copy style={{ color: colors.muted }}>
            {ridesLoading
              ? 'Loading your rides…'
              : ridesError || 'No rides yet. Scan a vehicle to begin.'}
          </Copy>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => go('/rewards')}
          style={{ backgroundColor: colors.paleGreen, borderRadius: 12, padding: 15, gap: 6 }}
        >
          <Copy bold style={{ fontSize: 14 }}>
            Rewards
          </Copy>
          <Copy style={{ fontSize: 12, color: colors.muted }}>
            {progress} / {REWARD_THRESHOLD} rides
          </Copy>
        </Pressable>
      </View>
    </PortalShell>
  );
}
