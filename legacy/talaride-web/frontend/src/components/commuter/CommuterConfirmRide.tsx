import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, ChevronRight, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { api, getWebPaymentMode } from '../../services/api';

interface Props {
  scanData: any;
  onCancel: () => void;
  onPaymentSuccess: (res: any) => void;
}

export const CommuterConfirmRide: React.FC<Props> = ({
  scanData,
  onCancel,
  onPaymentSuccess
}) => {
  const paymentMode = getWebPaymentMode();
  const isMock = paymentMode === 'mock';
  const [selectedProvider, setSelectedProvider] = useState<'gcash' | 'maya' | 'gotyme'>('gcash');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [error, setError] = useState('');

  const vehicleId = scanData.vehicleId || 'TR-01842';
  const driverName = scanData.driverName || 'Juan Dela Cruz';
  const fare = scanData.amount || 30;
  const paymentId = scanData.paymentId || 'PAY-2026-1003-01';

  const checkPaymentStatus = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const result = await api.getConfirmedPaymentResult(paymentId);
      if (result.success) {
        onPaymentSuccess(result);
        return true;
      }

      if (result.status === 'expired') {
        setError('This payment request expired. Ask the driver to create a new fare request.');
      } else if (result.status === 'failed') {
        setError('The payment failed. Please try again or pay cash.');
      } else if (!silent) {
        setError('Still waiting for PayMongo confirmation. Complete checkout, then check again.');
      }
      return false;
    } catch (err: any) {
      if (!silent) setError(err.message || 'Could not check payment status.');
      return false;
    } finally {
      if (!silent) setChecking(false);
    }
  }, [onPaymentSuccess, paymentId]);

  useEffect(() => {
    if (isMock || !checkoutOpened) return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const complete = await checkPaymentStatus(true);
      if (complete) cancelled = true;
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [checkPaymentStatus, checkoutOpened, isMock]);

  const handleConfirmAndPay = async () => {
    setLoading(true);
    setError('');

    if (isMock) {
      try {
        const res = await api.confirmPayment({
          paymentId,
          provider: selectedProvider,
          passengerId: 'USR-COM-001',
          passengerName: 'Maria Santos',
          approximateLocation: 'Tagum City Commercial Center'
        });
        if (res.success) onPaymentSuccess(res);
        else setError(res.error || 'Payment confirmation failed');
      } catch (err: any) {
        setError(err.message || 'Payment processing error');
      } finally {
        setLoading(false);
      }
      return;
    }

    const checkoutWindow = window.open('about:blank', 'talaride-paymongo-checkout');
    try {
      const status = await api.getPaymentStatus(paymentId);

      if (status.payment.payment_status === 'paid') {
        checkoutWindow?.close();
        await checkPaymentStatus();
        return;
      }

      if (status.payment.payment_status === 'expired') {
        checkoutWindow?.close();
        setError('This payment request expired. Ask the driver to create a new one.');
        return;
      }

      const checkoutUrl = status.checkoutUrl || status.payment.checkout_url;
      if (!checkoutUrl) {
        checkoutWindow?.close();
        throw new Error('PayMongo checkout is not available for this payment.');
      }

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

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 select-none">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <span className="text-xs font-bold text-emerald-600">Review Ride</span>
        </div>

        <div>
          <h1 className="text-xl font-black text-slate-900">Confirm Payment</h1>
          <p className="text-xs text-slate-500">
            Verify the vehicle and fare before opening secure checkout.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {checkoutOpened && !error && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>PayMongo checkout is open. Waiting for provider confirmation…</span>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vehicle</span>
              <div className="font-mono text-2xl font-black text-slate-900">{vehicleId}</div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Driver</span>
              <div className="font-bold text-slate-900 text-sm">{driverName}</div>
            </div>
          </div>

          <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Fare Amount</span>
            <div className="text-4xl font-black font-mono text-emerald-600 my-0.5">₱{fare}</div>
            <span className="text-[11px] text-slate-500">
              {isMock ? 'Local payment simulator' : 'Secure checkout powered by PayMongo'}
            </span>
          </div>

          {isMock ? (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Simulate provider:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['gcash', 'maya', 'gotyme'] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSelectedProvider(provider)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition capitalize ${
                      selectedProvider === provider
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              PayMongo Checkout will show the payment methods enabled for this test account, including
              supported e-wallet, card, and QR Ph options. TalaRide marks the ride paid only after the
              backend receives provider confirmation.
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 rounded-xl text-[11px] text-emerald-800 border border-emerald-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Payment status is verified by the TalaRide backend, not by this browser.</span>
          </div>
        </div>
      </div>

      <div className="pt-4 space-y-2">
        <button
          onClick={handleConfirmAndPay}
          disabled={loading || checking}
          className="w-full py-4.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-base rounded-2xl transition shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isMock ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ExternalLink className="w-5 h-5" />
          )}
          <span>
            {loading
              ? 'Opening…'
              : isMock
                ? `CONFIRM DEMO PAYMENT ₱${fare}`
                : checkoutOpened
                  ? 'REOPEN PAYMONGO CHECKOUT'
                  : 'OPEN PAYMONGO CHECKOUT'}
          </span>
        </button>

        {!isMock && checkoutOpened && (
          <button
            onClick={() => checkPaymentStatus(false)}
            disabled={checking}
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking…' : 'Check payment status'}</span>
          </button>
        )}

        <p className="text-[11px] text-center text-slate-400">
          {isMock
            ? 'Simulator-only payment. No real provider request is made.'
            : 'Test-mode PayMongo checkout. Provider webhook confirmation is required.'}
        </p>
      </div>
    </div>
  );
};
