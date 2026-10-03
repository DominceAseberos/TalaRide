import { Router } from 'express';
import { db } from '../db.js';
import { LostItemReport } from '../types.js';
import { sse } from '../sse.js';

export const lostItemsRouter = Router();

// List lost item reports (filter by passengerId or driverId)
lostItemsRouter.get('/', (req, res) => {
  const { passengerId, driverId } = req.query;

  let items = Array.from(db.lostItems.values());

  if (passengerId) {
    items = items.filter(i => i.passenger_id === passengerId);
  }

  if (driverId) {
    items = items.filter(i => i.driver_id === driverId);
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return res.json(items);
});

// Passenger reports lost item
lostItemsRouter.post('/', (req, res) => {
  const {
    rideId,
    itemCategory,
    description,
    passengerId = 'USR-COM-001',
    passengerName = 'Maria Santos',
    passengerContact = '09187654321'
  } = req.body;

  const ride = db.rides.get(rideId);
  if (!ride) {
    return res.status(404).json({ error: 'Ride record not found' });
  }

  const reportId = `LIR-${Date.now().toString().slice(-4)}`;
  const report: LostItemReport = {
    report_id: reportId,
    ride_id: rideId,
    vehicle_id: ride.vehicle_id,
    driver_id: ride.driver_id,
    passenger_id: passengerId,
    passenger_name: passengerName,
    passenger_contact: passengerContact,
    item_category: itemCategory || 'other',
    description: description || 'Lost item left in tricycle',
    status: 'driver_notified',
    driver_response: null,
    created_at: new Date().toISOString()
  };

  db.lostItems.set(reportId, report);

  // Notify driver via SSE
  sse.notifyDriver(ride.driver_id, 'lost_item_reported', {
    reportId,
    rideId,
    vehicleId: ride.vehicle_id,
    itemCategory,
    description,
    time: ride.timestamp
  });

  return res.status(201).json({
    success: true,
    message: 'Lost item report submitted. Driver has been notified via mediated channel.',
    report
  });
});

// Driver responds to lost item report
lostItemsRouter.post('/:id/driver-response', (req, res) => {
  const { response, note } = req.body; // response: 'found' | 'not_found' | 'contact_support'
  const report = db.lostItems.get(req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  report.driver_response = response;
  report.driver_response_note = note || '';

  if (response === 'found') {
    report.status = 'found';
  } else if (response === 'not_found') {
    report.status = 'unresolved';
  } else {
    report.status = 'driver_notified';
  }

  db.lostItems.set(report.report_id, report);

  // Broadcast update
  sse.broadcast('lost_item_updated', report);

  return res.json({
    success: true,
    message: `Driver response recorded: ${response}`,
    report
  });
});
