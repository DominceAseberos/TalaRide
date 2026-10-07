import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { AppState, View } from 'react-native';
import { Button, Card, Copy, Detail, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { claimReward, fetchRewards, type RewardClaimType, type RewardVoucher, type RewardsMe } from '@/api/rewards';
import { colors } from '@/constants/theme';

export function RewardsPanel({ audience }: { audience: 'passenger' | 'driver' }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [rewards, setRewards] = useState<RewardsMe | null>(null);
  const [latestClaim, setLatestClaim] = useState<{ userId: string; voucher: RewardVoucher } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const claimOperation = useRef<string | null>(null);
  const [error, setError] = useState('');
  const rewardType: RewardClaimType = audience === 'passenger' ? 'drink_voucher' : 'fuel_discount';
  const title = audience === 'passenger' ? 'Ride rewards' : 'Driver rewards';
  const offer = audience === 'passenger'
    ? 'Claim one drink voucher worth up to ₱50 after 10 confirmed paid digital rides.'
    : 'Claim 10% off Petron gasoline after 10 confirmed paid digital rides, up to ₱50. Gasoline only; diesel excluded.';
  const claimLabel = audience === 'passenger' ? 'Claim drink voucher' : 'Claim fuel discount';

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = async () => {
      try {
        const value = await fetchRewards();
        if (active) {
          setRewards(value);
          setError('');
        }
      } catch {
        if (active) setError('Rewards could not be refreshed.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      foreground.remove();
    };
  }, [userId]);

  const available = rewards?.unlocked_rewards_count ?? 0;
  const progress = rewards?.current ?? 0;
  const threshold = rewards?.threshold ?? 10;
  const progressDisplay = available > 0 ? threshold : progress;
  const claimed = rewards?.history.find(
    (item) => item.status === 'redeemed' && item.reward_type === rewardType && item.voucher_code,
  );
  const displayedClaim = latestClaim && latestClaim.userId === userId ? latestClaim.voucher : null;

  async function claim() {
    if (!userId || claiming || available < 1) return;
    setClaiming(true);
    setError('');
    try {
      claimOperation.current ||= `reward-${randomUUID()}`;
      const voucher = await claimReward(rewardType, claimOperation.current);
      claimOperation.current = null;
      setLatestClaim({ userId, voucher });
      setRewards(await fetchRewards());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not claim this reward.');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Title>{title}</Title>
        <Copy style={{ marginTop: 6 }}>{offer}</Copy>
        <Detail icon="bicycle-outline" label="Confirmed rides" value={String(rewards?.completed_rides ?? 0)} />
        <Detail
          icon="gift-outline"
          label="Progress"
          value={`${progressDisplay} / ${threshold}${available > 1 ? ` · ${available} rewards ready` : available === 1 ? ' · reward ready' : ''}`}
        />
        <Button
          label={claiming ? 'Claiming…' : available ? claimLabel : `${Math.max(0, threshold - progress)} rides to unlock`}
          icon={audience === 'passenger' ? 'cafe-outline' : 'car-outline'}
          disabled={claiming || available < 1}
          onPress={() => void claim()}
        />
        <Copy style={{ marginTop: 10, fontSize: 12, color: colors.muted }}>
          {rewards?.test_mode
            ? 'Test voucher only · no real drink or fuel discount is issued.'
            : 'Voucher codes are for participating partners and expire 30 days after claim.'}
        </Copy>
      </Card>
      {(displayedClaim?.code || claimed?.voucher_code) && (
        <Card>
          <Detail icon="ticket-outline" label="Latest claimed voucher" value={displayedClaim?.code ?? claimed?.voucher_code ?? ''} />
          {!!(displayedClaim?.description ?? claimed?.voucher_description) && (
            <Copy>{displayedClaim?.description ?? claimed?.voucher_description}</Copy>
          )}
          {!!(displayedClaim?.valid_until ?? claimed?.voucher_valid_until) && (
            <Copy style={{ marginTop: 6, color: colors.muted }}>
              Valid until {new Date(displayedClaim?.valid_until ?? claimed?.voucher_valid_until ?? '').toLocaleDateString()}
            </Copy>
          )}
        </Card>
      )}
      {!!error && <Copy accessibilityRole="alert" style={{ color: colors.red }}>{error}</Copy>}
    </View>
  );
}
