# Archived Talaride-web migrations

These SQL files came from the old local `Talaride-web` checkout and were never committed to that repository's production `main`.

They are preserved for migration review only and are intentionally outside `supabase/migrations/`, so Supabase CLI commands such as `supabase db push` do not apply them automatically.

Do not move these files into the active migration directory as-is. They overlap with the canonical TalaRide schema, including `profiles`, `drivers`, and `vehicles`. Reconcile table definitions, constraints, RLS policies, and existing production schema first.
