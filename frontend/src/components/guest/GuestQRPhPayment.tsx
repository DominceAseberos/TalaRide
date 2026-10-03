import React, { useState } from 'react';
import { ShieldCheck, Check, Smartphone, ArrowRight, Download, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

interface Props {
  fareAmount?: number;
  vehicleId?: string;
  driverName?: string;
  paymentId?: string;
  onPaymentSuccess?: () => void;
  onOpenCommuterApp?: () => void;
}

export const GuestQRPhPayment: React.FC<Props> = ({
  fareAmount = 30,
  vehicleId = 'TR-01842',
  driverName = 'Juan Dela Cruz',
  paymentId = 'PAY-2026-1003-01',
  onPaymentSuccess,
  onOpenCommuterApp
}) => {
  const [provider, setProvider] = useState<'gcash' | 'maya' | 'gotyme'>('gcash');
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [refNumber, setRefNumber] = useState('');

  const handlePayAsGuest = async () => {
    setLoading(true);
    try {
      const res = await api.confirmPayment({
        paymentId,
        provider,
        passengerId: undefined, // Guest commuter - no account required!
        passengerName: 'Guest Commuter',
        approximateLocation: 'Tagum City'
      });
      if (res.success) {
        setPaid(true);
        setRefNumber(res.payment?.provider_reference || `GCASH-REF-${Math.floor(1000000 + Math.random() * 9000000)}`);
        confetti({ particleCount: 30, spread: 60 });
        onPaymentSuccess?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getProviderTheme = () => {
    switch (provider) {
      case 'gcash':
        return {
          bg: 'bg-blue-600',
          lightBg: 'bg-blue-50',
          text: 'text-blue-600',
          border: 'border-blue-500',
          brand: 'GCash'
        };
      case 'maya':
        return {
          bg: 'bg-emerald-600',
          lightBg: 'bg-emerald-50',
          text: 'text-emerald-600',
          border: 'border-emerald-500',
          brand: 'Maya'
        };
      case 'gotyme':
        return {
          bg: 'bg-cyan-700',
          lightBg: 'bg-cyan-50',
          text: 'text-cyan-700',
          border: 'border-cyan-600',
          brand: 'GoTyme Bank'
        };
    }
  };

  const theme = getProviderTheme();

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-900 text-white select-none">
      <div className="max-w-md mx-auto w-full space-y-4">
        {/* Top Simulation notice */}
        <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Simulating Commuter's E-Wallet</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
            No TalaRide App Required
          </span>
        </div>

        {paid ? (
          /* Payment Success inside Guest e-wallet */
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className={`w-16 h-16 ${theme.bg} text-white rounded-full mx-auto flex items-center justify-center shadow-lg`}>
              <Check className="w-10 h-10 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Payment Sent to Driver</h2>
              <div className="text-4xl font-black font-mono text-emerald-400">₱{fareAmount}.00</div>
              <p className="text-xs text-slate-400 font-mono">Ref: {refNumber}</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl text-left text-xs space-y-1 border border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Merchant / Driver:</span>
                <span className="font-bold text-white">TalaRide / {driverName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Unit:</span>
                <span className="font-mono text-white">{vehicleId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Channel:</span>
                <span className="font-semibold text-emerald-400">QR Ph Interoperable</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/70 border border-emerald-800/80 rounded-2xl text-left text-xs space-y-2">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                Want ride records & TalaRide rewards?
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Download the free TalaRide app next time to record your trips for safety, report lost items, and earn 1 TalaPoint towards ride discounts!
              </p>
              {onOpenCommuterApp && (
                <button
                  onClick={onOpenCommuterApp}
                  className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition"
                >
                  Try TalaRide Commuter App
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Step 4 & 5 Guest E-Wallet Payment Screen */
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            {/* Wallet header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className={`text-base font-black ${theme.text}`}>{theme.brand}</span>
              <span className="text-[10px] font-mono text-slate-400">QR Ph Rail</span>
            </div>

            {/* Merchant Details */}
            <div className="text-center space-y-1 py-1">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Merchant / Tricycle Unit
              </span>
              <h3 className="text-xl font-bold text-white">TalaRide • {vehicleId}</h3>
              <p className="text-xs text-slate-400">Assigned Driver: {driverName}</p>
              <div className="text-4xl font-black font-mono text-emerald-400 pt-2">₱{fareAmount}.00</div>
            </div>

            {/* Wallet Selection Switcher */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Simulate Scanning App:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['gcash', 'maya', 'gotyme'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`py-2 px-1 rounded-xl font-bold border transition capitalize ${
                      provider === p
                        ? 'bg-slate-800 border-emerald-500 text-white shadow-xs'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Only official server confirmation marks payment as successful on driver's screen.</span>
            </div>

            <button
              onClick={handlePayAsGuest}
              disabled={loading}
              className={`w-full py-4 ${theme.bg} hover:opacity-90 active:scale-98 text-white font-black text-base rounded-2xl transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-50`}
            >
              <span>{loading ? 'Authorizing QR Ph...' : `PAY ₱${fareAmount}.00 WITH ${theme.brand.toUpperCase()}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
