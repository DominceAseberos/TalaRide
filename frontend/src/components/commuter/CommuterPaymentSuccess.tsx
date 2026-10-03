import React, { useEffect } from 'react';
import { Check, Award, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  paymentResult: any;
  onDone: () => void;
  onViewHistory: () => void;
}

export const CommuterPaymentSuccess: React.FC<Props> = ({
  paymentResult,
  onDone,
  onViewHistory
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 40,
        spread: 55,
        origin: { y: 0.5 }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const ride = paymentResult?.ride;
  const payment = paymentResult?.payment;
  const pointsAwarded = paymentResult?.pointsAwarded ?? 1;

  const vehicleId = ride?.vehicle_id || payment?.vehicle_id || 'TR-01842';
  const amount = ride?.fare_amount || payment?.amount || 30;

  return (
    <div className="min-h-full flex flex-col justify-between p-6 bg-slate-50 text-slate-900 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Ride & Payment Verified
        </span>
        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
          {vehicleId}
        </span>
      </div>

      {/* Main Success State */}
      <div className="my-auto text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-xl shadow-emerald-600/30">
          <Check className="w-12 h-12 stroke-[3.5]" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">✓ RIDE PAID</h1>
          <div className="text-5xl font-black font-mono text-emerald-600 tracking-tight">₱{amount}</div>
        </div>

        {/* Section 9 Ride Record Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-left text-xs space-y-2 max-w-xs mx-auto">
          <div className="flex justify-between border-b border-slate-100 pb-1.5 font-medium">
            <span className="text-slate-500">Vehicle Unit:</span>
            <span className="font-mono font-bold text-slate-900">{vehicleId}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Date & Time:</span>
            <span className="text-slate-800 font-medium">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Payment:</span>
            <span className="font-semibold text-emerald-700 uppercase">
              Digital ({payment?.provider || 'QR Ph'})
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-[11px] pt-0.5 font-mono">
            <span>Status:</span>
            <span className="text-emerald-600 font-bold">Saved to Ride History</span>
          </div>
        </div>

        {/* Section 15 Rewards Award Notification */}
        {pointsAwarded > 0 && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800 shadow-xs">
            <Award className="w-4 h-4 text-amber-600" />
            <span>+1 TalaPoint Earned! (Ride #{pointsAwarded + 8} / 10)</span>
          </div>
        )}
      </div>

      {/* Done & History CTA */}
      <div className="space-y-2 pt-4">
        <button
          onClick={onDone}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-base rounded-2xl transition shadow-xl shadow-emerald-600/20"
        >
          Done
        </button>
        <button
          onClick={onViewHistory}
          className="w-full py-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition"
        >
          View in Ride History
        </button>
      </div>
    </div>
  );
};
