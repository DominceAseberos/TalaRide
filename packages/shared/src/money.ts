export function formatCentavos(amountCentavos: number, currency = '₱'): string {
  if (!Number.isInteger(amountCentavos) || amountCentavos < 0) throw new Error('Invalid amount.');
  const pesos = Math.floor(amountCentavos / 100);
  const centavos = amountCentavos % 100;
  const grouped = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return centavos === 0
    ? `${currency}${grouped}`
    : `${currency}${grouped}.${centavos.toString().padStart(2, '0')}`;
}

export function parsePesoToCentavos(input: string): number {
  const normalized = input.trim().replace(/[₱, ]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid fare.');
  const [pesos, cents = ''] = normalized.split('.');
  const amountCentavos = Number(pesos) * 100 + Number((cents + '00').slice(0, 2));
  if (!Number.isInteger(amountCentavos) || amountCentavos < 100 || amountCentavos > 99990000)
    throw new Error('Fare must be ₱1–₱999,900.');
  return amountCentavos;
}
