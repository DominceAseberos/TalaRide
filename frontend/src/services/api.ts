import { authToken } from './auth';
import {
  Driver,
  Vehicle,
  Ride,
  Payment,
  LostItemReport,
  FareConfiguration,
  PaymentIssueTicket
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'talaride.auth-token';

export const eventBus = new BroadcastChannel('talaride_events');

export function getWebPaymentMode(): 'live' | 'mock' { return 'live'; }
function broadcastSimulation(_type: string, _payload: unknown) {}
export function setAuthToken(_token: string | null) { window.sessionStorage.removeItem(TOKEN_KEY); }
async function getAuthToken() { return authToken(); }

function rideOwner() {
  const key = 'talaride.ride-browser-key';
  let owner = window.sessionStorage.getItem(key);
  if (!owner) { owner = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); window.sessionStorage.setItem(key, owner); }
  return owner;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const publicRequest = path.startsWith('/public/') || path.startsWith('/payment-status') || path === '/payment-intent';
  const token = publicRequest ? await getAuthToken().catch(() => '') : await getAuthToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (path.startsWith('/public/vehicles/') || path === '/payment-intent') headers.set('x-ride-owner', rideOwner());
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {}
    throw new Error(message);
  }
  return res;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  return res.json() as Promise<T>;
}

function normalizeDriver(raw: any): Driver {
  return {
    driver_id: raw.driver_id ?? raw.driver_code,
    user_id: raw.user_id,
    name: raw.name ?? raw.full_name,
    mobile_number: raw.mobile_number,
    verification_status: raw.verification_status,
    toda_operator: raw.toda_operator,
    assigned_vehicle_id: raw.assigned_vehicle_id ?? raw.assigned_vehicle_code ?? null,
    shift_status: raw.shift_status ?? 'ended',
    active_shift_id: raw.active_shift_id ?? null,
    license_number: raw.license_number ?? '',
    photo_url: raw.photo_url ?? null,
    created_at: raw.created_at
  };
}

function normalizeVehicle(raw: any): Vehicle {
  return {
    vehicle_id: raw.vehicle_id ?? raw.vehicle_code,
    plate_body_number: raw.plate_body_number,
    toda: raw.toda,
    status: raw.status,
    assigned_driver_id: raw.assigned_driver_id ?? raw.assigned_driver_code ?? null,
    assigned_driver_name: raw.assigned_driver_name ?? null,
    qr_code_payload:
      raw.qr_code_payload ??
      (raw.vehicle_code && raw.qr_checksum
        ? `https://talaride-web-frontend.vercel.app/v/${raw.vehicle_code}?c=${raw.qr_checksum}`
        : ''),
    created_at: raw.created_at
  };
}

function normalizeShift(raw: any) {
  if (!raw) return null;
  return {
    shift_id: raw.shift_id,
    driver_id: raw.driver_id ?? raw.driver_code,
    vehicle_id: raw.vehicle_id ?? raw.vehicle_code,
    start_time: raw.start_time,
    end_time: raw.end_time,
    status: raw.status,
    digital_rides_count: raw.digital_rides_count ?? 0,
    digital_gross_total: (raw.digital_gross_total ?? raw.digital_gross_centavos ?? 0) / (raw.digital_gross_centavos !== undefined ? 100 : 1),
    provider_platform_fees: (raw.provider_platform_fees ?? raw.provider_fees_centavos ?? 0) / (raw.provider_fees_centavos !== undefined ? 100 : 1),
    digital_net_total: (raw.digital_net_total ?? raw.digital_net_centavos ?? 0) / (raw.digital_net_centavos !== undefined ? 100 : 1),
    cash_rides_count: raw.cash_rides_count ?? 0,
    cash_gross_total: (raw.cash_gross_total ?? raw.cash_gross_centavos ?? 0) / (raw.cash_gross_centavos !== undefined ? 100 : 1)
  };
}

function normalizeRide(raw: any): Ride {
  return {
    ride_id: raw.ride_id,
    driver_id: raw.driver_id ?? raw.driver_code,
    driver_name: raw.driver_name ?? '',
    vehicle_id: raw.vehicle_id ?? raw.vehicle_code,
    passenger_id: raw.passenger_id ?? null,
    passenger_name: raw.passenger_name ?? null,
    passenger_mobile: raw.passenger_mobile ?? null,
    timestamp: raw.timestamp,
    approximate_location: raw.approximate_location ?? '',
    payment_method: raw.payment_method,
    fare_amount:
      raw.fare_amount ?? (raw.fare_amount_centavos !== undefined ? raw.fare_amount_centavos / 100 : 0),
    status: raw.status,
    is_checkin_only: raw.is_checkin_only
  };
}

