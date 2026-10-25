import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoProfile } from '../src/data/demo.ts';
import { publicSnapshot } from '../src/lib/profile.ts';
import { geography } from '../src/lib/geography.ts';
test('SQL foundation: ownership, private drafts, atomic publication, stale writes and unpublish', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
    );
    const migration = await readFile(
      new URL(
        '../../supabase/migrations/20261025081126_sl_provider_foundation.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await db.exec(migration);
    await db.exec(
      await readFile(
        new URL('../../supabase/migrations/20261025095911_sl_profile_banner.sql', import.meta.url),
        'utf8',
      ),
    );
    const { rows: geo } = await db.query(
      'select id,name,subdivisions from sl_geography order by id',
    );
    assert.deepEqual(geo, geography);
    const a = '11111111-1111-4111-8111-111111111111',
      b = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users values ($1),($2)', [a, b]);
    async function role(name: string, user = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec(`set role ${name}`);
    }
    async function write(p: unknown, s: unknown, rev: number, action: string) {
      await db.query('select sl_write_workspace($1::jsonb,$2::jsonb,$3,$4)', [
        p ? JSON.stringify(p) : null,
        s ? JSON.stringify(s) : null,
        rev,
        action,
      ]);
    }
    await role('authenticated', a);
    const p = demoProfile();
    const { banner, bannerPosition, ...legacy } = publicSnapshot(p);
    const valid = async (profile: unknown) =>
      (
        await db.query<{ valid: boolean }>('select sl_valid_profile($1::jsonb) as valid', [
          JSON.stringify(profile),
        ])
      ).rows[0].valid;
    assert.equal(await valid(legacy), true);
    const large = {
      ...publicSnapshot(p),
      photo: 'data:image/webp;base64,' + 'A'.repeat(160000),
      banner: 'data:image/webp;base64,' + 'B'.repeat(210000),
      bannerPosition: 0,
    };
    assert.equal(await valid(large), true);
    await db.query('insert into sl_workspaces(user_id,draft) values($1,$2)', [
      a,
      JSON.stringify(large),
    ]);
    await assert.rejects(
      db.query('update sl_workspaces set draft=$1', [
        JSON.stringify({ ...large, extra: 'x'.repeat(500000) }),
      ]),
      /check constraint/,
    );
    for (const bad of [
      { banner: 'https://example.invalid/secret.png' },
      { banner: null },
      { banner: 'data:image/webp;base64,' + 'A'.repeat(220000) },
      { bannerPosition: 101 },
      { bannerPosition: 0.5 },
      { bannerPosition: '50' },
      { privateBannerSource: 'private' },
    ])
      assert.equal(await valid({ ...publicSnapshot(p), ...bad }), false);
    await write(p, null, 0, 'save');
    const { rows: privateRows } = await db.query('select * from sl_workspaces');
    assert.equal(privateRows.length, 1);
    await role('anon');
    await assert.rejects(db.query('select draft from sl_workspaces'), /permission denied/);
    assert.equal((await db.query('select profile from sl_public_profiles')).rows.length, 0);
    await assert.rejects(write(p, publicSnapshot(p), 1, 'publish'), /permission denied/);
    await role('authenticated', b);
    await write(null, null, 0, 'unpublish');
    assert.equal((await db.query('select * from sl_workspaces')).rows.length, 0);
    await assert.rejects(
      db.query('insert into sl_workspaces(user_id,draft) values($1,$2)', [a, '{}']),
      /row-level security/,
    );
    await role('authenticated', a);
    await write(p, publicSnapshot(p), 1, 'publish');
    p.name = 'DRAFT ONLY';
    await write(p, null, 2, 'save');
    await role('anon');
    const { rows: visible } = await db.query<{ profile: { name: string } }>(
      'select profile from sl_public_profiles',
    );
    assert.notEqual(visible[0].profile.name, 'DRAFT ONLY');
    await assert.rejects(db.query('select user_id from sl_public_profiles'), /permission denied/);
    await role('authenticated', b);
    const { rows: updates } = await db.query(
      'update sl_public_profiles set slug=$1 where user_id=$2 returning slug',
      ['hijack', a],
    );
    assert.equal(updates.length, 0);
    await assert.rejects(
      write({ ...demoProfile(), slug: 'aina-demo' }, publicSnapshot(demoProfile()), 0, 'publish'),
      /unique/,
    );
    assert.equal((await db.query('select * from sl_workspaces')).rows.length, 0); // entire conflicting publish rolled back
    await role('authenticated', a);
    await assert.rejects(write(p, null, 1, 'save'), /another tab/);
    const bad = { ...publicSnapshot(p), privateEmail: 'should-not-leak' };
    await assert.rejects(write(p, bad, 3, 'publish'), /required public profile/);
    await assert.rejects(
      write({ ...p, banner: 'data:image/webp;base64,AAAA' }, publicSnapshot(p), 3, 'publish'),
      /match your draft/,
    );
    const badCoverage = {
      ...publicSnapshot(p),
      coverage: [{ stateId: 'my-07', wholeState: false, subdivisionIds: ['my-01-01'] }],
    };
    await assert.rejects(
      write({ ...p, coverage: badCoverage.coverage }, badCoverage, 3, 'publish'),
      /required public profile/,
    );
    p.slug = 'new-profile';
    await write(p, publicSnapshot(p), 3, 'publish');
    await role('anon');
    assert.equal(
      (await db.query("select profile from sl_public_profiles where slug='aina-demo'")).rows.length,
      0,
    );
    await role('authenticated', a);
    await write(null, null, 4, 'unpublish');
    assert.equal((await db.query('select draft from sl_workspaces')).rows.length, 1);
    await role('anon');
    assert.equal((await db.query('select profile from sl_public_profiles')).rows.length, 0);
  } finally {
    await db.close();
  }
});
