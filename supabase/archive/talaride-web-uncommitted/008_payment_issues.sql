-- 008_payment_issues.sql
-- Payment issues / disputes table with resolution tracking

CREATE TABLE IF NOT EXISTS payment_issues (
  ticket_id TEXT PRIMARY KEY,
  payment_id TEXT REFERENCES payments(payment_id) ON DELETE SET NULL,
  ride_id TEXT REFERENCES rides(ride_id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('paid_twice', 'wrong_amount', 'deducted_no_driver_confirm', 'incorrect_custom_fare', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'refunded')),
  reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_by_name TEXT,
  resolution_notes TEXT,
  client_operation_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE payment_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment issues"
  ON payment_issues FOR SELECT
  USING (reported_by = auth.uid());

CREATE POLICY "Admins can view and manage all payment issues"
  ON payment_issues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
