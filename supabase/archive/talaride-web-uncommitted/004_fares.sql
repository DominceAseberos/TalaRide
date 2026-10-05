-- 004_fares.sql
-- Fare configuration with integer centavos and basis points

CREATE TABLE IF NOT EXISTS fares (
  id TEXT PRIMARY KEY DEFAULT 'current',
  standard_fares_centavos INT[] NOT NULL DEFAULT '{1500, 2000, 2500, 3000, 4000}',
  min_custom_fare_centavos INT NOT NULL DEFAULT 1500 CHECK (min_custom_fare_centavos >= 1000),
  max_custom_fare_centavos INT NOT NULL DEFAULT 50000 CHECK (max_custom_fare_centavos > min_custom_fare_centavos),
  provider_fee_basis_points INT NOT NULL DEFAULT 175 CHECK (provider_fee_basis_points >= 0), -- 175 = 1.75%
  talaride_fee_basis_points INT NOT NULL DEFAULT 0 CHECK (talaride_fee_basis_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default configuration
INSERT INTO fares (id, standard_fares_centavos, min_custom_fare_centavos, max_custom_fare_centavos, provider_fee_basis_points)
VALUES ('current', '{1500, 2000, 2500, 3000, 4000}', 1500, 50000, 175)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fare table"
  ON fares FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update fare table"
  ON fares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
