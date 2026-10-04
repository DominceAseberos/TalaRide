import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';
import { supabaseAdmin } from './supabase-admin.js';
import { generateVehicleChecksum } from './qr.js';
import {
  Profile,
  Driver,
  Vehicle,
  DriverShift,
  Ride,
  Payment,
  PaymentEvent,
  LostItemReport,
  RewardsLedger,
  FareConfiguration,
  PaymentIssueTicket,
  NotificationRecord,
  PaymentStatus
} from '../types.js';

interface StorageSchema {
  profiles: Profile[];
  drivers: Driver[];
  vehicles: Vehicle[];
  shifts: DriverShift[];
  rides: Ride[];
  payments: Payment[];
  paymentEvents: PaymentEvent[];
  lostItems: LostItemReport[];
  rewards: RewardsLedger[];
  paymentIssues: PaymentIssueTicket[];
  notifications: NotificationRecord[];
  fareConfig: FareConfiguration;
}

export class TalaRideRepository {
  private localDataDir: string;
  private localFilePath: string;
  private memoryState: StorageSchema;
  private isSupabaseConfigured: boolean;

  constructor() {
    this.localDataDir = path.resolve(process.cwd(), 'data');
    this.localFilePath = path.join(this.localDataDir, 'talaride-persistence.json');
    this.isSupabaseConfigured =
      Boolean(env.SUPABASE_URL) &&
      !env.SUPABASE_URL.includes('your-project') &&
      !env.SUPABASE_URL.includes('mock.supabase.co');

    this.memoryState = this.loadInitialData();
  }

