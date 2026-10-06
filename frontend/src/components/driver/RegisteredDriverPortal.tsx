import { useEffect, useState } from 'react';
import { getAuthClient, signOut } from '../../services/auth';
import { api } from '../../services/api';
import { VehicleSticker } from '../common/VehicleSticker';

export function RegisteredDriverPortal() {
  const [account, setAccount] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [toda, setToda] = useState('');
  const [license, setLicense] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const load = async () => setAccount(await api.getCurrentAccount());
  useEffect(() => { void getAuthClient().then(c => c.auth.getSession()).then(r => r.data.session ? load() : undefined).catch(() => {}); }, []);
  useEffect(() => {
    if (!account?.driver?.driver_code) return;
    let active = true;
    const poll = () => api.getDriverNotifications(account.driver.driver_code).then(r => { if (active) setNotifications(r.notifications); }).catch(() => {});
    void poll(); const timer = window.setInterval(poll, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [account?.driver?.driver_code]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const client = await getAuthClient();
      if (register) {
        const result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + '/driver', data: { display_name: name.trim(), full_name: name.trim(), requested_role: 'driver' } } });
        if (result.error) throw result.error;
        setNotice('Confirm your email, then sign in to submit your driver details.'); setRegister(false); setPassword('');
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        await load();
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  async function enroll(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.enrollDriver({ full_name: name, mobile_number: phone, toda_operator: toda, license_number: license }); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not submit details.'); }
    finally { setBusy(false); }
  }
  const field = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900';
  const driver = account?.driver;
  const vehicle = account?.vehicle;
  return <main className="min-h-screen bg-[#F4F8F5] p-5 text-slate-900"><div className="mx-auto max-w-lg space-y-5">
    <header className="flex justify-between"><h1 className="text-2xl font-black text-emerald-900">TalaRide · Driver</h1><a href="/" className="text-sm">TODA portal</a></header>
    {!account ? <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{register ? 'Create driver account' : 'Driver sign in'}</h2>
      {register && <input aria-label="Full name" placeholder="Full name" className={field} value={name} onChange={e => setName(e.target.value)} required />}
      <input aria-label="Email" type="email" autoComplete="email" placeholder="Email" className={field} value={email} onChange={e => setEmail(e.target.value)} required />
      <input aria-label="Password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={8} placeholder="Password" className={field} value={password} onChange={e => setPassword(e.target.value)} required />
      <button disabled={busy} className="w-full rounded-xl bg-emerald-700 p-3 font-bold text-white">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      <button type="button" onClick={() => setRegister(!register)} className="text-emerald-700">{register ? 'Already registered? Sign in' : 'Create a driver account'}</button>
    </form> : <>
      <p>Welcome, {account.user.full_name}</p>
      {!driver ? <form onSubmit={enroll} className="space-y-3 rounded-3xl bg-white p-6">
        <h2 className="text-xl font-bold">Register as a driver</h2>
        <p className="text-sm">Submit your details for verification and vehicle assignment.</p>
        {[[name, setName, 'Full name'], [phone, setPhone, 'Mobile number'], [toda, setToda, 'TODA group'], [license, setLicense, 'License number']].map(([value, setter, label]) => <input key={String(label)} aria-label={String(label)} placeholder={String(label)} required className={field} value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value)} />)}
        <button disabled={busy} className="w-full rounded-xl bg-emerald-700 p-3 text-white">Submit for verification</button>
      </form> : <section className="space-y-4 rounded-3xl bg-white p-6">
        <h2 className="text-xl font-bold">{driver.full_name}</h2><p>{driver.driver_code} · {driver.verification_status === 'verified' ? 'Verified driver' : 'Verification pending'}</p>
        {vehicle ? <VehicleSticker code={vehicle.vehicle_code} url={`${window.location.origin}/v/${vehicle.vehicle_code}?c=${encodeURIComponent(vehicle.qr_checksum)}`} /> : <p>Your QR will appear after your TODA assigns a registered vehicle.</p>}
        {vehicle && driver.verification_status === 'verified' && <button disabled={busy} className="w-full rounded-xl bg-emerald-700 p-3 text-white" onClick={async () => {
          setBusy(true); setError('');
          try { if (driver.shift_status === 'active') await api.endShift(driver.driver_code); else await api.startShift(driver.driver_code, vehicle.vehicle_code); await load(); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not update shift.'); }
          finally { setBusy(false); }
        }}>{driver.shift_status === 'active' ? 'End shift' : 'Start shift'}</button>}
        <p className="text-sm">Commuters scan your QR or enter the code printed below it, then choose their fare.</p>
      </section>}
      <section className="rounded-3xl bg-white p-6"><h2 className="font-bold">Payment and lost-item notifications</h2>{notifications.length ? notifications.map(item => <p key={item.id} className="mt-3 border-t pt-3">{item.message}</p>) : <p className="mt-2 text-sm text-slate-500">No notifications yet.</p>}</section>
      <button onClick={() => void signOut().then(() => { setAccount(null); setNotifications([]); setPassword(''); }).catch(e => setError(e.message))}>Sign out</button>
    </>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3">{notice}</p>}
  </div></main>;
}