function normalizePayment(raw: any): Payment {
  return {
    payment_environment: raw.payment_environment,
    payment_id: raw.payment_id,
    ride_id: raw.ride_id,
    driver_id: raw.driver_id ?? raw.driver_code,
    vehicle_id: raw.vehicle_id ?? raw.vehicle_code,
    amount: raw.amount ?? (raw.amount_centavos !== undefined ? raw.amount_centavos / 100 : 0),
    provider: raw.provider,
    provider_reference: raw.provider_reference ?? raw.provider_ref ?? '',
    checkout_url: raw.checkout_url ?? null,
    payment_status:
      raw.payment_status === 'confirmed'
        ? 'paid'
        : raw.payment_status === 'awaiting_confirmation' || raw.payment_status === 'initiated'
          ? 'pending'
          : raw.payment_status,
    provider_fee:
      raw.provider_fee ?? (raw.provider_fee_centavos !== undefined ? raw.provider_fee_centavos / 100 : 0),
    talaride_fee:
      raw.talaride_fee ?? (raw.talaride_fee_centavos !== undefined ? raw.talaride_fee_centavos / 100 : 0),
    net_amount: raw.net_amount ?? (raw.net_centavos !== undefined ? raw.net_centavos / 100 : 0),
    qr_payload: raw.qr_payload ?? '',
    created_at: raw.created_at,
    expires_at: raw.expires_at,
    paid_at: raw.paid_at ?? raw.confirmed_at ?? null
  };
}

function normalizeLostItem(raw: any): LostItemReport {
  return {
    report_id: raw.report_id,
    ride_id: raw.ride_id,
    vehicle_id: raw.vehicle_id ?? raw.vehicle_code,
    driver_id: raw.driver_id ?? raw.driver_code,
    passenger_id: raw.passenger_id ?? '',
    passenger_name: raw.passenger_name,
    passenger_contact: raw.passenger_contact,
    item_category: raw.item_category,
    description: raw.description,
    status: raw.status,
    driver_response: raw.driver_response,
    driver_response_note: raw.driver_response_note,
    created_at: raw.created_at,
    resolved_at: raw.resolved_at
  };
}

function normalizeFareConfig(raw: any): FareConfiguration {
  return {
    standard_fares:
      raw.standard_fares ??
      (raw.standard_fares_centavos ?? []).map((value: number) => value / 100),
    min_custom_fare:
      raw.min_custom_fare ??
      (raw.min_custom_fare_centavos !== undefined ? raw.min_custom_fare_centavos / 100 : 0),
    max_custom_fare:
      raw.max_custom_fare ??
      (raw.max_custom_fare_centavos !== undefined ? raw.max_custom_fare_centavos / 100 : 0),
    provider_fee_percentage:
      raw.provider_fee_percentage ??
      (raw.provider_fee_basis_points !== undefined ? raw.provider_fee_basis_points / 100 : 0),
    talaride_platform_fee:
      raw.talaride_platform_fee ??
      (raw.talaride_fee_basis_points !== undefined ? raw.talaride_fee_basis_points / 100 : 0)
  };
}