  private loadInitialData(): StorageSchema {
    // If persistent disk file exists, load it directly to survive process restart
    if (fs.existsSync(this.localFilePath)) {
      try {
        const raw = fs.readFileSync(this.localFilePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('Could not read existing persistence file, reinitializing', err);
      }
    }

    // Default Seed Data
    const seed: StorageSchema = {
      profiles: [
        {
          id: 'USR-DRV-001',
          mobile_number: '09171234567',
          full_name: 'Juan Dela Cruz',
          role: 'driver',
          status: 'active',
          created_at: '2026-09-01T08:00:00.000Z'
        },
        {
          id: 'USR-COM-001',
          mobile_number: '09187654321',
          full_name: 'Maria Santos',
          role: 'passenger',
          status: 'active',
          created_at: '2026-09-10T10:00:00.000Z'
        },
        {
          id: 'USR-ADM-001',
          mobile_number: '09990001122',
          full_name: 'Admin TalaRide',
          role: 'talaride_admin',
          status: 'active',
          created_at: '2026-08-01T00:00:00.000Z'
        }
      ],
      drivers: [
        {
          driver_code: 'DR-000481',
          user_id: 'USR-DRV-001',
          full_name: 'Juan Dela Cruz',
          mobile_number: '09171234567',
          verification_status: 'verified',
          toda_operator: 'Tagum Poblacion TODA',
          license_number: 'N02-14-098765',
          assigned_vehicle_code: 'TR-01842',
          shift_status: 'active',
          active_shift_id: 'SHIFT-2026-001',
          created_at: '2026-09-01T08:00:00.000Z'
        },
        {
          driver_code: 'DR-000512',
          user_id: 'USR-DRV-002',
          full_name: 'Rodrigo Bautista',
          mobile_number: '09201122334',
          verification_status: 'verified',
          toda_operator: 'Magsaysay TODA',
          license_number: 'N03-16-123456',
          assigned_vehicle_code: null,
          shift_status: 'ended',
          active_shift_id: null,
          created_at: '2026-09-15T09:30:00.000Z'
        },
        {
          driver_code: 'DR-000999',
          user_id: 'USR-DRV-003',
          full_name: 'Suspended Driver',
          mobile_number: '09999999999',
          verification_status: 'suspended',
          toda_operator: 'San Miguel TODA',
          license_number: 'N01-99-999999',
          assigned_vehicle_code: null,
          shift_status: 'ended',
          active_shift_id: null,
          created_at: '2026-09-10T09:30:00.000Z'
        }
      ],
      vehicles: [
        {
          vehicle_code: 'TR-01842',
          plate_body_number: 'TAG-842',
          toda: 'Tagum Poblacion TODA',
          status: 'active',
          assigned_driver_code: 'DR-000481',
          assigned_driver_name: 'Juan Dela Cruz',
          qr_checksum: generateVehicleChecksum('TR-01842'),
          created_at: '2026-09-01T08:00:00.000Z'
        },
        {
          vehicle_code: 'TR-00421',
          plate_body_number: 'TAG-421',
          toda: 'Magsaysay TODA',
          status: 'active',
          assigned_driver_code: null,
          assigned_driver_name: null,
          qr_checksum: generateVehicleChecksum('TR-00421'),
          created_at: '2026-09-05T09:00:00.000Z'
        },
        {
          vehicle_code: 'TR-02910',
          plate_body_number: 'TAG-910',
          toda: 'San Miguel TODA',
          status: 'active',
          assigned_driver_code: null,
          assigned_driver_name: null,
          qr_checksum: generateVehicleChecksum('TR-02910'),
          created_at: '2026-09-12T11:00:00.000Z'
        }
      ],
      shifts: [
        {
          shift_id: 'SHIFT-2026-001',
          driver_code: 'DR-000481',
          vehicle_code: 'TR-01842',
          start_time: '2026-10-03T06:00:00.000Z',
          end_time: null,
          status: 'active',
          digital_rides_count: 18,
          digital_gross_centavos: 62000,
          provider_fees_centavos: 1085,
          talaride_fees_centavos: 0,
          digital_net_centavos: 60915,
          cash_rides_count: 12,
          cash_gross_centavos: 36000,
          created_at: '2026-10-03T06:00:00.000Z'
        }
      ],
      rides: [],
      payments: [],
      paymentEvents: [],
      lostItems: [],
      rewards: [],
      paymentIssues: [],
      notifications: [],
      fareConfig: {
        id: 'current',
        standard_fares_centavos: [1500, 2000, 2500, 3000, 4000],
        min_custom_fare_centavos: 1500,
        max_custom_fare_centavos: 50000,
        provider_fee_basis_points: 175,
        talaride_fee_basis_points: 0
      }
    };

    this.persistToDisk(seed);
    return seed;
  }

  private persistToDisk(state: StorageSchema): void {
    try {
      if (!fs.existsSync(this.localDataDir)) {
        fs.mkdirSync(this.localDataDir, { recursive: true });
      }
      fs.writeFileSync(this.localFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database state to disk', err);
    }
  }

  // --- Readiness check ---
  async checkReadiness(): Promise<{ ready: boolean; details: any }> {
    const hasSecrets =
      Boolean(env.QR_INTENT_SECRET) &&
      Boolean(env.PAYMENT_WEBHOOK_SECRET);

    return {
      ready: hasSecrets,
      details: {
        supabaseConfigured: this.isSupabaseConfigured,
        durablePersistenceReady: true,
        environment: env.NODE_ENV,
        paymentMode: env.PAYMENT_MODE
      }
    };
  }

  // --- Profiles & Users ---
  async getProfile(userId: string): Promise<Profile | null> {
    const profile = this.memoryState.profiles.find((p) => p.id === userId);
    return profile || null;
  }

  async getProfileByMobile(mobile: string): Promise<Profile | null> {
    const profile = this.memoryState.profiles.find((p) => p.mobile_number === mobile);
    return profile || null;
  }

  async createProfile(profile: Profile): Promise<Profile> {
    this.memoryState.profiles.push(profile);
    this.persistToDisk(this.memoryState);
    return profile;
  }

  // --- Drivers ---
  async getDriver(driverCode: string): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find((d) => d.driver_code === driverCode);
    return driver || null;
  }

  async getDriverByUserId(userId: string): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find((d) => d.user_id === userId);
    return driver || null;
  }

  async getAllDrivers(): Promise<Driver[]> {
    return [...this.memoryState.drivers];
  }

  async createDriver(driver: Driver): Promise<Driver> {
    this.memoryState.drivers.push(driver);
    this.persistToDisk(this.memoryState);
    return driver;
  }

