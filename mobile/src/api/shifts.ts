import { apiRequest } from './client';

export interface ShiftSession {
  shift_id: string;
  driver_code: string;
  vehicle_code: string;
  start_time: string;
  status: string;
}

export async function startShift(
  driver_code: string,
  vehicle_code: string,
  client_operation_id?: string,
): Promise<ShiftSession> {
  const data = await apiRequest<{ shift: ShiftSession }>('/shift-start', {
    method: 'POST',
    body: JSON.stringify({ driver_code, vehicle_code, client_operation_id }),
  });
  return data.shift;
}

export async function endShift(driver_code: string): Promise<ShiftSession> {
  const data = await apiRequest<{ shift: ShiftSession }>('/shift-end', {
    method: 'POST',
    body: JSON.stringify({ driver_code }),
  });
  return data.shift;
}
