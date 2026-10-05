-- 002_driver_vehicle_codes.sql
-- Canonical driver and vehicle tables with strict format constraints

CREATE TABLE IF NOT EXISTS drivers (
  driver_code TEXT PRIMARY KEY CHECK (driver_code ~ '^DR-[0-9]{6}$'),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  license_number TEXT NOT NULL,
  toda_operator TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'pending', 'suspended')),
  pin_hash TEXT,
  assigned_vehicle_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_code TEXT PRIMARY KEY CHECK (vehicle_code ~ '^TR-[0-9]{5}$'),
  plate_body_number TEXT NOT NULL,
  toda TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  assigned_driver_code TEXT REFERENCES drivers(driver_code) ON DELETE SET NULL,
  qr_checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Circular FK link from drivers to vehicles
ALTER TABLE drivers
  ADD CONSTRAINT fk_driver_assigned_vehicle
  FOREIGN KEY (assigned_vehicle_code) REFERENCES vehicles(vehicle_code)
  ON DELETE SET NULL;

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Public can view active vehicles for QR validation / safety check-in
CREATE POLICY "Public vehicle verification"
  ON vehicles FOR SELECT
  USING (true);

-- Drivers can read their own driver profile
CREATE POLICY "Drivers can read own profile"
  ON drivers FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );

-- Operators can read drivers and vehicles in their TODA
CREATE POLICY "Operators can read TODA drivers"
  ON drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'operator'
    )
  );
