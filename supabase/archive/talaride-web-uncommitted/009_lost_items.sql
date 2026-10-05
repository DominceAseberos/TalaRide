-- 009_lost_items.sql
-- Mediated lost item reports and driver response workflows

CREATE TABLE IF NOT EXISTS lost_items (
  report_id TEXT PRIMARY KEY,
  ride_id TEXT NOT NULL REFERENCES rides(ride_id) ON DELETE RESTRICT,
  vehicle_code TEXT NOT NULL REFERENCES vehicles(vehicle_code) ON DELETE RESTRICT,
  driver_code TEXT NOT NULL REFERENCES drivers(driver_code) ON DELETE RESTRICT,
  passenger_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  passenger_name TEXT NOT NULL,
  passenger_contact TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('phone', 'wallet', 'bag', 'documents', 'keys', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'driver_notified', 'found', 'unresolved', 'closed')),
  driver_response TEXT CHECK (driver_response IN ('found', 'not_found', 'contact_support')),
  driver_response_note TEXT,
  client_operation_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can read own lost item reports"
  ON lost_items FOR SELECT
  USING (passenger_id = auth.uid());

CREATE POLICY "Drivers can view and respond to lost items on their rides"
  ON lost_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.driver_code = lost_items.driver_code
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view and manage all lost items"
  ON lost_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
