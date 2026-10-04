import React, { useState } from 'react';
import { ArrowLeft, Camera, QrCode, Shield, Sparkles, Loader2 } from 'lucide-react';
import { api, getWebPaymentMode } from '../../services/api';

interface Props {
  onBack: () => void;
  onScanned: (scanResult: { type: 'payment' | 'vehicle_sticker'; data: any }) => void;
}

export const CommuterScanner: React.FC<Props> = ({ onBack, onScanned }) => {
  const isMock = getWebPaymentMode() === 'mock';
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState('');

  const handlePresetScan = async (
    presetType: 'payment_standard' | 'payment_custom' | 'sticker_1842' | 'sticker_421'
  ) => {
    setError('');

    if (presetType === 'payment_standard' || presetType === 'payment_custom') {
      const amount = presetType === 'payment_standard' ? 30 : 120;
      if (isMock) {
        onScanned({
          type: 'payment',
          data: {
            paymentId:
              presetType === 'payment_standard'
                ? 'PAY-2026-1003-01'
                : `PAY-${Date.now().toString().slice(-6)}`,
            driverId: 'DR-000481',
            driverName: 'Juan Dela Cruz',
            vehicleId: 'TR-01842',
            amount,
            currency: 'PHP',
            isCustom: presetType === 'payment_custom'
          }
        });
        return;
      }

      setCreatingPayment(true);
      try {
        const intent = await api.createPaymentQR(
          'DR-000481',
          'TR-01842',
          amount,
          presetType === 'payment_custom'
        );
        onScanned({
          type: 'payment',
          data: {
            paymentId: intent.payment.payment_id,
            driverId: 'DR-000481',
            driverName: 'Juan Dela Cruz',
            vehicleId: 'TR-01842',
            amount,
            currency: 'PHP',
            isCustom: presetType === 'payment_custom'
          }
        });
      } catch (err: any) {
        setError(err.message || 'Could not create a staging payment.');
      } finally {
        setCreatingPayment(false);
      }
      return;
    }

    if (presetType === 'sticker_1842') {
      onScanned({
        type: 'vehicle_sticker',
        data: {
          vehicleId: 'TR-01842',
          plateBodyNumber: 'TAG-842',
          driverId: 'DR-000481',
          driverName: 'Juan Dela Cruz',
          toda: 'Tagum Poblacion TODA'
        }
      });
      return;
    }

    onScanned({
      type: 'vehicle_sticker',
      data: {
        vehicleId: 'TR-00421',
        plateBodyNumber: 'TAG-421',
        driverId: 'DR-000512',
        driverName: 'Rodrigo Bautista',
        toda: 'Magsaysay TODA'
      }
    });
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-950 text-white select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          TalaRide Scanner
        </span>
      </div>

      <div className="my-auto py-2 flex flex-col items-center text-center space-y-4">
        <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-emerald-500/60 bg-slate-900 flex items-center justify-center shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/50 animate-bounce" />
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />

          <div className="text-center p-4 space-y-2 opacity-75">
            <Camera className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
            <p className="text-xs text-slate-400">Point at a TalaRide payment or vehicle QR</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-bold text-white">Position TalaRide QR Inside Frame</div>
          <p className="text-xs text-slate-400 max-w-xs">
            TalaRide payment QRs identify a ride. Permanent vehicle stickers identify the tricycle.
            Payment itself is completed through PayMongo Checkout.
          </p>
        </div>
      </div>

      <div className="space-y-2 pt-2 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            {isMock ? 'Quick Test Simulation' : 'Staging Test'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isMock ? 'Local mock' : 'Creates real PayMongo test checkout'}
          </span>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => handlePresetScan('payment_standard')}
            disabled={creatingPayment}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition disabled:opacity-50"
          >
            <div className="font-bold text-emerald-400 flex items-center justify-between">
              <span>Pay ₱30 Fare</span>
              {creatingPayment ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div className="text-[11px] text-slate-400">TR-01842 • test checkout</div>
          </button>

          <button
            onClick={() => handlePresetScan('payment_custom')}
            disabled={creatingPayment}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition disabled:opacity-50"
          >
            <div className="font-bold text-amber-400 flex items-center justify-between">
              <span>Pay ₱120 Custom</span>
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-slate-400">TR-01842 • test checkout</div>
          </button>

          <button
            onClick={() => handlePresetScan('sticker_1842')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-white flex items-center justify-between">
              <span>Sticker TR-01842</span>
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-[11px] text-slate-400">Permanent vehicle QR</div>
          </button>

          <button
            onClick={() => handlePresetScan('sticker_421')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-white flex items-center justify-between">
              <span>Sticker TR-00421</span>
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-[11px] text-slate-400">Permanent vehicle QR</div>
          </button>
        </div>
      </div>
    </div>
  );
};
