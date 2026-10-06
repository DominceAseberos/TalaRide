import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { api } from '../../services/api';

type PaymentMethod = 'gcash' | 'maya' | 'card' | 'qrph';

interface PublicVehicleData {
  payment_environment?: 'test' | 'live';
  vehicle_code: string;
  plate_body_number: string;
  toda: string;
  status: string;
  shift_status: string;
  driver_code: string | null;
  driver_name: string;
  verification_status?: 'verified' | 'pending' | 'suspended';
  driver_photo_url?: string | null;
  fare_config?: { standard_fares_centavos?: number[] };
  session_id?: string;
  session_expires_at?: string | null;
  error?: string;
  message?: string;
}

interface Props {
  vehicleCode: string;
  checksum: string;
  onGoHome?: () => void;
}

const PRESET_FARES = [15, 20, 25, 30, 40];
const MIN_FARE = 15;

export const PublicVehiclePage: React.FC<Props> = ({ vehicleCode, checksum }) => {
  const [data, setData] = useState<PublicVehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [presetFare, setPresetFare] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customFare, setCustomFare] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const fares = useMemo(() => {
    const configured = data?.fare_config?.standard_fares_centavos;
    return configured?.length ? configured.map((value) => value / 100) : PRESET_FARES;
  }, [data?.fare_config?.standard_fares_centavos]);

  const appDeepLink = useMemo(
    () =>
      'talaride://ride-confirm?vehicle_code=' +
      encodeURIComponent(vehicleCode) +
      '&c=' +
      encodeURIComponent(checksum),
    [vehicleCode, checksum]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    if (search.get('web') === '1') return;

    const userAgent = window.navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      const fallback = new URL(window.location.href);
      fallback.searchParams.set('web', '1');
      const intentUrl =
        'intent://ride-confirm?vehicle_code=' +
        encodeURIComponent(vehicleCode) +
        '&c=' +
        encodeURIComponent(checksum) +
        '#Intent;scheme=talaride;package=com.beepanjero.talaride;S.browser_fallback_url=' +
        encodeURIComponent(fallback.toString()) +
        ';end';
      window.location.replace(intentUrl);
      return;
    }

    if (!/iPhone|iPad|iPod/i.test(userAgent)) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.display = 'none';
    frame.src = appDeepLink;
    document.body.appendChild(frame);
    const timer = window.setTimeout(() => frame.remove(), 1400);
    return () => {
      window.clearTimeout(timer);
      frame.remove();
    };
  }, [appDeepLink, vehicleCode, checksum]);

  useEffect(() => {
    let ignore = false;
    const requestedSessionId = new URLSearchParams(window.location.search).get('sid') || undefined;
    api.getPublicVehicle(vehicleCode, checksum, requestedSessionId)
      .then((res) => {
        if (ignore) return;
        if (res.error || res.message) {
          setErrorMessage(res.message || 'Vehicle QR could not be verified');
        } else {
          setData(res);
          if (res.session_id) {
            setSessionId(res.session_id);
            const url = new URL(window.location.href);
            url.searchParams.set('sid', res.session_id);
            window.history.replaceState({}, '', url.toString());
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.message || 'Unable to connect to TalaRide');
          setLoading(false);
        }
      });
    return () => { ignore = true; };
  }, [vehicleCode, checksum]);

  useEffect(() => {
    if (!data?.session_expires_at) return;
    const remaining = Math.max(0, new Date(data.session_expires_at).getTime() - Date.now());
    const timer = window.setTimeout(() => setSessionExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [data?.session_expires_at]);

  const finalFare = useMemo(() => {
    if (!customMode) return presetFare ?? 0;
    const parsed = Number(customFare);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [customFare, customMode, presetFare]);

  const hasValidFare = finalFare >= MIN_FARE && finalFare <= 500;
  const canPay =
    !!data?.driver_code &&
    data.verification_status === 'verified' &&
    data.status === 'Active' &&
    data.shift_status === 'Active' &&
    hasValidFare &&
    !!paymentMethod &&
    !submitting;

  const choosePreset = (amount: number) => {
    setPresetFare(amount);
    setCustomMode(false);
    setCustomFare('');
    setPaymentMethod(null);
    setErrorMessage(null);
  };

  const chooseCustom = () => {
    setPresetFare(null);
    setCustomMode(true);
    setPaymentMethod(null);
    setErrorMessage(null);
  };

  const proceed = async () => {
    if (!data?.driver_code || !paymentMethod || !canPay) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await api.createPaymentQR(
        data.driver_code,
        data.vehicle_code,
        finalFare,
        customMode,
        paymentMethod,
        sessionId ?? undefined
      );
      if (!result.checkoutUrl) {
        throw new Error('The payment gateway is unavailable right now.');
      }
      window.location.assign(result.checkoutUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start payment.');
      setSubmitting(false);
    }
  };

  const paymentOptions: Array<{
    id: PaymentMethod;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    { id: 'gcash', label: 'GCash', subtitle: 'E-wallet', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'maya', label: 'Maya', subtitle: 'E-wallet', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'card', label: 'Card', subtitle: 'Visa / Mastercard', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'qrph', label: 'QR Ph', subtitle: 'Bank / wallet', icon: <ShieldCheck className="h-4 w-4" /> }
  ];

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-ink">TalaRide</div>
            <div className="mt-0.5 text-xs font-medium text-muted">Verified ride checkout</div>
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = appDeepLink; }}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-accent shadow-none transition hover:bg-accent-soft"
          >
            Open app <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </header>

        {loading && (
          <div className="rounded-2xl border border-line bg-white p-10 text-center shadow-none">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-accent" />
            <p className="text-sm font-semibold text-muted">Verifying TalaRide vehicle…</p>
          </div>
        )}

        {!loading && errorMessage && !data && (
          <div className="rounded-2xl border border-danger-line bg-danger-soft p-6 text-center shadow-none">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-danger" />
            <div className="font-semibold text-danger">Unable to verify this vehicle</div>
            <p className="mt-1 text-sm leading-relaxed text-danger">{errorMessage}</p>
          </div>
        )}

        {!loading && sessionExpired && (
          <div className="rounded-2xl border border-danger-line bg-danger-soft p-6 text-center shadow-none">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-danger" />
            <div className="font-semibold text-danger">Ride session expired</div>
            <p className="mt-1 text-sm leading-relaxed text-danger">Scan the vehicle QR code again to start a new private payment session.</p>
          </div>
        )}

        {!loading && data && !sessionExpired && (
          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-none">
              <div className="bg-white border-b border-line px-5 py-4 text-ink">
                <div className="flex items-center gap-3">
                  {data.driver_photo_url ? (
                    <img src={data.driver_photo_url} alt="Driver profile" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-line" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-xl font-semibold text-accent">
                      {data.driver_name.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-accent">
                      <CheckCircle2 className="h-5 w-5" />
                      {data.verification_status === 'verified' ? 'Verified driver' : 'Verification pending'}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{data.driver_name}</div>
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {data.vehicle_code} • Body {data.plate_body_number}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-line">
                <div className="bg-white px-4 py-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">TODA</div>
                  <div className="mt-1 text-sm font-bold text-ink">{data.toda}</div>
                </div>
                <div className="bg-white px-4 py-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Shift</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    {data.shift_status}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-none">
              <div className="text-base font-semibold text-ink">1. Choose fare</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Select the exact fare before choosing how to pay.
              </p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {fares.map((amount) => {
                  const selected = !customMode && presetFare === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => choosePreset(amount)}
                      className={
                        'min-h-11 rounded-xl border text-sm font-semibold transition ' +
                        (selected
                          ? 'border-accent bg-accent text-white shadow-none'
                          : 'border-line bg-subtle text-ink hover:border-accent')
                      }
                    >
                      ₱{amount}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={chooseCustom}
                  className={
                    'min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold transition ' +
                    (customMode
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-white text-muted')
                  }
                >
                  Other
                </button>
                {customMode && (
                  <div className="flex min-h-11 flex-1 items-center rounded-xl border border-line bg-subtle px-3 focus-within:border-accent">
                    <span className="text-sm font-bold text-muted">₱</span>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={customFare}
                      onChange={(e) => {
                        setCustomFare(e.target.value.replace(/[^0-9.]/g, ''));
                        setPaymentMethod(null);
                      }}
                      placeholder="Enter fare"
                      className="w-full bg-transparent px-2 py-2.5 text-sm font-bold text-ink outline-none placeholder:text-muted"
                    />
                  </div>
                )}
              </div>
              {customMode && customFare && !hasValidFare && (
                <p className="mt-2 text-xs font-medium text-danger">Enter a fare of at least ₱15.</p>
              )}
            </section>

            <section
              className={
                'rounded-2xl border p-5 shadow-none transition ' +
                (hasValidFare
                  ? 'border-line bg-white'
                  : 'border-line bg-subtle')
              }
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-ink">2. Select payment</div>
                {hasValidFare && (
                  <div className="text-sm font-semibold text-accent">₱{finalFare.toFixed(2)}</div>
                )}
              </div>
              {!hasValidFare ? (
                <p className="mt-2 text-sm text-muted">Choose or enter the fare first.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {paymentOptions.map((option) => {
                    const selected = paymentMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPaymentMethod(option.id)}
                        className={
                          'flex min-h-[64px] items-center gap-3 rounded-2xl border p-3 text-left transition ' +
                          (selected
                            ? 'border-accent bg-accent-soft'
                            : 'border-line bg-subtle hover:border-accent')
                        }
                      >
                        <span className={selected ? 'text-accent' : 'text-muted'}>
                          {option.icon}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-ink">{option.label}</span>
                          <span className="block text-[11px] text-muted">{option.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {errorMessage && (
              <div className="rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {errorMessage}
              </div>
            )}

            {data.verification_status !== 'verified' && (
              <div className="rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                Digital payment is unavailable until this driver is verified by TalaRide/TODA.
              </div>
            )}

            <button
              type="button"
              onClick={proceed}
              disabled={!canPay}
              className="flex min-h-[64px] w-full items-center justify-between rounded-2xl bg-accent px-5 py-4 text-white shadow-none  transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none"
            >
              <span className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">
                  3. Proceed to payment
                </span>
                <span className="mt-0.5 block text-lg font-semibold">
                  {!hasValidFare
                    ? 'Choose fare first'
                    : !paymentMethod
                      ? '₱' + finalFare.toFixed(2) + ' • Select payment'
                      : '₱' +
                        finalFare.toFixed(2) +
                        ' • ' +
                        paymentOptions.find((x) => x.id === paymentMethod)?.label}
                </span>
              </span>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <p className="px-4 text-center text-[11px] leading-relaxed text-muted">
              {data.payment_environment === 'test' ? 'PayMongo test checkout — no real money is charged.' : 'Nothing is charged until you authorize payment with the provider.'} TalaRide shows success only after the payment provider confirms it.
            </p>
          </div>
        )}
      </div>
    </main>
  );
};
