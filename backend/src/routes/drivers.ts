import { Router } from 'express';
import { db } from '../db.js';
import { DriverShift, Ride } from '../types.js';
import { sse } from '../sse.js';

export const driversRouter = Router();

// Get driver details
driversRouter.get('/:id', (req, res) => {
  const driver = db.drivers.get(req.params.id);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const assignedVehicle = driver.assigned_vehicle_id
    ? db.vehicles.get(driver.assigned_vehicle_id)
    : null;

  const activeShift = driver.active_shift_id
    ? db.shifts.get(driver.active_shift_id)
    : null;

  return res.json({
    driver,
    vehicle: assignedVehicle,
    activeShift
  });
});

// Start Driver Shift
driversRouter.post('/shifts/start', (req, res) => {
  const { driverId, vehicleId } = req.body;

  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const vehicle = db.vehicles.get(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // Create new active shift
  const shiftId = `SHIFT-${Date.now().toString().slice(-6)}`;
  const newShift: DriverShift = {
    shift_id: shiftId,
    driver_id: driverId,
    vehicle_id: vehicleId,
    start_time: new Date().toISOString(),
    end_time: null,
    status: 'active',
    digital_rides_count: 0,
    digital_gross_total: 0,
    provider_platform_fees: 0,
    digital_net_total: 0,
    cash_rides_count: 0,
    cash_gross_total: 0
  };

  db.shifts.set(shiftId, newShift);

  // Update driver
  driver.assigned_vehicle_id = vehicleId;
  driver.shift_status = 'active';
  driver.active_shift_id = shiftId;
  db.drivers.set(driverId, driver);

  // Update vehicle assignment
  vehicle.assigned_driver_id = driverId;
  vehicle.assigned_driver_name = driver.name;
  db.vehicles.set(vehicleId, vehicle);

  sse.notifyDriver(driverId, 'shift_updated', { driver, shift: newShift, vehicle });

  return res.json({
    success: true,
    message: `Driver ${driverId} started shift with vehicle ${vehicleId}`,
    shift: newShift,
    driver,
    vehicle
  });
});

// End Driver Shift
driversRouter.post('/shifts/end', (req, res) => {
  const { driverId } = req.body;
  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  if (driver.active_shift_id) {
    const shift = db.shifts.get(driver.active_shift_id);
    if (shift) {
      shift.status = 'ended';
      shift.end_time = new Date().toISOString();
      db.shifts.set(shift.shift_id, shift);
    }
  }

  if (driver.assigned_vehicle_id) {
    const vehicle = db.vehicles.get(driver.assigned_vehicle_id);
    if (vehicle) {
      vehicle.assigned_driver_id = null;
      vehicle.assigned_driver_name = null;
      db.vehicles.set(vehicle.vehicle_id, vehicle);
    }
  }

  driver.shift_status = 'ended';
  driver.active_shift_id = null;
  driver.assigned_vehicle_id = null;
  db.drivers.set(driverId, driver);

  sse.notifyDriver(driverId, 'shift_updated', { driver, shift: null, vehicle: null });

  return res.json({
    success: true,
    message: 'Shift ended successfully',
    driver
  });
});

// Record Cash Ride
driversRouter.post('/cash-ride', (req, res) => {
  const { driverId, vehicleId, fareAmount } = req.body;

  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
  const ride: Ride = {
    ride_id: rideId,
    driver_id: driverId,
    driver_name: driver.name,
    vehicle_id: vehicleId || driver.assigned_vehicle_id || 'TR-01842',
    timestamp: new Date().toISOString(),
    approximate_location: 'Tagum City Center',
    payment_method: 'cash',
    fare_amount: Number(fareAmount),
    status: 'completed'
  };

  db.rides.set(rideId, ride);

  // Update active shift if any
  if (driver.active_shift_id) {
    const shift = db.shifts.get(driver.active_shift_id);
    if (shift) {
      shift.cash_rides_count += 1;
      shift.cash_gross_total += Number(fareAmount);
      db.shifts.set(shift.shift_id, shift);
    }
  }

  return res.json({
    success: true,
    message: `Cash ride recorded: ₱${fareAmount}`,
    ride
  });
});

// Driver today's transactions / summary
driversRouter.get('/:id/summary', (req, res) => {
  const driverId = req.params.id;
  const driver = db.drivers.get(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const activeShift = driver.active_shift_id ? db.shifts.get(driver.active_shift_id) : null;

  // Filter rides for driver
  const driverRides = Array.from(db.rides.values())
    .filter(r => r.driver_id === driverId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter payments for driver
  const driverPayments = Array.from(db.payments.values())
    .filter(p => p.driver_id === driverId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return res.json({
    driver,
    activeShift,
    rides: driverRides,
    payments: driverPayments
  });
});
