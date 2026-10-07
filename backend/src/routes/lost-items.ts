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

export const LostItemMessageSchema = z.object({
  report_id: z.string().min(1),
  message: z.string().trim().min(1).max(1000)
});

export const LostItemCloseSchema = z.object({
  report_id: z.string().min(1)
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
      messages: [
        {
          message_id: `LIM-${randomUUID()}`,
          author_role: 'passenger',
          author_id: req.user?.id || null,
          message: description,
          created_at: new Date().toISOString()
        }
      ],
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
    const updated = await repository.respondToLostItem(
      report_id,
      response,
      note,
      req.user?.id || null,
    );
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

// POST /api/lost-item-message
// Passenger and assigned driver share one privacy-safe thread. TODA operators
// remain read-only and never receive the passenger's private contact details.
lostItemsRouter.post('/lost-item-message', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sign in to use the lost-item conversation.' });
    if (req.user.role === 'operator') {
      return res.status(403).json({ error: 'TODA operators have read-only lost-item access.' });
    }
    const parsed = LostItemMessageSchema.safeParse({
      report_id: req.body.report_id || req.body.reportId,
      message: req.body.message
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }

    const report = await repository.getLostItemReport(parsed.data.report_id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const passengerOwns = req.user.role === 'passenger' && report.passenger_id === req.user.id;
    const driverOwns = req.user.role === 'driver' && report.driver_code === req.user.driver_code;
    if (!passengerOwns && !driverOwns && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'This lost-item conversation belongs to another ride.' });
    }

    const authorRole =
      req.user.role === 'admin'
        ? 'admin'
        : req.user.role === 'driver'
          ? 'driver'
          : 'passenger';
    const updated = await repository.addLostItemMessage(
      report.report_id,
      { role: authorRole, id: req.user.id },
      parsed.data.message,
    );
    return res.json({ success: true, report: updated });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Could not send lost-item message.';
    if (message.includes('closed')) return res.status(409).json({ error: message });
    console.error('Error sending lost-item message:', err);
    return res.status(500).json({ error: 'Server error', message });
  }
});

// POST /api/lost-item-close
// Only the reporting passenger (or an administrator) can mark recovery complete.
lostItemsRouter.post('/lost-item-close', optionalAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sign in to close a lost-item report.' });
    const parsed = LostItemCloseSchema.safeParse({
      report_id: req.body.report_id || req.body.reportId
    });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Malformed input', details: parsed.error.format() });
    }
    const report = await repository.getLostItemReport(parsed.data.report_id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role !== 'admin' && report.passenger_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the reporting passenger can close this report.' });
    }
    const updated = await repository.closeLostItemReport(report.report_id);
    return res.json({ success: true, report: updated });
  } catch (err: any) {
    console.error('Error closing lost-item report:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// GET /api/lost-items
lostItemsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    let driverCode = req.user?.role === 'driver' ? req.user.driver_code || '__none__' : (req.query.driver_code || req.query.driverId) as string | undefined;
    const passengerId = req.user && !['driver', 'admin', 'operator'].includes(req.user.role) ? req.user.id : (req.query.passenger_id || req.query.passengerId) as string | undefined;

    let operatorDriverCodes: Set<string> | null = null;
    if (req.user?.role === 'operator') {
      const groupId = req.user.toda_group?.id;
      if (!groupId) return res.status(403).json({ error: 'No TODA group assigned.' });
      operatorDriverCodes = new Set(
        (await repository.getAllDrivers())
          .filter((driver) => driver.toda_group_id === groupId)
          .map((driver) => driver.driver_code),
      );
      if (driverCode && !operatorDriverCodes.has(driverCode)) {
        return res.status(403).json({ error: 'Report belongs to another TODA group.' });
      }
      if (!driverCode) driverCode = undefined;
    }

    let reports = await repository.getLostItems({
      driver_code: driverCode,
      passenger_id: passengerId
    });
    if (operatorDriverCodes) reports = reports.filter((report) => operatorDriverCodes!.has(report.driver_code));

    return res.json(reports);
  } catch (err: any) {
    console.error('Error fetching lost items:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
});
