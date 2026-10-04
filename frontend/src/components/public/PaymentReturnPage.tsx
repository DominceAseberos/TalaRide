import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, RotateCw, XCircle } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  paymentId: string;
  cancelled?: boolean;
}

export const PaymentReturnPage: React.FC<Props> = ({ paymentId, cancelled = false }) => {
  const [state, setState] = useState<'checking' | 'confirmed' | 'pending' | 'failed'>(
    cancelled ? 'failed' : 'checking'
  );
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState(
    cancelled ? 'Checkout was cancelled. No payment was marked successful.' : 'Checking payment status…'
  );

  const verify = useCallback(async () => {
    if (!paymentId || cancelled) return;
    setState('checking');
    setMessage('Checking payment status…');

    try {
      const res = await api.getConfirmedPaymentResult(paymentId);
      if (res.success) {
        setResult(res);
        setState('confirmed');
        setMessage('Payment confirmed by TalaRide.');
        return;
      }

      if (res.status === 'expired' || res.status === 'failed') {
        setState('failed');
        setMessage(
          res.status === 'expired'
            ? 'This payment request expired before confirmation.'
            : 'The payment could not be confirmed.'
        );
        return;
      }

      setState('pending');
      setMessage('Payment is still awaiting provider confirmation.');
    } catch (err: any) {
      setState('pending');
      setMessage(err.message || 'Could not verify payment yet.');
    }
  }, [cancelled, paymentId]);

  useEffect(() => {
    if (cancelled) return;
    const initial = window.setTimeout(() => void verify(), 0);
    const timer = window.setInterval(() => void verify(), 3000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [cancelled, verify]);

  const amount =
    result?.payment?.amount ??
    (result?.payment?.amount_centavos ? result.payment.amount_centavos / 100 : null);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          {state === 'confirmed' ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          ) : state === 'failed' ? (
            <XCircle className="w-10 h-10 text-rose-400" />
          ) : state === 'checking' ? (
            <RotateCw className="w-10 h-10 text-amber-300 animate-spin" />
          ) : (
            <Clock3 className="w-10 h-10 text-amber-300" />
          )}
          <div>
            <h1 className="text-xl font-black">
              {state === 'confirmed'
                ? 'Payment confirmed'
                : state === 'failed'
                  ? 'Payment not completed'
                  : 'Verifying payment'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
          </div>
        </div>

        {paymentId && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Payment ID</span>
              <span className="font-mono text-right break-all">{paymentId}</span>
            </div>
            {result?.payment?.vehicle_id && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-mono">{result.payment.vehicle_id}</span>
              </div>
            )}
            {amount !== null && amount !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Amount</span>
                <span className="font-black text-emerald-400">₱{Number(amount).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {state === 'pending' && !cancelled && (
          <button
            onClick={() => void verify()}
            className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl transition"
          >
            Check again
          </button>
        )}

        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition"
        >
          Return to TalaRide
        </button>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          A redirect alone never marks a TalaRide payment as paid. This page only shows success after
          the backend reports provider-confirmed settlement.
        </p>
      </div>
    </div>
  );
};
