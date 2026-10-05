const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const readRepoFile = (file) =>
  readFileSync(existsSync(file) ? file : path.resolve(__dirname, '../../', file), 'utf8');

test('fleet management migration establishes organizations, vehicles, drivers and enforces multi-tenant RLS', async () => {
  const db = new PGlite();

  // Test identities
  const operatorA = '11111111-1111-4111-8111-111111111111';
  const operatorB = '22222222-2222-4222-8222-222222222222';
  const lguAdminTala = '33333333-3333-4333-8333-333333333333';
  const passenger = '44444444-4444-4444-8444-444444444444';

  try {
    // 1. Setup Supabase baseline auth & schemas
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users(id) values
        ('${operatorA}'),
        ('${operatorB}'),
        ('${lguAdminTala}'),
        ('${passenger}');
    `);

    // 2. Run previous migrations (profiles baseline)
    await db.exec(readRepoFile('supabase/migrations/202609180001_profiles.sql'));

    // 3. Run the new fleet management migration
    await db.exec(readRepoFile('supabase/migrations/202609280001_fleet_management.sql'));

    // 4. Create organizations as service_role/admin
    const orgARes = await db.query(`
      insert into public.organizations (name, municipality, region, subscription_tier)
      values ('Tala Transport Coop', 'Tala', 'Region IV-A', 'operator')
      returning id;
    `);
    const orgAId = orgARes.rows[0].id;

    const orgBRes = await db.query(`
      insert into public.organizations (name, municipality, region, subscription_tier)
      values ('Antipolo Drivers Assoc', 'Antipolo', 'Region IV-A', 'operator')
      returning id;
    `);
    const orgBId = orgBRes.rows[0].id;

    // 5. Setup user profile roles and associations
    await db.query(`
      update public.profiles set role = 'operator', organization_id = $1 where id = $2;
    `, [orgAId, operatorA]);

    await db.query(`
      update public.profiles set role = 'operator', organization_id = $1 where id = $2;
    `, [orgBId, operatorB]);

    await db.query(`
      update public.profiles set role = 'lgu_admin', municipality = 'Tala' where id = $1;
    `, [lguAdminTala]);

    // 6. Test Operator A context
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${operatorA}';`);

    // Operator A reads own org
    const aOrgs = (await db.query('select name from public.organizations')).rows;
    assert.equal(aOrgs.length, 1);
    assert.equal(aOrgs[0].name, 'Tala Transport Coop');

    // Operator A adds a vehicle
    const vehicleRes = await db.query(`
      insert into public.vehicles (organization_id, body_number, mtop_number, unit_type, status)
      values ($1, 'T-042', 'MTOP-2026-001', 'tricycle', 'active')
      returning id, body_number;
    `, [orgAId]);
    assert.equal(vehicleRes.rows[0].body_number, 'T-042');
    const vehicleAId = vehicleRes.rows[0].id;

    // Operator A adds a driver assigned to vehicle
    const driverRes = await db.query(`
      insert into public.drivers (organization_id, vehicle_id, full_name, license_number, contact_number)
      values ($1, $2, 'Juan dela Cruz', 'N01-20-123456', '+639171234567')
      returning id, full_name;
    `, [orgAId, vehicleAId]);
    assert.equal(driverRes.rows[0].full_name, 'Juan dela Cruz');

    // Operator A cannot insert vehicle for Org B (should fail RLS)
    await assert.rejects(
      async () => {
        await db.query(`
          insert into public.vehicles (organization_id, body_number, unit_type)
          values ($1, 'B-999', 'tricycle');
        `, [orgBId]);
      },
      /new row violates row-level security policy/
    );

    // 7. Test Operator B context
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${operatorB}';`);

    // Operator B should see 0 vehicles (cannot see Org A's vehicle)
    const bVehicles = (await db.query('select * from public.vehicles')).rows;
    assert.equal(bVehicles.length, 0);

    // Operator B cannot see Org A's driver
    const bDrivers = (await db.query('select * from public.drivers')).rows;
    assert.equal(bDrivers.length, 0);

    // Operator B inserts own vehicle
    await db.query(`
      insert into public.vehicles (organization_id, body_number, unit_type)
      values ($1, 'ANT-101', 'pedicab');
    `, [orgBId]);

    // 8. Test LGU Admin for 'Tala'
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${lguAdminTala}';`);

    // Tala Admin sees Org A (in Tala), but not Org B (in Antipolo)
    const lguOrgs = (await db.query('select name, municipality from public.organizations')).rows;
    assert.equal(lguOrgs.length, 1);
    assert.equal(lguOrgs[0].municipality, 'Tala');

    // Tala Admin sees vehicles in Tala only (T-042), not ANT-101
    const lguVehicles = (await db.query('select body_number from public.vehicles')).rows;
    assert.equal(lguVehicles.length, 1);
    assert.equal(lguVehicles[0].body_number, 'T-042');

    // Tala Admin sees drivers in Tala only
    const lguDrivers = (await db.query('select full_name from public.drivers')).rows;
    assert.equal(lguDrivers.length, 1);
    assert.equal(lguDrivers[0].full_name, 'Juan dela Cruz');

    // 9. Test Passenger context
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${passenger}';`);

    // Passenger cannot see any organizations, vehicles, or drivers
    const passOrgs = (await db.query('select * from public.organizations')).rows;
    assert.equal(passOrgs.length, 0);

    const passVehicles = (await db.query('select * from public.vehicles')).rows;
    assert.equal(passVehicles.length, 0);

    const passDrivers = (await db.query('select * from public.drivers')).rows;
    assert.equal(passDrivers.length, 0);

  } finally {
    await db.close();
  }
});
