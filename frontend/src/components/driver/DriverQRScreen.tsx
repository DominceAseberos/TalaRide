import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, ArrowLeft, Banknote, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Payment } from '../../types';
import { api, connectSSE, getWebPaymentMode } from '../../services/api';
import { playPaymentChime } from '../../utils/audio';

interface Props {
  driverId: string;
  vehicleId: string;
  fareAmount: number;
  isCustom?: boolean;
  onPaymentSuccess: (payment: any) => void;
  onCancel: () => void;
  onSwitchToCash: () => void;
}

export const DriverQRScreen: React.FC<Props> = ({
  driverId,
  vehicleId,
  fareAmount,
  isCustom,
  onPaymentSuccess,
  onCancel,
  onSwitchToCash
}) => {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300);
  const [simulating, setSimulating] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const isMock = getWebPaymentMode() === 'mock';

  // 1. Generate QR on mount
  useEffect(() => {
    let mounted = true;
    const generateQR = async () => {
      setLoading(true);
      try {
        const res = await api.createPaymentQR(driverId, vehicleId, fareAmount, isCustom);
        if (mounted && res.success) {
          setPayment(res.payment);
          const expiresAt = new Date(res.payment.expires_at).getTime();
          setTimeLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        }
      } catch (err: any) {
        console.error('Failed to create payment QR', err);
        setPaymentError('Could not connect to payment gateway. Please switch to cash.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    generateQR();

    return () => {
      mounted = false;
    };
  }, [driverId, vehicleId, fareAmount, isCustom]);

  // 2. Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // 3. Listen for SSE / Broadcast payment confirmation
  useEffect(() => {
    const cleanup = connectSSE({
      driverId,
      onPaymentConfirmed: (data) => {
        if (!payment || data.paymentId === payment.payment_id) {
          playPaymentChime();
          onPaymentSuccess(data);
        }
      }
    });

    return () => cleanup();
  }, [driverId, payment, onPaymentSuccess]);

  // 4. Quick Simulator trigger
  const handleSimulatePayment = async (provider: 'gcash' | 'maya' | 'gotyme') => {
    if (!payment || !isMock) return;
    setSimulating(true);
    try {
      const res = await api.confirmPayment({
        paymentId: payment.payment_id,
        provider,
        passengerId: 'USR-COM-001',
        passengerName: 'Maria Santos',
        approximateLocation: 'Tagum City Commercial Center'
      });
      if (res.success) {
        playPaymentChime();
        onPaymentSuccess(res.payment);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-950 text-white select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-emerald-400">{vehicleId}</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
            {minutes}:{seconds}
          </span>
        </div>
      </div>

      {/* Main QR Card */}
      <div className="my-auto py-2 flex flex-col items-center text-center space-y-3">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Generating QR Ph payment code...</p>
          </div>
        ) : paymentError ? (
          <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl space-y-3 max-w-xs">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-bold text-rose-200">{paymentError}</div>
            <button
              onClick={onSwitchToCash}
              className="w-full py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              PAY CASH INSTEAD
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                {isCustom ? 'Special / Custom Fare' : 'Standard Fare'}
              </span>
              <div className="text-4xl font-mono font-black text-emerald-400 tracking-tight">
                ₱{fareAmount}
              </div>
            </div>

            {/* QR Ph Container (Sunlight-readable high contrast white block) */}
            <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 flex flex-col items-center border-4 border-emerald-500/40">
              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                <span className="text-[10px] font-black tracking-widest text-slate-900 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  TALARIDE PAYMENT QR
                </span>
                <span className="text-[10px] text-slate-500 font-mono">TAGUM CITY</span>
              </div>

              {payment && (
                <QRCodeSVG
                  value={payment.qr_payload}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              )}

              <div className="mt-2 text-[10px] font-semibold text-slate-600">
                Scan with TalaRide to continue to secure PayMongo checkout
              </div>
            </div>

            {/* Waiting Pulse Status */}
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-semibold tracking-wide uppercase text-[11px]">
                Waiting for payment confirmation...
              </span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-xs">
              This QR identifies the TalaRide payment request. PayMongo handles the actual wallet,
              card, or QR Ph payment and the server confirms settlement.
            </p>
          </>
        )}
      </div>

      {/* Action & Fallback Section */}
      <div className="space-y-2.5 pt-2">
        {/* Fallback to cash (Section 19 & 20) */}
        <button
          onClick={onSwitchToCash}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
        >
          <Banknote className="w-4 h-4" />
          <span>Passenger Wants to Pay Cash (₱{fareAmount})</span>
        </button>

        {isMock ? (
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 text-center tracking-wider">
              Simulator-only instant confirmation:
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleSimulatePayment('gcash')}
                disabled={simulating || !payment}
                className="py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition disabled:opacity-50"
              >
                GCash Pay
              </button>
              <button
                onClick={() => handleSimulatePayment('maya')}
                disabled={simulating || !payment}
                className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition disabled:opacity-50"
              >
                Maya Pay
              </button>
              <button
                onClick={() => handleSimulatePayment('gotyme')}
                disabled={simulating || !payment}
                className="py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold rounded-lg transition disabled:opacity-50"
              >
                GoTyme Pay
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-center">
            Live staging waits for PayMongo provider confirmation. No browser button can mark this ride paid.
          </div>
        )}
      </div>
    </div>
  );
};
