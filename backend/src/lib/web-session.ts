import crypto from 'node:crypto';
import { repository } from './repository.js';

const SESSION_TTL_MS = 10 * 60 * 1000;

export function hashWebSessionOwner(owner: string): string {
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(owner)) throw new Error('Invalid browser session.');
  return crypto.createHash('sha256').update(owner).digest('hex');
}

export async function createWebSession(vehicleCode: string, owner: string) {
  const session = await repository.createWebSession(
    vehicleCode,
    hashWebSessionOwner(owner),
    SESSION_TTL_MS,
  );
  return { sessionId: session.session_id, expiresAt: session.expires_at };
}

export async function validateWebSession(sessionId: string, vehicleCode: string, owner: string): Promise<boolean> {
  const session = await repository.getWebSession(sessionId);
  return !!session &&
    !session.consumed &&
    !session.reserved &&
    session.owner_hash === hashWebSessionOwner(owner) &&
    session.vehicle_code === vehicleCode;
}

export async function getWebSessionState(sessionId: string, vehicleCode: string, owner: string) {
  const session = await repository.getWebSession(sessionId);
  if (
    !session ||
    session.consumed ||
    session.owner_hash !== hashWebSessionOwner(owner) ||
    session.vehicle_code !== vehicleCode
  ) {
    return null;
  }
  return session;
}

export async function getWebSessionExpiry(sessionId: string, vehicleCode: string, owner: string): Promise<string | null> {
  return (await getWebSessionState(sessionId, vehicleCode, owner))?.expires_at ?? null;
}

export async function reserveWebSession(sessionId: string, vehicleCode: string, owner: string): Promise<boolean> {
  const session = await repository.reserveWebSession(
    sessionId,
    vehicleCode,
    hashWebSessionOwner(owner),
  );
  return !!session;
}

export async function releaseWebSession(sessionId: string, owner: string): Promise<void> {
  await repository.releaseWebSession(sessionId, hashWebSessionOwner(owner));
}

export async function attachPaymentToWebSession(sessionId: string, owner: string, paymentId: string): Promise<boolean> {
  return repository.attachPaymentToWebSession(sessionId, hashWebSessionOwner(owner), paymentId);
}

export async function consumeWebSession(sessionId: string, paymentId?: string): Promise<boolean> {
  return repository.consumeWebSession(sessionId, paymentId);
}
