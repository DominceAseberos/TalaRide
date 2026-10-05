import React, { useState, useEffect } from 'react';
import {
  Home,
  QrCode,
  Clock,
  Award,
  User
} from 'lucide-react';

import { PublicVehiclePage } from './components/public/PublicVehiclePage';
import { PaymentReturnPage } from './components/public/PaymentReturnPage';

// Commuter Components
import { CommuterHome } from './components/commuter/CommuterHome';
import { CommuterScanner } from './components/commuter/CommuterScanner';
import { CommuterConfirmRide } from './components/commuter/CommuterConfirmRide';
import { CommuterPaymentSuccess } from './components/commuter/CommuterPaymentSuccess';
import { CommuterHistory } from './components/commuter/CommuterHistory';
import { CommuterRideDetails } from './components/commuter/CommuterRideDetails';
import { CommuterLostItemForm } from './components/commuter/CommuterLostItemForm';
import { CommuterRewards } from './components/commuter/CommuterRewards';
import { CommuterAccount } from './components/commuter/CommuterAccount';
import { SafetyCheckInModal } from './components/commuter/SafetyCheckInModal';

// Driver Components
import { DriverLogin } from './components/driver/DriverLogin';
import { DriverShiftSelect } from './components/driver/DriverShiftSelect';
import { DriverMainFare } from './components/driver/DriverMainFare';
import { DriverQRScreen } from './components/driver/DriverQRScreen';
import { DriverPaymentSuccess } from './components/driver/DriverPaymentSuccess';
import { DriverHistory } from './components/driver/DriverHistory';
import { DriverLostItems } from './components/driver/DriverLostItems';

// Guest & Admin Components
import { GuestQRPhPayment } from './components/guest/GuestQRPhPayment';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DualScreenSimulator } from './components/simulator/DualScreenSimulator';

import { Ride, Driver } from './types';
import { api, connectSSE } from './services/api';
import { playAlertChime } from './utils/audio';

const SEED_TIMESTAMP = '2026-10-01T08:00:00.000Z';

type ActivePortal = 'commuter' | 'driver' | 'guest' | 'admin' | 'simulator';

