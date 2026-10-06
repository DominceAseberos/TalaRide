import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { resendConfirmation } from '@/auth/actions';
import { emailInbox } from '@/auth/emailInbox';
import { Notice } from './Notice';
import { Button, Copy, Field } from './ui';

export function ConfirmEmail({ email: initialEmail, onClose }: { email: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const nextSend = useRef(0);
  const inbox = emailInbox(email);
  async function resend() {
    if (locked.current) return;
    if (Date.now() < nextSend.current) { setMessage('Please wait one minute before requesting another email.'); return; }
    locked.current = true; setBusy(true); setMessage('');
    try {
      await resendConfirmation(email);
      nextSend.current = Date.now() + 60_000;
      setMessage('If this account needs confirmation, a new email will arrive. Open only the newest link.');
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Could not send the email. Try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return <Notice title="Confirm your email" message="Open the newest TalaRide email and tap Confirm email. Check Spam if you don’t see it. Then return to the app to sign in." onClose={onClose}>
    <Field label="Confirmation email" placeholder="Your email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} editable={!busy} />
    {inbox ? <Button label={`Open ${inbox.name}`} onPress={() => { void Linking.openURL(inbox.url).catch(() => setMessage('Could not open your inbox. Please open your email app.')); }} /> : <Copy>Open your email app or your email provider’s website to check your inbox.</Copy>}
    <Button label={busy ? 'Sending…' : 'Resend confirmation email'} disabled={busy} variant="outline" onPress={() => void resend()} />
    {!!message && <Copy accessibilityRole="alert">{message}</Copy>}
  </Notice>;
}
