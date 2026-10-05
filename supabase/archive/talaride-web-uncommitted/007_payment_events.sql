-- 007_payment_events.sql
-- Audit log of payment events and provider callbacks

CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_ref TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment events"
  ON payment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('lgu_admin', 'talaride_admin')
    )
  );
