import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './client';

export interface PublicVehicle {
  vehicle_code: string;
  plate_body_number: string;
  toda: string;
  status: string;
  shift_status: string;
  driver_code: string | null;
  driver_name: string;
  verification_status: 'verified' | 'pending' | 'suspended';
  driver_photo_url?: string | null;
  fare_config?: { standard_fares_centavos: number[] };
}

export async function fetchPublicVehicle(vehicleCode: string, checksum: string) {
  const code = vehicleCode.trim().toUpperCase();
  const cacheKey = `talaride.public-vehicle-v2:${code}:${checksum.trim()}`;
  try {
    const value = await apiRequest<PublicVehicle>(
      '/vehicles/' + encodeURIComponent(code) + '/public?c=' + encodeURIComponent(checksum.trim()),
    );
    await AsyncStorage.setItem(cacheKey, JSON.stringify(value));
    return value;
  } catch (error) {
    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as PublicVehicle;
    throw error;
  }
}
