import React, { useEffect, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { api } from '../../services/api';
import { getAuthClient } from '../../services/auth';
import { ConfirmEmail } from './ConfirmEmail';

export interface TodaSession {
  name: string;
  group: string;
  email: string;
  role: 'operator' | 'admin';
}
interface Props { onAuthenticated: (session: TodaSession) => void; }

export const TodaLogin: React.FC<Props> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (!params.has('error') && !params.has('error_code')) return '';
    return params.get('error_code') === 'otp_expired'
      ? 'This confirmation link has expired or was already used. Sign in or request a new confirmation email.'
      : 'The email link could not be verified. Sign in or request a new confirmation email.';
  });
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function openAccount() {
    const result = await api.getCurrentAccount();
    if (!['operator', 'admin'].includes(result.user.role)) {
      setNotice('This account does not have a TODA portal role. Ask a TalaRide administrator to create or assign it.');
      return;
    }
    onAuthenticated({ name: result.user.full_name, role: result.user.role, group: result.user.toda_group?.name || 'TalaRide administration', email: email.trim().toLowerCase() });
  }
  useEffect(() => {
    window.localStorage.removeItem('talaride.toda-account');
    window.sessionStorage.removeItem('talaride.toda-session');
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error') || params.has('error_code')) window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      const client = await getAuthClient();
      const { error: failure } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (failure) throw failure;
      await openAccount();
      setPassword('');
    } catch (failure) {
      if (failure instanceof Error && failure.message.toLowerCase().includes('email not confirmed')) setConfirmation(true);
      setError(failure instanceof Error ? failure.message : 'Could not connect to your account.');
    } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#f4f6f9] px-4 py-8 text-slate-800 sm:px-6">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
      <section className="w-full overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-t-4 border-[#367fa9] p-6 sm:p-9">
          <div className="mb-8"><div className="text-2xl font-semibold">TalaRide</div><div className="mt-1 text-xs text-slate-500">TODA operations portal</div></div>
          <h1 className="text-2xl font-semibold">Sign in to your portal</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use the account created for your role to access the administration or your assigned TODA group.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Email</span><div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-[#367fa9]"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="name@example.com" autoComplete="email" /></div></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Password</span><div className="flex items-center rounded border border-slate-300 px-3 focus-within:border-[#367fa9]"><LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" /><input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="Password" autoComplete="current-password" /></div></label>
            {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} type="submit" className="min-h-11 w-full rounded bg-[#367fa9] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2e6f96] disabled:opacity-60">{busy ? 'Please wait…' : 'Sign in'}</button>
          </form>
          {notice && <p role="status" className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
          <button type="button" onClick={() => setConfirmation(true)} className="mt-5 w-full text-center text-sm font-medium text-[#286b8e] hover:underline">Need to confirm your email?</button>
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-500">Operator accounts and group access are assigned by a TalaRide administrator.</p>
        </div>
      </section>
    </div>
    {confirmation && <ConfirmEmail email={email.trim()} onClose={() => setConfirmation(false)} />}
  </main>;
};
