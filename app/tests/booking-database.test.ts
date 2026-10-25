import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { demoProfile } from '../src/data/demo.ts';
import { publicSnapshot } from '../src/lib/profile.ts';
test('booking SQL: private records, owner checks, server-only guest access, capacity constraints and payment transitions', async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  const owner = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
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
    await db.exec(
      await readFile(
        new URL(
          '../../supabase/migrations/20261025085204_sl_booking_foundation.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    const p = publicSnapshot(demoProfile());
    await db.query('insert into sl_public_profiles(user_id,slug,profile) values($1,$2,$3)', [
      owner,
      p.slug,
      JSON.stringify(p),
    ]);
    const weekly = Array.from({ length: 7 }, (_, day) => ({
      day,
      enabled: true,
      start: '07:00',
      end: '23:00',
    }));
    const payment = {
      bankName: 'Demo Bank',
      accountName: 'Fictional test',
      accountNumber: 'DEMO ONLY',
    };
    await db.query(
      'insert into sl_booking_settings(user_id,enabled,weekly,payment_details) values($1,true,$2,$3),($4,true,$2,$3)',
      [owner, JSON.stringify(weekly), JSON.stringify(payment), other],
    );
    const start = new Date(Date.now() + 3 * 86400000);
    start.setUTCHours(1, 0, 0, 0);
    const end = new Date(+start + 2 * 3600000),
      deadline = new Date(Date.now() + 3600000);
    const base = {
      slug: 'aina-demo',
      serviceId: 'demo-care',
      mode: 'appointment',
      start: start.toISOString(),
      end: end.toISOString(),
      stateId: 'my-07',
      subdivisionId: 'my-07-04',
      customerName: 'Fictional customer',
      customerPhone: '60120000000',
      customerEmail: '',
      note: 'Demo only',
      consent: true,
    };
    async function role(name: string, user = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec(`set role ${name}`);
    }
    const request = async (id: string, overrides = {}) => {
      const r = await db.query<{ id: string }>('select sl_booking_create_request($1,$2,$3) as id', [
        JSON.stringify({ ...base, requestId: id, ...overrides }),
        'a'.repeat(64),
        'b'.repeat(64),
      ]);
      return r.rows[0].id;
    };
    await role('anon');
    await assert.rejects(db.query('select * from sl_bookings'), /permission denied/);
    await assert.rejects(request(crypto.randomUUID()), /permission denied/);
    await assert.rejects(db.query('select * from sl_booking_settings'), /permission denied/);
    await role('service_role');
    const key = crypto.randomUUID(),
      a = await request(key);
    assert.equal(await request(key), a);
    const b = await request(crypto.randomUUID());
    await assert.rejects(request(crypto.randomUUID(), { subdivisionId: 'my-01-01' }), /coverage/);
    await assert.rejects(
      db.query('update sl_bookings set payment_status=$1', ['provider_verified']),
      /permission denied/,
    );
    await role('authenticated', other);
    assert.equal((await db.query('select * from sl_bookings')).rows.length, 0);
    await assert.rejects(
      db.query('select sl_booking_owner_action($1,$2,$3,$4)', [
        a,
        'accept',
        5000,
        deadline.toISOString(),
      ]),
      /unavailable/,
    );
    await assert.rejects(
      db.query('update sl_bookings set status=$1', ['confirmed']),
      /permission denied/,
    );
    await role('authenticated', owner);
    assert.equal((await db.query('select * from sl_bookings')).rows.length, 2);
    await db.query('select sl_booking_owner_action($1,$2,$3,$4)', [
      a,
      'accept',
      5000,
      deadline.toISOString(),
    ]);
    await assert.rejects(
      db.query('select sl_booking_owner_action($1,$2,$3,$4)', [
        b,
        'accept',
        5000,
        deadline.toISOString(),
      ]),
      /exclusion constraint/,
    );
    await assert.rejects(
      db.query('select sl_booking_time_block($1,$2,$3)', [
        start.toISOString(),
        end.toISOString(),
        'Private note',
      ]),
      /exclusion constraint/,
    );
    await role('service_role');
    const before = await db.query<{ data: { paymentStatus: string } }>(
      'select sl_booking_customer_read($1,$2) as data',
      [a, 'a'.repeat(64)],
    );
    assert.equal(before.rows[0].data.paymentStatus, 'unpaid');
    await db.query('select sl_booking_customer_action($1,$2,$3)', [a, 'a'.repeat(64), 'claim']);
    await assert.rejects(
      db.query('select sl_booking_customer_action($1,$2,$3)', [a, 'c'.repeat(64), 'claim']),
      /unavailable/,
    );
    const reported = await db.query<{ data: { paymentStatus: string; status: string } }>(
      'select sl_booking_customer_read($1,$2) as data',
      [a, 'a'.repeat(64)],
    );
    assert.equal(reported.rows[0].data.paymentStatus, 'claimed');
    assert.equal(reported.rows[0].data.status, 'accepted');
    assert.equal(JSON.stringify(reported.rows).includes('customer_token_hash'), false);
    await role('authenticated', owner);
    await db.query('select sl_booking_owner_action($1,$2)', [a, 'verify']);
    const verified = await db.query<{ status: string; payment_status: string }>(
      'select status,payment_status from sl_bookings where id=$1',
      [a],
    );
    assert.equal(verified.rows[0].status, 'confirmed');
    assert.equal(verified.rows[0].payment_status, 'provider_verified');
    await db.query('select sl_booking_owner_action($1,$2)', [a, 'cancel']);
    assert.equal(
      (
        await db.query<{ refund_follow_up: boolean }>(
          'select refund_follow_up from sl_bookings where id=$1',
          [a],
        )
      ).rows[0].refund_follow_up,
      true,
    );
    await db.query('select sl_booking_owner_action($1,$2,$3,$4)', [
      b,
      'accept',
      5000,
      deadline.toISOString(),
    ]);
    await role('postgres');
    await db.query(
      "update sl_bookings set payment_deadline=now()-interval '1 minute' where id=$1",
      [b],
    );
    await db.query(
      "update sl_private.capacity set expires_at=now()-interval '1 minute' where booking_id=$1",
      [b],
    );
    await role('authenticated', owner);
    await assert.rejects(
      db.query('select sl_booking_owner_action($1,$2)', [b, 'verify']),
      /payment window/,
    );
    const freeStart = new Date(+end + 3600000),
      freeEnd = new Date(+freeStart + 3600000);
    const block = await db.query<{ id: string }>('select sl_booking_time_block($1,$2,$3) as id', [
      freeStart.toISOString(),
      freeEnd.toISOString(),
      'Private test block',
    ]);
    await role('authenticated', other);
    await assert.rejects(
      db.query('select sl_booking_time_block(null,null,$1,$2)', ['', block.rows[0].id]),
      /unavailable/,
    );
  } finally {
    await db.close();
  }
});
