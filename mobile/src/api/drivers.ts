import { apiRequest } from './client';

export type DriverNotification = {
  id: string;
  kind: 'payment_confirmed' | 'lost_item_reported';
  title: string;
  message: string;
  created_at: string;
  payload?: unknown;
};

export type DriverRide = {
  ride_id: string;
  vehicle_code: string;
  timestamp: string;
  payment_method: 'digital' | 'cash';
  fare_amount_centavos: number;
  status: string;
};

export type DriverPayment = {
  payment_id: string;
  ride_id: string;
  amount_centavos: number;
  payment_status: string;
  confirmed_at?: string | null;
};

export type DriverSummary = {
  rides: DriverRide[];
  payments: DriverPayment[];
  activeShift?: unknown;
};

export type DriverVehicle = {
  vehicle_code: string;
  plate_body_number: string;
  qr_checksum: string;
  toda?: string;
  status?: string;
};

export async function fetchDriverNotifications(driverCode: string, since?: string) {
  const suffix = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiRequest<{ notifications: DriverNotification[] }>(
    `/drivers/${encodeURIComponent(driverCode)}/notifications${suffix}`,
  );
}

export async function updateDriverPhoto(photoUrl: string | null) {
  return apiRequest<{ driver: unknown }>('/drivers/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ photo_url: photoUrl }),
  });
}

export async function fetchDriverSummary(driverCode: string) {
  return apiRequest<DriverSummary>(`/drivers/${encodeURIComponent(driverCode)}/summary`);
}

export async function registerDriverVehicle(plateBodyNumber: string) {
  return apiRequest<{ driver: unknown; vehicle: DriverVehicle; created: boolean }>(
    '/drivers/me/vehicle',
    {
      method: 'POST',
      body: JSON.stringify({ plate_body_number: plateBodyNumber }),
    },
  );
}
