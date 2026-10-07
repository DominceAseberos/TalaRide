import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { env, paymentProviderConfigured, paymentSimulationConfigured } from '../env.js';
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
  PaymentStatus,
  TodaGroup,
  WebCheckoutSession
} from '../types.js';

function cloudPersistenceConfigured(): boolean {
  const hasRealUrl =
    Boolean(env.SUPABASE_URL) &&
    !env.SUPABASE_URL.includes('your-project') &&
    !env.SUPABASE_URL.includes('mock.supabase.co');
  const hasServerCredential =
    env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_') ||
    env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ');
  return env.NODE_ENV !== 'test' && hasRealUrl && hasServerCredential;
}

interface StorageSchema {
  profiles: Profile[];
  todaGroups: TodaGroup[];
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
  webSessions: WebCheckoutSession[];
  fareConfig: FareConfiguration;
}

export class TalaRideRepository {
  private localDataDir: string;
  private localFilePath: string;
  private memoryState: StorageSchema;
  private isSupabaseConfigured: boolean;

  constructor() {
    this.localDataDir = env.DATA_DIR
      ? path.resolve(env.DATA_DIR)
      : path.resolve(process.cwd(), 'data');
    this.localFilePath = path.join(this.localDataDir, 'talaride-persistence.json');
    this.isSupabaseConfigured = cloudPersistenceConfigured();

    this.memoryState = this.loadInitialData();
  }

