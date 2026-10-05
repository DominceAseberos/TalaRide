import { Pressable, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Brand, Copy, Icon, IconButton, Title, go, s } from '@/components/ui';
import { BottomNav } from '@/components/BottomNav';
import { RideRow } from '@/components/RideRow';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';
import { useMock } from '@/mocks/MockProvider';
import { LinearGradient } from 'expo-linear-gradient';

const REWARD_THRESHOLD = 10;

export default function HomeScreen() {
  const { displayName } = useAuth();
  const { rides, ridesLoading, ridesError } = useMock();
  const recent = rides.slice(0, 1);
  const progress = Math.min(rides.length % (REWARD_THRESHOLD + 1), REWARD_THRESHOLD);
  return (
    <Screen footer={<BottomNav active="Home" />}>
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 22 }]}>
        <Brand />
        <IconButton
          name="notifications-outline"
          label="Open notifications"
          onPress={() => go('/activity?tab=notifications')}
        />
      </View>
      <Title style={{ fontSize: 25, lineHeight: 30, color: colors.darkGreen }}>Ready for your next ride?</Title>
      <Copy style={{ fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 20 }}>
        Hi {displayName.split(' ')[0]}. Scan the vehicle QR, verify your ride, then choose your fare and payment.
      </Copy>
      {/* Primary CTA — SCAN RIDE */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan ride"
        onPress={() => go('/scan-ride')}
      >
        <LinearGradient
          colors={[colors.green, colors.darkGreen]}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            minHeight: 112,
            gap: 9,
          }}
        >
          <Icon name="scan-outline" size={44} color={colors.white} />
          <Copy bold style={{ color: colors.white, fontSize: 18 }}>
            SCAN RIDE
          </Copy>
        </LinearGradient>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => go('/driver')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 12,
          paddingVertical: 10,
        }}
      >
        <Icon name="car-outline" size={18} color={colors.darkGreen} />
        <Copy style={{ color: colors.darkGreen, fontSize: 13 }}>
          Driver mode — shift + cash
        </Copy>
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
    </Screen>
  );
}
