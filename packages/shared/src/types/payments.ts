// Payment/ride/shift/reward/fare shared types. DB snake_case ↔ TS camelCase mapped in backend-contract.
export type PaymentMethod = 'digital' | 'cash';
export type PaymentStatus =
  | 'initiated'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'reversed';
export type RideStatus = 'pending' | 'completed' | 'cancelled';
export type ShiftStatus = 'active' | 'ended' | 'expired';

export interface PaymentIntent {
  paymentId: string;
  rideId: string;
  vehicleCode: string;
  amountCentavos: number;
  qrPayload: string;
  expiresAt: string;
  status: PaymentStatus;
  mock: boolean;
}

export interface ServerRide {
  rideId: string;
  vehicleCode: string;
  driverCode?: string;
  driverNameMasked?: string;
  amountCentavos: number;
  paymentMethod: PaymentMethod;
  status: RideStatus;
  date: string;
  pickupText?: string;
}

export interface FareButton {
  id: string;
  label: string;
  amountCentavos: number;
  sortOrder: number;
}

export const DEFAULT_FARES: FareButton[] = [
  { id: 'fare-15', label: '₱15', amountCentavos: 1500, sortOrder: 0 },
  { id: 'fare-20', label: '₱20', amountCentavos: 2000, sortOrder: 1 },
  { id: 'fare-25', label: '₱25', amountCentavos: 2500, sortOrder: 2 },
  { id: 'fare-30', label: '₱30', amountCentavos: 3000, sortOrder: 3 },
  { id: 'fare-40', label: '₱40', amountCentavos: 4000, sortOrder: 4 },
];
