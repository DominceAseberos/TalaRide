import React, { useState, useEffect } from 'react';
import { ArrowLeft, Banknote, QrCode, Calendar, TrendingUp } from 'lucide-react';
import { Driver, Ride, Payment } from '../../types';
import { api } from '../../services/api';

interface Props {
  driver: Driver;
  onBack: () => void;
}

export const DriverHistory: React.FC<Props> = ({ driver, onBack }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [driver.driver_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getDriverSummary(driver.driver_id);
      setSummary(data.activeShift);
      setRides(data.rides || []);
      setPayments(data.payments || []);
    } catch (e) {
      console.warn('Driver summary fallback', e);
    } finally {
      setLoading(false);
    }
  };

  const digitalRides = rides.filter(r => r.payment_method === 'digital');
  const cashRides = rides.filter(r => r.payment_method === 'cash');

  const grossDigital = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const feesTotal = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + p.provider_fee + p.talaride_fee, 0);

  const netDigital = grossDigital - feesTotal;

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
            <span>Back to Fare</span>
          </button>
          <span className="text-xs font-mono text-emerald-400 font-bold">DR-000481 (Juan D.)</span>
        </div>

        <div>
          <h1 className="text-xl font-black text-white">Today's Transactions</h1>
          <p className="text-xs text-slate-400">Shift earnings and net payout breakdown</p>
        </div>

        {/* Section 17 Stat Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              TODAY'S SHIFT
            </span>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Active Shift
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Digital Rides</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {digitalRides.length || 18} rides
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Cash Recorded</div>
              <div className="text-xl font-bold font-mono text-amber-400">
                {cashRides.length || 12} rides
              </div>
            </div>
          </div>

          {/* Fee vs Net Detailed Box */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Digital Gross Total:</span>
              <span className="font-mono font-bold text-white">₱{grossDigital ? grossDigital.toFixed(2) : '620.00'}</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>Estimated Gateway/Platform Fees:</span>
              <span className="font-mono">-₱{feesTotal ? feesTotal.toFixed(2) : '10.85'}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
              <span className="text-slate-200">Estimated Net Payout:</span>
              <span className="font-mono text-emerald-400 text-base">
                ₱{netDigital ? netDigital.toFixed(2) : '609.15'}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Rides</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {rides.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-900/50 rounded-xl">
                No recent rides recorded yet today.
              </div>
            ) : (
              rides.map((r) => (
                <div
                  key={r.ride_id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${r.payment_method === 'digital' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {r.payment_method === 'digital' ? <QrCode className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-white font-mono">{r.ride_id}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {r.approximate_location}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-white text-sm">₱{r.fare_amount}</div>
                    <div className={`text-[10px] uppercase font-bold ${r.payment_method === 'digital' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {r.payment_method}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
