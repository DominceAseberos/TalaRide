import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request, stopTestServer, resetDatabase } from './helpers.js';

describe('Lost Items Mediated Workflow (Section 7)', () => {
  before(() => {
    resetDatabase();
  });

  after(async () => {
    await stopTestServer();
  });

  test('✓ passenger reports lost item on ride & driver responds', async () => {
    // 1. Create a ride first
    const cashRes = await request('/api/cash-record', {
      method: 'POST',
      body: {
        driver_code: 'DR-000481',
        vehicle_code: 'TR-01842',
        amount_centavos: 2000
      }
    });
    const rideId = cashRes.body.ride.ride_id;

    // 2. Report lost item
    const reportRes = await request('/api/lost-item-report', {
      method: 'POST',
      body: {
        ride_id: rideId,
        item_category: 'wallet',
        description: 'Black leather wallet left on tricycle seat'
      }
    });
    assert.equal(reportRes.status, 201);
    assert.equal(reportRes.body.report.status, 'driver_notified');
    const reportId = reportRes.body.report.report_id;

    // 3. Driver responds "found"
    const respondRes = await request('/api/lost-item-respond', {
      method: 'POST',
      body: {
        report_id: reportId,
        response: 'found',
        note: 'Safely kept at Tagum Terminal booth'
      }
    });
    assert.equal(respondRes.status, 200);
    assert.equal(respondRes.body.report.status, 'found');
    assert.equal(respondRes.body.report.driver_response, 'found');
  });
});
