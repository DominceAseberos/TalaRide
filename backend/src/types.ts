export type AppRole = 'passenger' | 'driver' | 'operator' | 'lgu_admin' | 'talaride_admin';
export type DriverVerificationStatus = 'verified' | 'pending' | 'suspended';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export type ShiftStatus = 'active' | 'ended';
export type PaymentMethod = 'digital' | 'cash';
export type PaymentStatus =
  | 'initiated'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'reversed';
export type PaymentProvider = 'gcash' | 'maya' | 'gotyme' | 'qrph_bank' | 'card' | 'mock';
export type LostItemCategory = 'phone' | 'wallet' | 'bag' | 'documents' | 'keys' | 'other';
export type LostItemStatus = 'submitted' | 'driver_notified' | 'found' | 'unresolved' | 'closed';

export interface Profile {
  id: string; // UUID
  mobile_number: string;
  full_name: string;
  role: AppRole;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at?: string;
}

export interface Driver {
  driver_code: string; // e.g. DR-000481
  user_id: string;
  full_name: string;
  mobile_number: string;
  verification_status: DriverVerificationStatus;
  toda_operator: string;
  license_number: string;
  pin_hash?: string;
  assigned_vehicle_code: string | null;
  shift_status?: ShiftStatus;
  active_shift_id?: string | null;
  created_at: string;
  updated_at?: string;
  photo_url?: string | null;
}

export interface Vehicle {
  vehicle_code: string; // e.g. TR-01842
  plate_body_number: string;
  toda: string;
  status: VehicleStatus;
  assigned_driver_code: string | null;
  assigned_driver_name?: string | null;
  qr_checksum: string;
  created_at: string;
  updated_at?: string;
}

export interface DriverShift {
  shift_id: string;
  driver_code: string;
  vehicle_code: string;
  start_time: string;
  end_time: string | null;
  status: ShiftStatus;
  digital_rides_count: number;
  digital_gross_centavos: number;
  provider_fees_centavos: number;
  talaride_fees_centavos: number;
  digital_net_centavos: number;
  cash_rides_count: number;
  cash_gross_centavos: number;
  created_at: string;
}

export interface Ride {
  ride_id: string; // e.g. RIDE-2026-8941
  driver_code: string;
  driver_name?: string;
  vehicle_code: string;
  passenger_id?: string | null;
  passenger_name?: string | null;
  passenger_mobile?: string | null;
  timestamp: string;
  approximate_location: string;
  payment_method: PaymentMethod;
  fare_amount_centavos: number;
  status: 'completed' | 'pending' | 'cancelled';
  is_checkin_only?: boolean;
  client_operation_id?: string | null;
  created_at: string;
}

export interface Payment {
  payment_environment?: 'test' | 'live';
  payment_id: string; // e.g. PAY-842109
  ride_id: string;
  driver_code: string;
  vehicle_code: string;
  amount_centavos: number;
  provider: PaymentProvider;
  provider_ref: string | null;
  checkout_session_id?: string | null;
  checkout_url?: string | null;
  payment_status: PaymentStatus;
  provider_fee_centavos: number;
  talaride_fee_centavos: number;
  net_centavos: number;
  qr_payload: string;
  qr_sig: string;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
}

export interface PaymentEvent {
  event_id: string;
  payment_id: string;
  event_type: string;
  provider_ref?: string | null;
  payload: any;
  created_at: string;
}

export interface LostItemReport {
  report_id: string;
  ride_id: string;
  vehicle_code: string;
  driver_code: string;
  passenger_id?: string | null;
  passenger_name: string;
  passenger_contact: string;
  item_category: LostItemCategory;
  description: string;
  status: LostItemStatus;
  driver_response?: 'found' | 'not_found' | 'contact_support' | null;
  driver_response_note?: string | null;
  client_operation_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface RewardsLedger {
  reward_id: string;
  user_id: string;
  ride_id?: string | null;
  points: number;
  status: 'earned' | 'redeemed' | 'revoked';
  reward_type: 'ride_completion' | 'promotional_voucher';
  created_at: string;
}

export interface FareConfiguration {
  id?: string;
  standard_fares_centavos: number[]; // e.g. [1500, 2000, 2500, 3000, 4000]
  min_custom_fare_centavos: number;
  max_custom_fare_centavos: number;
  provider_fee_basis_points: number; // e.g. 175 = 1.75%
  talaride_fee_basis_points: number;
}

export interface PaymentIssueTicket {
  ticket_id: string;
  payment_id?: string | null;
  ride_id?: string | null;
  issue_type: 'paid_twice' | 'wrong_amount' | 'deducted_no_driver_confirm' | 'incorrect_custom_fare' | 'other';
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'refunded';
  reported_by?: string | null;
  reported_by_name?: string | null;
  resolution_notes?: string | null;
  client_operation_id?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface NotificationRecord {
  notification_id: string;
  user_id?: string | null;
  driver_code?: string | null;
  event_type: string;
  title: string;
  body: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}
