import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  HelpCircle,
  Search,
  Printer,
  Plus,
  RefreshCw
} from 'lucide-react';
import { VehicleSticker } from '../common/VehicleSticker';
import { Driver, Vehicle, Payment, LostItemReport, PaymentIssueTicket, FareConfiguration } from '../../types';
import { api } from '../../services/api';

interface Props {
  operatorName?: string;
  todaName?: string;
  onSignOut?: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ operatorName = 'TalaRide Operator', todaName = 'Tagum City TODA', onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'vehicles' | 'transactions' | 'lostItems' | 'issues' | 'fares'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [transactions, setTransactions] = useState<Payment[]>([]);
  const [lostItems, setLostItems] = useState<LostItemReport[]>([]);
  const [paymentIssues, setPaymentIssues] = useState<PaymentIssueTicket[]>([]);
  const [fareConfig, setFareConfig] = useState<FareConfiguration | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // New Driver Form state
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverMobile, setNewDriverMobile] = useState('');
  const [newDriverToda, setNewDriverToda] = useState('Tagum Poblacion TODA');

  // New Vehicle Form state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newVehicleBody, setNewVehicleBody] = useState('');
  const [newVehicleToda, setNewVehicleToda] = useState('Tagum Poblacion TODA');

  // Printable sticker modal
  const [stickerVehicle, setStickerVehicle] = useState<Vehicle | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [ov, drvs, vehs, txs, items, issues, fares] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminDrivers(),
        api.getVehicles(),
        api.getAdminTransactions(),
        api.getLostItems(),
        api.getPaymentIssues(),
        api.getFareConfig()
      ]);
      setOverview(ov);
      setDrivers(drvs);
      setVehicles(vehs);
      setTransactions(txs);
      setLostItems(items);
      setPaymentIssues(issues);
      setFareConfig(fares);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load dashboard records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
    setLoadError('');
      try {
        const [ov, drvs, vehs, txs, items, issues, fares] = await Promise.all([
          api.getAdminOverview(),
          api.getAdminDrivers(),
          api.getVehicles(),
          api.getAdminTransactions(),
          api.getLostItems(),
          api.getPaymentIssues(),
          api.getFareConfig()
        ]);
        if (!ignore) {
          setOverview(ov);
          setDrivers(drvs);
          setVehicles(vehs);
          setTransactions(txs);
          setLostItems(items);
          setPaymentIssues(issues);
          setFareConfig(fares);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load dashboard records.');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const handleVerifyDriver = async (driverId: string) => {
    await api.verifyDriver(driverId);
    await loadAllData();
  };

  const handleSuspendDriver = async (driverId: string) => {
    await api.suspendDriver(driverId);
    await loadAllData();
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/admin/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDriverName,
        mobile_number: newDriverMobile,
        toda_operator: newDriverToda
      })
    });
    setShowAddDriver(false);
    setNewDriverName('');
    setNewDriverMobile('');
    await loadAllData();
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.registerVehicle({
      vehicle_id: newVehicleId,
      plate_body_number: newVehicleBody,
      toda: newVehicleToda
    });
    setShowAddVehicle(false);
    setNewVehicleId('');
    setNewVehicleBody('');
    await loadAllData();
  };

  const handleResolveIssue = async (ticketId: string, status: 'resolved' | 'refunded') => {
    await api.resolvePaymentIssue(ticketId, status, 'Approved by TalaRide TODA Admin');
    await loadAllData();
  };

  const _handleUpdateFares = async (faresArray: number[]) => {
    await api.updateFareConfig({ standard_fares: faresArray });
    await loadAllData();
  };

  const filteredTransactions = transactions.filter(t =>
    t.payment_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.vehicle_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.driver_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-100 flex flex-col select-none">
      {/* Admin Top Navigation */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white text-lg">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-white text-lg tracking-tight">TalaRide Ops Portal</h1>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                {todaName}
              </span>
            </div>
            <p className="text-xs text-slate-400">{operatorName} · TODA operations dashboard</p>
          </div>
        </div>

        {/* Tab links */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'drivers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Drivers ({drivers.length})
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'vehicles' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Vehicles ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'transactions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('lostItems')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'lostItems' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Lost Items ({lostItems.length})
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'issues' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Issues ({paymentIssues.length})
          </button>
          <button
            onClick={() => setActiveTab('fares')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'fares' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Fare Config
          </button>
        </div>

        <button
          onClick={loadAllData}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-emerald-500 hover:text-white"
          >
            Sign out
          </button>
        )}
      </div>

      {loadError && <p role="alert" className="m-4 rounded-xl bg-rose-950 p-4 text-rose-100">{loadError}</p>}
      {/* Main Content Area */}
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards (Section 41 MVP Success Criteria) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Drivers on Shift</span>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  {overview?.metrics?.active_drivers_on_shift ?? 0} / {drivers.length}
                </div>
                <div className="text-xs text-slate-500">TODA verified operators</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Digital Adoption</span>
                <div className="text-3xl font-black text-white font-mono">
                  {overview?.metrics?.digital_adoption_pct ?? 0}%
                </div>
                <div className="text-xs text-emerald-400 font-medium">QR Ph vs Cash distribution</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Digital Volume</span>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  ₱{(overview?.metrics?.total_digital_volume_centavos ?? 0) / 100}
                </div>
                <div className="text-xs text-slate-500">
                  Fees collected: ₱{((overview?.metrics?.total_fees_collected_centavos ?? 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmation Speed</span>
                <div className="text-3xl font-black text-amber-400 font-mono">{overview?.metrics?.average_confirmation_speed_seconds ?? "—"}</div>
                <div className="text-xs text-slate-500">From scan to driver chime</div>
              </div>
            </div>

            {/* Quick Status Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lost items ticket queue */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-amber-400" />
                    Lost Item Queue
                  </h3>
                  <button
                    onClick={() => setActiveTab('lostItems')}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {lostItems.slice(0, 3).map((item) => (
                    <div key={item.report_id} className="p-3 bg-slate-900 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white capitalize">{item.item_category}</span>
                        <div className="text-[11px] text-slate-400">{item.vehicle_id} • {item.description}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment issues & disputes */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    Payment Disputes & Refund Tickets
                  </h3>
                  <button
                    onClick={() => setActiveTab('issues')}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {paymentIssues.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">No open dispute tickets</div>
                  ) : (
                    paymentIssues.slice(0, 3).map((t) => (
                      <div key={t.ticket_id} className="p-3 bg-slate-900 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-rose-300 capitalize">{t.issue_type.replace('_', ' ')}</span>
                          <div className="text-[11px] text-slate-400">{t.description}</div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DRIVERS */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Registered Drivers</h2>
                <p className="text-xs text-slate-400">Manage tricycle operators, verification, and active shifts</p>
              </div>
              <button
                onClick={() => window.open('/driver', '_blank', 'noopener,noreferrer')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Driver registration</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="p-4">Driver ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4">TODA / Operator</th>
                    <th className="p-4">Active Unit</th>
                    <th className="p-4">Shift Status</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {drivers.map((d) => (
                    <tr key={d.driver_id} className="hover:bg-slate-900/60">
                      <td className="p-4 font-mono font-bold text-emerald-400">{d.driver_id}</td>
                      <td className="p-4 font-semibold text-white">{d.name}</td>
                      <td className="p-4 font-mono text-slate-400">{d.mobile_number}</td>
                      <td className="p-4 text-slate-300">{d.toda_operator}</td>
                      <td className="p-4 font-mono font-bold text-slate-200">
                        {d.assigned_vehicle_id || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.shift_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {d.shift_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.verification_status === 'verified'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {d.verification_status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {d.verification_status !== 'verified' && (
                          <button
                            onClick={() => handleVerifyDriver(d.driver_id)}
                            className="px-2.5 py-1 bg-emerald-600/40 text-emerald-300 hover:bg-emerald-600/60 rounded text-[11px] font-semibold"
                          >
                            Verify
                          </button>
                        )}
                        {d.verification_status !== 'suspended' && (
                          <button
                            onClick={() => handleSuspendDriver(d.driver_id)}
                            className="px-2.5 py-1 bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 rounded text-[11px] font-semibold"
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: VEHICLES */}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Registered Tricycles</h2>
                <p className="text-xs text-slate-400">
                  Manage tricycle units and generate permanent QR safety stickers
                </p>
              </div>
              <button
                onClick={() => setShowAddVehicle(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Register Tricycle</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div key={v.vehicle_id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase">TalaRide Unit</div>
                      <div className="text-2xl font-black font-mono text-emerald-400">{v.vehicle_id}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 font-mono">
                      Body #{v.plate_body_number}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-300">
                    <div>TODA: <span className="font-semibold text-white">{v.toda}</span></div>
                    <div>
                      Assigned Driver:{' '}
                      <span className="font-semibold text-emerald-300">
                        {v.assigned_driver_name || 'No active driver'}
                      </span>
                    </div>
                  </div>

                  <label className="block text-xs text-slate-300">Assigned driver
                    <select aria-label={`Assign driver to ${v.vehicle_id}`} value={v.assigned_driver_id || ''} className="mt-2 w-full rounded-lg bg-slate-900 p-3" onChange={async e => {
                      if (!e.target.value) return;
                      try { await api.assignVehicleToDriver(e.target.value, v.vehicle_id); await loadAllData(); }
                      catch (failure) { setLoadError(failure instanceof Error ? failure.message : 'Assignment failed.'); }
                    }}>
                      <option value="">Select a verified driver</option>
                      {drivers.filter(d => d.verification_status === 'verified').map(d => <option key={d.driver_id} value={d.driver_id}>{d.name} · {d.driver_id}</option>)}
                    </select>
                  </label>
                  <button
                    onClick={() => setStickerVehicle(v)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Print Permanent Vehicle Sticker</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Digital Transactions & QR Ph Records</h2>
                <p className="text-xs text-slate-400">Search by payment ID, vehicle, or driver</p>
              </div>

              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="p-4">Payment ID</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Driver ID</th>
                    <th className="p-4">Fare</th>
                    <th className="p-4">Gateway Fee</th>
                    <th className="p-4">Net Payout</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredTransactions.map((t) => (
                    <tr key={t.payment_id} className="hover:bg-slate-900/60 font-mono">
                      <td className="p-4 font-bold text-emerald-400">{t.payment_id}</td>
                      <td className="p-4 text-white">{t.vehicle_id}</td>
                      <td className="p-4 text-slate-400">{t.driver_id}</td>
                      <td className="p-4 font-bold text-white">₱{t.amount.toFixed(2)}</td>
                      <td className="p-4 text-rose-400">-₱{t.provider_fee.toFixed(2)}</td>
                      <td className="p-4 font-bold text-emerald-300">₱{t.net_amount.toFixed(2)}</td>
                      <td className="p-4 uppercase text-slate-300">{t.provider}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {t.payment_status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-[11px]">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: LOST ITEMS */}
        {activeTab === 'lostItems' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Lost Item Reports Management</h2>
              <p className="text-xs text-slate-400">Track and mediate lost item claims across TODA operators</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="p-4">Report ID</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Driver ID</th>
                    <th className="p-4">Driver Status</th>
                    <th className="p-4">Report Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {lostItems.map((item) => (
                    <tr key={item.report_id} className="hover:bg-slate-900/60">
                      <td className="p-4 font-mono font-bold text-amber-400">{item.report_id}</td>
                      <td className="p-4 font-mono text-white">{item.vehicle_id}</td>
                      <td className="p-4 capitalize font-semibold text-slate-200">{item.item_category}</td>
                      <td className="p-4 text-slate-300 max-w-xs truncate">{item.description}</td>
                      <td className="p-4 font-mono text-slate-400">{item.driver_id}</td>
                      <td className="p-4 uppercase font-bold text-[11px] text-slate-300">
                        {item.driver_response || 'Pending Response'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'found' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENT ISSUES / REFUND TICKETS */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Payment Issues & Reversals</h2>
              <p className="text-xs text-slate-400">
                Support review for reported double charges, wrong fares, or gateway verification disputes
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="p-4">Ticket ID</th>
                    <th className="p-4">Issue Type</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Reported By</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {paymentIssues.map((issue) => (
                    <tr key={issue.ticket_id} className="hover:bg-slate-900/60">
                      <td className="p-4 font-mono font-bold text-rose-400">{issue.ticket_id}</td>
                      <td className="p-4 font-semibold capitalize text-white">
                        {issue.issue_type.replace(/_/g, ' ')}
                      </td>
                      <td className="p-4 text-slate-300 max-w-sm">{issue.description}</td>
                      <td className="p-4 text-slate-400">{issue.reported_by}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          issue.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : issue.status === 'refunded'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {issue.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResolveIssue(issue.ticket_id, 'resolved')}
                              className="px-2.5 py-1 bg-emerald-600/40 text-emerald-300 hover:bg-emerald-600/60 rounded text-[11px] font-semibold"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleResolveIssue(issue.ticket_id, 'refunded')}
                              className="px-2.5 py-1 bg-blue-600/40 text-blue-300 hover:bg-blue-600/60 rounded text-[11px] font-semibold"
                            >
                              Approve Refund
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: FARE CONFIGURATION */}
        {activeTab === 'fares' && fareConfig && (
          <div className="max-w-xl bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Standard Fare Configuration</h2>
              <p className="text-xs text-slate-400">
                Configure standard quick buttons displayed on Driver app terminals
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Current Quick-Select Buttons (Philippine Peso)
              </label>
              <div className="flex flex-wrap gap-2">
                {fareConfig.standard_fares.map((f) => (
                  <div
                    key={f}
                    className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl font-mono font-bold text-emerald-400 text-lg"
                  >
                    ₱{f}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Payment Provider Fee Schedule:</span>
                <span className="font-mono font-bold text-emerald-400">1.75% QR Ph Interoperable</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>TalaRide Platform Fee (MVP):</span>
                <span className="font-mono font-bold text-emerald-400">₱0.00 (Zero Driver Commission)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Custom Fare Minimum:</span>
                <span className="font-mono text-slate-400">₱15.00</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed">
              Section 29 Notice: TalaRide displays fares entered or configured for participating drivers and operators. TalaRide does not independently determine government-regulated transportation fares.
            </div>
          </div>
        )}
      </div>

      {/* Printable Vehicle Sticker Modal */}
      {stickerVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-900 space-y-4 shadow-2xl text-center">
            <div className="border-4 border-slate-900 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <span className="font-black text-lg tracking-tight">TALARIDE</span>
                <span className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                  OFFICIAL STICKER
                </span>
              </div>

              <VehicleSticker code={stickerVehicle.vehicle_id} url={stickerVehicle.qr_code_payload} />

              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Scan to record this ride
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {stickerVehicle.toda} • Body #{stickerVehicle.plate_body_number}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStickerVehicle(null)}
                className="flex-1 py-3 bg-slate-100 font-semibold text-slate-600 rounded-xl text-xs hover:bg-slate-200"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-emerald-600 font-bold text-white rounded-xl text-xs hover:bg-emerald-700"
              >
                Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Driver Modal */}
      {showAddDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <form onSubmit={handleAddDriver} className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-white shadow-2xl">
            <h3 className="text-lg font-bold text-white">Register New Tricycle Driver</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Driver Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Danilo Mendoza"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="09170001122"
                  value={newDriverMobile}
                  onChange={(e) => setNewDriverMobile(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">TODA Association</label>
                <input
                  type="text"
                  required
                  value={newDriverToda}
                  onChange={(e) => setNewDriverToda(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddDriver(false)}
                className="flex-1 py-3 bg-slate-800 rounded-xl text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Register Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <form onSubmit={handleAddVehicle} className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-white shadow-2xl">
            <h3 className="text-lg font-bold text-white">Register New Tricycle Unit</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">TalaRide Vehicle ID</label>
                <input
                  type="text"
                  required
                  placeholder="TR-03192"
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Plate / Body Number</label>
                <input
                  type="text"
                  required
                  placeholder="TAG-192"
                  value={newVehicleBody}
                  onChange={(e) => setNewVehicleBody(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">TODA Association</label>
                <input
                  type="text"
                  required
                  value={newVehicleToda}
                  onChange={(e) => setNewVehicleToda(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="flex-1 py-3 bg-slate-800 rounded-xl text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white"
              >
                Register Unit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
