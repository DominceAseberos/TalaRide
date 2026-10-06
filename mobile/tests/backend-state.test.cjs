const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('durable backend state denies client access and rejects stale concurrent writes', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
    await db.exec(readFileSync(path.resolve(__dirname, '../../supabase/migrations/202610060003_backend_state.sql'), 'utf8'));
    await db.exec(`set role service_role; insert into public.talaride_backend_state(id,state) values ('canonical','{"rides":[]}');`);
    const first = await db.query(`select public.talaride_commit_state(0,'{"rides":["saved"]}') as committed`);
    assert.equal(first.rows[0].committed, true);
    const stale = await db.query(`select public.talaride_commit_state(0,'{"rides":[]}') as committed`);
    assert.equal(stale.rows[0].committed, false);
    assert.deepEqual((await db.query('select state from public.talaride_backend_state')).rows[0].state, { rides: ['saved'] });
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role};`);
      await assert.rejects(db.query('select * from public.talaride_backend_state'), /permission denied/);
      await assert.rejects(db.query(`select public.talaride_commit_state(1,'{}')`), /permission denied/);
    }
  } finally { await db.close(); }
});
