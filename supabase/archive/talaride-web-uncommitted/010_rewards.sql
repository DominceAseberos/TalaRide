-- 010_rewards.sql
-- Server-minted rewards ledger with unique constraint preventing duplicate ride rewards

CREATE TABLE IF NOT EXISTS rewards_ledger (
  reward_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id TEXT UNIQUE REFERENCES rides(ride_id) ON DELETE SET NULL,
  points INT NOT NULL CHECK (points > 0),
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'redeemed', 'revoked')),
  reward_type TEXT NOT NULL DEFAULT 'ride_completion' CHECK (reward_type IN ('ride_completion', 'promotional_voucher')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards_ledger(user_id);

ALTER TABLE rewards_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can read own rewards ledger"
  ON rewards_ledger FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all rewards"
  ON rewards_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
