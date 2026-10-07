import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/auth/client';
import { apiRequest } from './client';

export type RewardClaimType = 'drink_voucher' | 'fuel_discount';

export interface RewardVoucher {
  code: string;
  reward_type: RewardClaimType;
  description: string;
  value_centavos: number;
  valid_until: string;
  test_only: boolean;
}

export interface RewardsMe {
  points_balance: number;
  current: number;
  threshold: number;
  completed_rides: number;
  unlocked_rewards_count: number;
  test_mode: boolean;
  history: {
    ride_id?: string | null;
    points: number;
    status: string;
    reward_type: string;
    environment: 'test' | 'live';
    voucher_code?: string | null;
    voucher_description?: string | null;
    voucher_valid_until?: string | null;
  }[];
}

const REWARDS_CACHE_PREFIX = 'talaride.rewards-cache-v2:';

// Server truth; cache is display-only, never authoritative.
export async function fetchRewards(): Promise<RewardsMe> {
  let cacheKey: string | null = null;
  try {
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    if (!session?.user.id) return emptyRewards();
    cacheKey = `${REWARDS_CACHE_PREFIX}${session.user.id}`;
    const data = await apiRequest<{
      current_points: number;
      target_milestone: number;
      progress_towards_milestone: number;
      completed_rides: number;
      unlocked_rewards_count: number;
      test_mode: boolean;
      history: RewardsMe['history'];
    }>('/rewards-me');
    const normalized: RewardsMe = {
      points_balance: data.current_points,
      current: data.progress_towards_milestone,
      threshold: data.target_milestone,
      completed_rides: data.completed_rides,
      unlocked_rewards_count: data.unlocked_rewards_count,
      test_mode: data.test_mode,
      history: data.history,
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(normalized));
    return normalized;
  } catch {
    const raw = cacheKey ? await AsyncStorage.getItem(cacheKey) : null;
    if (raw) return JSON.parse(raw) as RewardsMe;
    return emptyRewards();
  }
}

export async function claimReward(rewardType: RewardClaimType, clientOperationId: string): Promise<RewardVoucher> {
  const result = await apiRequest<{ success: boolean; voucher: RewardVoucher }>('/rewards/redeem', {
    method: 'POST',
    body: JSON.stringify({ reward_type: rewardType, client_operation_id: clientOperationId }),
  });
  return result.voucher;
}

function emptyRewards(): RewardsMe {
  return {
    points_balance: 0,
    current: 0,
    threshold: 10,
    completed_rides: 0,
    unlocked_rewards_count: 0,
    test_mode: false,
    history: [],
  };
}
