import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Building2, User, Car, Clock, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';

interface PublicVehicleData {
  vehicle_code: string;
  plate_body_number: string;
  toda: string;
  status: string;
  shift_status: string;
  driver_name: string;
  error?: string;
  message?: string;
}

interface Props {
  vehicleCode: string;
  checksum: string;
  onGoHome?: () => void;
}

export const PublicVehiclePage: React.FC<Props> = ({ vehicleCode, checksum, onGoHome }) => {
  const [data, setData] = useState<PublicVehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    api.getPublicVehicle(vehicleCode, checksum)
      .then((res) => {
        if (!ignore) {
          if (res.error || res.message) {
            setErrorMessage(res.message || 'Vehicle QR could not be verified');
          } else {
            setData(res);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.message || 'Unable to connect to TalaRide verification service');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [vehicleCode, checksum]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 select-none">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-base">
              TR
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white">TALARIDE</h1>
              <p className="text-[10px] uppercase font-bold text-slate-400">Public Vehicle Registry</p>
            </div>
          </div>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Portal
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Verifying vehicle credentials...</p>
          </div>
        )}

        {/* Error / Invalid QR State */}
        {!loading && errorMessage && (
          <div className="bg-rose-950/40 border border-rose-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-rose-200">Verification Failed</h2>
              <p className="text-xs text-rose-300 font-medium">{errorMessage}</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-rose-900/60">
              This QR code signature could not be verified against the official TalaRide registry. For your safety, do not make payments to unauthorized vehicle codes.
            </p>
          </div>
        )}

        {/* Verified Vehicle Details Card */}
        {!loading && data && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Verified Tricycle
                </div>
                <span className="font-mono text-xs text-slate-500">{data.vehicle_code}</span>
              </div>

              <div className="text-center py-2 space-y-1">
                <div className="text-3xl font-black tracking-tight text-white font-mono">
                  {data.vehicle_code}
                </div>
                <div className="text-xs font-semibold text-slate-400">
                  Body #{data.plate_body_number}
                </div>
              </div>

              {/* Vehicle Attributes */}
              <div className="bg-slate-950/80 rounded-2xl p-4 divide-y divide-slate-800/80 border border-slate-800 text-xs space-y-3">
                <div className="flex items-center justify-between pb-3 pt-1">
                  <span className="text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    Authorized Driver
                  </span>
                  <span className="font-bold text-white text-sm">{data.driver_name}</span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    Franchise / TODA
                  </span>
                  <span className="font-semibold text-slate-200 text-right max-w-[200px]">
                    {data.toda}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-500" />
                    Registry Status
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                    {data.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 pb-1">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Current Shift
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                      data.shift_status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {data.shift_status}
                  </span>
                </div>
              </div>

              {/* Safe Privacy Notice */}
              <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                Driver full identity, license details, and personal mobile contact are protected under RA 10173 (Data Privacy Act of 2012).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto pt-6 text-center text-[10px] text-slate-500">
        TalaRide City Transport Digital Infrastructure • Tagum City, Philippines
      </div>
    </div>
  );
};
