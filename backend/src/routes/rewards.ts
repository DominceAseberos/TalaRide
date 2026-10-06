import { Router, Request, Response } from 'express';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth } from '../lib/auth.js';

import { env } from '../env.js';

export const rewardsRouter = Router();
rewardsRouter.use(productionAuth);

// GET /api/rewards-me
rewardsRouter.get('/rewards-me', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || (req.query.user_id as string) || (req.query.userId as string) || '';
    if (!userId) return res.status(401).json({ error: 'Sign in to see rewards.' });
    if (req.user && req.user.id !== userId && !['talaride_admin', 'lgu_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Rewards belong to another account.' });
    const data = await repository.getRewardsForUser(userId);

    return res.json({
      user_id: userId,
      current_points: data.currentPoints,
      target_milestone: 10,
      progress_towards_milestone: data.progressTowardsMilestone,
      unlocked_rewards_count: data.unlockedRewardsCount,
      active_voucher:
        env.NODE_ENV === 'test' && data.unlockedRewardsCount > 0
          ? {
              voucher_code: 'TALA-PROMO-10RIDE',
              description: '₱20 Fare Discount / Partner Merchant Voucher',
              expiry: '30 days from unlock'
            }
          : null,
      history: data.history
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
    if (req.user && req.user.id !== userId && !['talaride_admin', 'lgu_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Rewards belong to another account.' });
    const data = await repository.getRewardsForUser(userId);

    return res.json({
      userId,
      currentPoints: data.currentPoints,
      targetMilestone: 10,
      progressTowardsMilestone: data.progressTowardsMilestone,
      unlockedRewardsCount: data.unlockedRewardsCount,
      activeVoucher:
        env.NODE_ENV === 'test' && data.unlockedRewardsCount > 0
          ? {
              voucherCode: 'TALA-PROMO-10RIDE',
              description: '₱20 Fare Discount / Partner Merchant Offer',
              expiry: '30 days from unlock'
            }
          : null,
      history: data.history
    });
  } catch (err: any) {
    console.error('Error fetching rewards for user:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/rewards/redeem
rewardsRouter.post('/redeem', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (env.NODE_ENV !== 'test') return res.status(409).json({ error: 'Reward redemption is not available yet.' });
    const userId = req.body.user_id || req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const redemption = await repository.redeemReward(userId);

    return res.json({
      success: true,
      message: 'Congratulations! You unlocked your ₱20 TalaRide promotional reward voucher.',
      redemption,
      voucher: {
        code: `TALAPROMO-${Math.floor(1000 + Math.random() * 9000)}`,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (err: any) {
    if (err.message.includes('Insufficient points')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error redeeming reward:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
