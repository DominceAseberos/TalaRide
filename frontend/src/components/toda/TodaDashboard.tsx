import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import type { Driver } from '../../types';

export function TodaDashboard({ operatorName, onSignOut }: { operatorName: string; onSignOut: () => void }) {
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<Driver[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const result = await api.getTodaMembers();
    if (mounted.current) { setGroup(result.group); setMembers(result.members); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const update = () => void refresh().catch(e => { if (mounted.current) setError(e.message); });
    update();
    const timer = window.setInterval(update, 15000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [refresh]);
  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.addTodaMember(code.trim().toUpperCase());
      setCode('');
      setNotice('Membership saved. The group name will appear in the driver’s app.');
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save membership.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-canvas text-ink">
    <header className="border-b border-line bg-white px-6 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
      <div><p className="font-semibold">TalaRide</p><p className="text-sm text-muted">{operatorName} · TODA operator</p></div>
      <button onClick={onSignOut} className="rounded-lg border border-line px-4 py-2 text-sm">Sign out</button>
    </div></header>
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div><h1 className="text-2xl font-semibold">{group?.name || 'Your TODA group'}</h1><p className="mt-2 text-sm text-muted">Manage your driver members. Driver verification is handled by the TalaRide administrator.</p></div>
      {error && <p role="alert" className="rounded-xl border border-line bg-danger-soft p-4 text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-accent-soft p-4 text-accent">{notice}</p>}
      <div className="grid grid-cols-2 gap-4"><div className="rounded-xl border border-line bg-white p-5"><p className="text-sm text-muted">Members</p><p className="mt-2 text-2xl font-semibold">{members.length}</p></div><div className="rounded-xl border border-line bg-white p-5"><p className="text-sm text-muted">Verified drivers</p><p className="mt-2 text-2xl font-semibold">{members.filter(d => d.verification_status === 'verified').length}</p></div></div>
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Add a driver to your group</h2><p className="mt-2 text-sm text-muted">Ask the driver for the code shown in their mobile app. Membership does not approve driver verification.</p>
        <form onSubmit={event => void addMember(event)} className="mt-4 flex flex-wrap gap-3">
          <label className="flex-1 text-sm">Driver code<input required pattern="[Dd][Rr]-[0-9]{6}" value={code} onChange={event => setCode(event.target.value)} placeholder="DR-123456" className="mt-2 block w-full rounded-lg border border-line bg-white px-4 py-3 uppercase" /></label>
          <button disabled={busy || !group} className="self-end rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Add member'}</button>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl border border-line bg-white"><h2 className="border-b border-line p-5 font-semibold">Driver members</h2>
        {!group ? <p className="p-5 text-muted">{error ? 'Member records are unavailable.' : 'Loading members…'}</p> : !members.length ? <p className="p-5 text-muted">No members yet. Add a registered driver using their driver code.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-subtle text-muted"><tr><th className="p-4">Driver</th><th className="p-4">Code</th><th className="p-4">Verification</th><th className="p-4">Vehicle</th></tr></thead><tbody>{members.map(driver => <tr key={driver.driver_id} className="border-t border-line"><td className="p-4 font-medium">{driver.name}</td><td className="p-4 font-mono">{driver.driver_id}</td><td className="p-4">{driver.verification_status === 'pending' ? 'Awaiting admin approval' : driver.verification_status === 'verified' ? 'Verified' : 'Suspended'}</td><td className="p-4">{driver.assigned_vehicle_id || 'Not assigned'}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>;
}
