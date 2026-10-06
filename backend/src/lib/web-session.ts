import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 10 * 60 * 1000;

interface WebSession {
  vehicleCode: string;
  expiresAt: number;
  consumed: boolean;
  owner: string;
  reserved: boolean;
}

const sessions = new Map<string, WebSession>();

function cleanupExpired(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now || session.consumed) sessions.delete(sessionId);
  }
}

export function createWebSession(vehicleCode: string, owner: string) {
  const now = Date.now();
  cleanupExpired(now);
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(owner)) throw new Error('Invalid browser session.');
  if (sessions.size >= 10000) throw new Error('Too many active ride sessions. Try again shortly.');
  const sessionId = randomBytes(24).toString('base64url');
  const expiresAt = now + SESSION_TTL_MS;
  sessions.set(sessionId, { vehicleCode, expiresAt, consumed: false, owner, reserved: false });
  return { sessionId, expiresAt: new Date(expiresAt).toISOString() };
}

export function validateWebSession(sessionId: string, vehicleCode: string, owner: string): boolean {
  cleanupExpired();
  const session = sessions.get(sessionId);
  return !!session && !session.consumed && !session.reserved && session.owner === owner && session.vehicleCode === vehicleCode;
}

export function getWebSessionExpiry(sessionId: string, vehicleCode: string, owner: string): string | null {
  cleanupExpired();
  const session = sessions.get(sessionId);
  if (!session || session.consumed || session.owner !== owner || session.vehicleCode !== vehicleCode) return null;
  return new Date(session.expiresAt).toISOString();
}

export function consumeWebSession(sessionId: string, vehicleCode: string, owner: string): boolean {
  cleanupExpired();
  const session = sessions.get(sessionId);
  if (!session || session.consumed || session.owner !== owner || session.vehicleCode !== vehicleCode) return false;
  session.consumed = true;
  sessions.delete(sessionId);
  return true;
}

export function reserveWebSession(id: string, vehicleCode: string, owner: string): boolean {
  if (!validateWebSession(id, vehicleCode, owner)) return false;
  sessions.get(id)!.reserved = true;
  return true;
}
export function releaseWebSession(id: string, owner: string) {
  const session = sessions.get(id);
  if (session?.owner === owner) session.reserved = false;
}
