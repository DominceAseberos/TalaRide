// ─── Shared between mobile (passenger) app and web dashboard ────────────────

/** Type of identifier used to identify a tricycle/pedicab. */
export type IdentifierType = 'MTOP' | 'Body #' | 'Plate #';

/** Vehicle compliance status. */
export type VehicleStatus = 'active' | 'suspended' | 'for_renewal';

/** Type of vehicle unit. */
export type UnitType = 'tricycle' | 'pedicab';

/** Auth role for Supabase profiles table. */
export type UserRole = 'passenger' | 'operator' | 'lgu_admin';

/** SaaS subscription tier for organizations. */
export type SubscriptionTier = 'free' | 'operator' | 'lgu';

// ─── Mobile-app types ─────────────────────────────────────────────────────────

export type RelayResponse = 'offered' | 'dismissed';
export type RelayRequestStatus = 'active' | 'helper_responding' | 'resolved' | 'expired';

/** A ride record stored locally on the passenger device. Never uploaded. */
export interface Ride {
  id: string;
  number: string;
  identifier: IdentifierType;
  date: string;    // ISO timestamp
  note: string;
  location: string;
}

export interface LostRequest {
  id: string;
  rideId: string;
  description: string;
  details: string;
  date: string;
  expiresAt: string;
  status: 'Active' | 'Helper responding' | 'Resolved' | 'Expired';
}

export interface RelayPrompt {
  matchId: string;
  requestId: string;
  rideId: string;
  description: string;
  details: string;
  createdAt: string;
  expiresAt: string;
}

export interface Notification {
  id: string;
  requestId: string;
  title: string;
  message: string;
  date: string;
  unread: boolean;
  kind: 'relay_prompt' | 'helper_offered' | 'request_resolved' | 'request_expired';
  matchId?: string;
  description?: string;
  details?: string;
  matchResponse?: RelayResponse | null;
  requestStatus?: RelayRequestStatus;
  expiresAt?: string;
}

// ─── Web dashboard types ──────────────────────────────────────────────────────

/** An operator organization — the paying customer unit. */
export interface Organization {
  id: string;
  name: string;
  municipality: string;
  region: string;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

/** A tricycle or pedicab registered by an operator. */
export interface Vehicle {
  id: string;
  organizationId: string;
  bodyNumber: string;
  mtopNumber?: string;
  plateNumber?: string;
  unitType: UnitType;
  status: VehicleStatus;
  mtopExpiresAt?: string;     // ISO date string (YYYY-MM-DD)
  inspectionDueAt?: string;   // ISO date string (YYYY-MM-DD)
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** A driver registered by an operator. */
export interface Driver {
  id: string;
  organizationId: string;
  vehicleId?: string;
  fullName: string;
  licenseNumber?: string;
  licenseExpiresAt?: string;  // ISO date string (YYYY-MM-DD)
  contactNumber?: string;
  emergencyContact?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** User profile metadata stored in Supabase profiles. */
export interface UserProfile {
  id: string;
  displayName: string;
  role: UserRole;
  organizationId?: string | null;
  municipality?: string | null;
  createdAt: string;
}

export * from './database';
export * from './payments';

