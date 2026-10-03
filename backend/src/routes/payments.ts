import { Router } from 'express';
import { db } from '../db.js';
import { Payment, Ride, RewardsTransaction, PaymentIssueTicket } from '../types.js';
import { sse } from '../sse.js';

export const paymentsRouter = Router();

// Driver generates payment QR for a specific fare
paymentsRouter.post('/create-qr', (req, res) => {
  const { driverId, vehicleId, fareAmount, isCustom = false } = req.body;

  if (!driverId || !vehicleId || !fareAmount) {
    return res.status(400).json({ error: 'driverId, vehicleId, and fareAmount are required' });
  }

  const amount = Number(fareAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid fare amount is required' });
  }

  const driver = db.drivers.get(driverId);
  const vehicle = db.vehicles.get(vehicleId);

  const paymentId = `PAY-${Date.now().toString().slice(-6)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

  const { providerFee, talarideFee, net } = db.calculateFees(amount);

  // Standard TalaRide QR Ph interoperable payload string
  // In real life this follows EMVCo / QR Ph national standard
  const qrPayload = JSON.stringify({
    scheme: 'QRPH',
    merchant: 'TalaRide Philippines',
    paymentId,
    driverId,
    driverName: driver?.name || 'Juan Dela Cruz',
    vehicleId,
    amount,
    currency: 'PHP',
    expiresAt
  });

  const payment: Payment = {
    payment_id: paymentId,
    ride_id: '', // Attached once ride completes
    driver_id: driverId,
    vehicle_id: vehicleId,
    amount,
    provider: 'gcash',
    provider_reference: '',
    payment_status: 'pending',
    provider_fee: providerFee,
    talaride_fee: talarideFee,
    net_amount: net,
    qr_payload: qrPayload,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    paid_at: null
  };

  db.payments.set(paymentId, payment);

  return res.json({
    success: true,
    payment,
    qrPayload
  });
});

// Check payment status
paymentsRouter.get('/:id', (req, res) => {
  const payment = db.payments.get(req.params.id);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  return res.json(payment);
});

// Simulate / Process QR Ph payment confirmation
// (Can be called by Commuter App or Guest Scanner simulating GCash / Maya / GoTyme)
paymentsRouter.post('/confirm-payment', (req, res) => {
  const {
    paymentId,
    provider = 'gcash',
    passengerId,
    passengerName,
    approximateLocation = 'Tagum City'
  } = req.body;

  const payment = db.payments.get(paymentId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment record not found' });
  }

  if (payment.payment_status === 'paid') {
    return res.json({
      success: true,
      message: 'Payment was already processed',
      payment
    });
  }

  // Check expiration
  if (new Date() > new Date(payment.expires_at)) {
    payment.payment_status = 'failed';
    return res.status(400).json({ error: 'Payment QR has expired. Please ask driver to generate a new QR.' });
  }

  // Complete Payment
  payment.payment_status = 'paid';
  payment.provider = provider;
  payment.provider_reference = `${provider.toUpperCase()}-REF-${Math.floor(1000000 + Math.random() * 9000000)}`;
  payment.paid_at = new Date().toISOString();

  // Create Completed Ride
  const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
  const driver = db.drivers.get(payment.driver_id);

  const ride: Ride = {
    ride_id: rideId,
    driver_id: payment.driver_id,
    driver_name: driver?.name || 'Juan Dela Cruz',
    vehicle_id: payment.vehicle_id,
    passenger_id: passengerId || null,
    passenger_name: passengerName || (passengerId ? 'Maria Santos' : 'Guest Commuter'),
    timestamp: new Date().toISOString(),
    approximate_location: approximateLocation,
    payment_method: 'digital',
    fare_amount: payment.amount,
    status: 'completed'
  };

  payment.ride_id = rideId;
  db.rides.set(rideId, ride);
  db.payments.set(paymentId, payment);

  // Update Driver's Shift stats
  if (driver?.active_shift_id) {
    const shift = db.shifts.get(driver.active_shift_id);
    if (shift) {
      shift.digital_rides_count += 1;
      shift.digital_gross_total = Number((shift.digital_gross_total + payment.amount).toFixed(2));
      shift.provider_platform_fees = Number((shift.provider_platform_fees + payment.provider_fee).toFixed(2));
      shift.digital_net_total = Number((shift.digital_net_total + payment.net_amount).toFixed(2));
      db.shifts.set(shift.shift_id, shift);
    }
  }

  // Rewards: 1 TalaPoint per completed digital ride for authenticated passengers
  let pointsAwarded = 0;
  if (passengerId) {
    pointsAwarded = 1;
    const rewardId = `REW-${Date.now().toString().slice(-6)}`;
    const reward: RewardsTransaction = {
      reward_id: rewardId,
      user_id: passengerId,
      ride_id: rideId,
      points: 1,
      status: 'earned',
      reward_type: 'ride_completion',
      created_at: new Date().toISOString()
    };
    db.rewards.set(rewardId, reward);
  }

  // Notify driver via SSE with sound/vibration trigger
  sse.notifyDriver(payment.driver_id, 'payment_confirmed', {
    paymentId: payment.payment_id,
    amount: payment.amount,
    provider: payment.provider,
    provider_reference: payment.provider_reference,
    vehicle_id: payment.vehicle_id,
    net_amount: payment.net_amount,
    driver_fee: payment.provider_fee,
    timestamp: payment.paid_at
  });

  return res.json({
    success: true,
    message: 'Payment confirmed successfully',
    payment,
    ride,
    pointsAwarded
  });
});

// Report payment problem / issue (Section 21)
paymentsRouter.post('/issues', (req, res) => {
  const { paymentId, rideId, issueType, description, reportedBy } = req.body;

  const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
  const ticket: PaymentIssueTicket = {
    ticket_id: ticketId,
    payment_id: paymentId || '',
    ride_id: rideId || '',
    issue_type: issueType || 'other',
    description: description || 'Payment verification dispute',
    status: 'pending',
    reported_by: reportedBy || 'Commuter',
    created_at: new Date().toISOString()
  };

  db.paymentIssues.set(ticketId, ticket);

  return res.status(201).json({
    success: true,
    message: 'Payment issue report submitted. TalaRide support will review with payment provider.',
    ticket
  });
});
