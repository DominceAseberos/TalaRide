import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, ApiError } from './client';

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
      checksum.trim() ? '/vehicles/' + encodeURIComponent(code) + '/public?c=' + encodeURIComponent(checksum.trim()) : '/vehicles/' + encodeURIComponent(code) + '/lookup',
    );
    await AsyncStorage.setItem(cacheKey, JSON.stringify(value));
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as PublicVehicle;
    throw error;
  }
}