export const api = {
  getCurrentAccount: () => apiJson<any>('/auth/me'),
  getTodaMembers: async (): Promise<{ group: { id: string; name: string }; members: Driver[] }> => {
    const data = await apiJson<{ group: { id: string; name: string }; members: any[] }>('/toda/members');
    return { group: data.group, members: data.members.map(normalizeDriver) };
  },
  addTodaMember: (driverCode: string) => apiJson<{ driver: unknown }>('/toda/members', { method: 'POST', body: JSON.stringify({ driver_code: driverCode }) }),
  enrollDriver: (data: { full_name: string; mobile_number: string; toda_operator: string; license_number: string }) => apiJson<any>('/drivers/enroll', { method: 'POST', body: JSON.stringify(data) }),
  getDriverNotifications: (code: string) => apiJson<any>(`/drivers/${encodeURIComponent(code)}/notifications`),
  requestOtp: async (mobileNumber: string, role = 'commuter') =>
    apiJson<any>('/auth/otp-request', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, role })
    }),

  verifyOtp: async (
    mobileNumber: string,
    otp: string,
    role = 'commuter',
    name?: string,
    pin?: string
  ) => {
    const data = await apiJson<any>('/auth/otp-verify', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, otp, role, name, pin })
    });
    if (data.token) setAuthToken(data.token);
    return data.driver ? { ...data, driver: normalizeDriver(data.driver) } : data;
  },

  getDriver: async (driverId: string) => {
    const data = await apiJson<any>(`/drivers/${driverId}`);
    return {
      ...data,
      driver: normalizeDriver(data.driver),
      vehicle: data.vehicle ? normalizeVehicle(data.vehicle) : null,
      activeShift: normalizeShift(data.activeShift)
    };
  },

  startShift: async (driverId: string, vehicleId: string) => {
    const data = await apiJson<any>('/shift-start', {
      method: 'POST',
      body: JSON.stringify({ driver_code: driverId, vehicle_code: vehicleId })
    });
    const result = { ...data, shift: normalizeShift(data.shift) };
    broadcastSimulation('shift_updated', result);
    return result;
  },

  endShift: async (driverId: string) => {
    const data = await apiJson<any>('/shift-end', {
      method: 'POST',
      body: JSON.stringify({ driver_code: driverId })
    });
    const result = { ...data, shift: normalizeShift(data.shift) };
    broadcastSimulation('shift_updated', result);
    return result;
  },

  recordCashRide: async (driverId: string, vehicleId: string, fareAmount: number) => {
    const data = await apiJson<any>('/cash-record', {
      method: 'POST',
      body: JSON.stringify({
        driver_code: driverId,
        vehicle_code: vehicleId,
        amount_centavos: Math.round(fareAmount * 100),
        client_operation_id: `web-cash-${crypto.randomUUID()}`
      })
    });
    const result = { ...data, ride: normalizeRide(data.ride) };
    broadcastSimulation('ride_created', result);
    return result;
  },

  getDriverSummary: async (driverId: string) => {
    const data = await apiJson<any>(`/drivers/${driverId}/summary`);
    return {
      ...data,
      driver: normalizeDriver(data.driver),
      activeShift: normalizeShift(data.activeShift),
      rides: (data.rides ?? []).map(normalizeRide),
      payments: (data.payments ?? []).map(normalizePayment)
    };
  },

  getVehicles: async (): Promise<Vehicle[]> => {
    const rows = await apiJson<any[]>('/vehicles');
    return rows.map(normalizeVehicle);
  },

  getVehicle: async (vehicleId: string) => {
    const data = await apiJson<any>(`/vehicles/${vehicleId}`);
    return data.vehicle ? { ...data, vehicle: normalizeVehicle(data.vehicle) } : normalizeVehicle(data);
  },

  getPublicVehicle: async (vehicleCode: string, checksum: string, sessionId?: string) => {
    const query = new URLSearchParams({ c: checksum });
    if (sessionId) query.set('sid', sessionId);
    return apiJson<any>(`/public/vehicles/${vehicleCode}/public?${query.toString()}`);
  },

  registerVehicle: async (data: { vehicle_id: string; plate_body_number: string; toda: string }) => {
    const result = await apiJson<any>('/admin/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        vehicle_code: data.vehicle_id,
        plate_body_number: data.plate_body_number,
        toda: data.toda
      })
    });
    return { ...result, vehicle: normalizeVehicle(result.vehicle) };
  },

  getRides: async (params?: { passengerId?: string; driverId?: string }): Promise<Ride[]> => {
    const query = new URLSearchParams();
    if (params?.passengerId) query.set('passenger_id', params.passengerId);
    if (params?.driverId) query.set('driver_code', params.driverId);
    const rows = await apiJson<any[]>(`/rides?${query.toString()}`);
    return rows.map(normalizeRide);
  },

  getRide: async (rideId: string) => {
    const data = await apiJson<any>(`/rides/${rideId}`);
    return {
      ...data,
      ride: normalizeRide(data.ride),
      driver: data.driver ? normalizeDriver(data.driver) : null,
      vehicle: data.vehicle ? normalizeVehicle(data.vehicle) : null,
      payment: data.payment ? normalizePayment(data.payment) : null
    };
  },

  safetyCheckIn: async (data: {
    vehicleId: string;
    passengerId?: string;
    passengerName?: string;
    approximateLocation?: string;
  }) => {
    const result = await apiJson<any>('/ride-checkin', {
      method: 'POST',
      body: JSON.stringify({
        vehicle_code: data.vehicleId,
        passenger_name: data.passengerName,
        approximate_location: data.approximateLocation,
        client_operation_id: `web-checkin-${crypto.randomUUID()}`
      })
    });
    const normalized = { ...result, ride: normalizeRide(result.ride) };
    broadcastSimulation('ride_created', normalized);
    return normalized;
  },

  createPaymentQR: async (
    driverId: string,
    vehicleId: string,
    fareAmount: number,
    _isCustom = false,
    paymentMethod: 'gcash' | 'maya' | 'card' | 'qrph' = 'gcash',
    sessionId?: string
  ) => {
    const raw = await apiJson<any>('/payment-intent', {
      method: 'POST',
      body: JSON.stringify({
        driver_code: driverId,
        vehicle_code: vehicleId,
        amount_centavos: Math.round(fareAmount * 100),
        payment_method: paymentMethod,
        ...(sessionId ? { session_id: sessionId } : {})
      })
    });
    const payment = normalizePayment({
      ...raw,
      payment_status: raw.payment_status,
      provider: raw.payment_method === 'qrph' ? 'qrph_bank' : (raw.payment_method || paymentMethod),
      provider_ref: null,
      created_at: new Date().toISOString(),
      confirmed_at: null
    });
    const result = {
      success: true,
      payment,
      qrPayload: raw.qr_payload,
      checkoutUrl: raw.checkout_url ?? null
    };
    broadcastSimulation('payment_created', result);
    return result;
  },

  getPaymentStatus: async (paymentId: string) => {
    const raw = await apiJson<any>(
      `/payment-status?payment_id=${encodeURIComponent(paymentId)}`
    );
    return {
      ...raw,
      payment: normalizePayment(raw),
      checkoutUrl: raw.checkout_url ?? null
    };
  },

  getConfirmedPaymentResult: async (paymentId: string) => {
    const status = await api.getPaymentStatus(paymentId);
    if (status.payment.payment_status !== 'paid') {
      return { success: false, status: status.payment.payment_status, payment: status.payment };
    }
    return {
      success: true,
      payment: status.payment
    };
  },

  confirmPayment: async (data: {
    paymentId: string;
    provider?: string;
    passengerId?: string;
    passengerName?: string;
    approximateLocation?: string;
  }) => {
    if (getWebPaymentMode() !== 'mock') {
      throw new Error('Mock confirmation is disabled outside the simulator. Use PayMongo Checkout.');
    }
    const raw = await apiJson<any>('/mock-confirm', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: data.paymentId,
        provider: data.provider,
        passenger_id: data.passengerId
      })
    });
    const result = {
      ...raw,
      payment: raw.payment ? normalizePayment(raw.payment) : raw.payment,
      ride: raw.ride ? normalizeRide(raw.ride) : raw.ride
    };
    broadcastSimulation('payment_confirmed', result);
    return result;
  },

  reportPaymentIssue: async (data: {
    paymentId?: string;
    rideId?: string;
    issueType: string;
    description: string;
    reportedBy: string;
  }) =>
    apiJson<any>('/payment-issue', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: data.paymentId,
        ride_id: data.rideId,
        issue_type: data.issueType,
        description: data.description,
        reported_by: data.reportedBy,
        client_operation_id: `web-issue-${crypto.randomUUID()}`
      })
    }),

  getLostItems: async (params?: {
    passengerId?: string;
    driverId?: string;
  }): Promise<LostItemReport[]> => {
    const query = new URLSearchParams();
    if (params?.passengerId) query.set('passenger_id', params.passengerId);
    if (params?.driverId) query.set('driver_code', params.driverId);
    const rows = await apiJson<any[]>(`/lost-items?${query.toString()}`);
    return rows.map(normalizeLostItem);
  },

  reportLostItem: async (data: {
    rideId: string;
    itemCategory: string;
    description: string;
    passengerId?: string;
    passengerName?: string;
    passengerContact?: string;
  }) => {
    const raw = await apiJson<any>('/lost-item-report', {
      method: 'POST',
      body: JSON.stringify({
        ride_id: data.rideId,
        item_category: data.itemCategory,
        description: data.description,
        passenger_name: data.passengerName,
        passenger_contact: data.passengerContact,
        client_operation_id: `web-lost-${crypto.randomUUID()}`
      })
    });
    const result = { ...raw, report: normalizeLostItem(raw.report) };
    broadcastSimulation('lost_item_reported', result);
    return result;
  },

  respondToLostItem: async (
    reportId: string,
    response: 'found' | 'not_found' | 'contact_support',
    note?: string
  ) => {
    const raw = await apiJson<any>('/lost-item-respond', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId, response, note })
    });
    const result = { ...raw, report: normalizeLostItem(raw.report) };
    broadcastSimulation('lost_item_updated', result);
    return result;
  },

  getRewards: async (_userId: string) => {
    const data = await apiJson<any>('/rewards-me');
    return {
      userId: data.user_id,
      currentPoints: data.current_points,
      targetMilestone: data.target_milestone,
      progressTowardsMilestone: data.progress_towards_milestone,
      unlockedRewardsCount: data.unlocked_rewards_count,
      activeVoucher: data.active_voucher,
      history: data.history
    };
  },

  redeemReward: async (userId: string) =>
    apiJson<any>('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }),

  getAdminOverview: async () => apiJson<any>('/admin/overview'),

  getAdminDrivers: async (): Promise<Driver[]> => {
    const rows = await apiJson<any[]>('/admin/drivers');
    return rows.map(normalizeDriver);
  },

  verifyDriver: async (driverId: string) =>
    apiJson<any>(`/admin/drivers/${driverId}/verify`, { method: 'POST' }),

  suspendDriver: async (driverId: string) =>
    apiJson<any>(`/admin/drivers/${driverId}/suspend`, { method: 'POST' }),

  assignVehicleToDriver: async (driverId: string, vehicleId: string) =>
    apiJson<any>('/admin/assign-vehicle', {
      method: 'POST',
      body: JSON.stringify({ driverId, vehicleId })
    }),

  getAdminTransactions: async (params?: {
    query?: string;
    status?: string;
  }): Promise<Payment[]> => {
    const query = new URLSearchParams();
    if (params?.query) query.set('query', params.query);
    if (params?.status) query.set('status', params.status);
    const rows = await apiJson<any[]>(`/admin/transactions?${query.toString()}`);
    return rows.map(normalizePayment);
  },

  getPaymentIssues: async (): Promise<PaymentIssueTicket[]> =>
    apiJson<PaymentIssueTicket[]>('/admin/payment-issues'),

  resolvePaymentIssue: async (
    ticketId: string,
    status: 'resolved' | 'refunded',
    notes?: string
  ) =>
    apiJson<any>(`/admin/payment-issues/${ticketId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, notes })
    }),

  getFareConfig: async (): Promise<FareConfiguration> => {
    const raw = await apiJson<any>('/admin/fares');
    return normalizeFareConfig(raw);
  },

  updateFareConfig: async (config: {
    standard_fares: number[];
    provider_fee_percentage?: number;
  }) => {
    const raw = await apiJson<any>('/admin/fares', {
      method: 'PUT',
      body: JSON.stringify({
        standard_fares_centavos: config.standard_fares.map((value) => Math.round(value * 100)),
        provider_fee_basis_points:
          config.provider_fee_percentage === undefined
            ? undefined
            : Math.round(config.provider_fee_percentage * 100)
      })
    });
    return { ...raw, fare_config: normalizeFareConfig(raw.fare_config) };
  }
};

export function connectSSE(options: {
  driverId?: string;
  role?: string;
  onPaymentConfirmed?: (data: any) => void;
  onLostItemReported?: (data: any) => void;
  onShiftUpdated?: (data: any) => void;
  onGeneralEvent?: (event: string, data: any) => void;
}) {
  let stopped = false;
  let source: EventSource | null = null;
  void getAuthToken().then(token => {
    if (stopped || !token) return;
    source = new EventSource(`${API_BASE}/events?token=${encodeURIComponent(token)}`);
    source.addEventListener('payment_confirmed', (e: MessageEvent) => options.onPaymentConfirmed?.(JSON.parse(e.data)));
    source.addEventListener('lost_item_reported', (e: MessageEvent) => options.onLostItemReported?.(JSON.parse(e.data)));
    source.addEventListener('shift_updated', (e: MessageEvent) => options.onShiftUpdated?.(JSON.parse(e.data)));
  }).catch(() => {});
  return () => { stopped = true; source?.close(); };
}
