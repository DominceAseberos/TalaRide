import { randomUUID } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { repository } from '../lib/repository.js';
import { optionalAuth, productionAuth } from '../lib/auth.js';
import { sse } from '../sse.js';
import { LostItemReport } from '../types.js';

export const lostItemsRouter = Router();
lostItemsRouter.use(productionAuth);

export const LostItemReportSchema = z.object({
  ride_id: z.string().min(1, 'ride_id is required'),
  item_category: z.enum(['phone', 'wallet', 'bag', 'documents', 'keys', 'other']),
  description: z.string().min(3, 'description must be at least 3 characters'),
  passenger_name: z.string().optional(),
  passenger_contact: z.string().optional(),
  client_operation_id: z.string().optional()
});

export const LostItemRespondSchema = z.object({
  report_id: z.string().min(1, 'report_id is required'),
  response: z.enum(['found', 'not_found', 'contact_support']),
  note: z.string().optional()
});

// POST /api/lost-item-report
lostItemsRouter.post('/lost-item-report', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      ride_id: req.body.ride_id || req.body.rideId,
      item_category: req.body.item_category || req.body.itemCategory,
      description: req.body.description,
      passenger_name: req.body.passenger_name || req.body.passengerName || req.user?.full_name || 'Passenger',
      passenger_contact: req.body.passenger_contact || req.body.passengerContact || req.user?.mobile_number || '',
      client_operation_id: req.body.client_operation_id || req.body.clientOperationId
    };

    const parsed = LostItemReportSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { ride_id, item_category, description, passenger_name, passenger_contact, client_operation_id } = parsed.data;


    const ride = await repository.getRide(ride_id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride record not found' });
    }

    if (req.user && req.user.role !== 'admin' && ride.passenger_id !== req.user.id) return res.status(403).json({ error: 'You can only report items from your own ride.' });
    const reportId = `LIR-${randomUUID()}`;
    const newReport: LostItemReport = {
      report_id: reportId,
      ride_id: ride.ride_id,
      vehicle_code: ride.vehicle_code,
      driver_code: ride.driver_code,
      passenger_id: req.user?.id || null,
      passenger_name: passenger_name || 'Passenger',
      passenger_contact: passenger_contact || 'Private',
      item_category,
      description,
      status: 'driver_notified',
      driver_response: null,
      driver_response_note: null,
      client_operation_id: client_operation_id || null,
      created_at: new Date().toISOString()
    };

    const createdReport = await repository.createLostItemReport(newReport);

    // Notify driver via SSE
    sse.notifyDriver(ride.driver_code, 'lost_item_reported', {
      report_id: reportId,
      ride_id: ride.ride_id,
      vehicle_code: ride.vehicle_code,
      item_category,
      description,
      time: ride.timestamp
    });

    const responseBody = {
      success: true,
      message: 'Lost item report submitted. Driver has been notified via privacy-safe channel.',
      report: createdReport
    };


    return res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error submitting lost item report:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// POST /api/lost-item-respond
lostItemsRouter.post('/lost-item-respond', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawBody = {
      report_id: req.body.report_id || req.body.reportId,
      response: req.body.response,
      note: req.body.note
    };

    const parsed = LostItemRespondSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const { report_id, response, note } = parsed.data;

    if (req.user && req.user.role !== 'admin') {
      if (!req.user.driver_code) return res.status(403).json({ error: 'Driver account required.' });
      const ownReports = await repository.getLostItems({ driver_code: req.user.driver_code });
      if (!ownReports.some(report => report.report_id === report_id)) return res.status(403).json({ error: 'Report belongs to another driver.' });
    }
    const updated = await repository.respondToLostItem(report_id, response, note);
    if (!updated) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({
      success: true,
      message: 'Driver response recorded',
      report: updated
    });
  } catch (err: any) {
    console.error('Error responding to lost item:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/lost-items
lostItemsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const driverCode = req.user?.role === 'driver' ? req.user.driver_code || '__none__' : (req.query.driver_code || req.query.driverId) as string | undefined;
    const passengerId = req.user && !['driver', 'admin', 'operator'].includes(req.user.role) ? req.user.id : (req.query.passenger_id || req.query.passengerId) as string | undefined;

    const reports = await repository.getLostItems({
      driver_code: driverCode,
      passenger_id: passengerId
    });

    return res.json(reports);
  } catch (err: any) {
    console.error('Error fetching lost items:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
