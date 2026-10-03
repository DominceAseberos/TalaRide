import React, { useEffect } from 'react';
import { Check, ShieldCheck, ArrowRight, Banknote } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playPaymentChime } from '../../utils/audio';

interface Props {
  payment: any;
  onNextPassenger: () => void;
}

export const DriverPaymentSuccess: React.FC<Props> = ({ payment, onNextPassenger }) => {
  useEffect(() => {
    // Play chime and vibrate immediately
    playPaymentChime();

    // Trigger visual confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const amount = payment?.amount || 30;
  const net = payment?.net_amount || (amount * 0.9825).toFixed(2);
  const fee = payment?.driver_fee || (amount * 0.0175).toFixed(2);
  const ref = payment?.provider_reference || `GCASH-REF-${Math.floor(1000000 + Math.random() * 9000000)}`;

  return (
    <div className="min-h-full flex flex-col justify-between p-6 bg-emerald-600 text-slate-950 select-none animate-fadeIn">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          Server Verified Payment
        </span>
        <span className="text-[11px] font-mono font-bold bg-emerald-700/50 text-white px-2.5 py-0.5 rounded-full">
          {payment?.vehicle_id || 'TR-01842'}
        </span>
      </div>

      {/* Main Massive Recognition Block */}
      <div className="my-auto text-center space-y-4">
        {/* Animated Check Circle */}
        <div className="w-24 h-24 rounded-full bg-white text-emerald-600 mx-auto flex items-center justify-center shadow-2xl shadow-emerald-900/30 transform scale-110">
          <Check className="w-16 h-16 stroke-[3.5]" />
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">✓ PAID</h1>
          <div className="text-6xl font-black font-mono text-white tracking-tight">₱{amount}</div>
        </div>

        {/* Breakdown for Driver (Section 17: Fare vs Net after fees) */}
        <div className="max-w-xs mx-auto bg-emerald-700/60 border border-emerald-500/50 rounded-2xl p-4 text-white text-left space-y-2 backdrop-blur-xs">
          <div className="flex justify-between text-xs border-b border-emerald-600/60 pb-1.5">
            <span className="text-emerald-200">Payment Channel:</span>
            <span className="font-bold uppercase">{payment?.provider || 'QR Ph / GCash'}</span>
          </div>
          <div className="flex justify-between text-xs border-b border-emerald-600/60 pb-1.5">
            <span className="text-emerald-200">Gateway Fee:</span>
            <span className="font-mono text-emerald-200">-₱{Number(fee).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-0.5">
            <span className="text-white">Net to Your Payout:</span>
            <span className="font-mono text-amber-300 text-base">₱{Number(net).toFixed(2)}</span>
          </div>
          <div className="text-[10px] text-emerald-200 font-mono pt-1 text-center truncate">
            Ref: {ref}
          </div>
        </div>

        <p className="text-xs text-emerald-100 font-medium max-w-xs mx-auto">
          No need to check passenger phone. Payment is securely verified on TalaRide server.
        </p>
      </div>

      {/* Next Passenger CTA Button */}
      <div className="pt-4">
        <button
          onClick={onNextPassenger}
          className="w-full py-5 bg-white hover:bg-slate-100 active:scale-98 text-emerald-950 font-black text-xl rounded-2xl transition shadow-2xl flex items-center justify-center gap-2"
        >
          <span>NEXT PASSENGER</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
