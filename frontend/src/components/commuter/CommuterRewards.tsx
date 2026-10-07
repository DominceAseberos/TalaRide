import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Award, Gift, Sparkles, ShieldAlert, ArrowLeft, Ticket } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

interface Props {
  userId?: string;
  onBack?: () => void;
}

export const CommuterRewards: React.FC<Props> = ({ userId = 'USR-COM-001', onBack }) => {
  const [data, setData] = useState<any>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [unlockedVoucher, setUnlockedVoucher] = useState<any>(null);
  const claimOperation = useRef<string | null>(null);

  const loadRewards = useCallback(async () => {
    try {
      const res = await api.getRewards(userId);
      setData(res);
      if (res.activeVoucher) {
        setUnlockedVoucher(res.activeVoucher);
      }
    } catch (e) {
      console.warn('Rewards load fallback', e);
      setData({
        currentPoints: 0,
        targetMilestone: 10,
        progressTowardsMilestone: 0,
        unlockedRewardsCount: 0
      });
    }
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    api.getRewards(userId)
      .then((res) => {
        if (!ignore) {
          setData(res);
          if (res.activeVoucher) {
            setUnlockedVoucher(res.activeVoucher);
          }
        }
      })
      .catch((e) => {
        if (!ignore) {
          console.warn('Rewards load fallback', e);
          setData({
            currentPoints: 8,
            targetMilestone: 10,
            progressTowardsMilestone: 8,
            unlockedRewardsCount: 0
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [userId]);

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      claimOperation.current ||= `web-reward-${crypto.randomUUID()}`;
      const res = await api.redeemReward(claimOperation.current);
      if (res.success) {
        setUnlockedVoucher(res.voucher);
        claimOperation.current = null;
        confetti({ particleCount: 50, spread: 60 });
        await loadRewards();
      }
    } catch (err: any) {
      alert(err.message || 'Need 10 points to unlock voucher');
    } finally {
      setRedeeming(false);
    }
  };

  const points = data?.currentPoints ?? 0;
  const target = data?.targetMilestone ?? 10;
  const progress = data?.progressTowardsMilestone ?? 0;
  const pct = Math.min(100, Math.round((progress / target) * 100));

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-black text-slate-900">TalaRide Rewards</h1>
          </div>
          <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            {points} TalaPoints
          </span>
        </div>

        {/* Milestone Card */}
        <div className="bg-linear-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-xl shadow-emerald-600/20 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-200 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Commuter Milestone
            </span>
            <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
              {progress} of {target} Rides
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-black">10-Ride Reward Voucher</h3>
            <p className="text-xs text-emerald-100">
              Earn 1 TalaPoint for every completed digital ride. Reach 10 to unlock your reward voucher.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-linear-to-r from-amber-300 to-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-emerald-100 font-medium">
              <span>{target - progress} more rides needed</span>
              <span>{pct}% Completed</span>
            </div>
          </div>

          {points >= 10 && (
            <button
              onClick={handleRedeem}
              disabled={redeeming}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              <span>{redeeming ? 'Unlocking...' : 'CLAIM PROMOTIONAL VOUCHER'}</span>
            </button>
          )}
        </div>

        {/* Unlocked Voucher Card if available */}
        {unlockedVoucher && (
          <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
                <Ticket className="w-4 h-4 text-amber-600" />
                Active Promotional Voucher
              </span>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                READY TO USE
              </span>
            </div>
            <div className="font-mono text-xl font-black text-slate-900 tracking-wider">
              {unlockedVoucher.voucherCode || unlockedVoucher.code || 'TALA-PROMO-10RIDE'}
            </div>
            <p className="text-xs text-slate-600">
              Show to participating TODA terminal or partner merchant for ₱20 fare credit / discount.
            </p>
          </div>
        )}

        {/* Section 16: Anti-Fraud & Policy Notice */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>Fair Play & Rewards Verification Policy</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Points are credited only upon verified server confirmation from the QR Ph gateway. Repetitive ₱1 micro-transactions or duplicate driver-passenger looping are automatically flagged and excluded.
          </p>
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
            Disclaimer: Promotional reward values and availability are controlled by TalaRide and local TODA sponsors. Rewards have no independent cash value.
          </div>
        </div>
      </div>
    </div>
  );
};
