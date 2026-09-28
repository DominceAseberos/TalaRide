-- Phase 2: Operator & LGU Fleet Management Schema
-- Passenger ride privacy is strictly maintained (rides remain 100% on device).
begin;

-- 1. Organizations: The paying customer unit (Operator co-op or LGU Municipality)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  municipality text not null check (char_length(btrim(municipality)) between 2 and 100),
  region text not null check (char_length(btrim(region)) between 2 and 100),
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'operator', 'lgu')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Extend profiles with role and org mapping
alter table public.profiles
  add column if not exists role text not null default 'passenger'
    check (role in ('passenger', 'operator', 'lgu_admin')),
  add column if not exists organization_id uuid
    references public.organizations(id) on delete set null,
  add column if not exists municipality text;

-- 3. Vehicles: Registered units per organization
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  body_number text not null check (char_length(btrim(body_number)) between 1 and 20),
  mtop_number text check (mtop_number is null or char_length(btrim(mtop_number)) between 1 and 30),
  plate_number text check (plate_number is null or char_length(btrim(plate_number)) between 1 and 15),
  unit_type text not null default 'tricycle'
    check (unit_type in ('tricycle', 'pedicab')),
  year integer check (year is null or (year between 1970 and 2100)),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'for_renewal')),
  mtop_expires_at date,
  inspection_due_at date,
  photo_url text check (photo_url is null or char_length(photo_url) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vehicle_org_body unique (organization_id, body_number)
);

-- 4. Drivers: Registered drivers per organization
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  license_number text check (license_number is null or char_length(btrim(license_number)) between 1 and 30),
  license_expires_at date,
  contact_number text check (contact_number is null or char_length(btrim(contact_number)) between 7 and 25),
  emergency_contact text check (emergency_contact is null or char_length(btrim(emergency_contact)) between 2 and 150),
  photo_url text check (photo_url is null or char_length(photo_url) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Indexes for fast lookup and multi-tenant isolation
create index idx_org_municipality on public.organizations(municipality);
create index idx_vehicles_org on public.vehicles(organization_id);
create index idx_vehicles_status on public.vehicles(status);
create index idx_vehicles_mtop_expires on public.vehicles(mtop_expires_at);
create index idx_drivers_org on public.drivers(organization_id);
create index idx_drivers_vehicle on public.drivers(vehicle_id);
create index idx_drivers_license_expires on public.drivers(license_expires_at);
create index idx_profiles_org on public.profiles(organization_id);
create index idx_profiles_role on public.profiles(role);

-- 6. Updated_at trigger helper
create or replace function public.set_row_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_row_updated_at();

create trigger trg_drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_row_updated_at();

create trigger trg_orgs_updated_at
  before update on public.organizations
  for each row execute function public.set_row_updated_at();

-- 7. Row Level Security
alter table public.organizations enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.vehicles from anon, authenticated;
revoke all on public.drivers from anon, authenticated;

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.drivers to authenticated;
grant update (organization_id, role, municipality) on public.profiles to authenticated;

-- Organizations Policies:
-- Any authenticated user can create an organization (onboarding)
create policy "Authenticated users can create organization"
  on public.organizations for insert to authenticated
  with check (true);

-- Operators can read their own organization
create policy "Operators read own organization"
  on public.organizations for select to authenticated
  using (
    id = (select organization_id from public.profiles where id = (select auth.uid()))
    or
    (
      -- LGU Admins can read all organizations in their municipality
      exists (
        select 1 from public.profiles
        where id = (select auth.uid())
          and role = 'lgu_admin'
          and municipality = organizations.municipality
      )
    )
  );

-- Operators can update their own organization
create policy "Operators update own organization"
  on public.organizations for update to authenticated
  using (id = (select organization_id from public.profiles where id = (select auth.uid())))
  with check (id = (select organization_id from public.profiles where id = (select auth.uid())));

-- Vehicles Policies:
-- Operators can select their own vehicles; LGU admins can select vehicles under their municipality
create policy "Read vehicles"
  on public.vehicles for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
    or
    exists (
      select 1 from public.profiles p
      join public.organizations o on o.id = vehicles.organization_id
      where p.id = (select auth.uid())
        and p.role = 'lgu_admin'
        and p.municipality = o.municipality
    )
  );

-- Operators can insert vehicles into their own org
create policy "Operators insert vehicles"
  on public.vehicles for insert to authenticated
  with check (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Operators can update their own vehicles
create policy "Operators update vehicles"
  on public.vehicles for update to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Operators can delete their own vehicles
create policy "Operators delete vehicles"
  on public.vehicles for delete to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Drivers Policies:
-- Operators can select their own drivers; LGU admins can select drivers in their municipality
create policy "Read drivers"
  on public.drivers for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
    or
    exists (
      select 1 from public.profiles p
      join public.organizations o on o.id = drivers.organization_id
      where p.id = (select auth.uid())
        and p.role = 'lgu_admin'
        and p.municipality = o.municipality
    )
  );

-- Operators can insert drivers into their own org
create policy "Operators insert drivers"
  on public.drivers for insert to authenticated
  with check (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Operators can update their own drivers
create policy "Operators update drivers"
  on public.drivers for update to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

-- Operators can delete their own drivers
create policy "Operators delete drivers"
  on public.drivers for delete to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

commit;
