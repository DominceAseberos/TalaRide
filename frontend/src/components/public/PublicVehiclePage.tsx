import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { api } from '../../services/api';

type PaymentMethod = 'gcash' | 'maya' | 'card' | 'qrph';

interface PublicVehicleData {
  vehicle_code: string;
  plate_body_number: string;
  toda: string;
  status: string;
  shift_status: string;
  driver_code: string | null;
  driver_name: string;
  error?: string;
  message?: string;
}

interface Props {
  vehicleCode: string;
  checksum: string;
  onGoHome?: () => void;
}

const PRESET_FARES = [15, 20, 30, 40, 50];

export const PublicVehiclePage: React.FC<Props> = ({ vehicleCode, checksum }) => {
  const [data, setData] = useState<PublicVehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fare, setFare] = useState<number>(30);
  const [customFare, setCustomFare] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    api.getPublicVehicle(vehicleCode, checksum)
      .then((res) => {
        if (ignore) return;
        if (res.error || res.message) {
          setErrorMessage(res.message || 'Vehicle QR could not be verified');
        } else {
          setData(res);
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

  const finalFare = useMemo(() => {
    if (fare > 0) return fare;
    const parsed = Number(customFare);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [fare, customFare]);

  const canPay =
    !!data?.driver_code &&
    data.status === 'Active' &&
    data.shift_status === 'Active' &&
    finalFare >= 10 &&
    !submitting;

  const proceed = async () => {
    if (!data?.driver_code || !canPay) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await api.createPaymentQR(
        data.driver_code,
        data.vehicle_code,
        finalFare,
        fare === 0,
        paymentMethod
      );
      if (!result.checkoutUrl) {
        throw new Error('Payment gateway is unavailable right now.');
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
    { id: 'gcash', label: 'GCash', subtitle: 'E-wallet', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'maya', label: 'Maya', subtitle: 'E-wallet', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'card', label: 'Card', subtitle: 'Visa / Mastercard', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'qrph', label: 'QR Ph', subtitle: 'Bank / wallet', icon: <ShieldCheck className="w-4 h-4" /> }
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 py-5">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-black tracking-tight">TalaRide</div>
            <div className="text-[11px] text-slate-500">Scan • Choose • Pay</div>
          </div>
          <div className="text-[10px] font-bold text-emerald-400">SECURE CHECKOUT</div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-400">Verifying vehicle…</p>
          </div>
        )}

        {!loading && errorMessage && !data && (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-5 text-center">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-rose-400" />
            <div className="font-bold text-rose-200">Unable to continue</div>
            <p className="mt-1 text-xs text-rose-300">{errorMessage}</p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified driver
                  </div>
                  <div className="mt-2 text-xl font-black">{data.driver_name}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {data.vehicle_code} • Body {data.plate_body_number}
                  </div>
                  <div className="text-xs text-slate-500">{data.toda}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                  {data.shift_status}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-bold">Choose fare</div>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_FARES.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setFare(amount);
                      setCustomFare('');
                    }}
                    className={`rounded-xl border py-2.5 text-xs font-black transition ${
                      fare === amount
                        ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    ₱{amount}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setFare(0)}
                  className={`shrink-0 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                    fare === 0
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  Other
                </button>
                {fare === 0 && (
                  <div className="flex flex-1 items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                    <span className="text-sm text-slate-500">₱</span>
                    <input
                      inputMode="decimal"
                      value={customFare}
                      onChange={(e) => setCustomFare(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Enter fare"
                      className="w-full bg-transparent px-2 py-2.5 text-sm font-bold outline-none"
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-bold">Select payment</div>
              <div className="grid grid-cols-2 gap-2">
                {paymentOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setPaymentMethod(option.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                      paymentMethod === option.id
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 bg-slate-950'
                    }`}
                  >
                    <span className={paymentMethod === option.id ? 'text-emerald-400' : 'text-slate-400'}>
                      {option.icon}
                    </span>
                    <span>
                      <span className="block text-xs font-black">{option.label}</span>
                      <span className="block text-[10px] text-slate-500">{option.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {errorMessage && (
              <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2.5 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <button
              onClick={proceed}
              disabled={!canPay}
              className="flex w-full items-center justify-between rounded-2xl bg-emerald-500 px-4 py-4 text-slate-950 shadow-lg shadow-emerald-950/30 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Proceed to payment
                </span>
                <span className="block text-lg font-black">
                  {finalFare >= 10 ? `₱${finalFare.toFixed(2)} • ${paymentOptions.find((x) => x.id === paymentMethod)?.label}` : 'Choose fare'}
                </span>
              </span>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <p className="px-4 text-center text-[10px] leading-relaxed text-slate-500">
              Your fare and selected payment method are locked into the checkout when you continue.
              TalaRide only marks the ride paid after provider confirmation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
};
