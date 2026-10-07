import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Copy, Icon, IconButton, Title, go } from '@/components/ui';
import { PortalShell } from '@/components/PortalShell';
import { RideRow } from '@/components/RideRow';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';
import { useMock } from '@/mocks/MockProvider';
import { fetchRewards, type RewardsMe } from '@/api/rewards';

export default function HomeScreen() {
  const { displayName, session } = useAuth();
  const { rides, ridesLoading, ridesError } = useMock();
  const recent = rides.slice(0, 1);
  const [rewardsState, setRewardsState] = useState<{ ownerId: string; data: RewardsMe } | null>(null);

  useEffect(() => {
    let active = true;
    const ownerId = session?.user.id;
    if (!ownerId) return;
    void fetchRewards().then((value) => {
      if (active) setRewardsState({ ownerId, data: value });
    });
    return () => {
      active = false;
    };
  }, [session?.user.id, rides.length]);

  const rewards =
    rewardsState && rewardsState.ownerId === session?.user.id ? rewardsState.data : null;
  const progress = rewards?.current ?? 0;
  const rewardThreshold = rewards?.threshold ?? 10;
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
            {progress} / {rewardThreshold} points
          </Copy>
        </Pressable>
      </View>
    </PortalShell>
  );
}
