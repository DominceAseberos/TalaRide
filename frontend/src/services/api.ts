import {
  Driver,
  Vehicle,
  DriverShift,
  Ride,
  Payment,
  LostItemReport,
  RewardsTransaction,
  FareConfiguration,
  PaymentIssueTicket,
  User
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Shared Broadcast Channel for multi-tab simulation when running locally
export const eventBus = new BroadcastChannel('talaride_events');

export const api = {
  // Auth
  requestOtp: async (mobileNumber: string, role = 'commuter') => {
    const res = await fetch(`${API_BASE}/auth/otp-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber, role })
    });
    return res.json();
  },

  verifyOtp: async (mobileNumber: string, otp: string, role = 'commuter', name?: string) => {
    const res = await fetch(`${API_BASE}/auth/otp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber, otp, role, name })
    });
    return res.json();
  },

  // Drivers
  getDriver: async (driverId: string) => {
    const res = await fetch(`${API_BASE}/drivers/${driverId}`);
    return res.json();
  },

  startShift: async (driverId: string, vehicleId: string) => {
    const res = await fetch(`${API_BASE}/drivers/shifts/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, vehicleId })
    });
    const data = await res.json();
    eventBus.postMessage({ type: 'shift_updated', payload: data });
    return data;
  },

  endShift: async (driverId: string) => {
    const res = await fetch(`${API_BASE}/drivers/shifts/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId })
    });
    const data = await res.json();
    eventBus.postMessage({ type: 'shift_updated', payload: data });
    return data;
  },

  recordCashRide: async (driverId: string, vehicleId: string, fareAmount: number) => {
    const res = await fetch(`${API_BASE}/drivers/cash-ride`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, vehicleId, fareAmount })
    });
    const data = await res.json();
    eventBus.postMessage({ type: 'ride_created', payload: data });
    return data;
  },

  getDriverSummary: async (driverId: string) => {
    const res = await fetch(`${API_BASE}/drivers/${driverId}/summary`);
    return res.json();
  },

  // Vehicles
  getVehicles: async (): Promise<Vehicle[]> => {
    const res = await fetch(`${API_BASE}/vehicles`);
    return res.json();
  },

  getVehicle: async (vehicleId: string) => {
    const res = await fetch(`${API_BASE}/vehicles/${vehicleId}`);
    return res.json();
  },

  registerVehicle: async (data: { vehicle_id: string; plate_body_number: string; toda: string }) => {
    const res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Rides
  getRides: async (params?: { passengerId?: string; driverId?: string }): Promise<Ride[]> => {
    const query = new URLSearchParams();
    if (params?.passengerId) query.set('passengerId', params.passengerId);
    if (params?.driverId) query.set('driverId', params.driverId);
    const res = await fetch(`${API_BASE}/rides?${query.toString()}`);
    return res.json();
  },

  getRide: async (rideId: string) => {
    const res = await fetch(`${API_BASE}/rides/${rideId}`);
    return res.json();
  },

  safetyCheckIn: async (data: {
    vehicleId: string;
    passengerId?: string;
    passengerName?: string;
    approximateLocation?: string;
  }) => {
    const res = await fetch(`${API_BASE}/rides/safety-checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    eventBus.postMessage({ type: 'ride_created', payload: result });
    return result;
  },

  // Payments
  createPaymentQR: async (driverId: string, vehicleId: string, fareAmount: number, isCustom = false) => {
    const res = await fetch(`${API_BASE}/payments/create-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, vehicleId, fareAmount, isCustom })
    });
    const data = await res.json();
    eventBus.postMessage({ type: 'payment_created', payload: data });
    return data;
  },

  confirmPayment: async (data: {
    paymentId: string;
    provider?: string;
    passengerId?: string;
    passengerName?: string;
    approximateLocation?: string;
  }) => {
    const res = await fetch(`${API_BASE}/payments/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    eventBus.postMessage({ type: 'payment_confirmed', payload: result });
    return result;
  },

  reportPaymentIssue: async (data: {
    paymentId?: string;
    rideId?: string;
    issueType: string;
    description: string;
    reportedBy: string;
  }) => {
    const res = await fetch(`${API_BASE}/payments/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Lost Items
  getLostItems: async (params?: { passengerId?: string; driverId?: string }): Promise<LostItemReport[]> => {
    const query = new URLSearchParams();
    if (params?.passengerId) query.set('passengerId', params.passengerId);
    if (params?.driverId) query.set('driverId', params.driverId);
    const res = await fetch(`${API_BASE}/lost-items?${query.toString()}`);
    return res.json();
  },

  reportLostItem: async (data: {
    rideId: string;
    itemCategory: string;
    description: string;
    passengerId?: string;
    passengerName?: string;
    passengerContact?: string;
  }) => {
    const res = await fetch(`${API_BASE}/lost-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    eventBus.postMessage({ type: 'lost_item_reported', payload: result });
    return result;
  },

  respondToLostItem: async (reportId: string, response: 'found' | 'not_found' | 'contact_support', note?: string) => {
    const res = await fetch(`${API_BASE}/lost-items/${reportId}/driver-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, note })
    });
    const result = await res.json();
    eventBus.postMessage({ type: 'lost_item_updated', payload: result });
    return result;
  },

  // Rewards
  getRewards: async (userId: string) => {
    const res = await fetch(`${API_BASE}/rewards/${userId}`);
    return res.json();
  },

  redeemReward: async (userId: string) => {
    const res = await fetch(`${API_BASE}/rewards/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return res.json();
  },

  // Admin
  getAdminOverview: async () => {
    const res = await fetch(`${API_BASE}/admin/overview`);
    return res.json();
  },

  getAdminDrivers: async (): Promise<Driver[]> => {
    const res = await fetch(`${API_BASE}/admin/drivers`);
    return res.json();
  },

  verifyDriver: async (driverId: string) => {
    const res = await fetch(`${API_BASE}/admin/drivers/${driverId}/verify`, { method: 'POST' });
    return res.json();
  },

  suspendDriver: async (driverId: string) => {
    const res = await fetch(`${API_BASE}/admin/drivers/${driverId}/suspend`, { method: 'POST' });
    return res.json();
  },

  assignVehicleToDriver: async (driverId: string, vehicleId: string) => {
    const res = await fetch(`${API_BASE}/admin/assign-vehicle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, vehicleId })
    });
    return res.json();
  },

  getAdminTransactions: async (params?: { query?: string; status?: string }): Promise<Payment[]> => {
    const query = new URLSearchParams();
    if (params?.query) query.set('query', params.query);
    if (params?.status) query.set('status', params.status);
    const res = await fetch(`${API_BASE}/admin/transactions?${query.toString()}`);
    return res.json();
  },

  getPaymentIssues: async (): Promise<PaymentIssueTicket[]> => {
    const res = await fetch(`${API_BASE}/admin/payment-issues`);
    return res.json();
  },

  resolvePaymentIssue: async (ticketId: string, status: 'resolved' | 'refunded', notes?: string) => {
    const res = await fetch(`${API_BASE}/admin/payment-issues/${ticketId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    return res.json();
  },

  getFareConfig: async (): Promise<FareConfiguration> => {
    const res = await fetch(`${API_BASE}/admin/fare-config`);
    return res.json();
  },

  updateFareConfig: async (config: { standard_fares: number[]; provider_fee_percentage?: number }) => {
    const res = await fetch(`${API_BASE}/admin/fare-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  }
};