  async updateDriverStatus(driverCode: string, status: 'verified' | 'suspended'): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find((d) => d.driver_code === driverCode);
    if (!driver) return null;
    driver.verification_status = status;
    if (status === 'suspended') {
      driver.shift_status = 'ended';
      driver.active_shift_id = null;
      driver.assigned_vehicle_code = null;
    }
    this.persistToDisk(this.memoryState);
    return driver;
  }

  // --- Vehicles ---
  async getVehicle(vehicleCode: string): Promise<Vehicle | null> {
    const vehicle = this.memoryState.vehicles.find((v) => v.vehicle_code === vehicleCode);
    return vehicle || null;
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    return [...this.memoryState.vehicles];
  }

  async createVehicle(vehicle: Vehicle): Promise<Vehicle> {
    this.memoryState.vehicles.push(vehicle);
    this.persistToDisk(this.memoryState);
    return vehicle;
  }

  async assignVehicleToDriver(driverCode: string, vehicleCode: string): Promise<{ driver: Driver; vehicle: Vehicle }> {
    const driver = await this.getDriver(driverCode);
    const vehicle = await this.getVehicle(vehicleCode);
    if (!driver || !vehicle) throw new Error('Driver or vehicle not found');

    driver.assigned_vehicle_code = vehicleCode;
    vehicle.assigned_driver_code = driverCode;
    vehicle.assigned_driver_name = driver.full_name;

    this.persistToDisk(this.memoryState);
    return { driver, vehicle };
  }

  // --- Shifts ---
  async getActiveShiftForDriver(driverCode: string): Promise<DriverShift | null> {
    const shift = this.memoryState.shifts.find(
      (s) => s.driver_code === driverCode && s.end_time === null
    );
    return shift || null;
  }

  async getActiveShiftForVehicle(vehicleCode: string): Promise<DriverShift | null> {
    const shift = this.memoryState.shifts.find(
      (s) => s.vehicle_code === vehicleCode && s.end_time === null
    );
    return shift || null;
  }

  async getShift(shiftId: string): Promise<DriverShift | null> {
    const shift = this.memoryState.shifts.find((s) => s.shift_id === shiftId);
    return shift || null;
  }

  async startShift(driverCode: string, vehicleCode: string): Promise<DriverShift> {
    // Check if driver already has active shift (one active shift per driver constraint)
    const existingDriverShift = await this.getActiveShiftForDriver(driverCode);
    if (existingDriverShift) {
      throw new Error(`Driver ${driverCode} already has an active shift ${existingDriverShift.shift_id}`);
    }

    // Check if vehicle is already in active shift (one active shift per vehicle constraint)
    const existingVehicleShift = await this.getActiveShiftForVehicle(vehicleCode);
    if (existingVehicleShift) {
      throw new Error(`Vehicle ${vehicleCode} is already assigned to active shift ${existingVehicleShift.shift_id}`);
    }

    const shiftId = `SHIFT-${Date.now().toString().slice(-6)}`;
    const newShift: DriverShift = {
      shift_id: shiftId,
      driver_code: driverCode,
      vehicle_code: vehicleCode,
      start_time: new Date().toISOString(),
      end_time: null,
      status: 'active',
      digital_rides_count: 0,
      digital_gross_centavos: 0,
      provider_fees_centavos: 0,
      talaride_fees_centavos: 0,
      digital_net_centavos: 0,
      cash_rides_count: 0,
      cash_gross_centavos: 0,
      created_at: new Date().toISOString()
    };

    this.memoryState.shifts.push(newShift);

    // Update driver state
    const driver = await this.getDriver(driverCode);
    if (driver) {
      driver.shift_status = 'active';
      driver.active_shift_id = shiftId;
      driver.assigned_vehicle_code = vehicleCode;
    }

    // Update vehicle assignment
    const vehicle = await this.getVehicle(vehicleCode);
    if (vehicle) {
      vehicle.assigned_driver_code = driverCode;
      vehicle.assigned_driver_name = driver?.full_name || null;
    }

    this.persistToDisk(this.memoryState);
    return newShift;
  }

  async endShift(driverCode: string): Promise<DriverShift | null> {
    const shift = await this.getActiveShiftForDriver(driverCode);
    if (!shift) return null;

    shift.end_time = new Date().toISOString();
    shift.status = 'ended';

    const driver = await this.getDriver(driverCode);
    if (driver) {
      driver.shift_status = 'ended';
      driver.active_shift_id = null;
      driver.assigned_vehicle_code = null;
    }

    const vehicle = await this.getVehicle(shift.vehicle_code);
    if (vehicle) {
      vehicle.assigned_driver_code = null;
      vehicle.assigned_driver_name = null;
    }

    this.persistToDisk(this.memoryState);
    return shift;
  }

  // --- Rides ---
  async createRide(ride: Ride): Promise<Ride> {
    // If clientOperationId is set, check if already recorded
    if (ride.client_operation_id) {
      const existing = this.memoryState.rides.find(
        (r) => r.client_operation_id === ride.client_operation_id
      );
      if (existing) return existing;
    }

    this.memoryState.rides.push(ride);
    this.persistToDisk(this.memoryState);
    return ride;
  }

  async getRide(rideId: string): Promise<Ride | null> {
    const ride = this.memoryState.rides.find((r) => r.ride_id === rideId);
    return ride || null;
  }

  async getRides(filters?: {
    driver_code?: string;
    passenger_id?: string;
    vehicle_code?: string;
  }): Promise<Ride[]> {
    let rides = [...this.memoryState.rides];
    if (filters?.driver_code) {
      rides = rides.filter((r) => r.driver_code === filters.driver_code);
    }
    if (filters?.passenger_id) {
      rides = rides.filter((r) => r.passenger_id === filters.passenger_id);
    }
    if (filters?.vehicle_code) {
      rides = rides.filter((r) => r.vehicle_code === filters.vehicle_code);
    }
    return rides.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async updateRideStatus(rideId: string, status: 'completed' | 'pending' | 'cancelled'): Promise<Ride | null> {
    const ride = this.memoryState.rides.find((r) => r.ride_id === rideId);
    if (!ride) return null;
    ride.status = status;
    this.persistToDisk(this.memoryState);
    return ride;
  }

  // --- Payments ---
  async createPayment(payment: Payment): Promise<Payment> {
    // Enforce ride_id unique constraint
    const existing = this.memoryState.payments.find((p) => p.ride_id === payment.ride_id);
    if (existing) {
      throw new Error(`Payment already exists for ride_id ${payment.ride_id}`);
    }

    this.memoryState.payments.push(payment);
    this.persistToDisk(this.memoryState);
    return payment;
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((p) => p.payment_id === paymentId);
    return payment || null;
  }

  async getPaymentByRideId(rideId: string): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((p) => p.ride_id === rideId);
    return payment || null;
  }

  async getPaymentByProviderRef(providerRef: string): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((p) => p.provider_ref === providerRef);
    return payment || null;
  }

  async getAllPayments(filters?: { query?: string; status?: PaymentStatus }): Promise<Payment[]> {
    let payments = [...this.memoryState.payments];
    if (filters?.status) {
      payments = payments.filter((p) => p.payment_status === filters.status);
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase();
      payments = payments.filter(
        (p) =>
          p.payment_id.toLowerCase().includes(q) ||
          p.driver_code.toLowerCase().includes(q) ||
          p.vehicle_code.toLowerCase().includes(q) ||
          (p.provider_ref && p.provider_ref.toLowerCase().includes(q))
      );
    }
    return payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updatePaymentConfirmation(params: {
    paymentId: string;
    provider: any;
    providerRef: string;
    confirmedAt: string;
    passengerId?: string | null;
    passengerName?: string | null;
    passengerMobile?: string | null;
  }): Promise<{ payment: Payment; ride: Ride; shift: DriverShift | null }> {
    const payment = await this.getPayment(params.paymentId);
    if (!payment) throw new Error('Payment not found');

    // Idempotency: if already confirmed with this provider_ref, return without duplicate shift increments
    if (payment.payment_status === 'confirmed' && payment.provider_ref === params.providerRef) {
      const ride = (await this.getRide(payment.ride_id))!;
      const shift = await this.getActiveShiftForDriver(payment.driver_code);
      return { payment, ride, shift };
    }

    // Provider ref uniqueness constraint
    if (params.providerRef) {
      const dup = this.memoryState.payments.find(
        (p) => p.provider_ref === params.providerRef && p.payment_id !== payment.payment_id
      );
      if (dup) {
        throw new Error(`provider_ref ${params.providerRef} is already attached to payment ${dup.payment_id}`);
      }
    }

    // Update payment
    payment.payment_status = 'confirmed';
    payment.provider = params.provider;
    payment.provider_ref = params.providerRef;
    payment.confirmed_at = params.confirmedAt;

    // Atomically complete ride
    const ride = await this.getRide(payment.ride_id);
    if (ride) {
      ride.status = 'completed';
      if (params.passengerId) ride.passenger_id = params.passengerId;
      if (params.passengerName) ride.passenger_name = params.passengerName;
      if (params.passengerMobile) ride.passenger_mobile = params.passengerMobile;
    }

    // Atomically update driver's active shift
    const shift = await this.getActiveShiftForDriver(payment.driver_code);
    if (shift) {
      shift.digital_rides_count += 1;
      shift.digital_gross_centavos += payment.amount_centavos;
      shift.provider_fees_centavos += payment.provider_fee_centavos;
      shift.talaride_fees_centavos += payment.talaride_fee_centavos;
      shift.digital_net_centavos += payment.net_centavos;
    }

    // Record payment event
    this.addPaymentEvent({
      event_id: `EVT-${Date.now().toString().slice(-6)}`,
      payment_id: payment.payment_id,
      event_type: 'payment_confirmed',
      provider_ref: params.providerRef,
      payload: { amount_centavos: payment.amount_centavos, net_centavos: payment.net_centavos },
      created_at: params.confirmedAt
    });

    this.persistToDisk(this.memoryState);
    return { payment, ride: ride!, shift };
  }

  // --- Payment Events ---
  async addPaymentEvent(event: PaymentEvent): Promise<PaymentEvent> {
    this.memoryState.paymentEvents.push(event);
    this.persistToDisk(this.memoryState);
    return event;
  }

  // --- Rewards ---
  async mintReward(params: {
    userId: string;
    rideId: string;
    points?: number;
  }): Promise<RewardsLedger | null> {
    // Critical constraint: rewards_ledger.ride_id UNIQUE
    const existing = this.memoryState.rewards.find((r) => r.ride_id === params.rideId);
    if (existing) {
      return null; // Already minted, strictly prevent double reward
    }

    // Daily cap rule: max 10 rewards earned per passenger per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayEarnedCount = this.memoryState.rewards.filter(
      (r) => r.user_id === params.userId && r.created_at >= oneDayAgo && r.status === 'earned'
    ).length;

    if (todayEarnedCount >= 10) {
      return null; // Daily cap reached
    }

    const reward: RewardsLedger = {
      reward_id: `REW-${Date.now().toString().slice(-6)}`,
      user_id: params.userId,
      ride_id: params.rideId,
      points: params.points ?? 1,
      status: 'earned',
      reward_type: 'ride_completion',
      created_at: new Date().toISOString()
    };

    this.memoryState.rewards.push(reward);
    this.persistToDisk(this.memoryState);
    return reward;
  }

  async getRewardsForUser(userId: string): Promise<{
    currentPoints: number;
    progressTowardsMilestone: number;
    unlockedRewardsCount: number;
    history: RewardsLedger[];
  }> {
    const userRewards = this.memoryState.rewards.filter((r) => r.user_id === userId);
    const earned = userRewards.filter((r) => r.status === 'earned').reduce((s, r) => s + r.points, 0);
    const redeemed = userRewards.filter((r) => r.status === 'redeemed').length;
    const currentPoints = Math.max(0, earned - redeemed * 10);
    const progressTowardsMilestone = currentPoints % 10;
    const unlockedRewardsCount = Math.floor(currentPoints / 10);

    return {
      currentPoints,
      progressTowardsMilestone,
      unlockedRewardsCount,
      history: userRewards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    };
  }

  async redeemReward(userId: string): Promise<RewardsLedger> {
    const balance = await this.getRewardsForUser(userId);
    if (balance.currentPoints < 10) {
      throw new Error('Insufficient points. Minimum 10 TalaPoints required to redeem.');
    }

    const redemption: RewardsLedger = {
      reward_id: `REW-RED-${Date.now().toString().slice(-6)}`,
      user_id: userId,
      ride_id: null,
      points: 10,
      status: 'redeemed',
      reward_type: 'promotional_voucher',
      created_at: new Date().toISOString()
    };

    this.memoryState.rewards.push(redemption);
    this.persistToDisk(this.memoryState);
    return redemption;
  }

  // --- Lost Items ---
  async createLostItemReport(report: LostItemReport): Promise<LostItemReport> {
    if (report.client_operation_id) {
      const existing = this.memoryState.lostItems.find(
        (l) => l.client_operation_id === report.client_operation_id
      );
      if (existing) return existing;
    }

    this.memoryState.lostItems.push(report);
    this.persistToDisk(this.memoryState);
    return report;
  }

  async getLostItems(filters?: { driver_code?: string; passenger_id?: string }): Promise<LostItemReport[]> {
    let items = [...this.memoryState.lostItems];
    if (filters?.driver_code) {
      items = items.filter((i) => i.driver_code === filters.driver_code);
    }
    if (filters?.passenger_id) {
      items = items.filter((i) => i.passenger_id === filters.passenger_id);
    }
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async respondToLostItem(reportId: string, response: 'found' | 'not_found' | 'contact_support', note?: string): Promise<LostItemReport | null> {
    const report = this.memoryState.lostItems.find((l) => l.report_id === reportId);
    if (!report) return null;

    report.driver_response = response;
    report.driver_response_note = note || null;
    if (response === 'found') {
      report.status = 'found';
      report.resolved_at = new Date().toISOString();
    } else if (response === 'not_found') {
      report.status = 'unresolved';
    } else {
      report.status = 'driver_notified';
    }

    this.persistToDisk(this.memoryState);
    return report;
  }

  // --- Payment Issues ---
  async createPaymentIssue(ticket: PaymentIssueTicket): Promise<PaymentIssueTicket> {
    if (ticket.client_operation_id) {
      const existing = this.memoryState.paymentIssues.find(
        (t) => t.client_operation_id === ticket.client_operation_id
      );
      if (existing) return existing;
    }

    this.memoryState.paymentIssues.push(ticket);
    this.persistToDisk(this.memoryState);
    return ticket;
  }

  async getPaymentIssues(): Promise<PaymentIssueTicket[]> {
    return [...this.memoryState.paymentIssues].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async resolvePaymentIssue(ticketId: string, status: 'resolved' | 'refunded', notes?: string): Promise<PaymentIssueTicket | null> {
    const ticket = this.memoryState.paymentIssues.find((t) => t.ticket_id === ticketId);
    if (!ticket) return null;

    ticket.status = status;
    ticket.resolution_notes = notes || 'Handled by TalaRide Admin support';
    ticket.resolved_at = new Date().toISOString();

    if (status === 'refunded' && ticket.payment_id) {
      const payment = await this.getPayment(ticket.payment_id);
      if (payment) {
        payment.payment_status = 'refunded';
      }
    }

    this.persistToDisk(this.memoryState);
    return ticket;
  }

  // --- Fares Configuration ---
  async getFareConfig(): Promise<FareConfiguration> {
    return { ...this.memoryState.fareConfig };
  }

  async updateFareConfig(config: Partial<FareConfiguration>): Promise<FareConfiguration> {
    if (config.standard_fares_centavos) {
      this.memoryState.fareConfig.standard_fares_centavos = config.standard_fares_centavos;
    }
    if (typeof config.provider_fee_basis_points === 'number') {
      this.memoryState.fareConfig.provider_fee_basis_points = config.provider_fee_basis_points;
    }
    this.persistToDisk(this.memoryState);
    return { ...this.memoryState.fareConfig };
  }

  // --- Reset/Clear (Strictly for test isolation) ---
  resetForTesting(): void {
    if (fs.existsSync(this.localFilePath)) {
      try {
        fs.unlinkSync(this.localFilePath);
      } catch {}
    }
    this.memoryState = this.loadInitialData();
  }
}

export const repository = new TalaRideRepository();
