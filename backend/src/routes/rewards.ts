import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth } from '../lib/auth.js';

import { env } from '../env.js';

export const rewardsRouter = Router();
rewardsRouter.use(productionAuth);

const RewardClaimSchema = z.object({
  reward_type: z.enum(['drink_voucher', 'fuel_discount']),
  client_operation_id: z.string().min(8).max(160)
});

function rewardHistory(history: Awaited<ReturnType<typeof repository.getRewardsForUser>>['history']) {
  return history.map(({ reward_id, ride_id, points, status, reward_type, environment, voucher_code, voucher_description, voucher_value_centavos, voucher_valid_until, created_at }) => ({
    reward_id,
    ride_id,
    points,
    status,
    reward_type,
    environment: environment ?? 'live',
    voucher_code,
    voucher_description,
    voucher_value_centavos,
    voucher_valid_until,
    created_at
  }));
}

function activeVoucher(history: Awaited<ReturnType<typeof repository.getRewardsForUser>>['history']) {
  const claim = history.find((entry) => entry.status === 'redeemed' && entry.voucher_code &&
    entry.voucher_valid_until && Date.parse(entry.voucher_valid_until) > Date.now());
  return claim ? {
    voucherCode: claim.voucher_code,
    description: claim.voucher_description,
    expiry: claim.voucher_valid_until
  } : null;
}

// GET /api/rewards-me
rewardsRouter.get('/rewards-me', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || (req.query.user_id as string) || (req.query.userId as string) || '';
    if (!userId) return res.status(401).json({ error: 'Sign in to see rewards.' });
    if (req.user && req.user.id !== userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Rewards belong to another account.' });
    const data = await repository.getRewardsForUser(userId, env.PAYMENT_ENVIRONMENT);

    return res.json({
      user_id: userId,
      current_points: data.currentPoints,
      target_milestone: 10,
      progress_towards_milestone: data.progressTowardsMilestone,
      unlocked_rewards_count: data.unlockedRewardsCount,
      completed_rides: data.completedRides,
      payment_environment: env.PAYMENT_ENVIRONMENT,
      test_mode: env.PAYMENT_ENVIRONMENT === 'test',
      active_voucher: activeVoucher(data.history),
      history: rewardHistory(data.history)
    });
  } catch (err: any) {
    console.error('Error fetching rewards:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/rewards/:userId (compatibility)
rewardsRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId);
    if (!userId) return res.status(401).json({ error: 'Sign in to see rewards.' });
    if (req.user && req.user.id !== userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Rewards belong to another account.' });
    const data = await repository.getRewardsForUser(userId, env.PAYMENT_ENVIRONMENT);

    return res.json({
      userId,
      currentPoints: data.currentPoints,
      targetMilestone: 10,
      progressTowardsMilestone: data.progressTowardsMilestone,
      unlockedRewardsCount: data.unlockedRewardsCount,
      completedRides: data.completedRides,
      paymentEnvironment: env.PAYMENT_ENVIRONMENT,
      testMode: env.PAYMENT_ENVIRONMENT === 'test',
      activeVoucher: activeVoucher(data.history),
      history: rewardHistory(data.history)
    });
  } catch (err: any) {
    console.error('Error fetching rewards for user:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/rewards/redeem
rewardsRouter.post('/redeem', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sign in to claim a reward.' });
    const parsed = RewardClaimSchema.safeParse({
      reward_type: req.body.reward_type,
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId || req.get('idempotency-key')
    });
    if (!parsed.success) return res.status(400).json({ error: 'Choose a valid reward and retry key.' });
    const rewardType = parsed.data.reward_type;
    if (rewardType === 'drink_voucher' && req.user.role !== 'passenger') {
      return res.status(403).json({ error: 'Drink vouchers are for passenger accounts.' });
    }
    if (rewardType === 'fuel_discount' && req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Fuel discounts are for verified driver accounts.' });
    }
    if (rewardType === 'fuel_discount') {
      const driver = await repository.getDriverByUserId(req.user.id);
      if (!driver || driver.verification_status !== 'verified') {
        return res.status(403).json({ error: 'Fuel rewards require a verified driver account.' });
      }
    }

    const redemption = await repository.redeemReward(req.user.id, rewardType, env.PAYMENT_ENVIRONMENT, parsed.data.client_operation_id);

    return res.json({
      success: true,
      message: env.PAYMENT_ENVIRONMENT === 'test'
        ? 'Test voucher claimed. It is for app preview only and cannot be redeemed for real goods or fuel.'
        : 'Reward claimed. Present the code at a participating partner before it expires.',
      voucher: {
        code: redemption.voucher_code,
        reward_type: redemption.reward_type,
        description: redemption.voucher_description,
        value_centavos: redemption.voucher_value_centavos,
        valid_until: redemption.voucher_valid_until,
        test_only: redemption.environment === 'test'
      },
      rewards: await repository.getRewardsForUser(req.user.id, env.PAYMENT_ENVIRONMENT)
    });
  } catch (err: any) {
    if (err.message.includes('Insufficient points')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error redeeming reward:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
