import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';

describe('Authentication & Driver PIN Behavior (Section 17 & 18)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ invalid OTP fails closed → 401', async () => {
    const res = await request('/api/auth/otp-verify', {
      method: 'POST',
      body: {
        mobileNumber: '09171234567',
        otp: '9999',
        role: 'commuter'
      }
    });
    assert.equal(res.status, 401, 'Invalid OTP must fail closed with 401');
  });

  test('✓ driver login with incorrect PIN fails closed → 401', async () => {
    const res = await request('/api/auth/otp-verify', {
      method: 'POST',
      body: {
        mobileNumber: '09171234567',
        otp: '8842',
        role: 'driver',
        pin: '0000' // wrong pin
      }
    });
    assert.equal(res.status, 401, 'Incorrect PIN must fail closed');
    assert.equal(res.body.error, 'Invalid Driver PIN');
  });

  test('✓ driver login with correct PIN returns session token → 200', async () => {
    const res = await request('/api/auth/otp-verify', {
      method: 'POST',
      body: {
        mobileNumber: '09171234567',
        otp: '8842',
        role: 'driver',
        pin: '8842'
      }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'Must return enforceable session token');
    assert.equal(res.body.driver?.driver_code, 'DR-000481');
  });
});
