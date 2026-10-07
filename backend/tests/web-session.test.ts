import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPaymentToWebSession,
  consumeWebSession,
  createWebSession,
  getWebSessionState,
  releaseWebSession,
  reserveWebSession,
  validateWebSession,
} from '../src/lib/web-session.js';

const owner = 'a'.repeat(48);
test('guest sessions belong to one browser and one vehicle', async () => {
  const { sessionId } = await createWebSession('TR-12345', owner);
  assert.equal(await validateWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(await validateWebSession(sessionId, 'TR-12345', 'b'.repeat(48)), false);
  assert.equal(await validateWebSession(sessionId, 'TR-54321', owner), false);
  assert.equal(await validateWebSession(sessionId, 'TR-12345', owner), true);
});

test('only one payment may reserve a session, failures can retry and success consumes it', async () => {
  const { sessionId } = await createWebSession('TR-12345', owner);
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), false);
  await releaseWebSession(sessionId, 'b'.repeat(48));
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), false);
  await releaseWebSession(sessionId, owner);
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(await attachPaymentToWebSession(sessionId, owner, 'PAY-SESSION-1'), true);
  assert.equal(await consumeWebSession(sessionId, 'PAY-WRONG'), false);
  assert.equal(await consumeWebSession(sessionId, 'PAY-SESSION-1'), true);
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), false);
});

test('an owned reserved guest session can be resumed after page reload', async () => {
  const { sessionId } = await createWebSession('TR-12345', owner);
  assert.equal(await reserveWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(await attachPaymentToWebSession(sessionId, owner, 'PAY-RESUME-1'), true);

  const resumed = await getWebSessionState(sessionId, 'TR-12345', owner);
  assert.equal(resumed?.reserved, true);
  assert.equal(resumed?.payment_id, 'PAY-RESUME-1');
  assert.equal(await getWebSessionState(sessionId, 'TR-12345', 'b'.repeat(48)), null);
});

test('expired sessions cannot be reused', async t => {
  const { sessionId } = await createWebSession('TR-12345', owner);
  const future = Date.now() + 11 * 60 * 1000;
  t.mock.method(Date, 'now', () => future);
  assert.equal(await validateWebSession(sessionId, 'TR-12345', owner), false);
  assert.equal(await consumeWebSession(sessionId, 'PAY-SESSION-2'), false);
});
