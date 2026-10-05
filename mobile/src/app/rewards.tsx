import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { BottomNav } from '@/components/BottomNav';
import { Button, Card, Copy, Detail, Title, go } from '@/components/ui';
import { RewardsDisclaimer } from '@/components/Disclaimers';
import { fetchRewards, type RewardsMe } from '@/api/rewards';

export default function RewardsScreen() {
  const [rewards, setRewards] = useState<RewardsMe | null>(null);

  useEffect(() => {
    void fetchRewards()
      .then(setRewards)
      .catch(() => {});
  }, []);

  const current = rewards?.current ?? 0;
  const threshold = rewards?.threshold ?? 10;
  return (
    <Screen footer={<BottomNav active="Rewards" />}>
      <Title>TalaRide Rewards</Title>
      <Copy style={{ marginTop: 6 }}>
        1 TalaPoint per completed digital ride. Server-minted only, never calculated on-device.
      </Copy>
      <Card>
        <Detail icon="gift-outline" label="Progress" value={`${current} / ${threshold} rides`} />
        <Detail
          icon="checkmark-circle-outline"
          label="Next reward"
          value={
            current >= threshold ? 'Unlocked — see promos' : `${threshold - current} rides to go`
          }
        />
        <Detail
          icon="wallet-outline"
          label="Points balance"
          value={String(rewards?.points_balance ?? 0)}
        />
      </Card>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Button label="Scan ride to earn" onPress={() => go('/scan-ride')} />
        <Button
          label="Refresh"
          variant="outline"
          onPress={() =>
            fetchRewards()
              .then(setRewards)
              .catch(() => {})
          }
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <RewardsDisclaimer />
      </View>
    </Screen>
  );
}