// SSE Hook helper
export function connectSSE(options: {
  driverId?: string;
  role?: string;
  onPaymentConfirmed?: (data: any) => void;
  onLostItemReported?: (data: any) => void;
  onShiftUpdated?: (data: any) => void;
  onGeneralEvent?: (event: string, data: any) => void;
}) {
  const query = new URLSearchParams();
  if (options.driverId) query.set('driverId', options.driverId);
  if (options.role) query.set('role', options.role);

  let es: EventSource | null = null;
  try {
    es = new EventSource(`${API_BASE}/events?${query.toString()}`);

    es.addEventListener('payment_confirmed', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        options.onPaymentConfirmed?.(data);
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    });

    es.addEventListener('lost_item_reported', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        options.onLostItemReported?.(data);
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    });

    es.addEventListener('shift_updated', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        options.onShiftUpdated?.(data);
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    });
  } catch (err) {
    console.warn('SSE connection could not be established; BroadcastChannel fallback active', err);
  }

  // Also listen on BroadcastChannel for same-browser simulation
  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'payment_confirmed') {
      options.onPaymentConfirmed?.(e.data.payload);
    } else if (e.data?.type === 'lost_item_reported') {
      options.onLostItemReported?.(e.data.payload);
    } else if (e.data?.type === 'shift_updated') {
      options.onShiftUpdated?.(e.data.payload);
    }
  };
  eventBus.addEventListener('message', handleBroadcast);

  return () => {
    if (es) es.close();
    eventBus.removeEventListener('message', handleBroadcast);
  };
}
