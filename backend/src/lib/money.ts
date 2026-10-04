/**
 * Canonical Currency & Fee Calculations
 * Strictly uses integer centavos (1 PHP = 100 centavos).
 * No floating point currency for authoritative backend values.
 */

export interface FeeBreakdown {
  amountCentavos: number;
  providerFeeCentavos: number;
  talarideFeeCentavos: number;
  netCentavos: number;
}

export function toCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function toPesos(centavos: number): number {
  return centavos / 100;
}

export function calculateFeeBreakdown(
  amountCentavos: number,
  providerFeeBps: number = 175, // 175 basis points = 1.75%
  talarideFeeBps: number = 0
): FeeBreakdown {
  if (!Number.isInteger(amountCentavos) || amountCentavos <= 0) {
    throw new Error(`Invalid amount_centavos: ${amountCentavos}. Must be a positive integer.`);
  }

  // Calculate provider fee in centavos (rounded to nearest centavo)
  const providerFeeCentavos = Math.round((amountCentavos * providerFeeBps) / 10000);
  const talarideFeeCentavos = Math.round((amountCentavos * talarideFeeBps) / 10000);
  const netCentavos = amountCentavos - providerFeeCentavos - talarideFeeCentavos;

  return {
    amountCentavos,
    providerFeeCentavos,
    talarideFeeCentavos,
    netCentavos
  };
}
