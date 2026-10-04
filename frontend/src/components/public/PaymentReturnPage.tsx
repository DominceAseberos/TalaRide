import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const autoOpenAttempted = useRef(false);

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

  const openTalaRide = useCallback(
    (silent = false) => {
      if (!paymentId || typeof window === 'undefined') return;

      const appUrl =
        'talaride://payment-status?payment_id=' + encodeURIComponent(paymentId);
      const ua = window.navigator.userAgent;

      if (/Android/i.test(ua)) {
        const fallback = new URL(window.location.href);
        fallback.searchParams.set('web', '1');
        const intentUrl =
          'intent://payment-status?payment_id=' +
          encodeURIComponent(paymentId) +
          '#Intent;scheme=talaride;package=com.beepanjero.talaride;S.browser_fallback_url=' +
          encodeURIComponent(fallback.toString()) +
          ';end';
        window.location.href = intentUrl;
        return;
      }

      if (/iPhone|iPad|iPod/i.test(ua) && silent) {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.display = 'none';
        frame.src = appUrl;
        document.body.appendChild(frame);
        window.setTimeout(() => frame.remove(), 1400);
        return;
      }

      window.location.href = appUrl;
    },
    [paymentId]
  );

  useEffect(() => {
    if (cancelled || state === 'confirmed' || state === 'failed') return;
    const initial = window.setTimeout(() => void verify(), 0);
    const timer = window.setInterval(() => void verify(), 3000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [cancelled, state, verify]);

  useEffect(() => {
    if (state !== 'confirmed' || autoOpenAttempted.current) return;
    autoOpenAttempted.current = true;
    if (!/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)) return;
    const timer = window.setTimeout(() => openTalaRide(true), 900);
    return () => window.clearTimeout(timer);
  }, [openTalaRide, state]);

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
                ? 'Payment successful'
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

        {state === 'confirmed' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4">
              <div className="text-sm font-black text-emerald-300">Continue in TalaRide</div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-100/70">
                If TalaRide is installed, return to the app for your payment status and ride history.
                No app yet? You can stay on this receipt page.
              </p>
              <button
                onClick={() => openTalaRide(false)}
                className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950"
              >
                OPEN TALARIDE
              </button>
              <p className="mt-2 text-center text-[10px] text-emerald-100/50">
                App-store installation links will be added when TalaRide is published.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4">
              <div className="text-sm font-black text-amber-300">🎟 Vouchers & rewards</div>
              <p className="mt-1 text-xs text-amber-100/60">Coming soon.</p>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl transition"
        >
          Done
        </button>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          A redirect alone never marks a TalaRide payment as paid. Success appears only after the
          backend reports provider-confirmed settlement.
        </p>
      </div>
    </div>
  );
};
