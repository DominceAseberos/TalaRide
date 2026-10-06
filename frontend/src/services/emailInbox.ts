// Only known inbox URLs are allowed; never navigate to a domain supplied in an email.
export function emailInbox(email: string): { name: string; url: string } | null {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' };
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' };
  if (['yahoo.com', 'ymail.com', 'rocketmail.com'].includes(domain)) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail/' };
  if (['proton.me', 'protonmail.com'].includes(domain)) return { name: 'Proton Mail', url: 'https://mail.proton.me/' };
  return null;
}
