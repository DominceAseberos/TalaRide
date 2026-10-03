import { Router } from 'express';
import { db } from '../db.js';
import { Driver, Vehicle } from '../types.js';
import { sse } from '../sse.js';

export const adminRouter = Router();

// Dashboard overview & KPIs
adminRouter.get('/overview', (req, res) => {
  const drivers = Array.from(db.drivers.values());
  const activeDrivers = drivers.filter(d => d.shift_status === 'active').length;
  const verifiedDrivers = drivers.filter(d => d.verification_status === 'verified').length;
  const vehicles = Array.from(db.vehicles.values());
  const rides = Array.from(db.rides.values());
  const payments = Array.from(db.payments.values());

  const digitalRides = rides.filter(r => r.payment_method === 'digital');
  const cashRides = rides.filter(r => r.payment_method === 'cash');

  const totalDigitalVolume = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalFeesCollected = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + p.provider_fee + p.talaride_fee, 0);

  const digitalAdoptionPct = rides.length > 0
    ? Math.round((digitalRides.length / rides.length) * 100)
    : 0;

  const paidPayments = payments.filter(p => p.payment_status === 'paid').length;
  const paymentSuccessRate = payments.length > 0
    ? Math.round((paidPayments / payments.length) * 100)
    : 100;

  return res.json({
    metrics: {
      totalRegisteredDrivers: drivers.length,
      activeDriversOnShift: activeDrivers,
      verifiedDrivers,
      totalRegisteredVehicles: vehicles.length,
      totalRidesCompleted: rides.length,
      digitalRidesCount: digitalRides.length,
      cashRidesCount: cashRides.length,
      digitalAdoptionPct,
      totalDigitalVolume,
      totalFeesCollected,
      paymentSuccessRate,
      averageConfirmationSpeedSeconds: '3.4s'
    },
    fareConfig: db.fareConfig,
    activeLostItemsCount: Array.from(db.lostItems.values()).filter(l => l.status !== 'closed' && l.status !== 'found').length,
    pendingPaymentIssuesCount: Array.from(db.paymentIssues.values()).filter(p => p.status === 'pending').length
  });
});

// Drivers management
adminRouter.get('/drivers', (req, res) => {
  const drivers = Array.from(db.drivers.values());
  return res.json(drivers);
});

adminRouter.post('/drivers', (req, res) => {
  const { name, mobile_number, toda_operator, license_number } = req.body;

  if (!name || !mobile_number) {
    return res.status(400).json({ error: 'Name and mobile number are required' });
  }

  const driverId = `DR-000${Math.floor(100 + Math.random() * 900)}`;
  const userId = `USR-DRV-${Date.now().toString().slice(-4)}`;

  const driver: Driver = {
    driver_id: driverId,
    user_id: userId,
    name,
    mobile_number,
    verification_status: 'verified',
    toda_operator: toda_operator || 'Tagum Poblacion TODA',
    assigned_vehicle_id: null,
    shift_status: 'ended',
    license_number: license_number || 'N01-24-' + Math.floor(100000 + Math.random() * 900000),
    created_at: new Date().toISOString()
  };

  db.drivers.set(driverId, driver);
  return res.status(201).json({ success: true, driver });
});

adminRouter.post('/drivers/:id/verify', (req, res) => {
  const driver = db.drivers.get(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  driver.verification_status = 'verified';
  db.drivers.set(driver.driver_id, driver);
  return res.json({ success: true, driver });
});

adminRouter.post('/drivers/:id/suspend', (req, res) => {
  const driver = db.drivers.get(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  driver.verification_status = 'suspended';
  driver.shift_status = 'ended';
  driver.assigned_vehicle_id = null;
  db.drivers.set(driver.driver_id, driver);
  return res.json({ success: true, driver });
});

// Assign vehicle to driver
adminRouter.post('/assign-vehicle', (req, res) => {
  const { driverId, vehicleId } = req.body;
  const driver = db.drivers.get(driverId);
  const vehicle = db.vehicles.get(vehicleId);

  if (!driver || !vehicle) {
    return res.status(404).json({ error: 'Driver or vehicle not found' });
  }

  driver.assigned_vehicle_id = vehicleId;
  vehicle.assigned_driver_id = driverId;
  vehicle.assigned_driver_name = driver.name;

  db.drivers.set(driverId, driver);
  db.vehicles.set(vehicleId, vehicle);

  return res.json({ success: true, driver, vehicle });
});

// Transactions list & search
adminRouter.get('/transactions', (req, res) => {
  const { query, status } = req.query;

  let payments = Array.from(db.payments.values());

  if (status) {
    payments = payments.filter(p => p.payment_status === status);
  }

  if (query) {
    const q = String(query).toLowerCase();
    payments = payments.filter(p =>
      p.payment_id.toLowerCase().includes(q) ||
      p.driver_id.toLowerCase().includes(q) ||
      p.vehicle_id.toLowerCase().includes(q) ||
      p.provider_reference.toLowerCase().includes(q)
    );
  }

  payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(payments);
});

// Payment issues / dispute management
adminRouter.get('/payment-issues', (req, res) => {
  const issues = Array.from(db.paymentIssues.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return res.json(issues);
});

adminRouter.post('/payment-issues/:id/resolve', (req, res) => {
  const { status, notes } = req.body; // status: 'resolved' | 'refunded'
  const ticket = db.paymentIssues.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  ticket.status = status;
  ticket.resolution_notes = notes || 'Handled by TalaRide Admin support';
  db.paymentIssues.set(ticket.ticket_id, ticket);

  // If refunded, mark payment refunded
  if (status === 'refunded' && ticket.payment_id) {
    const payment = db.payments.get(ticket.payment_id);
    if (payment) {
      payment.payment_status = 'refunded';
      db.payments.set(payment.payment_id, payment);
    }
  }

  return res.json({ success: true, ticket });
});

// Fare Configuration
adminRouter.get('/fare-config', (req, res) => {
  return res.json(db.fareConfig);
});

adminRouter.put('/fare-config', (req, res) => {
  const { standard_fares, provider_fee_percentage } = req.body;

  if (Array.isArray(standard_fares) && standard_fares.length > 0) {
    db.fareConfig.standard_fares = standard_fares;
  }

  if (typeof provider_fee_percentage === 'number') {
    db.fareConfig.provider_fee_percentage = provider_fee_percentage;
  }

  sse.broadcast('fare_config_updated', db.fareConfig);

  return res.json({ success: true, fareConfig: db.fareConfig });
});
