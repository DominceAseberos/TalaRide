const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const vm = require('node:vm');
const ts = require('typescript');

const readRepoFile = (file) =>
  readFileSync(existsSync(file) ? file : path.resolve(__dirname, '../../../', file), 'utf8');

test('profile migration runs in PostgreSQL and enforces per-user RLS and restricted writes', async () => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  try {
    // Supabase's auth schema and roles, reduced to what this migration consumes.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users(id) values ('${a}');
    `);
    await db.exec(readRepoFile('supabase/migrations/202609180001_profiles.sql'));
    // Backfill and trigger both work; never trust a metadata-provided account ID.
    await db.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [
      b,
      JSON.stringify({ display_name: ' Passenger B ', id: a }),
    ]);
    assert.equal(
      (await db.query('select count(*)::int as count from public.profiles')).rows[0].count,
      2,
    );
    assert.equal(
      (await db.query('select display_name from public.profiles where id=$1', [b])).rows[0]
        .display_name,
      'Passenger B',
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${a}';`);
    const rows = (await db.query('select id from public.profiles')).rows;
    assert.deepEqual(rows, [{ id: a }]);
    assert.equal(
      (await db.query('select id from public.profiles where id=$1', [b])).rows.length,
      0,
    );
    await db.query('update public.profiles set display_name=$1 where id=$2', ['Passenger A', a]);
    assert.equal(
      (await db.query('select display_name from public.profiles')).rows[0].display_name,
      'Passenger A',
    );
    assert.equal(
      (
        await db.query('update public.profiles set display_name=$1 where id=$2 returning id', [
          'Wrong user',
          b,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query('update public.profiles set id=$1 where id=$2', [b, a]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('update public.profiles set created_at=now() where id=$1', [a]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('insert into public.profiles(id) values($1)', [a]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('delete from public.profiles where id=$1', [a]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.profiles set display_name='' where id=$1", [a]),
      /check constraint/,
    );
    await assert.rejects(db.exec('select public.handle_new_user()'), /permission denied/);
    await db.exec(`set request.jwt.claim.sub = '${b}';`);
    assert.deepEqual((await db.query('select id from public.profiles')).rows, [{ id: b }]);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.exec('select * from public.profiles'), /permission denied/);
    await db.exec('reset role;');
    await db.query('delete from auth.users where id=$1', [a]);
    assert.equal(
      (await db.query('select id from public.profiles where id=$1', [a])).rows.length,
      0,
    );
    const tables = (await db.query("select tablename from pg_tables where schemaname='public'"))
      .rows;
    assert.deepEqual(tables, [{ tablename: 'profiles' }]);
  } finally {
    await db.close();
  }
});

test('Edge profile handler validates Auth server-side, scopes RLS queries and rejects unsafe input', async () => {
  let handler;
  let authenticated = false;
  let deletedUser = null;
  const calls = [];
  const query = {
    select(value) {
      calls.push(['select', value]);
      return this;
    },
    update(value) {
      calls.push(['update', value]);
      return this;
    },
    eq(key, value) {
      calls.push(['eq', key, value]);
      return this;
    },
    single: async () => ({ data: { id: 'verified-user', display_name: 'Passenger' }, error: null }),
  };
  const source = ts.transpileModule(
    readRepoFile('supabase/functions/account-profile/index.ts'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports: {},
    Response,
    TextEncoder,
    TextDecoder,
    Deno: {
      env: {
        get: (key) =>
          key === 'SUPABASE_URL'
            ? 'https://example.test'
            : key === 'SUPABASE_SERVICE_ROLE_KEY'
              ? 'service-test-key'
              : 'public-test-key',
      },
      serve: (callback) => {
        handler = callback;
      },
    },
    require: (name) => {
      assert.equal(name, 'npm:@supabase/supabase-js@2.116.0');
      return {
        createClient: (_, key, options) => {
          if (key === 'service-test-key')
            return {
              auth: {
                admin: {
                  deleteUser: async (id) => {
                    deletedUser = id;
                    return { error: null };
                  },
                },
              },
            };
          assert.equal(key, 'public-test-key');
          assert.ok(options.global.headers.Authorization.startsWith('Bearer '));
          return {
            auth: {
              getUser: async (token) => {
                assert.equal(token, 'test-token');
                return {
                  data: { user: authenticated ? { id: 'verified-user' } : null },
                  error: authenticated ? null : new Error('Invalid JWT'),
                };
              },
            },
            from: (table) => {
              assert.equal(table, 'profiles');
              return query;
            },
          };
        },
      };
    },
  });
  const request = (method, body, headers = {}) =>
    new Request('https://example.test/functions/v1/account-profile', {
      method,
      headers: { Authorization: 'Bearer test-token', ...headers },
      ...(body === undefined ? {} : { body }),
    });
  assert.equal((await handler(new Request('https://example.test'))).status, 401);
  assert.equal((await handler(request('PUT'))).status, 405);
  assert.equal((await handler(request('GET'))).status, 401);
  assert.equal(calls.length, 0);
  authenticated = true;
  const response = await handler(request('GET'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(
    calls.find((call) => call[0] === 'eq'),
    ['eq', 'id', 'verified-user'],
  );
  for (const body of [
    'invalid-json',
    '{}',
    '{"display_name":""}',
    '{"display_name":"Passenger","id":"someone-else"}',
  ])
    assert.equal((await handler(request('PATCH', body))).status, 400);
  assert.equal((await handler(request('PATCH', 'x'.repeat(2049)))).status, 413);
  assert.equal((await handler(request('PATCH', '{}', { 'Content-Length': '2049' }))).status, 413);
  assert.equal((await handler(request('PATCH', '{"display_name":" Updated "}'))).status, 200);
  assert.equal(calls.find((call) => call[0] === 'update')[1].display_name, 'Updated');
  assert.equal((await handler(request('DELETE'))).status, 204);
  assert.equal(deletedUser, 'verified-user');
});
