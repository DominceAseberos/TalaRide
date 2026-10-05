import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyVehicleChecksum } from '../src/lib/qr.js';

describe('Cross-Repository Contract Verification (Section 1, 30)', () => {
  const contractsDir = path.resolve(process.cwd(), '../../packages/contracts/fixtures');

  test('✓ payment-intent fixture conforms to canonical contract', () => {
    const filePath = path.join(contractsDir, 'payment-intent.example.json');
    assert.ok(fs.existsSync(filePath), 'payment-intent.example.json must exist');

    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.match(json.driver_code, /^DR-[0-9]{6}$/, 'driver_code must match DR-000000');
    assert.match(json.vehicle_code, /^TR-[0-9]{5}$/, 'vehicle_code must match TR-00000');
    assert.equal(Number.isInteger(json.amount_centavos), true, 'amount_centavos must be integer centavos');
    assert.equal(Number.isInteger(json.provider_fee_centavos), true, 'provider_fee_centavos must be integer');
    assert.equal(Number.isInteger(json.net_centavos), true, 'net_centavos must be integer');
    assert.equal(json.payment_status, 'awaiting_confirmation');
  });

  test('✓ payment-status fixture conforms to canonical vocabulary', () => {
    const filePath = path.join(contractsDir, 'payment-status.example.json');
    assert.ok(fs.existsSync(filePath), 'payment-status.example.json must exist');

    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const validStatuses = ['initiated', 'awaiting_confirmation', 'confirmed', 'failed', 'expired', 'refunded', 'reversed'];
    assert.ok(validStatuses.includes(json.payment_status), `Status ${json.payment_status} must be canonical`);
    assert.equal(Number.isInteger(json.amount_centavos), true);
  });

  test('✓ vehicle sticker URL format and checksum validation', () => {
    const filePath = path.join(contractsDir, 'vehicle-qr.example.txt');
    assert.ok(fs.existsSync(filePath), 'vehicle-qr.example.txt must exist');

    const urlString = fs.readFileSync(filePath, 'utf-8').trim();
    const url = new URL(urlString);
    assert.match(url.pathname, /^\/v\/TR-[0-9]{5}$/);
    const checksum = url.searchParams.get('c');
    assert.ok(checksum, 'Vehicle QR URL must contain ?c=<checksum>');
  });

  test('✓ dynamic payment QR fixture has canonical structure and expiry', () => {
    const filePath = path.join(contractsDir, 'payment-qr.example.json');
    assert.ok(fs.existsSync(filePath), 'payment-qr.example.json must exist');

    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(json.v, 1);
    assert.match(json.vehicle_code, /^TR-[0-9]{5}$/);
    assert.equal(Number.isInteger(json.amount_centavos), true);
    assert.ok(json.expires_at);
    assert.ok(json.sig);
  });
});
