import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './client';

export interface RewardsMe {
  points_balance: number;
  current: number;
  threshold: number;
  history: { ride_id: string; points: number; status: string }[];
}

const REWARDS_CACHE = 'talaride.rewards-cache-v1';

// Server truth; cache is display-only, never authoritative.
export async function fetchRewards(): Promise<RewardsMe> {
  try {
    const data = await apiRequest<{
      current_points: number;
      target_milestone: number;
      progress_towards_milestone: number;
      history: { ride_id?: string | null; points: number; status: string }[];
    }>('/rewards-me');
    const normalized: RewardsMe = {
      points_balance: data.current_points,
      current: data.progress_towards_milestone,
      threshold: data.target_milestone,
      history: data.history
        .filter((item): item is typeof item & { ride_id: string } => Boolean(item.ride_id))
        .map((item) => ({ ride_id: item.ride_id, points: item.points, status: item.status })),
    };
    await AsyncStorage.setItem(REWARDS_CACHE, JSON.stringify(normalized));
    return normalized;
  } catch {
    const raw = await AsyncStorage.getItem(REWARDS_CACHE);
    if (raw) return JSON.parse(raw) as RewardsMe;
    return { points_balance: 0, current: 0, threshold: 10, history: [] };
  }
}
