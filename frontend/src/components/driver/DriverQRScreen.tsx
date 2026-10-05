import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Loader2,
  ShieldCheck
} from 'lucide-react';
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
  const isMock = getWebPaymentMode() === 'mock';
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(isMock);
  const [timeLeft, setTimeLeft] = useState(300);
  const [simulating, setSimulating] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!isMock) return;

    let mounted = true;
    const generateQR = async () => {
      setLoading(true);
      setPaymentError('');
      try {
        const res = await api.createPaymentQR(driverId, vehicleId, fareAmount, isCustom);
        if (mounted && res.success) {
          setPayment(res.payment);
          const expiresAt = new Date(res.payment.expires_at).getTime();
          setTimeLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        }
      } catch (err: any) {
        console.error('Failed to create demo payment QR', err);
        if (mounted) setPaymentError('Could not create the demo payment QR.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void generateQR();
    return () => {
      mounted = false;
    };
  }, [driverId, vehicleId, fareAmount, isCustom, isMock]);

  useEffect(() => {
    if (!isMock || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [isMock, timeLeft]);

  useEffect(() => {
    const cleanup = connectSSE({
      driverId,
      onPaymentConfirmed: (data) => {
        if (!payment || data.paymentId === payment.payment_id || !isMock) {
          playPaymentChime();
          onPaymentSuccess(data);
        }
      }
    });
    return () => cleanup();
  }, [driverId, payment, isMock, onPaymentSuccess]);

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
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-emerald-400">{vehicleId}</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-bold">
            {isMock ? minutes + ':' + seconds : 'PERMANENT QR'}
          </span>
        </div>
      </div>

      <div className="my-auto py-5 flex flex-col items-center text-center space-y-4">
        {!isMock ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-black">Use the permanent vehicle sticker</div>
              <p className="mt-2 text-sm text-slate-400 max-w-sm">
                Passengers scan the fixed QR on the tricycle. TalaRide verifies the active driver,
                then the passenger chooses or enters the fare and selects a payment method on their
                own phone.
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-left">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Live payment flow
              </div>
              <p className="mt-2 text-xs text-slate-400">
                No expiring payment QR is generated here. This screen waits for provider-confirmed
                payments for the driver.
              </p>
            </div>
          </>
        ) : loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Generating demo payment QR...</p>
          </div>
        ) : paymentError ? (
          <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl space-y-3 max-w-xs">
            <div className="text-sm font-bold text-rose-200">{paymentError}</div>
          </div>
        ) : (
          <>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                {isCustom ? 'Demo custom fare' : 'Demo standard fare'}
              </span>
              <div className="text-4xl font-mono font-black text-emerald-400 tracking-tight">
                ₱{fareAmount}
              </div>
            </div>

            <div className="p-4 bg-white rounded-3xl shadow-2xl border-4 border-emerald-500/40">
              {payment && (
                <QRCodeSVG
                  value={payment.qr_payload}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              )}
              <div className="mt-2 text-[10px] font-semibold text-slate-600">
                DEMO ONLY — expiring payment QR
              </div>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5 w-full max-w-sm">
              <div className="text-[10px] uppercase font-bold text-slate-400 text-center tracking-wider">
                Simulator-only confirmation
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleSimulatePayment('gcash')}
                  disabled={simulating || !payment}
                  className="py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                >
                  GCash
                </button>
                <button
                  onClick={() => handleSimulatePayment('maya')}
                  disabled={simulating || !payment}
                  className="py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                >
                  Maya
                </button>
                <button
                  onClick={() => handleSimulatePayment('gotyme')}
                  disabled={simulating || !payment}
                  className="py-1.5 bg-cyan-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
                >
                  GoTyme
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2.5 pt-2">
        <button
          onClick={onSwitchToCash}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
        >
          <Banknote className="w-4 h-4" />
          <span>Record cash fare (₱{fareAmount})</span>
        </button>
        {!isMock && (
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-center">
            Paid status comes only from the payment provider/webhook. The driver cannot mark a
            digital payment paid from this screen.
          </div>
        )}
      </div>
    </div>
  );
};
