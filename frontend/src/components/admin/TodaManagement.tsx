import { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, CircleAlert, Plus, UserRoundPlus, Users } from 'lucide-react';
import { api } from '../../services/api';
import type { Driver } from '../../types';

type Group = { id: string; name: string; members: Driver[] };
const field = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#367fa9] focus:ring-2 focus:ring-[#367fa9]/15';
const button = 'inline-flex items-center justify-center gap-2 rounded bg-[#367fa9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2e6f96] disabled:cursor-not-allowed disabled:opacity-50';

export function TodaManagement() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [driverCode, setDriverCode] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorGroup, setOperatorGroup] = useState('');
  const [operatorNewGroup, setOperatorNewGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedGroup = groups.find(group => group.id === selected);
  const refresh = useCallback(async () => {
    const rows = await api.getAdminTodaGroups();
    setGroups(rows);
    setSelected(current => rows.some(row => row.id === current) ? current : rows[0]?.id || '');
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(failure =>
        setError(failure instanceof Error ? failure.message : 'Could not load TODA groups.')
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  async function submit(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold text-slate-800">TODA groups</h2><p className="mt-1 text-sm text-slate-500">Create associations, review membership and verification status, and assign drivers.</p></div>
    {error && <p role="alert" className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><CircleAlert className="h-4 w-4 shrink-0" />{error}</p>}
    {notice && <p role="status" className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h3 className="font-semibold">Group directory</h3><p className="mt-1 text-xs text-slate-500">{groups.length} registered {groups.length === 1 ? 'group' : 'groups'}</p></div><div className="flex gap-2"><input aria-label="New TODA group name" value={newGroup} onChange={event => setNewGroup(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(async () => { const result = await api.createTodaGroup(newGroup.trim()); setNewGroup(''); setSelected(result.group.id); }, 'TODA group created.'); } }} placeholder="New group name" className="w-40 rounded border border-slate-300 px-3 py-2 text-sm sm:w-52" /><button className={button} disabled={busy || newGroup.trim().length < 2} onClick={() => void submit(async () => { const result = await api.createTodaGroup(newGroup.trim()); setNewGroup(''); setSelected(result.group.id); }, 'TODA group created.')}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create group</span></button></div></div>
        {groups.length === 0 ? <div className="p-10 text-center text-sm text-slate-500"><Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />No TODA groups yet. Create the first group above.</div> : <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 p-2 md:border-b-0 md:border-r">{groups.map(group => <button key={group.id} onClick={() => setSelected(group.id)} className={`mb-1 flex w-full items-center justify-between rounded px-3 py-3 text-left text-sm ${selected === group.id ? 'bg-[#eaf3f8] font-semibold text-[#286b8e]' : 'text-slate-700 hover:bg-slate-50'}`}><span className="truncate">{group.name}</span><span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">{group.members.length}</span></button>)}</div>
          {selectedGroup && <div className="min-w-0 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{selectedGroup.name}</h3><p className="text-xs text-slate-500">{selectedGroup.members.length} enrolled drivers</p></div><form className="flex gap-2" onSubmit={event => { event.preventDefault(); void submit(() => api.assignDriverToTodaGroup(selectedGroup.id, driverCode.trim().toUpperCase()), 'Driver assigned to this TODA group.').then(() => setDriverCode('')); }}><input required pattern="[Dd][Rr]-[0-9]{6}" value={driverCode} onChange={event => setDriverCode(event.target.value)} placeholder="DR-123456" aria-label="Driver code" className="w-32 rounded border border-slate-300 px-3 py-2 text-sm uppercase" /><button className={button} disabled={busy}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Assign driver</span></button></form></div>
            {selectedGroup.members.length === 0 ? <p className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No drivers assigned to this group yet.</p> : <div className="overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-[#f4f6f9] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Driver code</th><th className="px-3 py-3">Verification</th><th className="px-3 py-3">Vehicle</th></tr></thead><tbody>{selectedGroup.members.map(member => <tr key={member.driver_id} className="border-t border-slate-200"><td className="px-3 py-3 font-medium">{member.name}</td><td className="px-3 py-3 font-mono text-xs">{member.driver_id}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-xs ${member.verification_status === 'verified' ? 'bg-green-50 text-green-800' : member.verification_status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{member.verification_status === 'verified' ? 'Verified' : member.verification_status === 'pending' ? 'Pending admin review' : 'Suspended'}</span></td><td className="px-3 py-3 text-slate-600">{member.assigned_vehicle_id || '—'}</td></tr>)}</tbody></table></div>}
          </div>}
        </div>}
      </section>
      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-[#367fa9]" /><h3 className="font-semibold">Create operator account</h3></div><p className="mt-1 text-xs leading-5 text-slate-500">Send an email invitation and limit the operator to one TODA group. Their portal is read-only.</p></div>
        <form className="space-y-4 p-5" onSubmit={event => { event.preventDefault(); void submit(async () => { const data = operatorNewGroup.trim() ? { name: operatorName.trim(), email: operatorEmail.trim(), groupName: operatorNewGroup.trim() } : { name: operatorName.trim(), email: operatorEmail.trim(), groupId: operatorGroup }; await api.inviteTodaOperator(data); setOperatorName(''); setOperatorEmail(''); setOperatorNewGroup(''); setNotice('Invitation sent. The operator will receive access to the assigned group after confirming their email.'); }, 'Invitation sent to the operator.'); }}>
          <label className="block text-sm">Operator name<input required minLength={2} maxLength={80} value={operatorName} onChange={event => setOperatorName(event.target.value)} className={field} /></label>
          <label className="block text-sm">Email address<input required type="email" value={operatorEmail} onChange={event => setOperatorEmail(event.target.value)} className={field} /></label>
          <label className="block text-sm">Assign to group<select required value={operatorGroup} onChange={event => { setOperatorGroup(event.target.value); if (event.target.value) setOperatorNewGroup(''); }} className={field}><option value="">Create a new group below</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          {!operatorGroup && <label className="block text-sm">New TODA group<input required minLength={2} maxLength={120} value={operatorNewGroup} onChange={event => setOperatorNewGroup(event.target.value)} className={field} placeholder="e.g. Tagum Poblacion TODA" /></label>}
          <button disabled={busy || (!operatorGroup && operatorNewGroup.trim().length < 2)} className={`${button} w-full`}><Users className="h-4 w-4" />{busy ? 'Sending invitation…' : 'Create and invite operator'}</button>
        </form>
      </section>
    </div>
  </div>;
}
