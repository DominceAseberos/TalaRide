import React, { useState } from 'react';
import { ArrowLeft, Camera, QrCode, Shield, Sparkles, AlertCircle } from 'lucide-react';

interface Props {
  onBack: () => void;
  onScanned: (scanResult: { type: 'payment' | 'vehicle_sticker'; data: any }) => void;
}

export const CommuterScanner: React.FC<Props> = ({ onBack, onScanned }) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'presets'>('camera');

  // Realistic mock triggers for quick testing
  const handlePresetScan = (presetType: 'payment_standard' | 'payment_custom' | 'sticker_1842' | 'sticker_421') => {
    if (presetType === 'payment_standard') {
      onScanned({
        type: 'payment',
        data: {
          paymentId: 'PAY-2026-1003-01',
          driverId: 'DR-000481',
          driverName: 'Juan Dela Cruz',
          vehicleId: 'TR-01842',
          amount: 30,
          currency: 'PHP'
        }
      });
    } else if (presetType === 'payment_custom') {
      onScanned({
        type: 'payment',
        data: {
          paymentId: `PAY-${Date.now().toString().slice(-6)}`,
          driverId: 'DR-000481',
          driverName: 'Juan Dela Cruz',
          vehicleId: 'TR-01842',
          amount: 120,
          currency: 'PHP',
          isCustom: true
        }
      });
    } else if (presetType === 'sticker_1842') {
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
    } else {
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
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-950 text-white select-none">
      {/* Top Bar */}
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

      {/* Camera Viewfinder Area */}
      <div className="my-auto py-2 flex flex-col items-center text-center space-y-4">
        <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-emerald-500/60 bg-slate-900 flex items-center justify-center shadow-2xl">
          {/* Animated Laser Scanning Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/50 animate-bounce" />

          {/* Corner frame markers */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />

          <div className="text-center p-4 space-y-2 opacity-75">
            <Camera className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
            <p className="text-xs text-slate-400">Point at Driver's QR or Tricycle Sticker</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-bold text-white">Position QR Code Inside Frame</div>
          <p className="text-xs text-slate-400 max-w-xs">
            Supports both QR Ph payment screen and permanent tricycle vehicle stickers.
          </p>
        </div>
      </div>

      {/* Simulator Tap Presets for Instant Testing */}
      <div className="space-y-2 pt-2 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            Quick Test Simulation
          </span>
          <span className="text-[10px] text-slate-500">Tap to simulate scan</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => handlePresetScan('payment_standard')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-emerald-400 flex items-center justify-between">
              <span>Pay ₱30 Fare</span>
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-[11px] text-slate-400">Driver QR • TR-01842</div>
          </button>

          <button
            onClick={() => handlePresetScan('payment_custom')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-amber-400 flex items-center justify-between">
              <span>Pay ₱120 Custom</span>
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] text-slate-400">Special Trip • TR-01842</div>
          </button>

          <button
            onClick={() => handlePresetScan('sticker_1842')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-white flex items-center justify-between">
              <span>Sticker TR-01842</span>
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-[11px] text-slate-400">Safety Check-In • Juan D.</div>
          </button>

          <button
            onClick={() => handlePresetScan('sticker_421')}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-left rounded-xl border border-slate-700 space-y-0.5 transition"
          >
            <div className="font-bold text-white flex items-center justify-between">
              <span>Sticker TR-00421</span>
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-[11px] text-slate-400">Safety Check-In • Unit 421</div>
          </button>
        </div>
      </div>
    </div>
  );
};
