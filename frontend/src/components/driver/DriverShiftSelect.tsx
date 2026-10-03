import React, { useState, useEffect } from 'react';
import { Bike, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { Vehicle, Driver } from '../../types';
import { api } from '../../services/api';

interface Props {
  driver: Driver;
  onShiftStarted: (shiftData: any) => void;
}

export const DriverShiftSelect: React.FC<Props> = ({ driver, onShiftStarted }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('TR-01842');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
      if (driver.assigned_vehicle_id) {
        setSelectedVehicleId(driver.assigned_vehicle_id);
      } else if (data.length > 0) {
        setSelectedVehicleId(data[0].vehicle_id);
      }
    } catch (e) {
      console.warn('Vehicle list fallback', e);
      setVehicles([
        {
          vehicle_id: 'TR-01842',
          plate_body_number: 'TAG-842',
          toda: 'Tagum Poblacion TODA',
          status: 'active',
          assigned_driver_id: driver.driver_id,
          qr_code_payload: 'TALARIDE:VEHICLE:TR-01842',
          created_at: new Date().toISOString()
        },
        {
          vehicle_id: 'TR-00421',
          plate_body_number: 'TAG-421',
          toda: 'Magsaysay TODA',
          status: 'active',
          assigned_driver_id: null,
          qr_code_payload: 'TALARIDE:VEHICLE:TR-00421',
          created_at: new Date().toISOString()
        }
      ]);
    }
  };

  const handleStartShift = async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.startShift(driver.driver_id, selectedVehicleId);
      if (res.success) {
        onShiftStarted(res);
      } else {
        setError(res.error || 'Failed to start shift');
      }
    } catch (err: any) {
      setError(err.message || 'Error starting shift');
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId);

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-900 text-white">
      {/* Top Driver Badge */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Driver ID</span>
            <h2 className="text-xl font-mono font-bold text-emerald-400">{driver.driver_id}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-300 font-semibold">{driver.name}</span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 justify-end">
              <Shield className="w-3 h-3" />
              <span>Verified Operator</span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white mb-1">Select Your Tricycle</h1>
          <p className="text-xs text-slate-400">
            Drivers and vehicles are treated separately. Select the unit you are operating today.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950 border border-rose-800 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Vehicles list */}
        <div className="space-y-3">
          {vehicles.map((v) => {
            const isSelected = v.vehicle_id === selectedVehicleId;
            return (
              <div
                key={v.vehicle_id}
                onClick={() => setSelectedVehicleId(v.vehicle_id)}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg text-white">{v.vehicle_id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 font-mono">
                        Body #{v.plate_body_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{v.toda}</p>
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
                )}
              </div>
            );
          })}
        </div>

        {selectedVehicle && (
          <div className="p-3.5 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1 text-xs">
            <div className="text-slate-400">Assignment Check:</div>
            <div className="font-medium text-slate-200">
              Driver <strong className="text-emerald-400">{driver.driver_id}</strong> is starting shift with unit <strong className="text-emerald-400">{selectedVehicle.vehicle_id}</strong> ({selectedVehicle.toda}).
            </div>
          </div>
        )}
      </div>

      {/* Start Shift CTA */}
      <div className="pt-6">
        <button
          onClick={handleStartShift}
          disabled={loading || !selectedVehicleId}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-black text-lg rounded-2xl transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{loading ? 'Starting Shift...' : 'START SHIFT'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
