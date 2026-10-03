import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, CreditCard, ChevronRight, Check } from 'lucide-react';
import { api } from '../../services/api';

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
  const [selectedProvider, setSelectedProvider] = useState<'gcash' | 'maya' | 'gotyme'>('gcash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vehicleId = scanData.vehicleId || 'TR-01842';
  const driverName = scanData.driverName || 'Juan Dela Cruz';
  const fare = scanData.amount || 30;
  const paymentId = scanData.paymentId || 'PAY-2026-1003-01';

  const handleConfirmAndPay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.confirmPayment({
        paymentId,
        provider: selectedProvider,
        passengerId: 'USR-COM-001',
        passengerName: 'Maria Santos',
        approximateLocation: 'Tagum City Commercial Center'
      });
      if (res.success) {
        onPaymentSuccess(res);
      } else {
        setError(res.error || 'Payment confirmation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 select-none">
      {/* Top Bar */}
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
          <p className="text-xs text-slate-500">Verify tricycle and fare details before authorizing payment</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Section 9 Ride Confirmation Card */}
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
            <span className="text-[11px] text-slate-500">Method: Digital (QR Ph Interoperable)</span>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pay using e-Wallet / Bank:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedProvider('gcash')}
                className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-1 ${
                  selectedProvider === 'gcash'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>GCash</span>
                {selectedProvider === 'gcash' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedProvider('maya')}
                className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-1 ${
                  selectedProvider === 'maya'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>Maya</span>
                {selectedProvider === 'maya' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedProvider('gotyme')}
                className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-1 ${
                  selectedProvider === 'gotyme'
                    ? 'bg-cyan-50 border-cyan-500 text-cyan-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>GoTyme</span>
                {selectedProvider === 'gotyme' && <Check className="w-3.5 h-3.5 text-cyan-600" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 rounded-xl text-[11px] text-emerald-800 border border-emerald-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Earns +1 TalaPoint towards free promotional discounts.</span>
          </div>
        </div>
      </div>

      {/* Confirm CTA */}
      <div className="pt-4">
        <button
          onClick={handleConfirmAndPay}
          disabled={loading}
          className="w-full py-4.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-lg rounded-2xl transition shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{loading ? 'Processing Payment...' : `CONFIRM & PAY ₱${fare}`}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-[11px] text-center text-slate-400 mt-2">
          Secure payment authorized via Philippine QR Ph national rails.
        </p>
      </div>
    </div>
  );
};
