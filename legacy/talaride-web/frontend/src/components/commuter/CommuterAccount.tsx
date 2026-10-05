import React, { useState } from 'react';
import { MapPin, FileText, PhoneCall, ChevronRight, Lock } from 'lucide-react';
import { DisclaimersModal } from '../common/DisclaimersModal';

interface Props {
  onLogout?: () => void;
}

export const CommuterAccount: React.FC<Props> = ({ onLogout }) => {
  const [locationAllowed, setLocationAllowed] = useState(true);
  const [showDisclaimers, setShowDisclaimers] = useState(false);

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-xl font-black text-slate-900">Account & Safety</h1>
          <p className="text-xs text-slate-500">Commuter profile and privacy controls</p>
        </div>

        {/* Profile Card */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
              MS
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Maria Santos</h3>
              <p className="text-xs text-slate-500 font-mono">0918-765-4321</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">
            Verified Rider
          </span>
        </div>

        {/* Section 28: Location Permission Explicit Control */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-slate-900">Ride Location Logging</span>
            </div>
            <button
              onClick={() => setLocationAllowed(!locationAllowed)}
              className={`w-12 h-6 rounded-full transition p-1 flex items-center ${
                locationAllowed ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {locationAllowed
              ? 'Permission granted: Approximate area (e.g. Tagum City Commercial Center) is saved when you record rides for safety records.'
              : 'Disabled: Rides will be logged without geolocation coordinates.'}
          </p>
        </div>

        {/* Emergency Assistance Direct Dial (Section 31) */}
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-rose-600" />
              Emergency Assistance (Tagum City)
            </span>
          </div>
          <p className="text-[11px] text-rose-800">
            TalaRide is not an emergency response service. If in immediate danger, contact local authorities:
          </p>
          <div className="flex gap-2 pt-1">
            <a
              href="tel:911"
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl text-center shadow-xs"
            >
              Dial 911
            </a>
            <a
              href="tel:084216911"
              className="flex-1 py-2 bg-white text-rose-700 font-bold text-xs rounded-xl text-center border border-rose-300 shadow-xs"
            >
              Tagum PNP: (084) 216-911
            </a>
          </div>
        </div>

        {/* Legal Disclaimers & Privacy Notice Trigger (Sections 29-38) */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowDisclaimers(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 text-left transition"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Terms, Safety & Payment Disclaimers
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => setShowDisclaimers(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 text-left transition"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Privacy Notice & Data Retention (RA 10173)
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full p-4 flex items-center justify-between hover:bg-red-50 text-left transition text-red-600 border-t border-slate-100"
            >
              <span className="text-xs font-bold">Sign Out</span>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>

      <DisclaimersModal
        isOpen={showDisclaimers}
        onClose={() => setShowDisclaimers(false)}
      />
    </div>
  );
};
