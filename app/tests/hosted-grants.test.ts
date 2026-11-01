import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('anonymous public-profile projection remains narrow under hosted default table grants', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL(
          '../../supabase/migrations/20261025081126_sl_provider_foundation.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    // Reproduce the table-level grant present in a newly provisioned hosted project.
    await db.exec('grant all on public.sl_public_profiles to anon');
    const privileges = async () =>
      (
        await db.query<{ owner: boolean; profile: boolean; writes: boolean }>(
          `select has_column_privilege('anon','public.sl_public_profiles','user_id','select') as owner, has_column_privilege('anon','public.sl_public_profiles','profile','select') as profile, has_table_privilege('anon','public.sl_public_profiles','insert') as writes`,
        )
      ).rows[0];
    assert.equal((await privileges()).owner, true);
    await db.exec(
      await readFile(
        new URL(
          '../../supabase/migrations/20261101074808_sl_explicit_public_profile_grants.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    assert.deepEqual(await privileges(), { owner: false, profile: true, writes: false });
    await db.exec('set role anon');
    assert.deepEqual(
      (await db.query('select slug,profile,published_at from public.sl_public_profiles')).rows,
      [],
    );
    await assert.rejects(
      db.query('select user_id from public.sl_public_profiles'),
      /permission denied/i,
    );
    await assert.rejects(db.query('select * from public.sl_workspaces'), /permission denied/i);
  } finally {
    await db.close();
  }
});
