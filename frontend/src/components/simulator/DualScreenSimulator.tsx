import React, { useState } from 'react';
import { Smartphone, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { DriverMainFare } from '../driver/DriverMainFare';
import { DriverQRScreen } from '../driver/DriverQRScreen';
import { DriverPaymentSuccess } from '../driver/DriverPaymentSuccess';
import { DriverHistory } from '../driver/DriverHistory';
import { DriverLostItems } from '../driver/DriverLostItems';
import { CommuterConfirmRide } from '../commuter/CommuterConfirmRide';
import { CommuterPaymentSuccess } from '../commuter/CommuterPaymentSuccess';
import { GuestQRPhPayment } from '../guest/GuestQRPhPayment';
import { playPaymentChime } from '../../utils/audio';

export const DualScreenSimulator: React.FC = () => {
  // Driver state
  const [driverState, setDriverState] = useState<'fare' | 'qr' | 'success' | 'history' | 'lostItems'>('fare');
  const [currentFare, setCurrentFare] = useState<number>(30);
  const [isCustom, setIsCustom] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  // Commuter state
  const [commuterMode, setCommuterMode] = useState<'app' | 'guest'>('app');
  const [commuterState, setCommuterState] = useState<'idle' | 'confirm' | 'success'>('idle');

  const driverProfile = {
    driver_id: 'DR-000481',
    user_id: 'USR-DRV-001',
    name: 'Juan Dela Cruz',
    mobile_number: '09171234567',
    verification_status: 'verified' as const,
    toda_operator: 'Tagum Poblacion TODA',
    assigned_vehicle_id: 'TR-01842',
    shift_status: 'active' as const,
    license_number: 'N02-14-098765',
    created_at: new Date().toISOString()
  };

  const shiftData = {
    shift_id: 'SHIFT-2026-001',
    driver_id: 'DR-000481',
    vehicle_id: 'TR-01842',
    start_time: new Date().toISOString(),
    end_time: null,
    status: 'active' as const,
    digital_rides_count: 18,
    digital_gross_total: 620,
    provider_platform_fees: 10.85,
    digital_net_total: 609.15,
    cash_rides_count: 12,
    cash_gross_total: 360
  };

  const handleGeneratePaymentQR = (amount: number, custom: boolean) => {
    setCurrentFare(amount);
    setIsCustom(custom);
    setDriverState('qr');
    setCommuterState('confirm');
  };

  const handlePaymentConfirmed = (payment: any) => {
    setPaymentResult(payment);
    setDriverState('success');
    setCommuterState('success');
    playPaymentChime();
  };

  return (
    <div className="min-h-full bg-slate-950 p-6 text-white flex flex-col items-center">
      {/* Simulation Banner */}
      <div className="max-w-5xl w-full mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-white text-base">Live Interactive Ecosystem Simulator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Test the end-to-end QR Ph payment flow live. Tap a fare on the Driver terminal, then pay on the passenger device!
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Right Device Mode:</span>
          <button
            onClick={() => setCommuterMode('app')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${commuterMode === 'app' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            TalaRide App User
          </button>
          <button
            onClick={() => setCommuterMode('guest')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${commuterMode === 'guest' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            Guest E-Wallet (GCash)
          </button>
        </div>
      </div>

      {/* Dual Phone Frames */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* LEFT PHONE: DRIVER */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Driver Phone (Mounted on Tricycle)</span>
          </div>

          <div className="w-[360px] h-[680px] bg-black rounded-[42px] border-8 border-slate-800 shadow-2xl overflow-hidden relative flex flex-col">
            {/* Notch / Speaker */}
            <div className="w-32 h-4.5 bg-slate-800 rounded-b-xl mx-auto z-40 mb-1" />

            <div className="flex-1 overflow-y-auto">
              {driverState === 'fare' && (
                <DriverMainFare
                  driver={driverProfile}
                  shift={shiftData}
                  onGeneratePaymentQR={handleGeneratePaymentQR}
                  onCashRideRecorded={() => alert('Cash ride recorded in driver shift!')}
                  onViewHistory={() => setDriverState('history')}
                  onViewLostItems={() => setDriverState('lostItems')}
                  onEndShift={() => alert('Shift ended')}
                />
              )}

              {driverState === 'qr' && (
                <DriverQRScreen
                  driverId={driverProfile.driver_id}
                  vehicleId={driverProfile.assigned_vehicle_id || 'TR-01842'}
                  fareAmount={currentFare}
                  isCustom={isCustom}
                  onPaymentSuccess={handlePaymentConfirmed}
                  onCancel={() => {
                    setDriverState('fare');
                    setCommuterState('idle');
                  }}
                  onSwitchToCash={() => {
                    setDriverState('fare');
                    setCommuterState('idle');
                    alert('Switched to cash payment');
                  }}
                />
              )}

              {driverState === 'success' && (
                <DriverPaymentSuccess
                  payment={paymentResult || { amount: currentFare, vehicle_id: 'TR-01842' }}
                  onNextPassenger={() => {
                    setDriverState('fare');
                    setCommuterState('idle');
                  }}
                />
              )}

              {driverState === 'history' && (
                <DriverHistory
                  driver={driverProfile}
                  onBack={() => setDriverState('fare')}
                />
              )}

              {driverState === 'lostItems' && (
                <DriverLostItems
                  driver={driverProfile}
                  onBack={() => setDriverState('fare')}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PHONE: COMMUTER / GUEST */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span>
              {commuterMode === 'app' ? 'Commuter Phone (TalaRide App)' : "Guest Phone (GCash / Maya Scan)"}
            </span>
          </div>

          <div className="w-[360px] h-[680px] bg-slate-900 rounded-[42px] border-8 border-slate-800 shadow-2xl overflow-hidden relative flex flex-col">
            {/* Notch / Speaker */}
            <div className="w-32 h-4.5 bg-slate-800 rounded-b-xl mx-auto z-40 mb-1" />

            <div className="flex-1 overflow-y-auto">
              {commuterMode === 'app' ? (
                <>
                  {commuterState === 'idle' && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                        <Smartphone className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-white text-base">Waiting for Driver QR</h3>
                        <p className="text-xs text-slate-400">
                          Tap a fare on the Driver phone on the left (e.g. ₱30) to generate the payment QR.
                        </p>
                      </div>
                      <button
                        onClick={() => handleGeneratePaymentQR(30, false)}
                        className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                      >
                        Auto-Request ₱30 Fare
                      </button>
                    </div>
                  )}

                  {commuterState === 'confirm' && (
                    <CommuterConfirmRide
                      scanData={{
                        vehicleId: 'TR-01842',
                        driverName: 'Juan Dela Cruz',
                        amount: currentFare,
                        paymentId: 'PAY-2026-1003-01'
                      }}
                      onCancel={() => {
                        setCommuterState('idle');
                        setDriverState('fare');
                      }}
                      onPaymentSuccess={handlePaymentConfirmed}
                    />
                  )}

                  {commuterState === 'success' && (
                    <CommuterPaymentSuccess
                      paymentResult={paymentResult || { ride: { vehicle_id: 'TR-01842', fare_amount: currentFare } }}
                      onDone={() => {
                        setCommuterState('idle');
                        setDriverState('fare');
                      }}
                      onViewHistory={() => {
                        setCommuterState('idle');
                        setDriverState('fare');
                      }}
                    />
                  )}
                </>
              ) : (
                /* Guest E-Wallet Mode */
                <GuestQRPhPayment
                  fareAmount={currentFare}
                  vehicleId="TR-01842"
                  driverName="Juan Dela Cruz"
                  onPaymentSuccess={() => {
                    handlePaymentConfirmed({ amount: currentFare, vehicle_id: 'TR-01842' });
                  }}
                  onOpenCommuterApp={() => setCommuterMode('app')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
