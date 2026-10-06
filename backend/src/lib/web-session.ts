import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 10 * 60 * 1000;

interface WebSession {
  vehicleCode: string;
  expiresAt: number;
  consumed: boolean;
}

const sessions = new Map<string, WebSession>();

function cleanupExpired(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now || session.consumed) sessions.delete(sessionId);
  }
}

export function createWebSession(vehicleCode: string) {
  const now = Date.now();
  cleanupExpired(now);
  const sessionId = randomBytes(24).toString('base64url');
  const expiresAt = now + SESSION_TTL_MS;
  sessions.set(sessionId, { vehicleCode, expiresAt, consumed: false });
  return { sessionId, expiresAt: new Date(expiresAt).toISOString() };
}

export function validateWebSession(sessionId: string, vehicleCode: string): boolean {
  cleanupExpired();
  const session = sessions.get(sessionId);
  return !!session && !session.consumed && session.vehicleCode === vehicleCode;
}

export function getWebSessionExpiry(sessionId: string, vehicleCode: string): string | null {
  cleanupExpired();
  const session = sessions.get(sessionId);
  if (!session || session.consumed || session.vehicleCode !== vehicleCode) return null;
  return new Date(session.expiresAt).toISOString();
}

export function consumeWebSession(sessionId: string, vehicleCode: string): boolean {
  cleanupExpired();
  const session = sessions.get(sessionId);
  if (!session || session.consumed || session.vehicleCode !== vehicleCode) return false;
  session.consumed = true;
  sessions.delete(sessionId);
  return true;
}
