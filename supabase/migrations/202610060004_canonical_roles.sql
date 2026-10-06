begin;

-- Keep the public profile role vocabulary small and consistent across clients.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles
set role = case role
  when 'talaride_admin' then 'admin'
  when 'lgu_admin' then 'admin'
  when 'commuter' then 'passenger'
  when 'toda_operator' then 'operator'
  when 'driver' then 'driver'
  when 'operator' then 'operator'
  when 'admin' then 'admin'
  else 'passenger'
end;
alter table public.profiles alter column role set default 'passenger';
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'operator', 'passenger', 'driver'));

-- Preserve driver accounts created before roles were added to the profile
-- trigger. The durable backend state is the registration source of truth.
update public.profiles p
set role = 'driver'
where p.role = 'passenger'
  and (
    exists (
      select 1 from auth.users u
      where u.id = p.id and u.raw_user_meta_data ->> 'requested_role' = 'driver'
    )
    or exists (
      select 1
      from public.talaride_backend_state state_row
      cross join lateral jsonb_array_elements(coalesce(state_row.state -> 'drivers', '[]'::jsonb)) as driver(value)
      where driver.value ->> 'user_id' = p.id::text
    )
  );

-- Role and organization membership are managed by the service role. A user
-- must not be able to promote their own profile through the public API.
revoke update (organization_id, role, municipality) on public.profiles from authenticated;

-- Fleet management runs through the authenticated backend. The legacy tables
-- remain available for scoped reads, but self-service DML is disabled.
drop policy if exists "Authenticated users can create organization" on public.organizations;
drop policy if exists "Operators update own organization" on public.organizations;
drop policy if exists "Operators insert vehicles" on public.vehicles;
drop policy if exists "Operators update vehicles" on public.vehicles;
drop policy if exists "Operators delete vehicles" on public.vehicles;
drop policy if exists "Operators insert drivers" on public.drivers;
drop policy if exists "Operators update drivers" on public.drivers;
drop policy if exists "Operators delete drivers" on public.drivers;
revoke insert, update, delete on public.organizations, public.vehicles, public.drivers from authenticated;
grant select on public.organizations, public.vehicles, public.drivers to authenticated;

drop policy if exists "Operators read own organization" on public.organizations;
create policy "Read assigned organization" on public.organizations for select to authenticated
  using (
    id = (select organization_id from public.profiles where id = (select auth.uid()))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
drop policy if exists "Read vehicles" on public.vehicles;
create policy "Read assigned vehicles" on public.vehicles for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
drop policy if exists "Read drivers" on public.drivers;
create policy "Read assigned drivers" on public.drivers for select to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Signup may choose only the two self-service roles; privileged roles are
-- assigned by the admin portal using Supabase's server-side admin API.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  requested_name text := btrim(new.raw_user_meta_data ->> 'display_name');
  requested_role text := new.raw_user_meta_data ->> 'requested_role';
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    case when char_length(requested_name) between 1 and 80 then requested_name else 'Passenger' end,
    case when requested_role = 'driver' then 'driver' else 'passenger' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
