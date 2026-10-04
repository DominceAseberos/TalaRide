import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Check, Smartphone, ArrowRight, Download, Loader2, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api, getWebPaymentMode } from '../../services/api';

interface Props {
  fareAmount?: number;
  vehicleId?: string;
  driverId?: string;
  driverName?: string;
  paymentId?: string;
  onPaymentSuccess?: () => void;
  onOpenCommuterApp?: () => void;
}

export const GuestQRPhPayment: React.FC<Props> = ({
  fareAmount = 30,
  vehicleId = 'TR-01842',
  driverId = 'DR-000481',
  driverName = 'Juan Dela Cruz',
  paymentId,
  onPaymentSuccess,
  onOpenCommuterApp
}) => {
  const isMock = getWebPaymentMode() === 'mock';
  const [provider, setProvider] = useState<'gcash' | 'maya' | 'gotyme'>('gcash');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [refNumber, setRefNumber] = useState('');
  const [activePaymentId, setActivePaymentId] = useState(paymentId || '');
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [error, setError] = useState('');

  const completeIfConfirmed = useCallback(async (id: string, silent = false) => {
    if (!silent) setChecking(true);
    try {
      const result = await api.getConfirmedPaymentResult(id);
      if (result.success) {
        setPaid(true);
        setRefNumber(result.payment.provider_reference || result.payment.payment_id);
        confetti({ particleCount: 30, spread: 60 });
        onPaymentSuccess?.();
        return true;
      }
      if (result.status === 'expired') setError('This payment request expired. Start a new checkout.');
      else if (result.status === 'failed') setError('Payment failed. Please try again.');
      else if (!silent) setError('Still waiting for PayMongo confirmation.');
      return false;
    } catch (err: any) {
      if (!silent) setError(err.message || 'Could not check payment status.');
      return false;
    } finally {
      if (!silent) setChecking(false);
    }
  }, [onPaymentSuccess]);

  useEffect(() => {
    if (isMock || !checkoutOpened || !activePaymentId || paid) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const done = await completeIfConfirmed(activePaymentId, true);
      if (done) cancelled = true;
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePaymentId, checkoutOpened, completeIfConfirmed, isMock, paid]);

  const handlePayAsGuest = async () => {
    setLoading(true);
    setError('');

    if (isMock) {
      try {
        const res = await api.confirmPayment({
          paymentId: activePaymentId || 'PAY-2026-1003-01',
          provider,
          passengerId: undefined,
          passengerName: 'Guest Commuter',
          approximateLocation: 'Tagum City'
        });
        if (res.success) {
          setPaid(true);
          setRefNumber(res.payment?.provider_reference || res.payment?.payment_id || 'DEMO');
          confetti({ particleCount: 30, spread: 60 });
          onPaymentSuccess?.();
        }
      } catch (err: any) {
        setError(err.message || 'Payment simulation failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const checkoutWindow = window.open('about:blank', 'talaride-paymongo-checkout');
    try {
      let id = activePaymentId;
      let checkoutUrl: string | null = null;

      if (id) {
        try {
          const status = await api.getPaymentStatus(id);
          if (status.payment.payment_status === 'paid') {
            checkoutWindow?.close();
            await completeIfConfirmed(id);
            return;
          }
          checkoutUrl = status.checkoutUrl || status.payment.checkout_url || null;
        } catch {
          id = '';
        }
      }

      if (!id || !checkoutUrl) {
        const intent = await api.createPaymentQR(driverId, vehicleId, fareAmount, false);
        id = intent.payment.payment_id;
        checkoutUrl = intent.checkoutUrl || intent.payment.checkout_url || null;
      }

      if (!checkoutUrl) throw new Error('PayMongo checkout is unavailable.');

      setActivePaymentId(id);
      if (checkoutWindow) {
        checkoutWindow.opener = null;
        checkoutWindow.location.href = checkoutUrl;
      } else {
        window.location.href = checkoutUrl;
        return;
      }
      setCheckoutOpened(true);
    } catch (err: any) {
      checkoutWindow?.close();
      setError(err.message || 'Could not open PayMongo checkout.');
    } finally {
      setLoading(false);
    }
  };

  const getProviderTheme = () => {
    switch (provider) {
      case 'gcash':
        return { bg: 'bg-blue-600', text: 'text-blue-600', brand: 'GCash' };
      case 'maya':
        return { bg: 'bg-emerald-600', text: 'text-emerald-600', brand: 'Maya' };
      case 'gotyme':
        return { bg: 'bg-cyan-700', text: 'text-cyan-700', brand: 'GoTyme Bank' };
    }
  };

  const theme = getProviderTheme();

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-900 text-white select-none">
      <div className="max-w-md mx-auto w-full space-y-4">
        <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">
              {isMock ? "Simulating Commuter's E-Wallet" : 'Guest web payment'}
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
            No TalaRide App Required
          </span>
        </div>

        {paid ? (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className={`w-16 h-16 ${theme.bg} text-white rounded-full mx-auto flex items-center justify-center shadow-lg`}>
              <Check className="w-10 h-10 stroke-[3]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Payment Confirmed</h2>
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
                <span>Status:</span>
                <span className="font-semibold text-emerald-400">Provider confirmed</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-950/70 border border-emerald-800/80 rounded-2xl text-left text-xs space-y-2">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                Want ride records & TalaRide rewards?
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Get TalaRide to keep receipts, ride history, safety records, and rewards in one place.
              </p>
              {onOpenCommuterApp && (
                <button
                  onClick={onOpenCommuterApp}
                  className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition"
                >
                  Open / Get TalaRide
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-base font-black text-emerald-400">
                {isMock ? theme.brand : 'PayMongo Checkout'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {isMock ? 'LOCAL DEMO' : 'TEST MODE'}
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {error}
              </div>
            )}

            {checkoutOpened && !error && (
              <div className="p-3 bg-amber-950/50 border border-amber-700/60 text-amber-200 text-xs rounded-xl flex gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Checkout opened. Waiting for PayMongo to confirm the payment…</span>
              </div>
            )}

            <div className="text-center space-y-1 py-1">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Tricycle Unit
              </span>
              <h3 className="text-xl font-bold text-white">TalaRide • {vehicleId}</h3>
              <p className="text-xs text-slate-400">Assigned Driver: {driverName}</p>
              <div className="text-4xl font-black font-mono text-emerald-400 pt-2">₱{fareAmount}.00</div>
            </div>

            {isMock && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Simulate provider:
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
            )}

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Only backend-confirmed provider settlement marks this payment successful.</span>
            </div>

            <button
              onClick={handlePayAsGuest}
              disabled={loading || checking}
              className={`w-full py-4 ${isMock ? theme.bg : 'bg-emerald-600'} hover:opacity-90 active:scale-98 text-white font-black text-base rounded-2xl transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>
                {loading
                  ? 'Opening…'
                  : isMock
                    ? `PAY ₱${fareAmount}.00 WITH ${theme.brand.toUpperCase()}`
                    : checkoutOpened
                      ? 'REOPEN PAYMONGO CHECKOUT'
                      : 'OPEN PAYMONGO CHECKOUT'}
              </span>
            </button>

            {!isMock && checkoutOpened && activePaymentId && (
              <button
                onClick={() => completeIfConfirmed(activePaymentId, false)}
                disabled={checking}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking…' : 'Check payment status'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
