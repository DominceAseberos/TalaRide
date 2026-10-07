import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CircleAlert, Save, Users } from 'lucide-react';
import { api } from '../../services/api';
import { OpsLayout, type OpsSection } from '../ops/OpsLayout';
import type { Driver } from '../../types';

type LostNotice = {
  report_id: string;
  vehicle_code: string;
  driver_code: string;
  item_category: string;
  description: string;
  status: string;
  driver_response?: string | null;
  created_at: string;
};

type TodaGroup = {
  id: string;
  name: string;
  is_placeholder?: boolean;
};

type TodaTransaction = {
  ride_id: string;
  payment_id?: string | null;
  driver_code: string;
  vehicle_code: string;
  timestamp: string;
  amount_centavos: number;
  payment_method: 'cash' | 'digital';
  provider?: string | null;
  payment_status?: string | null;
  ride_status: string;
  payment_environment?: 'test' | 'live' | null;
};

const card = 'rounded border border-slate-200 bg-white';

export function TodaDashboard({
  operatorName,
  onSignOut,
}: {
  operatorName: string;
  onSignOut: () => void;
}) {
  const [group, setGroup] = useState<TodaGroup | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupNameDirty, setGroupNameDirty] = useState(false);
  const groupNameDirtyRef = useRef(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [members, setMembers] = useState<Driver[]>([]);
  const [lostItems, setLostItems] = useState<LostNotice[]>([]);
  const [transactions, setTransactions] = useState<TodaTransaction[]>([]);
  const [tab, setTab] = useState<OpsSection>('overview');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [memberData, reportData, transactionData] = await Promise.all([
      api.getTodaMembers(),
      api.getTodaLostItems(),
      api.getTodaTransactions(),
    ]);
    setGroup(memberData.group);
    if (!groupNameDirtyRef.current) {
      setGroupNameDraft(memberData.group.is_placeholder ? '' : memberData.group.name);
    }
    setMembers(memberData.members);
    setLostItems(reportData as LostNotice[]);
    setTransactions(transactionData as TodaTransaction[]);
    setError('');
  }, []);

  useEffect(() => {
    let active = true;
    const update = () =>
      void refresh().catch(failure => {
        if (active) {
          setError(
            failure instanceof Error ? failure.message : 'Could not load this group.',
          );
        }
      });
    update();
    const timer = window.setInterval(update, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const saveGroupName = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = groupNameDraft.trim();
    if (name.length < 2) {
      setError('Enter a TODA group name with at least 2 characters.');
      return;
    }

    setSavingGroup(true);
    setError('');
    setSaveNotice('');
    try {
      const result = await api.renameTodaGroup(name);
      setGroup(result.group);
      setGroupNameDraft(result.group.name);
      groupNameDirtyRef.current = false;
      setGroupNameDirty(false);
      setSaveNotice('TODA group name saved.');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not save the TODA group name.',
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const openItems = lostItems.filter(item => !['closed', 'found'].includes(item.status));
  const sections = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'members' as const, label: 'Members', count: members.length },
    { id: 'transactions' as const, label: 'Transactions', count: transactions.length },
    { id: 'lostItems' as const, label: 'Lost item notices', count: openItems.length },
  ];
  const displayGroupName = group?.is_placeholder
    ? 'Name your TODA group'
    : group?.name || 'Your TODA group';

  return (
    <OpsLayout
      title="TODA operations"
      person={operatorName}
      role="operator"
      group={displayGroupName}
      active={tab}
      sections={sections}
      onSelect={setTab}
      onSignOut={onSignOut}
      onRefresh={() => void refresh()}
    >
      {error && (
        <p
          role="alert"
          className="mb-5 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <CircleAlert className="h-4 w-4" />
          {error}
        </p>
      )}

      <div className="mb-5">
        <h1 className="text-xl font-semibold">{displayGroupName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tab === 'overview'
            ? 'Group activity and member status'
            : tab === 'members'
              ? 'Read-only driver roster'
              : tab === 'transactions'
                ? 'Backend ride and payment activity for this TODA'
                : 'New and unresolved lost-item reports'}
        </p>
      </div>

      <form
        onSubmit={saveGroupName}
        className="mb-5 rounded border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              TODA group name
            </span>
            <input
              aria-label="TODA group name"
              value={groupNameDraft}
              onChange={event => {
                setGroupNameDraft(event.target.value);
                groupNameDirtyRef.current = true;
                setGroupNameDirty(true);
                setSaveNotice('');
              }}
              placeholder="e.g. Tagum Poblacion TODA"
              maxLength={120}
              className="min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#367fa9]"
            />
          </label>
          <button
            type="submit"
            disabled={
              savingGroup ||
              !groupNameDirty ||
              groupNameDraft.trim().length < 2
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#367fa9] px-5 text-sm font-semibold text-white transition hover:bg-[#2e6f96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingGroup ? 'Saving…' : 'Save name'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-slate-500">
            This is your group name across TalaRide. Saving updates the database immediately.
          </p>
          {saveNotice && <p role="status" className="font-medium text-green-700">{saveNotice}</p>}
        </div>
      </form>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Group members', members.length],
              [
                'Verified drivers',
                members.filter(driver => driver.verification_status === 'verified').length,
              ],
              [
                'Pending verification',
                members.filter(driver => driver.verification_status === 'pending').length,
              ],
              ['Recorded transactions', transactions.length],
              ['Open lost-item notices', openItems.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className={`${card} border-l-4 border-l-[#367fa9] p-5`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                <h2 className="font-semibold">Lost item notifications</h2>
              </div>
              <button
                onClick={() => setTab('lostItems')}
                className="text-sm font-medium text-[#286b8e] hover:underline"
              >
                View all
              </button>
            </div>
            {openItems.length ? (
              <LostTable items={openItems.slice(0, 5)} />
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">
                No open lost-item reports for this group.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'members' && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#367fa9]" />
              <h2 className="font-semibold">Driver members</h2>
            </div>
            <span className="text-xs text-slate-500">
              Read only · {members.length} members
            </span>
          </div>
          {members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[#f4f6f9] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Driver code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(driver => (
                    <tr key={driver.driver_id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium">{driver.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{driver.driver_id}</td>
                      <td className="px-4 py-3">
                        <Status value={driver.verification_status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {driver.assigned_vehicle_id || 'Not assigned'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">
              No members have been assigned by the TalaRide administrator.
            </p>
          )}
        </section>
      )}

      {tab === 'transactions' && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold">Ride and payment activity</h2>
              <p className="mt-1 text-xs text-slate-500">
                Read-only backend records for drivers assigned to this TODA.
              </p>
            </div>
            <span className="text-xs text-slate-500">{transactions.length} records</span>
          </div>
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#f4f6f9] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Driver / vehicle</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(item => (
                    <tr key={item.ride_id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{item.driver_code}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">{item.vehicle_code}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        ₱{(item.amount_centavos / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium capitalize">
                          {item.payment_method === 'cash' ? 'Cash' : item.provider || 'Digital'}
                        </div>
                        {item.payment_environment === 'test' && (
                          <div className="mt-1 text-[11px] text-amber-700">Test / simulation</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {item.payment_status || item.ride_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">
              No rides or payments have been recorded for this TODA yet.
            </p>
          )}
        </section>
      )}

      {tab === 'lostItems' && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <Bell className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold">Lost item notices</h2>
          </div>
          {lostItems.length ? (
            <LostTable items={lostItems} />
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">
              No lost-item reports have been filed by this group’s passengers.
            </p>
          )}
        </section>
      )}
    </OpsLayout>
  );
}

function Status({ value }: { value: string }) {
  const text =
    value === 'verified'
      ? 'Verified'
      : value === 'pending'
        ? 'Pending admin review'
        : 'Suspended';
  const style =
    value === 'verified'
      ? 'bg-green-50 text-green-800'
      : value === 'pending'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-red-50 text-red-700';
  return <span className={`rounded px-2 py-1 text-xs ${style}`}>{text}</span>;
}

function LostTable({ items }: { items: LostNotice[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-[#f4f6f9] text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Reported</th>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Details</th>
            <th className="px-4 py-3">Driver / vehicle</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.report_id} className="border-t border-slate-200">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {new Date(item.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-medium capitalize">
                {item.item_category.replace(/_/g, ' ')}
              </td>
              <td className="max-w-sm px-4 py-3 text-slate-600">{item.description}</td>
              <td className="px-4 py-3 text-slate-600">
                {item.driver_code}
                <br />
                {item.vehicle_code}
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {(item.driver_response || item.status).replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
