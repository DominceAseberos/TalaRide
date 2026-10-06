import React, { useState } from 'react';
import { Building2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

export interface TodaSession {
  name: string;
  group: string;
  email: string;
}

interface Props {
  onAuthenticated: (session: TodaSession) => void;
}

const DEMO_EMAIL = 'operator@talaride.ph';
const DEMO_PASSWORD = 'talaride-demo';
const ACCOUNT_KEY = 'talaride.toda-account';

export const TodaLogin: React.FC<Props> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (mode === 'signup') {
      if (name.trim().length < 2 || group.trim().length < 2) {
        setError('Enter your name and TODA group.');
        return;
      }
      const account = { name: name.trim(), group: group.trim(), email: normalizedEmail, password };
      window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      onAuthenticated({ name: account.name, group: account.group, email: account.email });
      return;
    }
    let account: { name: string; group: string; email: string; password: string } | null = null;
    try {
      const stored = window.localStorage.getItem(ACCOUNT_KEY);
      account = stored ? JSON.parse(stored) : null;
    } catch {
      account = null;
    }
    const accepted =
      (normalizedEmail === DEMO_EMAIL && password === DEMO_PASSWORD) ||
      (account?.email === normalizedEmail && account.password === password);
    if (!accepted) {
      setError('Those credentials were not recognized. Use your TODA account or the demo account shown below.');
      return;
    }
    onAuthenticated({
      name: account?.name ?? 'TalaRide Operator',
      group: account?.group ?? 'Tagum City TODA',
      email: normalizedEmail,
    });
  };

  return (
    <main className="min-h-screen bg-[#F4F8F5] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-950/10 md:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-[#003D2B] p-10 text-white md:block">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black">T</div>
              <div>
                <div className="text-2xl font-black">TalaRide</div>
                <div className="text-xs text-emerald-100">TODA operations portal</div>
              </div>
            </div>
            <div className="mt-20 max-w-md">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheck className="h-8 w-8 text-emerald-300" />
              </div>
              <h1 className="text-4xl font-black leading-tight">Run your TODA from one simple dashboard.</h1>
              <p className="mt-4 text-sm leading-6 text-emerald-100">
                Manage verified drivers, vehicles, locations, fare activity, lost-item reports, and payment issues in one place.
              </p>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8 md:hidden">
              <div className="text-2xl font-black text-[#003D2B]">TalaRide</div>
              <div className="text-xs text-slate-500">TODA operations portal</div>
            </div>
            <div className="mb-7">
              <h2 className="text-2xl font-black text-slate-900">
                {mode === 'signin' ? 'Sign in to your TODA portal' : 'Create a TODA portal account'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === 'signin'
                  ? 'Use your operator account to view today’s members, locations, reports, and activity.'
                  : 'Create an operator profile for your TODA group. You can update the group details after signing in.'}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Your name</span>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <input value={name} onChange={(event) => setName(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="TODA coordinator name" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">TODA group</span>
                    <input value={group} onChange={(event) => setGroup(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-emerald-500" placeholder="e.g. Tagum Poblacion TODA" />
                  </label>
                </>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="operator@example.com" autoComplete="email" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm outline-none" placeholder="At least 8 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
                </div>
              </label>
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
              <button type="submit" className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
                {mode === 'signin' ? 'Sign in to dashboard' : 'Create TODA account'}
              </button>
            </form>

            {mode === 'signin' && (
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
                <div className="font-bold">Demo access</div>
                <div className="mt-1 font-mono">{DEMO_EMAIL} · {DEMO_PASSWORD}</div>
              </div>
            )}
            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} className="mt-6 w-full text-center text-sm font-bold text-emerald-700 hover:underline">
              {mode === 'signin' ? 'Create a TODA account' : 'Already have an account? Sign in'}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
};
