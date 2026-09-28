const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const readRepoFile = (file) =>
  readFileSync(existsSync(file) ? file : path.resolve(__dirname, '../../../', file), 'utf8');
const { PGlite } = require('@electric-sql/pglite');

test('relay migration enforces ownership, expiration, response uniqueness and restricted writes', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const helper = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create schema extensions;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users(id) values ('${owner}'), ('${helper}');
    `);
    await db.exec(readRepoFile('supabase/migrations/202609200001_community_relay.sql'));
    await db.exec(readRepoFile('supabase/migrations/202609200002_notifications.sql'));
    await db.exec(readRepoFile('supabase/migrations/202609200003_security_retention.sql'));
    await db.exec(
      readRepoFile('supabase/migrations/202609220001_relay_response_consistency.sql'),
    );
    const digest = 'a'.repeat(64);
    const inserted = await db.query(
      `insert into public.lost_item_requests(owner_id, local_ride_id, vehicle_digest, item_description)
       values ($1, 'local-private-id', $2, 'Black bag') returning id, created_at, expires_at`,
      [owner, digest],
    );
    const request = inserted.rows[0];
    assert.equal(
      new Date(request.expires_at) - new Date(request.created_at),
      7 * 24 * 60 * 60 * 1000,
    );
    await assert.rejects(
      db.query(
        `insert into public.lost_item_requests(owner_id, local_ride_id, vehicle_digest, item_description) values ($1, 'local-private-id', $2, 'Duplicate')`,
        [owner, digest],
      ),
      /unique constraint/,
    );
    await db.query(`insert into public.relay_matches(request_id, helper_id) values ($1, $2)`, [
      request.id,
      helper,
    ]);
    await assert.rejects(
      db.query(`insert into public.relay_matches(request_id, helper_id) values ($1, $2)`, [
        request.id,
        helper,
      ]),
      /unique constraint/,
    );
    assert.equal(
      (
        await db.query(`select public.respond_to_relay_match($1, $2, 'dismissed') as request_id`, [
          (await db.query('select id from public.relay_matches where request_id=$1', [request.id]))
            .rows[0].id,
          helper,
        ])
      ).rows[0].request_id,
      request.id,
    );
    assert.equal(
      (
        await db.query(
          `select public.respond_to_relay_match((select id from public.relay_matches where request_id=$1), $2, 'offered') as request_id`,
          [request.id, helper],
        )
      ).rows[0].request_id,
      null,
    );
    const offeredRequest = (
      await db.query(
        `insert into public.lost_item_requests(owner_id, local_ride_id, vehicle_digest, item_description)
         values ($1, 'offered-ride', $2, 'Phone') returning id`,
        [owner, 'c'.repeat(64)],
      )
    ).rows[0];
    const offeredMatch = (
      await db.query(
        `insert into public.relay_matches(request_id, helper_id) values ($1, $2) returning id`,
        [offeredRequest.id, helper],
      )
    ).rows[0];
    assert.equal(
      (
        await db.query(`select public.respond_to_relay_match($1, $2, 'offered') as request_id`, [
          offeredMatch.id,
          helper,
        ])
      ).rows[0].request_id,
      offeredRequest.id,
    );
    assert.equal(
      (
        await db.query('select status from public.lost_item_requests where id=$1', [
          offeredRequest.id,
        ])
      ).rows[0].status,
      'helper_responding',
    );
    for (const [state, suffix] of [
      ['resolved', 'resolved'],
      ['expired', 'expired'],
    ]) {
      const closedRequest = (
        await db.query(
          `insert into public.lost_item_requests
             (owner_id, local_ride_id, vehicle_digest, item_description, status, resolved_at)
           values ($1, $2, $3, 'Keys', $4::public.lost_request_status,
                   case when $4::text = 'resolved' then now() else null end)
           returning id`,
          [owner, `${suffix}-ride`, (state === 'resolved' ? 'd' : 'e').repeat(64), state],
        )
      ).rows[0];
      const closedMatch = (
        await db.query(
          `insert into public.relay_matches(request_id, helper_id) values ($1, $2) returning id`,
          [closedRequest.id, helper],
        )
      ).rows[0];
      assert.equal(
        (
          await db.query(`select public.respond_to_relay_match($1, $2, 'offered') as request_id`, [
            closedMatch.id,
            helper,
          ])
        ).rows[0].request_id,
        null,
      );
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`);
    assert.equal((await db.query('select id from public.lost_item_requests')).rows.length, 4);
    await assert.rejects(
      db.query(`update public.lost_item_requests set status='resolved'`),
      /permission denied/,
    );
    await assert.rejects(db.query('select * from public.relay_matches'), /permission denied/);
    await db.exec(`set request.jwt.claim.sub = '${helper}';`);
    assert.equal((await db.query('select id from public.lost_item_requests')).rows.length, 0);
    await assert.rejects(
      db.query(
        `insert into public.lost_item_requests(owner_id, local_ride_id, vehicle_digest, item_description) values ($1, 'x', $2, 'Attack')`,
        [helper, digest],
      ),
      /permission denied/,
    );
    await db.exec('reset role;');
    await db.query(
      `update public.lost_item_requests set created_at=now() - interval '8 days', expires_at=now() - interval '1 day' where id=$1`,
      [request.id],
    );
    assert.equal(
      (await db.query('select public.expire_lost_item_requests() as count')).rows[0].count,
      1,
    );
    assert.equal(
      (await db.query('select status from public.lost_item_requests where id=$1', [request.id]))
        .rows[0].status,
      'expired',
    );
    assert.equal(
      (
        await db.query("select public.check_relay_rate_limit($1, 'scan', 1, 60) as allowed", [
          owner,
        ])
      ).rows[0].allowed,
      true,
    );
    assert.equal(
      (
        await db.query("select public.check_relay_rate_limit($1, 'scan', 1, 60) as allowed", [
          owner,
        ])
      ).rows[0].allowed,
      false,
    );
    const stale = await db.query(
      `insert into public.lost_item_requests
        (owner_id, local_ride_id, vehicle_digest, item_description, status, created_at, expires_at, resolved_at)
       values ($1, 'stale-local-id', $2, 'Old item', 'resolved', now() - interval '40 days',
               now() - interval '33 days', now() - interval '32 days') returning id`,
      [owner, 'b'.repeat(64)],
    );
    await db.query(
      `insert into public.push_tokens(user_id, token, platform, enabled, updated_at)
       values ($1, 'ExponentPushToken[stale-token]', 'android', false, now() - interval '31 days')`,
      [owner],
    );
    assert.equal(
      (await db.query('select public.purge_stale_relay_data() as count')).rows[0].count,
      1,
    );
    assert.equal(
      (await db.query('select id from public.lost_item_requests where id=$1', [stale.rows[0].id]))
        .rows.length,
      0,
    );
    assert.equal((await db.query('select token from public.push_tokens')).rows.length, 0);
  } finally {
    await db.close();
  }
});

test('relay Edge Function keeps matching server-side and encodes future-scan and abuse controls', () => {
  const source = readRepoFile('supabase/functions/community-relay/index.ts');
  assert.match(source, /crypto\.subtle\.sign\('HMAC'/);
  assert.match(source, /RELAY_MATCH_SECRET/);
  assert.match(source, /auth\.auth\.getUser\(\)/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /\.lt\('created_at', now\.toISOString\(\)\)/);
  assert.match(source, /\.gt\('expires_at', now\.toISOString\(\)\)/);
  assert.match(source, /\.neq\('owner_id', user\.id\)/);
  assert.match(source, /check_relay_rate_limit/);
  assert.match(source, /respond_to_relay_match/);
  assert.match(source, /purge_stale_relay_data/);
  assert.match(source, /onConflict: 'request_id,helper_id', ignoreDuplicates: true/);
  assert.doesNotMatch(source, /vehicle_number\s*:/);
});
