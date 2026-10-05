import { apiRequest } from './client';

export interface PublicVehicle {
  vehicle_code: string;
  plate_body_number: string;
  toda: string;
  status: string;
  shift_status: string;
  driver_code: string | null;
  driver_name: string;
}

export function fetchPublicVehicle(vehicleCode: string, checksum: string) {
  return apiRequest<PublicVehicle>(
    '/vehicles/' +
      encodeURIComponent(vehicleCode.trim().toUpperCase()) +
      '/public?c=' +
      encodeURIComponent(checksum.trim()),
  );
}
