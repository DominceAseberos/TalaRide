import { Router } from 'express';
import { db } from '../db.js';

export const rewardsRouter = Router();

// Get rewards balance and milestone for user
rewardsRouter.get('/:userId', (req, res) => {
  const userId = req.params.userId;

  const userRewards = Array.from(db.rewards.values()).filter(r => r.user_id === userId);
  const totalEarnedPoints = userRewards
    .filter(r => r.status === 'earned')
    .reduce((sum, r) => sum + r.points, 0);

  const redeemedCount = userRewards.filter(r => r.status === 'redeemed').length;

  const currentPoints = Math.max(0, totalEarnedPoints - (redeemedCount * 10));
  const progressToNextReward = currentPoints % 10;
  const rewardsUnlocked = Math.floor(currentPoints / 10);

  return res.json({
    userId,
    currentPoints,
    targetMilestone: 10,
    progressTowardsMilestone: progressToNextReward,
    unlockedRewardsCount: rewardsUnlocked,
    activeVoucher: rewardsUnlocked > 0 ? {
      voucherCode: 'TALA-PROMO-10RIDE',
      description: '₱20 Fare Discount / Partner Merchant Offer',
      expiry: '30 days from unlock'
    } : null,
    history: userRewards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  });
});

// Redeem reward voucher
rewardsRouter.post('/redeem', (req, res) => {
  const { userId } = req.body;

  const userRewards = Array.from(db.rewards.values()).filter(r => r.user_id === userId);
  const earned = userRewards.filter(r => r.status === 'earned').reduce((s, r) => s + r.points, 0);
  const redeemed = userRewards.filter(r => r.status === 'redeemed').length;
  const availablePoints = earned - (redeemed * 10);

  if (availablePoints < 10) {
    return res.status(400).json({ error: 'You need at least 10 TalaPoints to redeem this reward' });
  }

  const redeemTx = {
    reward_id: `REW-RED-${Date.now().toString().slice(-4)}`,
    user_id: userId,
    ride_id: '',
    points: 10,
    status: 'redeemed' as const,
    reward_type: 'promotional_voucher' as const,
    created_at: new Date().toISOString()
  };

  db.rewards.set(redeemTx.reward_id, redeemTx);

  return res.json({
    success: true,
    message: 'Congratulations! You unlocked your ₱20 TalaRide promotional reward voucher.',
    voucher: {
      code: `TALAPROMO-${Math.floor(1000 + Math.random() * 9000)}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
    }
  });
});
