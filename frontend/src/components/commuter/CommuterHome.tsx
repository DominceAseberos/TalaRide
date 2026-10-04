import React from 'react';
import { QrCode, Shield, Award, Clock, ChevronRight } from 'lucide-react';
import { Ride } from '../../types';

interface Props {
  onScanRide: () => void;
  onOpenSafetyCheckIn: () => void;
  onViewHistory: () => void;
  onViewRewards: () => void;
  onSelectRide: (ride: Ride) => void;
  recentRide?: Ride | null;
  rewardsProgress?: { currentPoints: number; targetMilestone: number };
}

export const CommuterHome: React.FC<Props> = ({
  onScanRide,
  onOpenSafetyCheckIn,
  onViewHistory,
  onViewRewards,
  onSelectRide,
  recentRide,
  rewardsProgress = { currentPoints: 8, targetMilestone: 10 }
}) => {
  const points = rewardsProgress.currentPoints;
  const target = rewardsProgress.targetMilestone;
  const pct = Math.min(100, Math.round((points / target) * 100));

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                <span className="font-black text-sm">T</span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">TalaRide</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Tagum City Commuter Portal</p>
          </div>

          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tagum TODA Verified</span>
          </div>
        </div>

        {/* Section 22: Main SCAN RIDE Hero Button */}
        <button
          onClick={onScanRide}
          className="w-full py-7 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-3xl shadow-xl shadow-emerald-600/25 flex flex-col items-center justify-center gap-2 transition group"
        >
          <div className="p-3.5 bg-white/20 rounded-2xl group-hover:scale-105 transition">
            <QrCode className="w-10 h-10" />
          </div>
          <span className="text-2xl font-black tracking-wide uppercase">SCAN RIDE</span>
          <span className="text-xs text-emerald-100 font-medium">
            Scan driver's QR to pay or vehicle sticker to record
          </span>
        </button>

        {/* Section 11: Cash Safety Check-In Callout */}
        <div
          onClick={onOpenSafetyCheckIn}
          className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:border-emerald-500/40 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800">Paying Cash? Safety Check-In</h4>
              <p className="text-[11px] text-slate-500">Record ride and assigned driver without digital payment</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Section 22: Rewards Progress Bar (8 / 10 rides) */}
        <div
          onClick={onViewRewards}
          className="p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-emerald-300 transition shadow-xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                <Award className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-800">TalaRide Rewards</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">
              {points} / {target} rides
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{target - points} more digital rides to unlock promo reward!</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
              View <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Section 22: Recent Ride Card */}
        {recentRide && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Ride</span>
              <button
                onClick={onViewHistory}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                See All
              </button>
            </div>

            <div
              onClick={() => onSelectRide(recentRide)}
              className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-300 transition shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl font-mono font-bold text-xs">
                  TR
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{recentRide.vehicle_id}</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      recentRide.payment_method === 'digital' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {recentRide.payment_method}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(recentRide.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Driver: {recentRide.driver_name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-black text-slate-900 text-sm">
                  ₱{recentRide.fare_amount || 30}
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-0.5">
                  Details <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
