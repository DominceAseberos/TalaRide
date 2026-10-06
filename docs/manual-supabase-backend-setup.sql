-- TalaRide: manual setup for the new backend storage.
-- Run in project icqxcfmhawqxufvlifdv, SQL Editor, with the postgres role.
-- Creates the required table/function and restricts direct client access.
-- Existing records are preserved. Does not seed demo records.
-- This handles backend storage only, not media or Edge Function deployment.
begin;
-- Durable store for the canonical Render API. Existing mobile profile/relay tables remain intact.
-- Browser/mobile clients cannot read or write the API store directly.
create table if not exists public.talaride_backend_state (
  id text primary key check (id = 'canonical'),
  revision bigint not null default 0,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.talaride_backend_state enable row level security;
revoke all on public.talaride_backend_state from public, anon, authenticated;
grant all on public.talaride_backend_state to service_role;

create or replace function public.talaride_commit_state(expected_revision bigint, next_state jsonb)
returns boolean language plpgsql set search_path = public as $$
begin
  update public.talaride_backend_state
  set state = next_state, revision = revision + 1, updated_at = now()
  where id = 'canonical' and revision = expected_revision;
  return found;
end;
$$;
revoke all on function public.talaride_commit_state(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.talaride_commit_state(bigint,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;

-- Expected: one row, with all four columns true.
select
  to_regclass('public.talaride_backend_state') is not null as backend_table_ready,
  to_regprocedure('public.talaride_commit_state(bigint,jsonb)') is not null as commit_function_ready,
  (select relrowsecurity from pg_class where oid = 'public.talaride_backend_state'::regclass) as row_security_enabled,
  not (
    has_table_privilege('anon', 'public.talaride_backend_state', 'SELECT, INSERT, UPDATE, DELETE')
    or has_table_privilege('authenticated', 'public.talaride_backend_state', 'SELECT, INSERT, UPDATE, DELETE')
  ) as client_access_blocked;