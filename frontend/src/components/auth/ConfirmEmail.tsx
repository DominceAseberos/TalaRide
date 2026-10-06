import { useEffect, useRef, useState } from 'react';
import { getAuthClient } from '../../services/auth';
import { emailInbox } from '../../services/emailInbox';

export function ConfirmEmail({ email: initialEmail, onClose }: { email: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const nextSend = useRef(0);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inbox = emailInbox(email);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function resend(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    if (Date.now() < nextSend.current) { setMessage('Please wait one minute before requesting another email.'); return; }
    locked.current = true; setBusy(true); setMessage('');
    try {
      const client = await getAuthClient();
      const { error } = await client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      nextSend.current = Date.now() + 60_000;
      setMessage('If this account needs confirmation, a new email will arrive. Open only the newest link.');
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Could not send the email. Try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="confirm-email-title" aria-describedby="confirm-email-description" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-emerald-100 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
    <h2 id="confirm-email-title" className="text-2xl font-black">Confirm your email</h2>
    <p id="confirm-email-description" className="mt-3 text-sm leading-6 text-slate-600">Open the newest TalaRide email and tap Confirm email. Check Spam if you don’t see it. Then return here to sign in. TODA dashboard access requires approval.</p>
    <form onSubmit={resend} className="mt-5 space-y-3">
      <label className="block text-sm font-bold">Email address
        <input autoFocus required type="email" autoComplete="email" disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" />
      </label>
      {inbox ? <a href={inbox.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white">Open {inbox.name}</a> : <p className="text-sm text-slate-600">Open your email app or your email provider’s website to check your inbox.</p>}
      <button disabled={busy} className="w-full rounded-xl border border-emerald-600 px-4 py-3 font-bold text-emerald-800 disabled:opacity-50">{busy ? 'Sending…' : 'Resend confirmation email'}</button>
      {message && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">{message}</p>}
    </form>
    <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-3 font-bold text-slate-600">Back to sign in</button>
  </dialog>;
}
