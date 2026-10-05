import React, { useState } from 'react';
import { X, Shield, CheckCircle2, Bike, User, MapPin, Clock } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  vehicleData: any;
  onClose: () => void;
  onSaved: (ride: any) => void;
}

export const SafetyCheckInModal: React.FC<Props> = ({
  isOpen,
  vehicleData,
  onClose,
  onSaved
}) => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  if (!isOpen) return null;

  const vehicleId = vehicleData?.vehicleId || 'TR-01842';
  const driverName = vehicleData?.driverName || 'Juan Dela Cruz';
  const toda = vehicleData?.toda || 'Tagum Poblacion TODA';

  const handleSaveRide = async () => {
    setLoading(true);
    try {
      const res = await api.safetyCheckIn({
        vehicleId,
        passengerId: 'USR-COM-001',
        passengerName: 'Maria Santos',
        approximateLocation: 'Tagum City Commercial Center'
      });
      if (res.success) {
        setSaved(true);
        setTimeout(() => {
          onSaved(res.ride);
        }, 1200);
      }
    } catch (err) {
      console.error('Safety check-in failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-900 space-y-4 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <Shield className="w-4 h-4 text-amber-500" />
            <span>Safety Ride Check-In</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saved ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Ride Recorded!</h3>
            <p className="text-xs text-slate-500">
              Trip logged in your history with assigned driver {driverName}.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-1">
              <div className="p-3 bg-amber-50 rounded-2xl w-14 h-14 mx-auto flex items-center justify-center text-amber-600 mb-1">
                <Bike className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black font-mono text-slate-900">{vehicleId}</h3>
              <p className="text-xs text-slate-500">{toda}</p>
            </div>

            {/* Section 11 Details */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Driver:
                </span>
                <span className="font-bold text-slate-800">{driverName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Area:
                </span>
                <span className="text-slate-700">Tagum City</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Time:
                </span>
                <span className="text-slate-700">{currentTime}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal text-center">
              Paying cash? You don't need digital payment to log your trip and keep a safety record.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-600 text-xs hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRide}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                {loading ? 'Recording...' : 'SAVE RIDE'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
