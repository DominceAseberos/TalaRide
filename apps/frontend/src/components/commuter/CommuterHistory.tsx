import React, { useState, useEffect } from 'react';
import { QrCode, Banknote, Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { Ride } from '../../types';
import { api } from '../../services/api';

interface Props {
  onSelectRide: (ride: Ride) => void;
  onBack?: () => void;
}

export const CommuterHistory: React.FC<Props> = ({ onSelectRide, onBack }) => {
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadRides() {
      try {
        const data = await api.getRides({ passengerId: 'USR-COM-001' });
        if (mounted) setRides(data);
      } catch (e) {
        console.warn('Rides fetch fallback', e);
      }
    }
    loadRides();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-black text-slate-900">Ride History</h1>
          </div>
          <span className="text-xs text-slate-500 font-mono">{rides.length} trips</span>
        </div>

        <p className="text-xs text-slate-500">
          Complete log of digital trips and voluntary cash safety check-ins. Tap any ride to view details or report lost items.
        </p>

        {/* Section 12 Rides List */}
        <div className="space-y-2.5">
          {rides.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
              <Shield className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Rides Recorded Yet</div>
              <p className="text-xs text-slate-400">
                Your future digital payments and cash safety check-ins will appear here.
              </p>
            </div>
          ) : (
            rides.map((ride) => {
              const isDigital = ride.payment_method === 'digital';
              const dateObj = new Date(ride.timestamp);
              const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={ride.ride_id}
                  onClick={() => onSelectRide(ride)}
                  className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-xs transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${isDigital ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {isDigital ? <QrCode className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          {formattedDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-black text-base text-slate-900">{ride.vehicle_id}</span>
                        <span className="text-xs text-slate-500 font-mono">• {formattedTime}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Driver: {ride.driver_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-black text-base text-slate-900">
                      ₱{ride.fare_amount || (isDigital ? 30 : 25)}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDigital ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {isDigital ? 'Digital' : 'Cash / Check-In'}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
