-- 003_driver_shifts.sql
-- Driver shifts with centavos financial totals and one-active-shift constraint

CREATE TABLE IF NOT EXISTS driver_shifts (
  shift_id TEXT PRIMARY KEY,
  driver_code TEXT NOT NULL REFERENCES drivers(driver_code) ON DELETE RESTRICT,
  vehicle_code TEXT NOT NULL REFERENCES vehicles(vehicle_code) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  digital_rides_count INT NOT NULL DEFAULT 0 CHECK (digital_rides_count >= 0),
  digital_gross_centavos INT NOT NULL DEFAULT 0 CHECK (digital_gross_centavos >= 0),
  provider_fees_centavos INT NOT NULL DEFAULT 0 CHECK (provider_fees_centavos >= 0),
  talaride_fees_centavos INT NOT NULL DEFAULT 0 CHECK (talaride_fees_centavos >= 0),
  digital_net_centavos INT NOT NULL DEFAULT 0,
  cash_rides_count INT NOT NULL DEFAULT 0 CHECK (cash_rides_count >= 0),
  cash_gross_centavos INT NOT NULL DEFAULT 0 CHECK (cash_gross_centavos >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enforce exactly ONE active shift per driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_driver
  ON driver_shifts(driver_code)
  WHERE end_time IS NULL;

-- Enforce exactly ONE active shift per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_vehicle
  ON driver_shifts(vehicle_code)
  WHERE end_time IS NULL;

ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view and update own shifts"
  ON driver_shifts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.driver_code = driver_shifts.driver_code
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all shifts"
  ON driver_shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
