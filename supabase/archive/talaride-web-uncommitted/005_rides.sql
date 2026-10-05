-- 005_rides.sql
-- Rides table with idempotency key, centavos fare, and foreign keys

CREATE TABLE IF NOT EXISTS rides (
  ride_id TEXT PRIMARY KEY,
  driver_code TEXT NOT NULL REFERENCES drivers(driver_code) ON DELETE RESTRICT,
  vehicle_code TEXT NOT NULL REFERENCES vehicles(vehicle_code) ON DELETE RESTRICT,
  passenger_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  passenger_name TEXT,
  passenger_mobile TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  approximate_location TEXT NOT NULL DEFAULT 'Tagum City',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('digital', 'cash')),
  fare_amount_centavos INT NOT NULL DEFAULT 0 CHECK (fare_amount_centavos >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  is_checkin_only BOOLEAN NOT NULL DEFAULT false,
  client_operation_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rides_driver_code ON rides(driver_code);
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_code ON rides(vehicle_code);

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can read own rides"
  ON rides FOR SELECT
  USING (passenger_id = auth.uid());

CREATE POLICY "Drivers can read their rides"
  ON rides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.driver_code = rides.driver_code
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all rides"
  ON rides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
