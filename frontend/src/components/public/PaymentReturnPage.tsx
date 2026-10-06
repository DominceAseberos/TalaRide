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
  const pollTimer = useRef<number | null>(null);
  const verifyInFlight = useRef(false);
  const terminalStateReached = useRef(cancelled);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const verify = useCallback(
    async (showChecking = false) => {
      if (
        !paymentId ||
        cancelled ||
        terminalStateReached.current ||
        verifyInFlight.current
      ) {
        return;
      }

      verifyInFlight.current = true;
      if (showChecking) {
        setState('checking');
        setMessage('Checking payment status…');
      }

      try {
        const res = await api.getConfirmedPaymentResult(paymentId);
        setResult(res);
        if (res.success) {
          terminalStateReached.current = true;
          stopPolling();
          setResult(res);
          setState('confirmed');
          setMessage(res.payment.payment_environment === 'test' ? 'Test confirmed by PayMongo. No real money was charged.' : 'Payment confirmed by TalaRide.');
          return;
        }

        const expiresAtMs = res.payment?.expires_at
          ? Date.parse(res.payment.expires_at)
          : Number.NaN;
        const expiredByTime =
          Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
        const terminalFailure =
          res.status === 'expired' ||
          res.status === 'failed' ||
          res.status === 'refunded' ||
          res.status === 'reversed' ||
          expiredByTime;

        if (terminalFailure) {
          terminalStateReached.current = true;
          stopPolling();
          setState('failed');
          setMessage(
            res.status === 'expired' || expiredByTime
              ? 'This payment request expired before confirmation.'
              : res.status === 'refunded' || res.status === 'reversed'
                ? 'This payment is no longer active.'
                : 'The payment could not be confirmed.'
          );
          return;
        }

        setState('pending');
        setMessage('Payment is still awaiting provider confirmation.');
      } catch (err: any) {
        setState('pending');
        setMessage(err.message || 'Could not verify payment yet.');
      } finally {
        verifyInFlight.current = false;
      }
    },
    [cancelled, paymentId, stopPolling]
  );

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
    stopPolling();
    terminalStateReached.current = cancelled;
    verifyInFlight.current = false;

    if (cancelled || !paymentId) return;

    const initial = window.setTimeout(() => void verify(true), 0);
    pollTimer.current = window.setInterval(() => void verify(false), 3000);

    return () => {
      window.clearTimeout(initial);
      stopPolling();
    };
  }, [cancelled, paymentId, stopPolling, verify]);

  useEffect(() => {
    if (state !== 'confirmed' || autoOpenAttempted.current) return;

    const isBrowserFallback =
      new URLSearchParams(window.location.search).get('web') === '1';
    if (isBrowserFallback) return;

    autoOpenAttempted.current = true;
    if (!/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)) return;

    const timer = window.setTimeout(() => openTalaRide(true), 900);
    return () => window.clearTimeout(timer);
  }, [openTalaRide, state]);

  const amount =
    result?.payment?.amount ??
    (result?.payment?.amount_centavos ? result.payment.amount_centavos / 100 : null);

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white border border-line rounded-2xl p-6 shadow-none  space-y-5">
        <div className="flex items-center gap-3">
          {state === 'confirmed' ? (
            <CheckCircle2 className="w-10 h-10 text-accent" />
          ) : state === 'failed' ? (
            <XCircle className="w-10 h-10 text-danger" />
          ) : state === 'checking' ? (
            <RotateCw className="w-10 h-10 text-warning animate-spin" />
          ) : (
            <Clock3 className="w-10 h-10 text-warning" />
          )}
          <div>
            <h1 className="text-xl font-semibold">
              {state === 'confirmed'
                ? (result?.payment?.payment_environment === 'test' ? 'Test payment successful' : 'Payment successful')
                : state === 'failed'
                  ? 'Payment not completed'
                  : 'Verifying payment'}
            </h1>
            <p className="text-xs text-muted mt-1">{message}</p>
          </div>
        </div>

        {paymentId && (
          <div className="bg-subtle border border-line rounded-2xl p-4 text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Payment ID</span>
              <span className="font-mono text-right break-all">{paymentId}</span>
            </div>
            {result?.payment?.vehicle_id && (
              <div className="flex justify-between gap-4">
                <span className="text-muted">Vehicle</span>
                <span className="font-mono">{result.payment.vehicle_id}</span>
              </div>
            )}
            {amount !== null && amount !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-muted">Amount</span>
                <span className="font-semibold text-accent">₱{Number(amount).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {state === 'pending' && !cancelled && (
          <button
            onClick={() => void verify(false)}
            className="w-full py-3 bg-warning-soft hover:bg-warning-soft text-ink font-semibold rounded-xl transition"
          >
            Check again
          </button>
        )}

        {state === 'confirmed' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-accent-soft p-4">
              <div className="text-sm font-semibold text-accent">Continue in TalaRide</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                If TalaRide is installed, return to the app for your payment status and ride history.
                No app yet? You can stay on this receipt page.
              </p>
              <button
                onClick={() => openTalaRide(false)}
                className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-semibold text-white"
              >
                OPEN TALARIDE
              </button>
              <p className="mt-2 text-center text-[10px] text-muted">
                App-store installation links will be added when TalaRide is published.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-warning-soft p-4">
              <div className="text-sm font-semibold text-warning">🎟 Vouchers & rewards</div>
              <p className="mt-1 text-xs text-warning">Coming soon.</p>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full py-3 bg-subtle hover:bg-line text-ink border border-line font-semibold rounded-xl transition"
        >
          Done
        </button>

        <p className="text-[11px] text-muted text-center leading-relaxed">
          A redirect alone never marks a TalaRide payment as paid. Success appears only after the
          backend reports provider-confirmed settlement.
        </p>
      </div>
    </div>
  );
};