export function App() {
  const [activePortal, setActivePortal] = useState<ActivePortal>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/simulator') return 'simulator';
      if (path === '/admin') return 'admin';
      if (path === '/driver') return 'driver';
      if (path === '/guest') return 'guest';
    }
    return 'commuter';
  });

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const currentSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isVehiclePublic = currentPath.startsWith('/v/');
  const isPaymentSuccessReturn = currentPath === '/success';
  const isPaymentCancelReturn = currentPath === '/cancel';
  const returnPaymentId = currentSearch.get('payment_id') || '';
  const publicVehicleCode = isVehiclePublic ? currentPath.replace(/^\/v\//, '').split('/')[0] : '';
  const publicChecksum = currentSearch.get('c') || '';

  // Commuter State
  const [commuterTab, setCommuterTab] = useState<'home' | 'scan' | 'history' | 'rewards' | 'account'>('home');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [commuterPaymentSuccess, setCommuterPaymentSuccess] = useState<any>(null);
  const [reportingLostItemForRide, setReportingLostItemForRide] = useState<Ride | null>(null);
  const [safetyCheckInVehicle, setSafetyCheckInVehicle] = useState<any>(null);
  const [recentRide, setRecentRide] = useState<Ride | null>(null);

  // Driver State
  const [driver, setDriver] = useState<Driver | null>({
    driver_id: 'DR-000481',
    user_id: 'USR-DRV-001',
    name: 'Juan Dela Cruz',
    mobile_number: '09171234567',
    verification_status: 'verified',
    toda_operator: 'Tagum Poblacion TODA',
    assigned_vehicle_id: 'TR-01842',
    shift_status: 'active',
    license_number: 'N02-14-098765',
    created_at: SEED_TIMESTAMP
  });

  const [driverShift, setDriverShift] = useState<any>({
    shift_id: 'SHIFT-2026-001',
    driver_id: 'DR-000481',
    vehicle_id: 'TR-01842',
    start_time: SEED_TIMESTAMP,
    end_time: null,
    status: 'active',
    digital_rides_count: 18,
    digital_gross_total: 620,
    provider_platform_fees: 10.85,
    digital_net_total: 609.15,
    cash_rides_count: 12,
    cash_gross_total: 360
  });

  const [driverScreen, setDriverScreen] = useState<'login' | 'shift_select' | 'fare' | 'qr' | 'success' | 'history' | 'lost_items'>('fare');
  const [activeFareAmount, setActiveFareAmount] = useState<number>(30);
  const [isCustomFare, setIsCustomFare] = useState(false);
  const [driverPaymentSuccess, setDriverPaymentSuccess] = useState<any>(null);

  // Initialize data & SSE Listener
  useEffect(() => {
    // Load recent ride for Maria Santos
    api.getRides({ passengerId: 'USR-COM-001' }).then((rides) => {
      if (rides && rides.length > 0) {
        setRecentRide(rides[0]);
      }
    }).catch(console.warn);

    // Global SSE connect
    const cleanup = connectSSE({
      driverId: driver?.driver_id,
      onLostItemReported: (item) => {
        playAlertChime();
        console.log('Lost item reported for driver:', item);
      }
    });

    return () => cleanup();
  }, [driver?.driver_id]);

  // Commuter Scan Handlers
  const handleCommuterScanned = (result: { type: 'payment' | 'vehicle_sticker'; data: any }) => {
    setIsScanning(false);
    if (result.type === 'payment') {
      setScanResult(result.data);
    } else {
      setSafetyCheckInVehicle(result.data);
    }
  };

  const handleCommuterPaymentConfirmed = (res: any) => {
    setScanResult(null);
    setCommuterPaymentSuccess(res);
    if (res.ride) {
      setRecentRide(res.ride);
    }
  };

  if (isPaymentSuccessReturn || isPaymentCancelReturn) {
    return (
      <PaymentReturnPage
        paymentId={returnPaymentId}
        cancelled={isPaymentCancelReturn}
      />
    );
  }

  if (isVehiclePublic) {
    return (
      <PublicVehiclePage
        vehicleCode={publicVehicleCode}
        checksum={publicChecksum}
        onGoHome={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFEF9] text-[#101A20] flex flex-col font-sans">
      {/* Role portals are route-driven. The production UI intentionally has no visible role switcher. */}

      {/* Main Dynamic Viewport */}
      <main className="flex-1 flex justify-center items-stretch p-0 overflow-hidden">
        {/* VIEW 1: COMMUTER APP */}
        {activePortal === 'commuter' && (
          <div className="w-full min-h-[100dvh] bg-[#FFFEF9] overflow-hidden flex flex-col relative">
            {/* Phone Screen Container */}
            <div className="flex-1 overflow-y-auto">
              {isScanning ? (
                <CommuterScanner
                  onBack={() => setIsScanning(false)}
                  onScanned={handleCommuterScanned}
                />
              ) : scanResult ? (
                <CommuterConfirmRide
                  scanData={scanResult}
                  onCancel={() => setScanResult(null)}
                  onPaymentSuccess={handleCommuterPaymentConfirmed}
                />
              ) : commuterPaymentSuccess ? (
                <CommuterPaymentSuccess
                  paymentResult={commuterPaymentSuccess}
                  onDone={() => setCommuterPaymentSuccess(null)}
                  onViewHistory={() => {
                    setCommuterPaymentSuccess(null);
                    setCommuterTab('history');
                  }}
                />
              ) : reportingLostItemForRide ? (
                <CommuterLostItemForm
                  ride={reportingLostItemForRide}
                  onBack={() => setReportingLostItemForRide(null)}
                  onSubmitSuccess={() => setReportingLostItemForRide(null)}
                />
              ) : selectedRide ? (
                <CommuterRideDetails
                  ride={selectedRide}
                  onBack={() => setSelectedRide(null)}
                  onReportLostItem={() => {
                    setReportingLostItemForRide(selectedRide);
                    setSelectedRide(null);
                  }}
                />
              ) : (
                <>
                  {commuterTab === 'home' && (
                    <CommuterHome
                      onScanRide={() => setIsScanning(true)}
                      onOpenSafetyCheckIn={() =>
                        setSafetyCheckInVehicle({
                          vehicleId: 'TR-01842',
                          driverName: 'Juan Dela Cruz',
                          toda: 'Tagum Poblacion TODA'
                        })
                      }
                      onViewHistory={() => setCommuterTab('history')}
                      onViewRewards={() => setCommuterTab('rewards')}
                      onSelectRide={(r) => setSelectedRide(r)}
                      recentRide={recentRide}
                    />
                  )}

                  {commuterTab === 'history' && (
                    <CommuterHistory
                      onSelectRide={(r) => setSelectedRide(r)}
                    />
                  )}

                  {commuterTab === 'rewards' && (
                    <CommuterRewards />
                  )}

                  {commuterTab === 'account' && (
                    <CommuterAccount />
                  )}
                </>
              )}
            </div>

            {/* Bottom Navigation (Section 12: Home | Scan | History | Rewards | Account) */}
            {!isScanning && !scanResult && !commuterPaymentSuccess && !selectedRide && !reportingLostItemForRide && (
              <nav className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around z-30">
                <button
                  onClick={() => setCommuterTab('home')}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
                    commuterTab === 'home' ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </button>

                <button
                  onClick={() => setIsScanning(true)}
                  className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-emerald-600 -mt-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span>Scan</span>
                </button>

                <button
                  onClick={() => setCommuterTab('history')}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
                    commuterTab === 'history' ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>History</span>
                </button>

                <button
                  onClick={() => setCommuterTab('rewards')}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
                    commuterTab === 'rewards' ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  <Award className="w-5 h-5" />
                  <span>Rewards</span>
                </button>

                <button
                  onClick={() => setCommuterTab('account')}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
                    commuterTab === 'account' ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span>Account</span>
                </button>
              </nav>
            )}

            {/* Safety Check-In Modal */}
            <SafetyCheckInModal
              isOpen={Boolean(safetyCheckInVehicle)}
              vehicleData={safetyCheckInVehicle}
              onClose={() => setSafetyCheckInVehicle(null)}
              onSaved={(newRide) => {
                setSafetyCheckInVehicle(null);
                setRecentRide(newRide);
                setCommuterTab('history');
              }}
            />
          </div>
        )}

        {/* VIEW 2: DRIVER APP */}
        {activePortal === 'driver' && (
          <div className="w-full min-h-[100dvh] bg-[#FFFEF9] overflow-hidden flex flex-col relative">
            <div className="flex-1 overflow-y-auto">
              {!driver || driverScreen === 'login' ? (
                <DriverLogin
                  onLoginSuccess={(d) => {
                    setDriver(d);
                    setDriverScreen(d.assigned_vehicle_id ? 'fare' : 'shift_select');
                  }}
                />
              ) : driverScreen === 'shift_select' ? (
                <DriverShiftSelect
                  driver={driver}
                  onShiftStarted={(res) => {
                    setDriver(res.driver);
                    setDriverShift(res.shift);
                    setDriverScreen('fare');
                  }}
                />
              ) : driverScreen === 'fare' ? (
                <DriverMainFare
                  driver={driver}
                  shift={driverShift}
                  onGeneratePaymentQR={(amount, custom) => {
                    setActiveFareAmount(amount);
                    setIsCustomFare(custom);
                    setDriverScreen('qr');
                  }}
                  onCashRideRecorded={(r) => {
                    alert(`Cash ride recorded for ₱${r.fare_amount}! Shift trip count updated.`);
                  }}
                  onViewHistory={() => setDriverScreen('history')}
                  onViewLostItems={() => setDriverScreen('lost_items')}
                  onEndShift={() => {
                    setDriverScreen('shift_select');
                  }}
                />
              ) : driverScreen === 'qr' ? (
                <DriverQRScreen
                  driverId={driver.driver_id}
                  vehicleId={driver.assigned_vehicle_id || 'TR-01842'}
                  fareAmount={activeFareAmount}
                  isCustom={isCustomFare}
                  onPaymentSuccess={(p) => {
                    setDriverPaymentSuccess(p);
                    setDriverScreen('success');
                  }}
                  onCancel={() => setDriverScreen('fare')}
                  onSwitchToCash={() => setDriverScreen('fare')}
                />
              ) : driverScreen === 'success' ? (
                <DriverPaymentSuccess
                  payment={driverPaymentSuccess}
                  onNextPassenger={() => setDriverScreen('fare')}
                />
              ) : driverScreen === 'history' ? (
                <DriverHistory
                  driver={driver}
                  onBack={() => setDriverScreen('fare')}
                />
              ) : (
                <DriverLostItems
                  driver={driver}
                  onBack={() => setDriverScreen('fare')}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: GUEST QR PH CHECKOUT */}
        {activePortal === 'guest' && (
          <div className="w-full min-h-[100dvh] bg-[#FFFEF9] overflow-hidden flex flex-col relative">
            <GuestQRPhPayment
              fareAmount={Number(currentSearch.get('amount')) || activeFareAmount || 30}
              vehicleId={currentSearch.get('vehicle') || driver?.assigned_vehicle_id || 'TR-01842'}
              driverId={currentSearch.get('driver_id') || driver?.driver_id || 'DR-000481'}
              driverName={currentSearch.get('driver_name') || driver?.name || 'Juan Dela Cruz'}
              paymentId={currentSearch.get('payment_id') || undefined}
              onOpenCommuterApp={() => setActivePortal('commuter')}
            />
          </div>
        )}

        {/* VIEW 4: ADMIN OPERATIONS PORTAL */}
        {activePortal === 'admin' && (
          <div className="w-full h-full">
            <AdminDashboard />
          </div>
        )}

        {/* VIEW 5: DUAL SCREEN SIMULATOR */}
        {activePortal === 'simulator' && (
          <div className="w-full h-full">
            <DualScreenSimulator />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
