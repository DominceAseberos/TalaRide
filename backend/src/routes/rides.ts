import { Router } from 'express';
import { db } from '../db.js';
import { Ride } from '../types.js';
import { sse } from '../sse.js';

export const ridesRouter = Router();

// List rides
ridesRouter.get('/', (req, res) => {
  const { passengerId, driverId } = req.query;

  let rides = Array.from(db.rides.values());

  if (passengerId) {
    rides = rides.filter(r => r.passenger_id === passengerId);
  }

  if (driverId) {
    rides = rides.filter(r => r.driver_id === driverId);
  }

  // Sort descending by timestamp
  rides.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json(rides);
});

// Get ride detail
ridesRouter.get('/:id', (req, res) => {
  const ride = db.rides.get(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  const driver = db.drivers.get(ride.driver_id);
  const vehicle = db.vehicles.get(ride.vehicle_id);

  // Find matching payment if digital
  let payment = null;
  for (const p of db.payments.values()) {
    if (p.ride_id === ride.ride_id) {
      payment = p;
      break;
    }
  }

  return res.json({
    ride,
    driver,
    vehicle,
    payment
  });
});

// Safety Check-In (Cash or Safety Ride Recording)
// Commuter scans permanent vehicle sticker e.g. TR-01842
ridesRouter.post('/safety-checkin', (req, res) => {
  const {
    vehicleId,
    passengerId,
    passengerName,
    approximateLocation = 'Tagum City'
  } = req.body;

  const vehicle = db.vehicles.get(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: `Vehicle ${vehicleId} not recognized in TalaRide system` });
  }

  const driver = vehicle.assigned_driver_id ? db.drivers.get(vehicle.assigned_driver_id) : null;

  const rideId = `RIDE-${Date.now().toString().slice(-6)}`;
  const newRide: Ride = {
    ride_id: rideId,
    driver_id: driver?.driver_id || 'DR-UNKNOWN',
    driver_name: driver?.name || 'On-Duty TalaRide Driver',
    vehicle_id: vehicle.vehicle_id,
    passenger_id: passengerId || null,
    passenger_name: passengerName || 'Commuter',
    timestamp: new Date().toISOString(),
    approximate_location: approximateLocation,
    payment_method: 'cash',
    fare_amount: 0,
    status: 'completed',
    is_checkin_only: true
  };

  db.rides.set(rideId, newRide);

  // If driver has active shift, update cash check-in count
  if (driver?.active_shift_id) {
    const shift = db.shifts.get(driver.active_shift_id);
    if (shift) {
      shift.cash_rides_count += 1;
      db.shifts.set(shift.shift_id, shift);
    }
  }

  return res.json({
    success: true,
    message: 'Ride check-in saved to ride history for safety tracking.',
    ride: newRide,
    vehicle,
    driver
  });
});
