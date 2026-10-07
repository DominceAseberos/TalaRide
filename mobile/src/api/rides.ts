import { apiRequest } from './client';

export interface ServerRideItem {
  ride_id: string;
  vehicle_code: string;
  driver_code?: string;
  date: string;
  amount_centavos: number;
  payment_method: string;
  status: string;
}

export async function fetchRides(limit = 50, cursor?: string) {
  const q = cursor ? `?limit=${limit}&cursor=${encodeURIComponent(cursor)}` : `?limit=${limit}`;
  const rows = await apiRequest<
    {
      ride_id: string;
      vehicle_code: string;
      driver_code?: string;
      timestamp: string;
      fare_amount_centavos: number;
      payment_method: string;
      status: string;
    }[]
  >(`/rides${q}`);
  return {
    rides: rows.slice(0, limit).map((ride) => ({
      ride_id: ride.ride_id,
      vehicle_code: ride.vehicle_code,
      driver_code: ride.driver_code,
      date: ride.timestamp,
      amount_centavos: ride.fare_amount_centavos,
      payment_method: ride.payment_method,
      status: ride.status,
    })),
    next_cursor: null,
  };
}

export async function requestCashRide(input: {
  vehicle_code: string;
  amount_centavos: number;
  client_operation_id: string;
  approximate_location?: string;
}) {
  const data = await apiRequest<{
    retry: boolean;
    ride: { ride_id: string; status: string };
  }>('/rides/cash-request', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.ride;
}

export async function confirmCashRide(rideId: string) {
  const data = await apiRequest<{
    duplicate: boolean;
    ride: { ride_id: string; status: string; fare_amount_centavos: number };
    points_awarded: number;
    driver_points_awarded: number;
  }>('/rides/cash-confirm', {
    method: 'POST',
    body: JSON.stringify({ ride_id: rideId }),
  });
  return data;
}

export async function sendCashRide(input: {
  driver_code: string;
  vehicle_code: string;
  amount_centavos: number;
  client_operation_id: string;
  local_ride_id?: string;
}, accessToken?: string) {
  const data = await apiRequest<{
    ride: { ride_id: string; status: string };
  }>('/cash-record', {
    method: 'POST',
    body: JSON.stringify(input),
  }, accessToken);
  return { ride_id: data.ride.ride_id, status: data.ride.status };
}

export async function sendCheckin(input: {
  vehicle_code: string;
  pickup_text?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  client_operation_id: string;
  local_ride_id?: string;
}, accessToken?: string) {
  const data = await apiRequest<{
    ride: { ride_id: string; vehicle_code: string; timestamp: string };
  }>('/ride-checkin', {
    method: 'POST',
    body: JSON.stringify({
      vehicle_code: input.vehicle_code,
      approximate_location: input.pickup_text,
      client_operation_id: input.client_operation_id,
      local_ride_id: input.local_ride_id,
    }),
  }, accessToken);
  return {
    ride_id: data.ride.ride_id,
    vehicle_code: data.ride.vehicle_code,
    recorded_at: data.ride.timestamp,
  };
}
