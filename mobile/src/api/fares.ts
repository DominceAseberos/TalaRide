import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_FARES, type FareButton } from '@talaride/shared';
import { apiRequest } from './client';

const FARES_CACHE = 'talaride.fares-cache-v1';

export async function fetchFares(
  organization_id?: string,
  municipality?: string,
): Promise<FareButton[]> {
  const q = `?organization_id=${encodeURIComponent(organization_id ?? '')}&municipality=${encodeURIComponent(municipality ?? '')}`;
  try {
    const data = await apiRequest<{
      standard_fares_centavos: number[];
    }>(`/fares${q}`);
    const fares = data.standard_fares_centavos.map((amountCentavos, index) => ({
      id: `server-fare-${amountCentavos}`,
      label: `₱${(amountCentavos / 100).toFixed(amountCentavos % 100 === 0 ? 0 : 2)}`,
      amountCentavos,
      sortOrder: index,
    }));
    await AsyncStorage.setItem(FARES_CACHE, JSON.stringify(fares));
    return fares;
  } catch {
    try {
      const raw = await AsyncStorage.getItem(FARES_CACHE);
      if (raw) return JSON.parse(raw) as FareButton[];
    } catch {}
    return DEFAULT_FARES;
  }
}
