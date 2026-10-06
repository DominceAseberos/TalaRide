import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebSession, validateWebSession, reserveWebSession, releaseWebSession, consumeWebSession } from '../src/lib/web-session.js';

const owner = 'a'.repeat(48);
test('guest sessions belong to one browser and one vehicle', () => {
  const { sessionId } = createWebSession('TR-12345', owner);
  assert.equal(validateWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(validateWebSession(sessionId, 'TR-12345', 'b'.repeat(48)), false);
  assert.equal(validateWebSession(sessionId, 'TR-54321', owner), false);
  assert.equal(consumeWebSession(sessionId, 'TR-12345', 'b'.repeat(48)), false);
  assert.equal(validateWebSession(sessionId, 'TR-12345', owner), true);
});
test('only one payment may reserve a session, failures can retry and success consumes it', () => {
  const { sessionId } = createWebSession('TR-12345', owner);
  assert.equal(reserveWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(reserveWebSession(sessionId, 'TR-12345', owner), false);
  releaseWebSession(sessionId, 'b'.repeat(48));
  assert.equal(reserveWebSession(sessionId, 'TR-12345', owner), false);
  releaseWebSession(sessionId, owner);
  assert.equal(reserveWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(consumeWebSession(sessionId, 'TR-12345', owner), true);
  assert.equal(reserveWebSession(sessionId, 'TR-12345', owner), false);
});
test('expired sessions cannot be reused', t => {
  const { sessionId } = createWebSession('TR-12345', owner);
  const future = Date.now() + 11 * 60 * 1000;
  t.mock.method(Date, 'now', () => future);
  assert.equal(validateWebSession(sessionId, 'TR-12345', owner), false);
  assert.equal(consumeWebSession(sessionId, 'TR-12345', owner), false);
});