  private loadInitialData(): StorageSchema {
    // Production never loads demo seeds or an ephemeral local cache.
    if (env.NODE_ENV === 'production') return this.emptyState();
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
          role: 'admin',
          status: 'active',
          created_at: '2026-08-01T00:00:00.000Z'
        }
      ],
      todaGroups: [],
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
      webSessions: [],
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
    if (env.NODE_ENV === 'production') return;
    try {
      if (!fs.existsSync(this.localDataDir)) {
        fs.mkdirSync(this.localDataDir, { recursive: true });
      }
      fs.writeFileSync(this.localFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      throw new Error('Could not persist records.');
    }
  }

  private emptyState(): StorageSchema {
    return {
      profiles: [], todaGroups: [], drivers: [], vehicles: [], shifts: [], rides: [], payments: [],
      paymentEvents: [], lostItems: [], rewards: [], paymentIssues: [], notifications: [], webSessions: [],
      fareConfig: { id: 'current', standard_fares_centavos: [1500, 2000, 2500, 3000, 4000],
        min_custom_fare_centavos: 1500, max_custom_fare_centavos: 50000,
        provider_fee_basis_points: 175, talaride_fee_basis_points: 0 },
    };
  }

  private cloudQueue: Promise<unknown> = Promise.resolve();

  // Serialize local operations and use a database compare-and-swap to protect writes
  // across restarts/instances. No response is acknowledged before its cloud commit.
  cloudCall(method: string, args: unknown[]): Promise<unknown> {
    const run = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const initial = await supabaseAdmin.from('talaride_backend_state').upsert(
          { id: 'canonical', state: this.emptyState() }, { onConflict: 'id', ignoreDuplicates: true },
        );
        if (initial.error) throw new Error('Durable database unavailable. Apply the backend storage migration.');
        const { data, error } = await supabaseAdmin.from('talaride_backend_state').select('state,revision').eq('id', 'canonical').single();
        if (error || !data) throw new Error('Durable database unavailable.');
        this.memoryState = structuredClone(data.state) as StorageSchema;
        const before = JSON.stringify(this.memoryState);
        const result = await (this as any)[method](...args);
        if (JSON.stringify(this.memoryState) === before) return structuredClone(result);
        const committed = await supabaseAdmin.rpc('talaride_commit_state', {
          expected_revision: data.revision, next_state: this.memoryState,
        });
        if (committed.error) throw new Error('Database write failed. Please try again.');
        if (committed.data === true) return structuredClone(result);
      }
      throw new Error('Records changed during this request. Please retry.');
    };
    const next = this.cloudQueue.then(run, run);
    this.cloudQueue = next.catch(() => {});
    return next;
  }

  async checkReadiness(): Promise<{ ready: boolean; details: any }> {
    const useCloudPersistence = env.NODE_ENV === 'production' || cloudPersistenceConfigured();
    let databaseReady = !useCloudPersistence;
    let commitFunctionReady = !useCloudPersistence;
    let databaseHttpStatus: number | undefined;
    let commitHttpStatus: number | undefined;
    if (useCloudPersistence) {
      const { error, status } = await supabaseAdmin.from('talaride_backend_state').select('id').limit(1);
      databaseHttpStatus = status;
      databaseReady = !error;
      const commit = await supabaseAdmin.rpc('talaride_commit_state', { expected_revision: -1, next_state: {} });
      commitHttpStatus = commit.status;
      commitFunctionReady = !commit.error && commit.data === false;
    }
    const simulationPaymentsEnabled = paymentSimulationConfigured();
    const providerPaymentsEnabled = env.PAYMENT_MODE === 'live';
    const providerKeyConfigured = paymentProviderConfigured();
    const webhookConfigured = !!env.PAYMENT_WEBHOOK_SECRET && !env.PAYMENT_WEBHOOK_SECRET.startsWith('mock_');
    const paymentConfigurationReady = simulationPaymentsEnabled ||
      (providerPaymentsEnabled && providerKeyConfigured && webhookConfigured);
    const configuration = {
      demoAuthDisabled: !env.DEMO_AUTH,
      simulationPaymentsEnabled,
      providerPaymentsEnabled,
      paymentConfigurationReady,
      providerKeyConfigured,
      publicAuthKeyConfigured: !!env.SUPABASE_PUBLISHABLE_KEY,
      qrSigningConfigured: env.QR_INTENT_SECRET.length >= 32 && !env.QR_INTENT_SECRET.includes('talaride_qr_secret'),
      webhookConfigured,
    };
    const liveConfiguration = env.NODE_ENV !== 'production' || (
      configuration.demoAuthDisabled &&
      configuration.publicAuthKeyConfigured &&
      configuration.qrSigningConfigured &&
      configuration.paymentConfigurationReady
    );
    return { ready: databaseReady && commitFunctionReady && liveConfiguration, details: {
      durablePersistenceReady: databaseReady, environment: env.NODE_ENV,
      databaseHttpStatus, commitHttpStatus,
      databaseCredentialType: env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_') ? 'publishable'
        : env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_') ? 'secret'
        : env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ') ? 'legacy-jwt' : 'unrecognized',
      persistence: useCloudPersistence ? 'supabase' : (env.NODE_ENV === 'test' ? 'test-local' : 'local-fallback'),
      paymentMode: env.PAYMENT_MODE, paymentEnvironment: env.PAYMENT_ENVIRONMENT,
      liveConfiguration, commitFunctionReady, configuration,
    } };
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

  // --- Durable guest checkout sessions ---
  private cleanupWebSessions(now = Date.now()): void {
    this.memoryState.webSessions ||= [];
    this.memoryState.webSessions = this.memoryState.webSessions.filter((session) =>
      !session.consumed && Date.parse(session.expires_at) > now
    );
  }

  async createWebSession(vehicleCode: string, ownerHash: string, ttlMs: number): Promise<WebCheckoutSession> {
    this.cleanupWebSessions();
    if (this.memoryState.webSessions.length >= 10000) throw new Error('Too many active ride sessions. Try again shortly.');
    const now = Date.now();
    const session: WebCheckoutSession = {
      session_id: randomUUID(),
      vehicle_code: vehicleCode,
      owner_hash: ownerHash,
      expires_at: new Date(now + ttlMs).toISOString(),
      reserved: false,
      consumed: false,
      payment_id: null,
      created_at: new Date(now).toISOString(),
    };
    this.memoryState.webSessions.push(session);
    this.persistToDisk(this.memoryState);
    return session;
  }

  async getWebSession(sessionId: string): Promise<WebCheckoutSession | null> {
    this.cleanupWebSessions();
    return this.memoryState.webSessions.find((session) => session.session_id === sessionId) || null;
  }

  async reserveWebSession(sessionId: string, vehicleCode: string, ownerHash: string): Promise<WebCheckoutSession | null> {
    this.cleanupWebSessions();
    const session = this.memoryState.webSessions.find((entry) => entry.session_id === sessionId);
    if (!session || session.consumed || session.reserved || session.owner_hash !== ownerHash || session.vehicle_code !== vehicleCode) return null;
    session.reserved = true;
    this.persistToDisk(this.memoryState);
    return session;
  }

  async releaseWebSession(sessionId: string, ownerHash: string): Promise<void> {
    this.cleanupWebSessions();
    const session = this.memoryState.webSessions.find((entry) => entry.session_id === sessionId);
    if (session && !session.consumed && session.owner_hash === ownerHash) {
      session.reserved = false;
      session.payment_id = null;
      this.persistToDisk(this.memoryState);
    }
  }

  async attachPaymentToWebSession(sessionId: string, ownerHash: string, paymentId: string): Promise<boolean> {
    this.cleanupWebSessions();
    const session = this.memoryState.webSessions.find((entry) => entry.session_id === sessionId);
    if (!session || session.consumed || session.owner_hash !== ownerHash || !session.reserved) return false;
    session.payment_id = paymentId;
    this.persistToDisk(this.memoryState);
    return true;
  }

  async consumeWebSession(sessionId: string, paymentId?: string): Promise<boolean> {
    this.cleanupWebSessions();
    const session = this.memoryState.webSessions.find((entry) => entry.session_id === sessionId);
    if (!session || session.consumed) return false;
    if (paymentId && session.payment_id !== paymentId) return false;
    session.consumed = true;
    session.reserved = false;
    this.persistToDisk(this.memoryState);
    return true;
  }

  async getTodaGroups(): Promise<TodaGroup[]> {
    return [...(this.memoryState.todaGroups || [])].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTodaGroup(id: string): Promise<TodaGroup | null> {
    return (this.memoryState.todaGroups || []).find(group => group.id === id) || null;
  }

  async createTodaGroup(name: string, createdBy: string): Promise<TodaGroup> {
    const cleanName = name.trim();
    if ((this.memoryState.todaGroups || []).some(group => group.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('A TODA group with this name already exists.');
    }
    const group: TodaGroup = {
      id: randomUUID(),
      name: cleanName,
      is_placeholder: false,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
    this.memoryState.todaGroups ||= [];
    this.memoryState.todaGroups.push(group);
    this.persistToDisk(this.memoryState);
    return group;
  }

  async ensureOperatorTodaGroup(userId: string): Promise<TodaGroup> {
    const profile = this.memoryState.profiles.find(profile => profile.id === userId);
    if (!profile) throw new Error('Operator profile not found.');

    if (profile.toda_group_id) {
      const existing = (this.memoryState.todaGroups || []).find(group => group.id === profile.toda_group_id);
      if (existing) return existing;
    }

    const now = new Date().toISOString();
    const group: TodaGroup = {
      id: randomUUID(),
      name: 'Untitled TODA',
      is_placeholder: true,
      created_at: now,
      created_by: userId,
      updated_at: now,
    };
    this.memoryState.todaGroups ||= [];
    this.memoryState.todaGroups.push(group);
    profile.toda_group_id = group.id;
    profile.updated_at = now;
    this.persistToDisk(this.memoryState);
    return group;
  }

  async ensureTodaGroupReference(
    id: string,
    name: string,
    createdBy: string,
  ): Promise<TodaGroup> {
    const existing = (this.memoryState.todaGroups || []).find(group => group.id === id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const group: TodaGroup = {
      id,
      name: name.trim() || 'Untitled TODA',
      is_placeholder: !name.trim(),
      created_at: now,
      created_by: createdBy,
      updated_at: now,
    };
    this.memoryState.todaGroups ||= [];
    this.memoryState.todaGroups.push(group);
    this.persistToDisk(this.memoryState);
    return group;
  }

  async assignOperatorToTodaGroup(userId: string, groupId: string): Promise<TodaGroup | null> {
    const profile = this.memoryState.profiles.find(profile => profile.id === userId);
    const group = (this.memoryState.todaGroups || []).find(group => group.id === groupId);
    if (!profile || !group) return null;
    profile.toda_group_id = group.id;
    profile.updated_at = new Date().toISOString();
    this.persistToDisk(this.memoryState);
    return group;
  }

  async renameTodaGroup(groupId: string, name: string): Promise<TodaGroup | null> {
    const cleanName = name.trim();
    const group = (this.memoryState.todaGroups || []).find(group => group.id === groupId);
    if (!group) return null;
    if ((this.memoryState.todaGroups || []).some(
      other => other.id !== groupId && other.name.toLowerCase() === cleanName.toLowerCase() && !other.is_placeholder
    )) {
      throw new Error('A TODA group with this name already exists.');
    }

    const now = new Date().toISOString();
    group.name = cleanName;
    group.is_placeholder = false;
    group.updated_at = now;

    for (const driver of this.memoryState.drivers) {
      if (driver.toda_group_id !== groupId) continue;
      driver.toda_operator = cleanName;
      driver.updated_at = now;
      const vehicle = driver.assigned_vehicle_code ? this.memoryState.vehicles.find(item => item.vehicle_code === driver.assigned_vehicle_code) : undefined;
      if (vehicle) {
        vehicle.toda = cleanName;
        vehicle.updated_at = now;
      }
    }

    this.persistToDisk(this.memoryState);
    return group;
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

  async registerDriver(userId: string, details: Pick<Driver, 'full_name' | 'mobile_number' | 'toda_operator' | 'license_number'>): Promise<Driver> {
    if (this.memoryState.drivers.some(d => d.user_id === userId)) throw new Error('Driver already registered.');
    let code: string;
    do { code = `DR-${String(randomInt(0, 1000000)).padStart(6, '0')}`; } while (this.memoryState.drivers.some(d => d.driver_code === code));
    return this.createDriver({ ...details, user_id: userId, driver_code: code, verification_status: 'pending', assigned_vehicle_code: null, shift_status: 'ended', active_shift_id: null, created_at: new Date().toISOString() });
  }

  async createDriver(driver: Driver): Promise<Driver> {
    this.memoryState.drivers.push(driver);
    this.persistToDisk(this.memoryState);
    return driver;
  }

  async addDriverToToda(driverCode: string, group: { id: string; name: string }, operatorId: string): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find(d => d.driver_code === driverCode);
    if (!driver) return null;
    if (driver.toda_group_id && driver.toda_group_id !== group.id) throw new Error('Driver already belongs to another TODA group. Ask an admin to resolve the membership.');
    if (driver.toda_group_id === group.id) return driver;
    driver.toda_group_id = group.id;
    driver.toda_operator = group.name;
    driver.membership_added_by = operatorId;
    driver.membership_added_at = new Date().toISOString();
    driver.updated_at = driver.membership_added_at;
    const vehicle = driver.assigned_vehicle_code ? this.memoryState.vehicles.find(item => item.vehicle_code === driver.assigned_vehicle_code) : undefined;
    if (vehicle) {
      vehicle.toda = group.name;
      vehicle.updated_at = driver.membership_added_at;
    }
    this.persistToDisk(this.memoryState);
    return driver;
  }

  async assignDriverToToda(driverCode: string, group: { id: string; name: string }, adminId: string): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find(d => d.driver_code === driverCode);
    if (!driver) return null;
    driver.toda_group_id = group.id;
    driver.toda_operator = group.name;
    driver.membership_added_by = adminId;
    driver.membership_added_at = new Date().toISOString();
    driver.updated_at = driver.membership_added_at;
    const vehicle = driver.assigned_vehicle_code ? this.memoryState.vehicles.find(item => item.vehicle_code === driver.assigned_vehicle_code) : undefined;
    if (vehicle) {
      vehicle.toda = group.name;
      vehicle.updated_at = driver.membership_added_at;
    }
    this.persistToDisk(this.memoryState);
    return driver;
  }

  async updateDriverStatus(driverCode: string, status: 'verified' | 'suspended', adminId?: string): Promise<Driver | null> {
    const driver = this.memoryState.drivers.find((d) => d.driver_code === driverCode);
    if (!driver) return null;
    driver.verification_status = status;
    driver.updated_at = new Date().toISOString();
    if (status === 'verified' && adminId) {
      driver.verified_by = adminId;
      driver.verified_at = driver.updated_at;
    }
    if (status === 'suspended') {
      driver.shift_status = 'ended';
      driver.active_shift_id = null;
      driver.assigned_vehicle_code = null;
    }
    this.persistToDisk(this.memoryState);
    return driver;
  }

  async updateDriverPhoto(driverCode: string, photoUrl: string | null): Promise<Driver | null> {
    const driver = await this.getDriver(driverCode);
    if (!driver) return null;
    driver.photo_url = photoUrl;
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

  async registerVehicleForDriver(userId: string, plateBodyNumber: string): Promise<{ driver: Driver; vehicle: Vehicle; created: boolean }> {
    const driver = this.memoryState.drivers.find(item => item.user_id === userId);
    if (!driver) throw new Error('Driver registration not found.');
    if (driver.verification_status !== 'verified') throw new Error('An administrator must verify the driver before registering a tricycle.');
    if (driver.assigned_vehicle_code) {
      const existing = this.memoryState.vehicles.find(item => item.vehicle_code === driver.assigned_vehicle_code);
      if (existing) return { driver, vehicle: existing, created: false };
    }

    const normalizedPlate = plateBodyNumber.trim().toUpperCase();
    const duplicate = this.memoryState.vehicles.find(item => item.plate_body_number.trim().toUpperCase() === normalizedPlate);
    if (duplicate) throw new Error('This plate or body number is already registered.');

    let vehicleCode: string;
    do { vehicleCode = `TR-${String(randomInt(0, 100000)).padStart(5, '0')}`; } while (this.memoryState.vehicles.some(item => item.vehicle_code === vehicleCode));
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      vehicle_code: vehicleCode,
      plate_body_number: plateBodyNumber.trim(),
      toda: driver.toda_group_id ? driver.toda_operator : '',
      status: 'active',
      assigned_driver_code: driver.driver_code,
      assigned_driver_name: driver.full_name,
      qr_checksum: generateVehicleChecksum(vehicleCode),
      created_at: now,
    };
    this.memoryState.vehicles.push(vehicle);
    driver.assigned_vehicle_code = vehicleCode;
    driver.updated_at = now;
    this.persistToDisk(this.memoryState);
    return { driver, vehicle, created: true };
  }

  async assignVehicleToDriver(driverCode: string, vehicleCode: string): Promise<{ driver: Driver; vehicle: Vehicle }> {
    const driver = await this.getDriver(driverCode);
    const vehicle = await this.getVehicle(vehicleCode);
    if (!driver || !vehicle) throw new Error('Driver or vehicle not found');
    if (driver.verification_status !== 'verified') throw new Error('Verify the driver before assigning a vehicle.');
    if (vehicle.assigned_driver_code && vehicle.assigned_driver_code !== driverCode) throw new Error('Vehicle is already assigned to another driver.');
    if (driver.assigned_vehicle_code && driver.assigned_vehicle_code !== vehicleCode) throw new Error('Driver already has an assigned vehicle.');

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

    const shiftId = `SHIFT-${randomUUID()}`;
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
    }

    const vehicle = await this.getVehicle(shift.vehicle_code);
    if (vehicle) {
      vehicle.assigned_driver_code = driverCode;
      vehicle.assigned_driver_name = driver?.full_name || null;
    }

    this.persistToDisk(this.memoryState);
    return shift;
  }

  // --- Rides ---
  async createRide(ride: Ride): Promise<Ride> {
    // If clientOperationId is set, check if already recorded
    if (ride.client_operation_id) {
      const existing = this.memoryState.rides.find(
        (r) => r.client_operation_id === ride.client_operation_id && r.passenger_id === ride.passenger_id && r.driver_code === ride.driver_code
      );
      if (existing) return existing;
    }

    this.memoryState.rides.push(ride);
    if (ride.payment_method === 'cash' && ride.status === 'completed' && !ride.is_checkin_only) {
      const shift = this.memoryState.shifts.find(s => s.driver_code === ride.driver_code && s.vehicle_code === ride.vehicle_code && s.status === 'active');
      if (shift) { shift.cash_rides_count += 1; shift.cash_gross_centavos += ride.fare_amount_centavos; }
    }
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

  async confirmPendingCashRide(rideId: string, driverCode: string): Promise<Ride | null> {
    const ride = this.memoryState.rides.find((entry) => entry.ride_id === rideId);
    if (!ride) return null;
    if (ride.driver_code !== driverCode || ride.payment_method !== 'cash' || ride.is_checkin_only) {
      throw new Error('Cash ride does not belong to this driver.');
    }
    if (ride.status === 'completed') return ride;
    if (ride.status !== 'pending') throw new Error('Cash ride is not awaiting confirmation.');

    const shift = ride.shift_id
      ? this.memoryState.shifts.find((entry) => entry.shift_id === ride.shift_id)
      : this.memoryState.shifts.find(
          (entry) =>
            entry.driver_code === ride.driver_code &&
            entry.vehicle_code === ride.vehicle_code &&
            entry.status === 'active',
        );
    if (!shift) throw new Error('The originating driver shift could not be found.');

    ride.status = 'completed';
    shift.cash_rides_count += 1;
    shift.cash_gross_centavos += ride.fare_amount_centavos;
    this.persistToDisk(this.memoryState);
    return ride;
  }

  // --- Payments ---
  async createRideAndPayment(
    ride: Ride,
    payment: Payment,
    event: PaymentEvent
  ): Promise<{ ride: Ride; payment: Payment; created: boolean }> {
    if (payment.ride_id !== ride.ride_id || event.payment_id !== payment.payment_id) {
      throw new Error('Payment record mismatch');
    }

    // Enforce checkout idempotency inside the same serialized repository
    // mutation used for the actual insert. This closes the race where two
    // requests both pass a route-level lookup before either has persisted.
    if (payment.client_operation_id) {
      const existingPayment = this.memoryState.payments.find((entry) =>
        entry.client_operation_id === payment.client_operation_id &&
        (entry.payment_environment ?? 'live') === (payment.payment_environment ?? 'live') &&
        (payment.owner_user_id
          ? entry.owner_user_id === payment.owner_user_id
          : !!payment.owner_browser_hash && entry.owner_browser_hash === payment.owner_browser_hash)
      );
      if (existingPayment) {
        const existingRide = this.memoryState.rides.find(
          (entry) => entry.ride_id === existingPayment.ride_id,
        );
        if (!existingRide) throw new Error('Idempotent payment is missing its ride record');
        return { ride: existingRide, payment: existingPayment, created: false };
      }
    }

    if (
      this.memoryState.rides.some((r) => r.ride_id === ride.ride_id) ||
      this.memoryState.payments.some(
        (p) => p.ride_id === ride.ride_id || p.payment_id === payment.payment_id,
      )
    ) {
      throw new Error('Payment already exists');
    }

    this.memoryState.rides.push(ride);
    this.memoryState.payments.push(payment);
    this.memoryState.paymentEvents.push(event);
    this.persistToDisk(this.memoryState);
    return { ride, payment, created: true };
  }

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

  async updatePaymentCheckout(
    paymentId: string,
    checkoutSessionId: string,
    checkoutUrl: string
  ): Promise<Payment> {
    const payment = await this.getPayment(paymentId);
    if (!payment) throw new Error('Payment not found');
    payment.checkout_session_id = checkoutSessionId;
    payment.checkout_url = checkoutUrl;
    this.persistToDisk(this.memoryState);
    return payment;
  }

  async getPaymentByRideId(rideId: string): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((p) => p.ride_id === rideId);
    return payment || null;
  }

  async getPaymentByProviderRef(providerRef: string): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((p) => p.provider_ref === providerRef);
    return payment || null;
  }

  async getPaymentByClientOperation(params: {
    clientOperationId: string;
    ownerUserId?: string | null;
    ownerBrowserHash?: string | null;
    environment?: 'test' | 'live';
  }): Promise<Payment | null> {
    const payment = this.memoryState.payments.find((entry) =>
      entry.client_operation_id === params.clientOperationId &&
      (!params.environment || (entry.payment_environment ?? 'live') === params.environment) &&
      (params.ownerUserId
        ? entry.owner_user_id === params.ownerUserId
        : !!params.ownerBrowserHash && entry.owner_browser_hash === params.ownerBrowserHash)
    );
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

    // Once a payment is confirmed, every later provider retry is a no-op even
    // if the provider sends a different event/reference for the same payment.
    if (payment.payment_status === 'confirmed') {
      const ride = (await this.getRide(payment.ride_id))!;
      const shift = payment.shift_id
        ? await this.getShift(payment.shift_id)
        : await this.getActiveShiftForDriver(payment.driver_code);
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

    // Attribute delayed confirmations to the shift that created the payment,
    // not whichever shift happens to be active when the webhook arrives.
    const shift = payment.shift_id
      ? await this.getShift(payment.shift_id)
      : await this.getActiveShiftForDriver(payment.driver_code);
    if (shift) {
      shift.digital_rides_count += 1;
      shift.digital_gross_centavos += payment.amount_centavos;
      shift.provider_fees_centavos += payment.provider_fee_centavos;
      shift.talaride_fees_centavos += payment.talaride_fee_centavos;
      shift.digital_net_centavos += payment.net_centavos;
    }

    // Record payment event
    this.addPaymentEvent({
      event_id: `EVT-${randomUUID()}`,
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
    environment?: 'test' | 'live';
  }): Promise<RewardsLedger | null> {
    // A completed ride can reward both the passenger and the driver, once each.
    const environment = params.environment ?? env.PAYMENT_ENVIRONMENT;
    const existing = this.memoryState.rewards.find(
      (r) => r.ride_id === params.rideId && r.user_id === params.userId && r.reward_type === 'ride_completion'
    );
    if (existing) {
      return null; // Already minted, strictly prevent double reward
    }

    const reward: RewardsLedger = {
      reward_id: `REW-${randomUUID()}`,
      user_id: params.userId,
      ride_id: params.rideId,
      points: params.points ?? 1,
      status: 'earned',
      reward_type: 'ride_completion',
      environment,
      created_at: new Date().toISOString()
    };

    this.memoryState.rewards.push(reward);
    this.persistToDisk(this.memoryState);
    return reward;
  }

  async mintRideRewards(params: {
    passengerUserId?: string | null;
    driverUserId?: string | null;
    rideId: string;
    environment: 'test' | 'live';
  }): Promise<{ passengerPointsAwarded: number; driverPointsAwarded: number }> {
    // Keep both awards in the same durable-state commit so a retry cannot
    // leave one side of a completed ride without its reward.
    const passenger = params.passengerUserId
      ? await this.mintReward({ userId: params.passengerUserId, rideId: params.rideId, environment: params.environment })
      : null;
    const driver = params.driverUserId
      ? await this.mintReward({ userId: params.driverUserId, rideId: params.rideId, environment: params.environment })
      : null;
    return {
      passengerPointsAwarded: passenger?.points ?? 0,
      driverPointsAwarded: driver?.points ?? 0
    };
  }

  async getRewardsForUser(userId: string, environment: 'test' | 'live' = env.PAYMENT_ENVIRONMENT): Promise<{
    currentPoints: number;
    progressTowardsMilestone: number;
    unlockedRewardsCount: number;
    completedRides: number;
    history: RewardsLedger[];
  }> {
    const userRewards = this.memoryState.rewards.filter((r) => r.user_id === userId);
    const programRewards = userRewards.filter((r) => (r.environment ?? 'live') === environment);
    const earned = programRewards.filter((r) => r.status === 'earned').reduce((s, r) => s + r.points, 0);
    const redeemed = programRewards.filter((r) => r.status === 'redeemed').reduce((s, r) => s + r.points, 0);
    const currentPoints = Math.max(0, earned - redeemed);
    const progressTowardsMilestone = currentPoints % 10;
    const unlockedRewardsCount = Math.floor(currentPoints / 10);

    return {
      currentPoints,
      progressTowardsMilestone,
      unlockedRewardsCount,
      completedRides: programRewards.filter((r) => r.status === 'earned' && r.reward_type === 'ride_completion').length,
      history: [...userRewards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    };
  }

  async redeemReward(
    userId: string,
    rewardType: 'drink_voucher' | 'fuel_discount',
    environment: 'test' | 'live' = env.PAYMENT_ENVIRONMENT,
    claimOperationId?: string | null,
  ): Promise<RewardsLedger> {
    if (claimOperationId) {
      const existingClaim = this.memoryState.rewards.find((entry) =>
        entry.user_id === userId &&
        (entry.environment ?? 'live') === environment &&
        entry.claim_operation_id === claimOperationId &&
        entry.status === 'redeemed'
      );
      if (existingClaim) return existingClaim;
    }
    const balance = await this.getRewardsForUser(userId, environment);
    if (balance.currentPoints < 10) {
      throw new Error('Insufficient points. Minimum 10 TalaPoints required to redeem.');
    }

    const claimedAt = new Date();
    const validUntil = new Date(claimedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const voucherCode = `TR-${rewardType === 'drink_voucher' ? 'DRINK' : 'FUEL'}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const voucherDescription = rewardType === 'drink_voucher'
      ? 'One drink voucher worth up to ₱50 at a participating TalaRide beverage partner.'
      : '10% off eligible Petron gasoline, up to ₱50. Gasoline only; diesel excluded.';
    const redemption: RewardsLedger = {
      reward_id: `REW-RED-${randomUUID()}`,
      user_id: userId,
      ride_id: null,
      claim_operation_id: claimOperationId || null,
      points: 10,
      status: 'redeemed',
      reward_type: rewardType,
      environment,
      voucher_code: voucherCode,
      voucher_description: voucherDescription,
      voucher_value_centavos: 5000,
      voucher_valid_until: validUntil,
      created_at: claimedAt.toISOString()
    };

    this.memoryState.rewards.push(redemption);
    this.persistToDisk(this.memoryState);
    return redemption;
  }

  // --- Lost Items ---
  async createLostItemReport(report: LostItemReport): Promise<LostItemReport> {
    if (report.client_operation_id) {
      const existing = this.memoryState.lostItems.find(
        (l) => l.client_operation_id === report.client_operation_id && l.passenger_id === report.passenger_id
      );
      if (existing) return existing;
    }

    this.memoryState.lostItems.push(report);
    this.persistToDisk(this.memoryState);
    return report;
  }

  async getLostItemReport(reportId: string): Promise<LostItemReport | null> {
    return this.memoryState.lostItems.find((entry) => entry.report_id === reportId) || null;
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

  async respondToLostItem(
    reportId: string,
    response: 'found' | 'not_found' | 'contact_support',
    note?: string,
    authorId?: string | null,
  ): Promise<LostItemReport | null> {
    const report = this.memoryState.lostItems.find((l) => l.report_id === reportId);
    if (!report) return null;

    report.driver_response = response;
    report.driver_response_note = note || null;
    report.messages ||= [];
    report.messages.push({
      message_id: `LIM-${randomUUID()}`,
      author_role: 'driver',
      author_id: authorId || null,
      message:
        note?.trim() ||
        (response === 'found'
          ? 'I found the reported item. Please use this thread to coordinate recovery.'
          : response === 'not_found'
            ? 'I checked the vehicle but have not found the item yet.'
            : 'I need TalaRide support to help with this report.'),
      created_at: new Date().toISOString(),
    });
    if (response === 'found') {
      // "Found" means the driver located the item; it is not proof the
      // passenger has recovered it, so do not close/resolve the report here.
      report.status = 'found';
      report.resolved_at = null;
    } else if (response === 'not_found') {
      report.status = 'unresolved';
    } else {
      report.status = 'driver_notified';
    }

    this.persistToDisk(this.memoryState);
    return report;
  }

  async addLostItemMessage(
    reportId: string,
    author: { role: 'passenger' | 'driver' | 'admin'; id?: string | null },
    message: string,
  ): Promise<LostItemReport | null> {
    const report = this.memoryState.lostItems.find((entry) => entry.report_id === reportId);
    if (!report) return null;
    if (report.status === 'closed') throw new Error('This lost-item conversation is closed.');
    report.messages ||= [];
    report.messages.push({
      message_id: `LIM-${randomUUID()}`,
      author_role: author.role,
      author_id: author.id || null,
      message: message.trim(),
      created_at: new Date().toISOString(),
    });
    this.persistToDisk(this.memoryState);
    return report;
  }

  async closeLostItemReport(reportId: string): Promise<LostItemReport | null> {
    const report = this.memoryState.lostItems.find((entry) => entry.report_id === reportId);
    if (!report) return null;
    if (report.status !== 'closed') {
      report.status = 'closed';
      report.resolved_at = new Date().toISOString();
    }
    this.persistToDisk(this.memoryState);
    return report;
  }

  // --- Payment Issues ---
  async createPaymentIssue(ticket: PaymentIssueTicket): Promise<PaymentIssueTicket> {
    if (ticket.client_operation_id) {
      const existing = this.memoryState.paymentIssues.find(
        (t) => t.client_operation_id === ticket.client_operation_id && t.reported_by === ticket.reported_by
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

const localRepository = new TalaRideRepository();
const useCloudRepository = env.NODE_ENV === 'production' || cloudPersistenceConfigured();

export const repository: TalaRideRepository = !useCloudRepository
  ? localRepository
  : new Proxy(localRepository, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (typeof value !== 'function') return value;
        if (property === 'checkReadiness') return value.bind(target);
        if (property === 'resetForTesting') {
          return () => {
            throw new Error('Unavailable while shared Supabase persistence is enabled');
          };
        }
        return (...args: unknown[]) => target.cloudCall(String(property), args);
      },
    });
