-- 006_payments.sql
-- Payments table with canonical status, unique constraints, and integer centavos

CREATE TYPE payment_status_type AS ENUM (
  'initiated',
  'awaiting_confirmation',
  'confirmed',
  'failed',
  'expired',
  'refunded',
  'reversed'
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  ride_id TEXT UNIQUE NOT NULL REFERENCES rides(ride_id) ON DELETE RESTRICT,
  driver_code TEXT NOT NULL REFERENCES drivers(driver_code) ON DELETE RESTRICT,
  vehicle_code TEXT NOT NULL REFERENCES vehicles(vehicle_code) ON DELETE RESTRICT,
  amount_centavos INT NOT NULL CHECK (amount_centavos > 0),
  provider TEXT NOT NULL DEFAULT 'gcash' CHECK (provider IN ('gcash', 'maya', 'gotyme', 'qrph_bank', 'mock')),
  provider_ref TEXT UNIQUE,
  payment_status payment_status_type NOT NULL DEFAULT 'initiated',
  provider_fee_centavos INT NOT NULL DEFAULT 0 CHECK (provider_fee_centavos >= 0),
  talaride_fee_centavos INT NOT NULL DEFAULT 0 CHECK (talaride_fee_centavos >= 0),
  net_centavos INT NOT NULL,
  qr_payload TEXT NOT NULL,
  qr_sig TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_driver_code ON payments(driver_code);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view payments for their rides"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.driver_code = payments.driver_code
      AND drivers.user_id = auth.uid()
    )
  );

CREATE POLICY "Passengers can view payment for their ride"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.ride_id = payments.ride_id
      AND rides.passenger_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
