export type UserRole = 'driver' | 'commuter' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';
export type DriverVerificationStatus = 'verified' | 'pending' | 'suspended';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export type ShiftStatus = 'active' | 'ended';
export type PaymentMethod = 'digital' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentProvider = 'gcash' | 'maya' | 'gotyme' | 'qrph_bank';
export type LostItemCategory = 'phone' | 'wallet' | 'bag' | 'documents' | 'keys' | 'other';
export type LostItemStatus = 'submitted' | 'driver_notified' | 'found' | 'unresolved' | 'closed';

export interface User {
  user_id: string;
  mobile_number: string;
  name: string;
  account_type: UserRole;
  status: AccountStatus;
  created_at: string;
}

export interface Driver {
  driver_id: string; // e.g. DR-000481
  user_id: string;
  name: string;
  mobile_number: string;
  verification_status: DriverVerificationStatus;
  toda_operator: string;
  assigned_vehicle_id: string | null;
  shift_status: ShiftStatus;
  active_shift_id?: string | null;
  license_number: string;
  created_at: string;
}

export interface Vehicle {
  vehicle_id: string; // e.g. TR-01842
  plate_body_number: string;
  toda: string;
  status: VehicleStatus;
  assigned_driver_id: string | null;
  assigned_driver_name?: string | null;
  qr_code_payload: string;
  created_at: string;
}

export interface DriverShift {
  shift_id: string;
  driver_id: string;
  vehicle_id: string;
  start_time: string;
  end_time: string | null;
  status: ShiftStatus;
  digital_rides_count: number;
  digital_gross_total: number;
  provider_platform_fees: number;
  digital_net_total: number;
  cash_rides_count: number;
  cash_gross_total: number;
}

export interface Ride {
  ride_id: string;
  driver_id: string;
  driver_name: string;
  vehicle_id: string;
  passenger_id?: string | null;
  passenger_name?: string | null;
  passenger_mobile?: string | null;
  timestamp: string;
  approximate_location: string;
  payment_method: PaymentMethod;
  fare_amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  is_checkin_only?: boolean;
}

export interface Payment {
  payment_id: string;
  ride_id: string;
  driver_id: string;
  vehicle_id: string;
  amount: number;
  provider: PaymentProvider;
  provider_reference: string;
  payment_status: PaymentStatus;
  provider_fee: number;
  talaride_fee: number;
  net_amount: number;
  qr_payload: string;
  created_at: string;
  expires_at: string;
  paid_at?: string | null;
}

export interface LostItemReport {
  report_id: string;
  ride_id: string;
  vehicle_id: string;
  driver_id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_contact: string;
  item_category: LostItemCategory;
  description: string;
  status: LostItemStatus;
  driver_response?: 'found' | 'not_found' | 'contact_support' | null;
  driver_response_note?: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface RewardsTransaction {
  reward_id: string;
  user_id: string;
  ride_id: string;
  points: number;
  status: 'earned' | 'redeemed' | 'revoked';
  reward_type: 'ride_completion' | 'promotional_voucher';
  created_at: string;
}

export interface FareConfiguration {
  standard_fares: number[];
  min_custom_fare: number;
  max_custom_fare: number;
  provider_fee_percentage: number;
  talaride_platform_fee: number;
}

export interface PaymentIssueTicket {
  ticket_id: string;
  payment_id: string;
  ride_id: string;
  issue_type: 'paid_twice' | 'wrong_amount' | 'deducted_no_driver_confirm' | 'incorrect_custom_fare' | 'other';
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'refunded';
  reported_by: string;
  created_at: string;
  resolution_notes?: string;
}
