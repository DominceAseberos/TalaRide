import { apiRequest } from './client';

export type DriverNotification = {
  id: string;
  kind: 'payment_confirmed' | 'lost_item_reported';
  title: string;
  message: string;
  created_at: string;
  payload?: unknown;
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
