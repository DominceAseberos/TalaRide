import React, { useState } from 'react';
import { QrCode, Banknote, Edit3, AlertCircle, History, Bell, LogOut, Check } from 'lucide-react';
import { Driver, DriverShift } from '../../types';
import { api } from '../../services/api';

interface Props {
  driver: Driver;
  shift: DriverShift | null;
  onGeneratePaymentQR: (amount: number, isCustom: boolean) => void;
  onCashRideRecorded: (ride: any) => void;
  onViewHistory: () => void;
  onViewLostItems: () => void;
  onEndShift: () => void;
}

export const DriverMainFare: React.FC<Props> = ({
  driver,
  shift,
  onGeneratePaymentQR,
  onCashRideRecorded,
  onViewHistory,
  onViewLostItems,
  onEndShift
}) => {
  const [selectedFare, setSelectedFare] = useState<number>(30);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customStep, setCustomStep] = useState<'input' | 'confirm'>('input');
  const [showCashConfirm, setShowCashConfirm] = useState(false);
  const [recordCashCheckIn, setRecordCashCheckIn] = useState(true);
  const [loading, setLoading] = useState(false);

  const standardFares = [15, 20, 25, 30, 40];

  const handleStandardFareSelect = (fare: number) => {
    setSelectedFare(fare);
  };

  const handleCustomSubmit = () => {
    const val = Number(customAmount);
    if (!val || val <= 0) return;
    setCustomStep('confirm');
  };

  const handleConfirmCustomQR = () => {
    const val = Number(customAmount);
    setShowCustomModal(false);
    setCustomStep('input');
    setCustomAmount('');
    onGeneratePaymentQR(val, true);
  };

  const handleStartDigitalPayment = () => {
    onGeneratePaymentQR(selectedFare, false);
  };

  const handleConfirmCashRide = async () => {
    setLoading(true);
    try {
      const res = await api.recordCashRide(
        driver.driver_id,
        driver.assigned_vehicle_id || 'TR-01842',
        selectedFare
      );
      setShowCashConfirm(false);
      onCashRideRecorded(res.ride);
    } catch (err) {
      console.error('Failed to log cash ride', err);
      setShowCashConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-3.5 bg-slate-950 text-white select-none">
      {/* Top Header: High-contrast vehicle and driver info */}
      <div className="space-y-3">
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Current Vehicle</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black font-mono tracking-tight text-white">
                {driver.assigned_vehicle_id || 'TR-01842'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ACTIVE
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Driver: <strong className="text-slate-200">{driver.name}</strong> ({driver.driver_id})
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onViewLostItems}
              aria-label="Lost Item Reports"
              className="p-2.5 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700 active:scale-95 transition relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            </button>
            <button
              onClick={onViewHistory}
              aria-label="Transaction History"
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95 transition"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={onEndShift}
              aria-label="End Shift"
              className="p-2.5 rounded-xl bg-slate-800 text-rose-400 hover:bg-slate-700 active:scale-95 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fare Selector Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Fare</span>
            <span className="text-xs text-emerald-400 font-mono font-semibold">TODA Regulated Rates</span>
          </div>

          {/* Large touch buttons (min 60px height) */}
          <div className="grid grid-cols-3 gap-2.5">
            {standardFares.map((f) => {
              const isSelected = selectedFare === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleStandardFareSelect(f)}
                  className={`h-20 rounded-2xl font-black text-2xl flex flex-col items-center justify-center transition active:scale-95 border-2 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-300/40'
                      : 'bg-slate-900 text-white border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>₱{f}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-emerald-950' : 'text-slate-500'}`}>
                    Standard
                  </span>
                </button>
              );
            })}

            {/* Custom Fare button */}
            <button
              type="button"
              onClick={() => {
                setCustomStep('input');
                setShowCustomModal(true);
              }}
              className="h-20 rounded-2xl font-black text-base flex flex-col items-center justify-center transition active:scale-95 border-2 bg-slate-900 text-amber-400 border-amber-500/30 hover:border-amber-400/60"
            >
              <Edit3 className="w-5 h-5 mb-1" />
              <span>CUSTOM</span>
            </button>
          </div>
        </div>

        {/* Selected Fare Large Display */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Fare Selected</div>
          <div className="text-4xl font-black text-white font-mono my-1">₱{selectedFare}</div>
          <div className="text-[11px] text-slate-400">Ready for Commuter Payment</div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="space-y-3 pt-3">
        {/* REQUEST DIGITAL PAYMENT (QR Ph) */}
        <button
          onClick={handleStartDigitalPayment}
          className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xl rounded-2xl transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3"
        >
          <QrCode className="w-7 h-7" />
          <span>REQUEST PAYMENT (QR Ph)</span>
        </button>

        {/* CASH PAYMENT BUTTON */}
        <button
          onClick={() => setShowCashConfirm(true)}
          className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-base rounded-2xl transition border border-slate-700 flex items-center justify-center gap-2"
        >
          <Banknote className="w-5 h-5 text-amber-400" />
          <span>RECORD CASH (₱{selectedFare})</span>
        </button>

        {/* Today's Ticker / Net Breakdown (Section 17) */}
        {shift && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-2.5 text-[11px] space-y-1">
            <div className="flex items-center justify-between font-mono font-bold text-slate-300">
              <span>TODAY'S SHIFT</span>
              <span className="text-emerald-400">Net: ₱{shift.digital_net_total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Digital: {shift.digital_rides_count} (₱{shift.digital_gross_total})</span>
              <span>Fee: -₱{shift.provider_platform_fees.toFixed(2)}</span>
              <span>Cash: {shift.cash_rides_count}</span>
            </div>
          </div>
        )}
      </div>

      {/* Custom Fare Modal (Section 7) */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl">
            {customStep === 'input' ? (
              <>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Enter Custom / Special Fare</h3>
                  <p className="text-xs text-slate-400">
                    Use for special chartered trips or long distances agreed with commuter.
                  </p>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-2xl font-bold text-emerald-400">₱</span>
                  <input
                    type="number"
                    min="15"
                    max="1000"
                    placeholder="120"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-3xl font-mono font-bold text-white focus:outline-hidden focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCustomModal(false)}
                    className="flex-1 py-3 bg-slate-800 rounded-xl font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customAmount || Number(customAmount) <= 0}
                    className="flex-1 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Confirm Prompt (Section 7) */}
                <div className="text-center space-y-2 py-2">
                  <div className="inline-flex p-3 bg-amber-500/20 text-amber-400 rounded-full mb-1">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="text-xs uppercase font-bold tracking-wider text-amber-400">Special Fare Verification</div>
                  <div className="text-4xl font-mono font-black text-white">₱{customAmount}</div>
                  <p className="text-xs text-slate-400 px-2">
                    Has the passenger agreed to this special fare before generating QR?
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setCustomStep('input')}
                    className="flex-1 py-3 bg-slate-800 rounded-xl font-semibold text-slate-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmCustomQR}
                    className="flex-1 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20"
                  >
                    CONFIRM & SHOW QR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cash Ride Modal (Section 10) */}
      {showCashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 bg-amber-500/20 text-amber-400 rounded-full mb-1">
                <Banknote className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold">Cash Payment Received</h3>
              <div className="text-3xl font-black font-mono text-emerald-400">₱{selectedFare}</div>
              <p className="text-xs text-slate-400">Driver receives cash directly from passenger.</p>
            </div>

            <div
              onClick={() => setRecordCashCheckIn(!recordCashCheckIn)}
              className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer"
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${recordCashCheckIn ? 'bg-emerald-500 text-slate-950' : 'border border-slate-600'}`}>
                {recordCashCheckIn && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
              <div className="text-xs text-slate-300">
                <div className="font-semibold text-white">Record ride in shift log?</div>
                <div className="text-[11px] text-slate-400">Helps track daily trip counts</div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCashConfirm(false)}
                className="flex-1 py-3 bg-slate-800 rounded-xl font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCashRide}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl"
              >
                {loading ? 'Saving...' : 'Finish Ride'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
