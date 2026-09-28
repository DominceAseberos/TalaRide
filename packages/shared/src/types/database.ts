export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          municipality: string;
          region: string;
          subscription_tier: 'free' | 'operator' | 'lgu';
          subscription_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          municipality: string;
          region: string;
          subscription_tier?: 'free' | 'operator' | 'lgu';
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          municipality?: string;
          region?: string;
          subscription_tier?: 'free' | 'operator' | 'lgu';
          subscription_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: 'passenger' | 'operator' | 'lgu_admin';
          organization_id: string | null;
          municipality: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          role?: 'passenger' | 'operator' | 'lgu_admin';
          organization_id?: string | null;
          municipality?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          role?: 'passenger' | 'operator' | 'lgu_admin';
          organization_id?: string | null;
          municipality?: string | null;
          created_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
          body_number: string;
          mtop_number: string | null;
          plate_number: string | null;
          unit_type: 'tricycle' | 'pedicab';
          year: number | null;
          status: 'active' | 'suspended' | 'for_renewal';
          mtop_expires_at: string | null;
          inspection_due_at: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          body_number: string;
          mtop_number?: string | null;
          plate_number?: string | null;
          unit_type?: 'tricycle' | 'pedicab';
          year?: number | null;
          status?: 'active' | 'suspended' | 'for_renewal';
          mtop_expires_at?: string | null;
          inspection_due_at?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          body_number?: string;
          mtop_number?: string | null;
          plate_number?: string | null;
          unit_type?: 'tricycle' | 'pedicab';
          year?: number | null;
          status?: 'active' | 'suspended' | 'for_renewal';
          mtop_expires_at?: string | null;
          inspection_due_at?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          organization_id: string;
          vehicle_id: string | null;
          full_name: string;
          license_number: string | null;
          license_expires_at: string | null;
          contact_number: string | null;
          emergency_contact: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          vehicle_id?: string | null;
          full_name: string;
          license_number?: string | null;
          license_expires_at?: string | null;
          contact_number?: string | null;
          emergency_contact?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          vehicle_id?: string | null;
          full_name?: string;
          license_number?: string | null;
          license_expires_at?: string | null;
          contact_number?: string | null;
          emergency_contact?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
