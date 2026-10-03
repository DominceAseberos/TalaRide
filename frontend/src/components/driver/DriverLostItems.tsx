import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, CheckCircle, XCircle, HelpCircle, Shield, AlertTriangle } from 'lucide-react';
import { Driver, LostItemReport } from '../../types';
import { api } from '../../services/api';

interface Props {
  driver: Driver;
  onBack: () => void;
}

export const DriverLostItems: React.FC<Props> = ({ driver, onBack }) => {
  const [reports, setReports] = useState<LostItemReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [driver.driver_id]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.getLostItems({ driverId: driver.driver_id });
      setReports(data);
    } catch (e) {
      console.warn('Lost item fetch fallback', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDriverResponse = async (reportId: string, response: 'found' | 'not_found' | 'contact_support') => {
    setRespondingId(reportId);
    try {
      await api.respondToLostItem(reportId, response, `Driver responded: ${response}`);
      await loadReports();
    } catch (e) {
      console.error('Failed to submit response', e);
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-950 text-white select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-xs font-mono text-emerald-400 font-bold">{driver.driver_id}</span>
        </div>

        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Lost Item Notifications
          </h1>
          <p className="text-xs text-slate-400">
            Mediated lost-item recovery for your assigned rides. Phone numbers are protected.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
            <Shield className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="font-bold text-sm text-slate-200">No Active Lost Item Reports</div>
            <p className="text-xs text-slate-400">
              When a passenger reports a forgotten wallet, phone, or bag from your shift, you will receive an alert here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((item) => {
              const isPending = !item.driver_response || item.status === 'driver_notified';
              return (
                <div
                  key={item.report_id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {item.report_id}
                      </span>
                      <h4 className="font-bold text-white text-sm capitalize mt-1">
                        Category: {item.item_category}
                      </h4>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      item.status === 'found'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : item.status === 'unresolved'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-300 animate-pulse'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="text-[11px] text-slate-400">Passenger Description:</div>
                    <p className="font-medium text-white italic">"{item.description}"</p>
                    <div className="text-[10px] text-slate-500 pt-1 font-mono">
                      Ride ID: {item.ride_id} • Unit: {item.vehicle_id}
                    </div>
                  </div>

                  {/* Section 14 Response buttons */}
                  {isPending ? (
                    <div className="pt-1 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-300">Did you find this item in your tricycle?</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleDriverResponse(item.report_id, 'found')}
                          disabled={respondingId === item.report_id}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>I Found It</span>
                        </button>

                        <button
                          onClick={() => handleDriverResponse(item.report_id, 'not_found')}
                          disabled={respondingId === item.report_id}
                          className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 border border-slate-700"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Not Found</span>
                        </button>

                        <button
                          onClick={() => handleDriverResponse(item.report_id, 'contact_support')}
                          disabled={respondingId === item.report_id}
                          className="py-2.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 border border-amber-500/30"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Support</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-800/80 rounded-xl text-xs flex items-center justify-between text-slate-300">
                      <span>Driver Response Recorded:</span>
                      <span className="font-bold text-emerald-400 uppercase">
                        {item.driver_response?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4">
        <button
          onClick={onBack}
          className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm"
        >
          Return to Fare Screen
        </button>
      </div>
    </div>
  );
};
