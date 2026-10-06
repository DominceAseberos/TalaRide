import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  HelpCircle,
  Search,
  Printer,
  Plus
} from 'lucide-react';
import { VehicleSticker } from '../common/VehicleSticker';
import { Driver, Vehicle, Payment, LostItemReport, PaymentIssueTicket, FareConfiguration } from '../../types';
import { api } from '../../services/api';
import { OpsLayout, type OpsSection } from '../ops/OpsLayout';
import { TodaManagement } from './TodaManagement';

interface Props {
  operatorName?: string;
  todaName?: string;
  onSignOut?: () => void;
  canVerify?: boolean;
}

export const AdminDashboard: React.FC<Props> = ({ operatorName = 'TalaRide Admin', todaName = 'TalaRide administration', onSignOut, canVerify = true }) => {
  const [activeTab, setActiveTab] = useState<OpsSection>('overview');
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
  const [verifyingDriver, setVerifyingDriver] = useState<string | null>(null);

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
    if (verifyingDriver) return;
    setVerifyingDriver(driverId); setLoadError('');
    try { await api.verifyDriver(driverId); await loadAllData(); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not approve this driver.'); }
    finally { setVerifyingDriver(null); }
  };

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(() => {
      void api.getAdminDrivers().then(rows => { if (active) setDrivers(rows); })
        .catch(error => { if (active) setLoadError(error.message); });
    }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const handleSuspendDriver = async (driverId: string) => {
    await api.suspendDriver(driverId);
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
    <OpsLayout title="TalaRide administration" person={operatorName} role="admin" group={todaName} active={activeTab}
      onSelect={setActiveTab} onSignOut={onSignOut} onRefresh={loadAllData} loading={loading}
      sections={[
        { id: 'overview', label: 'Overview' }, { id: 'drivers', label: 'Driver verification', count: drivers.filter(driver => driver.verification_status === 'pending').length },
        { id: 'groups', label: 'TODA groups' }, { id: 'vehicles', label: 'Vehicles', count: vehicles.length },
        { id: 'transactions', label: 'Transactions' }, { id: 'lostItems', label: 'Lost items', count: lostItems.filter(item => item.status !== 'closed' && item.status !== 'found').length },
        { id: 'issues', label: 'Payment issues', count: paymentIssues.filter(issue => issue.status === 'pending').length }, { id: 'fares', label: 'Fare settings' },
      ]}>

      {loadError && <p role="alert" className="m-4 rounded-xl bg-danger-soft p-4 text-danger">{loadError}</p>}
      {canVerify && drivers.some(driver => driver.verification_status === 'pending') && <button onClick={() => setActiveTab('drivers')} className="mx-4 mt-4 rounded-xl border border-line bg-white p-4 text-left text-sm font-semibold text-accent">{drivers.filter(driver => driver.verification_status === 'pending').length} driver verification request(s) awaiting your review →</button>}
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards (Section 41 MVP Success Criteria) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-line p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Drivers on Shift</span>
                <div className="text-3xl font-semibold text-accent font-mono">
                  {overview?.metrics?.active_drivers_on_shift ?? 0} / {drivers.length}
                </div>
                <div className="text-xs text-muted">TODA verified operators</div>
              </div>

              <div className="bg-white border border-line p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Digital Adoption</span>
                <div className="text-3xl font-semibold text-ink font-mono">
                  {overview?.metrics?.digital_adoption_pct ?? 0}%
                </div>
                <div className="text-xs text-accent font-medium">QR Ph vs Cash distribution</div>
              </div>

              <div className="bg-white border border-line p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Total Digital Volume</span>
                <div className="text-3xl font-semibold text-accent font-mono">
                  ₱{(overview?.metrics?.total_digital_volume_centavos ?? 0) / 100}
                </div>
                <div className="text-xs text-muted">
                  Fees collected: ₱{((overview?.metrics?.total_fees_collected_centavos ?? 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="bg-white border border-line p-5 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Confirmation Speed</span>
                <div className="text-3xl font-semibold text-warning font-mono">{overview?.metrics?.average_confirmation_speed_seconds ?? "—"}</div>
                <div className="text-xs text-muted">From scan to driver chime</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Registered drivers', drivers.length, 'Driver accounts in TalaRide'],
                ['TODA groups', overview?.metrics?.total_toda_groups ?? 0, 'Groups managed by this portal'],
                ['Verified drivers', overview?.metrics?.verified_drivers ?? 0, 'Approved by an administrator'],
                ['Open lost-item reports', lostItems.filter(item => !['closed', 'found'].includes(item.status)).length, 'Awaiting follow-up'],
              ].map(([label, value, detail]) => <div key={label} className="rounded border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </div>)}
            </div>

            {/* Quick Status Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lost items ticket queue */}
              <div className="bg-white border border-line p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-warning" />
                    Lost Item Queue
                  </h3>
                  <button
                    onClick={() => setActiveTab('lostItems')}
                    className="text-xs text-accent hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {lostItems.slice(0, 3).map((item) => (
                    <div key={item.report_id} className="p-3 bg-subtle rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-ink capitalize">{item.item_category}</span>
                        <div className="text-[11px] text-muted">{item.vehicle_id} • {item.description}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-warning bg-warning-soft px-2 py-0.5 rounded">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment issues & disputes */}
              <div className="bg-white border border-line p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-danger" />
                    Payment Disputes & Refund Tickets
                  </h3>
                  <button
                    onClick={() => setActiveTab('issues')}
                    className="text-xs text-accent hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-2">
                  {paymentIssues.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted">No open dispute tickets</div>
                  ) : (
                    paymentIssues.slice(0, 3).map((t) => (
                      <div key={t.ticket_id} className="p-3 bg-subtle rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-danger capitalize">{t.issue_type.replace('_', ' ')}</span>
                          <div className="text-[11px] text-muted">{t.description}</div>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-danger bg-danger-soft px-2 py-0.5 rounded">
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
                <h2 className="text-lg font-bold text-ink">Registered Drivers</h2>
                <p className="text-xs text-muted">Manage tricycle operators, verification, and active shifts</p>
              </div>
              <p className="text-xs text-muted">Drivers register in the TalaRide app.</p>
            </div>

            <div className="bg-white border border-line rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle border-b border-line text-muted font-bold uppercase">
                  <tr>
                    <th className="p-4">Driver ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Mobile / License</th>
                    <th className="p-4">TODA / Operator</th>
                    <th className="p-4">Active Unit</th>
                    <th className="p-4">Shift Status</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {drivers.map((d) => (
                    <tr key={d.driver_id} className="hover:bg-subtle/60">
                      <td className="p-4 font-mono font-bold text-accent">{d.driver_id}</td>
                      <td className="p-4 font-semibold text-ink">{d.name}</td>
                      <td className="p-4 font-mono text-muted">{d.mobile_number}<div className="mt-1">{d.license_number || 'No license submitted'}</div></td>
                      <td className="p-4 text-ink">{d.toda_operator}</td>
                      <td className="p-4 font-mono font-bold text-ink">
                        {d.assigned_vehicle_id || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.shift_status === 'active' ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted'
                        }`}>
                          {d.shift_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.verification_status === 'verified'
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-danger'
                        }`}>
                          {d.verification_status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {canVerify && d.verification_status !== 'verified' && (
                          <button
                            onClick={() => handleVerifyDriver(d.driver_id)}
                            disabled={!!verifyingDriver}
                            className="px-2.5 py-1 bg-accent-soft text-accent hover:bg-accent-soft rounded text-[11px] font-semibold"
                          >
                            {verifyingDriver === d.driver_id ? 'Approving…' : 'Approve driver'}
                          </button>
                        )}
                        {d.verification_status !== 'suspended' && (
                          <button
                            onClick={() => handleSuspendDriver(d.driver_id)}
                            className="px-2.5 py-1 bg-danger-soft text-danger hover:bg-danger-soft rounded text-[11px] font-semibold"
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
                <h2 className="text-lg font-bold text-ink">Registered Tricycles</h2>
                <p className="text-xs text-muted">
                  Manage tricycle units and generate permanent QR safety stickers
                </p>
              </div>
              <button
                onClick={() => setShowAddVehicle(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Register Tricycle</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div key={v.vehicle_id} className="bg-white border border-line p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-muted uppercase">TalaRide Unit</div>
                      <div className="text-2xl font-semibold font-mono text-accent">{v.vehicle_id}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-subtle text-ink font-mono">
                      Body #{v.plate_body_number}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-ink">
                    <div>TODA: <span className="font-semibold text-ink">{v.toda}</span></div>
                    <div>
                      Assigned Driver:{' '}
                      <span className="font-semibold text-accent">
                        {v.assigned_driver_name || 'No active driver'}
                      </span>
                    </div>
                  </div>

                  <label className="block text-xs text-ink">Assigned driver
                    <select aria-label={`Assign driver to ${v.vehicle_id}`} value={v.assigned_driver_id || ''} className="mt-2 w-full rounded-lg bg-subtle p-3" onChange={async e => {
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
                    className="w-full py-2.5 bg-subtle hover:bg-subtle text-ink border border-line font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Printer className="w-4 h-4 text-accent" />
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
                <h2 className="text-lg font-bold text-ink">Digital Transactions & QR Ph Records</h2>
                <p className="text-xs text-muted">Search by payment ID, vehicle, or driver</p>
              </div>

              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-line rounded-xl text-xs text-ink"
                />
              </div>
            </div>

            <div className="bg-white border border-line rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle border-b border-line text-muted font-bold uppercase">
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
                <tbody className="divide-y divide-line">
                  {filteredTransactions.map((t) => (
                    <tr key={t.payment_id} className="hover:bg-subtle/60 font-mono">
                      <td className="p-4 font-bold text-accent">{t.payment_id}</td>
                      <td className="p-4 text-ink">{t.vehicle_id}</td>
                      <td className="p-4 text-muted">{t.driver_id}</td>
                      <td className="p-4 font-bold text-ink">₱{t.amount.toFixed(2)}</td>
                      <td className="p-4 text-danger">-₱{t.provider_fee.toFixed(2)}</td>
                      <td className="p-4 font-bold text-accent">₱{t.net_amount.toFixed(2)}</td>
                      <td className="p-4 uppercase text-ink">{t.provider}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.payment_status === 'paid' ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger'
                        }`}>
                          {t.payment_status}
                        </span>
                      </td>
                      <td className="p-4 text-muted text-[11px]">
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
              <h2 className="text-lg font-bold text-ink">Lost Item Reports Management</h2>
              <p className="text-xs text-muted">Track and mediate lost item claims across TODA operators</p>
            </div>

            <div className="bg-white border border-line rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle border-b border-line text-muted font-bold uppercase">
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
                <tbody className="divide-y divide-line">
                  {lostItems.map((item) => (
                    <tr key={item.report_id} className="hover:bg-subtle/60">
                      <td className="p-4 font-mono font-bold text-warning">{item.report_id}</td>
                      <td className="p-4 font-mono text-ink">{item.vehicle_id}</td>
                      <td className="p-4 capitalize font-semibold text-ink">{item.item_category}</td>
                      <td className="p-4 text-ink max-w-xs truncate">{item.description}</td>
                      <td className="p-4 font-mono text-muted">{item.driver_id}</td>
                      <td className="p-4 uppercase font-bold text-[11px] text-ink">
                        {item.driver_response || 'Pending Response'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'found' ? 'bg-accent-soft text-accent' : 'bg-warning-soft text-warning'
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
              <h2 className="text-lg font-bold text-ink">Payment Issues & Reversals</h2>
              <p className="text-xs text-muted">
                Support review for reported double charges, wrong fares, or gateway verification disputes
              </p>
            </div>

            <div className="bg-white border border-line rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle border-b border-line text-muted font-bold uppercase">
                  <tr>
                    <th className="p-4">Ticket ID</th>
                    <th className="p-4">Issue Type</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Reported By</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paymentIssues.map((issue) => (
                    <tr key={issue.ticket_id} className="hover:bg-subtle/60">
                      <td className="p-4 font-mono font-bold text-danger">{issue.ticket_id}</td>
                      <td className="p-4 font-semibold capitalize text-ink">
                        {issue.issue_type.replace(/_/g, ' ')}
                      </td>
                      <td className="p-4 text-ink max-w-sm">{issue.description}</td>
                      <td className="p-4 text-muted">{issue.reported_by}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          issue.status === 'resolved'
                            ? 'bg-accent-soft text-accent'
                            : issue.status === 'refunded'
                            ? 'bg-accent-soft text-accent'
                            : 'bg-danger-soft text-danger'
                        }`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {issue.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResolveIssue(issue.ticket_id, 'resolved')}
                              className="px-2.5 py-1 bg-accent-soft text-accent hover:bg-accent-soft rounded text-[11px] font-semibold"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleResolveIssue(issue.ticket_id, 'refunded')}
                              className="px-2.5 py-1 bg-accent-soft text-accent hover:bg-accent-soft rounded text-[11px] font-semibold"
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
          <div className="max-w-xl bg-white border border-line p-6 rounded-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-ink">Standard Fare Configuration</h2>
              <p className="text-xs text-muted">
                Configure standard quick buttons displayed on Driver app terminals
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                Current Quick-Select Buttons (Philippine Peso)
              </label>
              <div className="flex flex-wrap gap-2">
                {fareConfig.standard_fares.map((f) => (
                  <div
                    key={f}
                    className="px-4 py-2 bg-accent-soft border border-line rounded-xl font-mono font-bold text-accent text-lg"
                  >
                    ₱{f}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-subtle rounded-2xl border border-line space-y-2 text-xs">
              <div className="flex justify-between text-ink">
                <span>Payment Provider Fee Schedule:</span>
                <span className="font-mono font-bold text-accent">1.75% QR Ph Interoperable</span>
              </div>
              <div className="flex justify-between text-ink">
                <span>TalaRide Platform Fee (MVP):</span>
                <span className="font-mono font-bold text-accent">₱0.00 (Zero Driver Commission)</span>
              </div>
              <div className="flex justify-between text-ink">
                <span>Custom Fare Minimum:</span>
                <span className="font-mono text-muted">₱15.00</span>
              </div>
            </div>

            <div className="text-[11px] text-muted leading-relaxed">
              Section 29 Notice: TalaRide displays fares entered or configured for participating drivers and operators. TalaRide does not independently determine government-regulated transportation fares.
            </div>
          </div>
        )}
        {activeTab === 'groups' && <TodaManagement />}
      </div>

      {/* Printable Vehicle Sticker Modal */}
      {stickerVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20  p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-ink space-y-4 shadow-none text-center">
            <div className="border-4 border-line rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between border-b-2 border-line pb-2">
                <span className="font-semibold text-lg tracking-tight">TALARIDE</span>
                <span className="text-[10px] font-bold uppercase bg-subtle text-ink px-2 py-0.5 rounded">
                  OFFICIAL STICKER
                </span>
              </div>

              <VehicleSticker code={stickerVehicle.vehicle_id} url={stickerVehicle.qr_code_payload} />

              <div className="text-xs font-bold uppercase tracking-wider text-muted">
                Scan to record this ride
              </div>
              <div className="text-[10px] text-muted font-mono">
                {stickerVehicle.toda} • Body #{stickerVehicle.plate_body_number}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStickerVehicle(null)}
                className="flex-1 py-3 bg-slate-100 font-semibold text-muted rounded-xl text-xs hover:bg-slate-200"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-accent font-bold text-white rounded-xl text-xs hover:bg-accent-hover"
              >
                Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20  p-4">
          <form onSubmit={handleAddVehicle} className="bg-white border border-line rounded-2xl max-w-md w-full p-6 space-y-4 text-ink shadow-none">
            <h3 className="text-lg font-bold text-ink">Register New Tricycle Unit</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1">TalaRide Vehicle ID</label>
                <input
                  type="text"
                  required
                  placeholder="TR-03192"
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full p-3 bg-subtle border border-line rounded-xl text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Plate / Body Number</label>
                <input
                  type="text"
                  required
                  placeholder="TAG-192"
                  value={newVehicleBody}
                  onChange={(e) => setNewVehicleBody(e.target.value)}
                  className="w-full p-3 bg-subtle border border-line rounded-xl text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">TODA Association</label>
                <input
                  type="text"
                  required
                  value={newVehicleToda}
                  onChange={(e) => setNewVehicleToda(e.target.value)}
                  className="w-full p-3 bg-subtle border border-line rounded-xl text-ink font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="flex-1 py-3 bg-subtle rounded-xl text-xs font-semibold text-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-accent hover:bg-accent-hover rounded-xl text-xs font-bold text-white"
              >
                Register Unit
              </button>
            </div>
          </form>
        </div>
      )}
    </OpsLayout>
  );
};
