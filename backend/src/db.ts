import {
  User,
  Driver,
  Vehicle,
  DriverShift,
  Ride,
  Payment,
  LostItemReport,
  RewardsTransaction,
  FareConfiguration,
  PaymentIssueTicket
} from './types.js';

class InMemoryDatabase {
  users: Map<string, User> = new Map();
  drivers: Map<string, Driver> = new Map();
  vehicles: Map<string, Vehicle> = new Map();
  shifts: Map<string, DriverShift> = new Map();
  rides: Map<string, Ride> = new Map();
  payments: Map<string, Payment> = new Map();
  lostItems: Map<string, LostItemReport> = new Map();
  rewards: Map<string, RewardsTransaction> = new Map();
  paymentIssues: Map<string, PaymentIssueTicket> = new Map();
  fareConfig: FareConfiguration = {
    standard_fares: [15, 20, 25, 30, 40],
    min_custom_fare: 15,
    max_custom_fare: 500,
    provider_fee_percentage: 1.75, // 1.75% QR Ph / e-wallet gateway fee
    talaride_platform_fee: 0
  };

  constructor() {
    this.seed();
  }

  seed() {
    // 1. Initial Users
    const driverUser: User = {
      user_id: 'USR-DRV-001',
      mobile_number: '09171234567',
      name: 'Juan Dela Cruz',
      account_type: 'driver',
      status: 'active',
      created_at: '2026-09-01T08:00:00Z'
    };

    const commuterUser: User = {
      user_id: 'USR-COM-001',
      mobile_number: '09187654321',
      name: 'Maria Santos',
      account_type: 'commuter',
      status: 'active',
      created_at: '2026-09-10T10:00:00Z'
    };

    const adminUser: User = {
      user_id: 'USR-ADM-001',
      mobile_number: '09990001122',
      name: 'Admin TalaRide',
      account_type: 'admin',
      status: 'active',
      created_at: '2026-08-01T00:00:00Z'
    };

    this.users.set(driverUser.user_id, driverUser);
    this.users.set(commuterUser.user_id, commuterUser);
    this.users.set(adminUser.user_id, adminUser);

    // 2. Initial Vehicles
    const vehicle1: Vehicle = {
      vehicle_id: 'TR-01842',
      plate_body_number: 'TAG-842',
      toda: 'Tagum Poblacion TODA',
      status: 'active',
      assigned_driver_id: 'DR-000481',
      assigned_driver_name: 'Juan Dela Cruz',
      qr_code_payload: 'TALARIDE:VEHICLE:TR-01842',
      created_at: '2026-09-01T08:00:00Z'
    };

    const vehicle2: Vehicle = {
      vehicle_id: 'TR-00421',
      plate_body_number: 'TAG-421',
      toda: 'Magsaysay TODA',
      status: 'active',
      assigned_driver_id: null,
      assigned_driver_name: null,
      qr_code_payload: 'TALARIDE:VEHICLE:TR-00421',
      created_at: '2026-09-05T09:00:00Z'
    };

    const vehicle3: Vehicle = {
      vehicle_id: 'TR-02910',
      plate_body_number: 'TAG-910',
      toda: 'San Miguel TODA',
      status: 'active',
      assigned_driver_id: null,
      assigned_driver_name: null,
      qr_code_payload: 'TALARIDE:VEHICLE:TR-02910',
      created_at: '2026-09-12T11:00:00Z'
    };

    this.vehicles.set(vehicle1.vehicle_id, vehicle1);
    this.vehicles.set(vehicle2.vehicle_id, vehicle2);
    this.vehicles.set(vehicle3.vehicle_id, vehicle3);

    // 3. Initial Driver (DR-000481)
    const driver: Driver = {
      driver_id: 'DR-000481',
      user_id: driverUser.user_id,
      name: 'Juan Dela Cruz',
      mobile_number: '09171234567',
      verification_status: 'verified',
      toda_operator: 'Tagum Poblacion TODA',
      assigned_vehicle_id: 'TR-01842',
      shift_status: 'active',
      active_shift_id: 'SHIFT-2026-001',
      license_number: 'N02-14-098765',
      created_at: '2026-09-01T08:00:00Z'
    };

    const driver2: Driver = {
      driver_id: 'DR-000512',
      user_id: 'USR-DRV-002',
      name: 'Rodrigo Bautista',
      mobile_number: '09201122334',
      verification_status: 'verified',
      toda_operator: 'Magsaysay TODA',
      assigned_vehicle_id: null,
      shift_status: 'ended',
      active_shift_id: null,
      license_number: 'N03-16-123456',
      created_at: '2026-09-15T09:30:00Z'
    };

    this.drivers.set(driver.driver_id, driver);
    this.drivers.set(driver2.driver_id, driver2);

    // 4. Initial Active Shift matching spec:
    // "Digital rides: 18, Digital payments: ₱620, fees: ₱10.85, net: ₱609.15, Cash: 12"
    const shift: DriverShift = {
      shift_id: 'SHIFT-2026-001',
      driver_id: 'DR-000481',
      vehicle_id: 'TR-01842',
      start_time: '2026-10-03T06:00:00Z',
      end_time: null,
      status: 'active',
      digital_rides_count: 18,
      digital_gross_total: 620,
      provider_platform_fees: 10.85,
      digital_net_total: 609.15,
      cash_rides_count: 12,
      cash_gross_total: 360
    };
    this.shifts.set(shift.shift_id, shift);

    // 5. Seed Historical Rides
    const ride1: Ride = {
      ride_id: 'RIDE-2026-1003-01',
      driver_id: 'DR-000481',
      driver_name: 'Juan Dela Cruz',
      vehicle_id: 'TR-01842',
      passenger_id: 'USR-COM-001',
      passenger_name: 'Maria Santos',
      passenger_mobile: '09187654321',
      timestamp: '2026-10-03T20:42:00+08:00',
      approximate_location: 'Tagum City Commercial Center',
      payment_method: 'digital',
      fare_amount: 30,
      status: 'completed'
    };

    const ride2: Ride = {
      ride_id: 'RIDE-2026-1002-04',
      driver_id: 'DR-000481',
      driver_name: 'Juan Dela Cruz',
      vehicle_id: 'TR-00421',
      passenger_id: 'USR-COM-001',
      passenger_name: 'Maria Santos',
      passenger_mobile: '09187654321',
      timestamp: '2026-10-02T19:16:00+08:00',
      approximate_location: 'Magsaysay Ave, Tagum City',
      payment_method: 'cash',
      fare_amount: 25,
      status: 'completed',
      is_checkin_only: true
    };

    this.rides.set(ride1.ride_id, ride1);
    this.rides.set(ride2.ride_id, ride2);

    // 6. Seed Payment
    const payment1: Payment = {
      payment_id: 'PAY-2026-1003-01',
      ride_id: ride1.ride_id,
      driver_id: 'DR-000481',
      vehicle_id: 'TR-01842',
      amount: 30,
      provider: 'gcash',
      provider_reference: 'GCASH-REF-8842109',
      payment_status: 'paid',
      provider_fee: 0.53,
      talaride_fee: 0,
      net_amount: 29.47,
      qr_payload: 'TALARIDE:PAY:PAY-2026-1003-01:TR-01842:30',
      created_at: '2026-10-03T20:41:30+08:00',
      expires_at: '2026-10-03T20:51:30+08:00',
      paid_at: '2026-10-03T20:42:00+08:00'
    };
    this.payments.set(payment1.payment_id, payment1);

    // 7. Seed Rewards for Maria Santos (8 out of 10 completed digital rides towards promo reward)
    for (let i = 1; i <= 8; i++) {
      const rew: RewardsTransaction = {
        reward_id: `REW-${1000 + i}`,
        user_id: 'USR-COM-001',
        ride_id: i === 1 ? ride1.ride_id : `RIDE-HIST-${i}`,
        points: 1,
        status: 'earned',
        reward_type: 'ride_completion',
        created_at: `2026-09-${20 + i}T12:00:00Z`
      };
      this.rewards.set(rew.reward_id, rew);
    }

    // 8. Seed Lost Item report for demonstration
    const lostItem1: LostItemReport = {
      report_id: 'LIR-0042',
      ride_id: ride1.ride_id,
      vehicle_id: 'TR-01842',
      driver_id: 'DR-000481',
      passenger_id: 'USR-COM-001',
      passenger_name: 'Maria Santos',
      passenger_contact: '09187654321',
      item_category: 'wallet',
      description: 'Black leather wallet with UMID ID and student card left on tricycle bench.',
      status: 'driver_notified',
      driver_response: null,
      created_at: '2026-10-03T21:10:00+08:00',
      resolved_at: null
    };
    this.lostItems.set(lostItem1.report_id, lostItem1);
  }

  // Calculate fee breakdown
  calculateFees(amount: number) {
    const feePct = this.fareConfig.provider_fee_percentage;
    const providerFee = Number(((amount * feePct) / 100).toFixed(2));
    const talarideFee = this.fareConfig.talaride_platform_fee;
    const net = Number((amount - providerFee - talarideFee).toFixed(2));
    return { providerFee, talarideFee, net };
  }
}

export const db = new InMemoryDatabase();
