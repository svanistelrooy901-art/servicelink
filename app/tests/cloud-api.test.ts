import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { handle, type Env } from '../worker/index.ts';
import { createHttpBookingRepository } from '../src/lib/httpBookingRepository.ts';
import {
  defaultBookingSettings,
  addDays,
  myDate,
  malaysiaInstant,
} from '../src/lib/bookingRules.ts';
import { demoProfile } from '../src/data/demo.ts';
import { publicSnapshot } from '../src/lib/profile.ts';
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const origin = 'https://servicelink-staging.example.invalid';
const env = {
  ASSETS: { fetch: async () => new Response('<html/>') },
  SL_ENVIRONMENT: 'staging',
  SL_APP_ORIGIN: origin,
  SL_PROJECT_REF: 'slfixtureabcdefghijk',
  SUPABASE_URL: 'https://slfixtureabcdefghijk.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_SECRET_KEY: 'sb_secret_fixture',
  SL_TOKEN_SECRET: 'test-only-token-secret-'.repeat(3),
  SL_RATE_SECRET: 'test-only-rate-secret-'.repeat(3),
  SL_BOOKINGS_ENABLED: 'true',
  SL_MEDIA_ENABLED: 'false',
} as Env;
test('staging HTTP APIs: two isolated clients, booking ownership/tokens, retries, capacity, expiry, media ownership and limits', async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  const upstream: string[] = [];
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
    );
    const root = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(root)).filter((f) => f.endsWith('.sql')).sort())
      try {
        await db.exec(await readFile(new URL(file, root), 'utf8'));
      } catch (e) {
        const err = e as { message: string; position?: string };
        throw new Error(`${file}: ${err.message} at ${err.position}`);
      }
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    const profile = publicSnapshot(demoProfile());
    profile.showWhatsapp = true;
    profile.whatsapp = '60120000000';
    await db.query('insert into sl_public_profiles(user_id,slug,profile) values($1,$2,$3)', [
      owner,
      profile.slug,
      JSON.stringify(profile),
    ]);
    const serial = { tail: Promise.resolve() as Promise<unknown> };
    async function fetcher(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = String(input),
        headers = new Headers(init?.headers);
      upstream.push(url);
      const bearer = headers.get('Authorization')?.slice(7);
      const who = bearer === 'owner-token' ? owner : bearer === 'other-token' ? other : null;
      if (url.endsWith('/auth/v1/user'))
        return who
          ? Response.json({ id: who, is_anonymous: false })
          : Response.json({ error: 'invalid' }, { status: 401 });
      assert.ok(url.startsWith(env.SUPABASE_URL + '/rest/v1/rpc/'));
      const name = url.split('/').pop()!;
      assert.ok(/^sl_[a-z_]+$/.test(name));
      const args = JSON.parse(String(init?.body));
      const names = Object.keys(args);
      assert.ok(names.every((k) => /^p_[a-z_]+$/.test(k)));
      const run = async () => {
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who ?? '']);
        await db.exec(`set role ${who ? 'authenticated' : 'service_role'}`);
        try {
          const sql = `select public.${name}(${names.map((k, i) => `${k} => $${i + 1}`).join(',')}) as value`;
          const result = await db.query(
            sql,
            Object.values(args).map((v) =>
              v !== null && typeof v === 'object' ? JSON.stringify(v) : v,
            ),
          );
          return Response.json(result.rows[0].value ?? null);
        } catch (e) {
          const err = e as { message: string; code?: string };
          return Response.json({ message: err.message, code: err.code }, { status: 400 });
        }
      };
      const result = serial.tail.then(run, run);
      serial.tail = result.catch(() => {});
      return result;
    }
    const transport = (token: string | null) => async (path: any, init?: RequestInit) =>
      handle(
        new Request(origin + String(path), {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init?.headers)),
            Origin: origin,
            'CF-Connecting-IP': token === 'other-token' ? '192.0.2.2' : '192.0.2.1',
          },
        }),
        env,
        fetcher,
      );
    const provider = createHttpBookingRepository(
      async () => 'owner-token',
      transport('owner-token'),
    );
    const customer = createHttpBookingRepository(async () => null, transport(null));
    const stranger = createHttpBookingRepository(
      async () => 'other-token',
      transport('other-token'),
    );
    let w = await provider.load();
    assert.equal(w.revision, 0);
    const settings = defaultBookingSettings();
    settings.enabled = true;
    settings.noticeMinutes = 0;
    settings.weekly = settings.weekly.map((d) => ({
      ...d,
      enabled: true,
      start: '00:00',
      end: '23:59',
    }));
    settings.payment = {
      bankName: 'Demo Bank',
      accountName: 'Fictional Test Only',
      accountNumber: 'DEMO-NOT-PAYABLE',
      instructions: 'Test only',
      qrPhoto: '',
    };
    w = await provider.saveSettings(settings, w.revision);
    assert.equal(w.revision, 1);
    await assert.rejects(provider.saveSettings(settings, 0), /changed/);
    const availability = await customer.availability(profile.slug);
    assert.equal(availability.settings.enabled, true);
    assert.equal('payment' in availability.settings, false);
    assert.equal(JSON.stringify(availability).includes('DEMO-NOT-PAYABLE'), false);
    const date = addDays(myDate(), 3);
    const input = {
      slug: profile.slug,
      serviceId: profile.services[0].id,
      mode: 'appointment' as const,
      start: malaysiaInstant(date, '09:00'),
      end: malaysiaInstant(date, '11:00'),
      stateId: 'my-07',
      subdivisionId: 'my-07-04',
      customerName: 'Fictional Guest',
      customerPhone: '0120000000',
      customerEmail: '',
      note: 'Demo only',
      consent: true,
      requestId: crypto.randomUUID(),
    };
    const booking = await customer.request(input);
    assert.equal(booking.status, 'requested');
    assert.equal(booking.amountDueCents, 5000);
    assert.match(booking.accessToken, /^[a-f0-9]{64}$/);
    assert.equal((await customer.request(input)).id, booking.id);
    await assert.rejects(
      createHttpBookingRepository(async () => null, transport(null)).request(input),
      /already used|changed/,
    );
    await assert.rejects(
      customer.request({ ...input, customerName: 'Modified' }),
      /already used|changed/,
    );
    assert.equal(await customer.customerRead(booking.id, 'f'.repeat(64)), null);
    assert.equal((await stranger.load()).bookings.length, 0);
    await assert.rejects(
      stranger.ownerAction(booking.id, 'accept', 0, {
        amountDueCents: 5000,
        paymentDeadline: new Date(Date.now() + 3600000).toISOString(),
      }),
    );
    w = await provider.load();
    assert.equal(w.bookings.length, 1);
    assert.equal(w.bookings[0].accessToken, '');
    assert.equal(JSON.stringify(w).includes('customer_token_hash'), false);
    const accept = {
      amountDueCents: 5000,
      paymentDeadline: new Date(Date.now() + 3600000).toISOString(),
    };
    w = await provider.ownerAction(booking.id, 'accept', w.revision, accept);
    const visible = await customer.customerRead(booking.id, booking.accessToken);
    assert.equal(visible?.paymentDetails?.accountNumber, 'DEMO-NOT-PAYABLE');
    assert.equal(visible?.providerWhatsapp, '60120000000');
    assert.equal((await customer.availability(profile.slug)).busy.length, 1);
    await assert.rejects(
      customer.request({ ...input, requestId: crypto.randomUUID() }),
      /reserved/,
    );
    const claimed = await customer.customerAction(booking.id, booking.accessToken, 'claim');
    assert.equal(claimed.paymentStatus, 'claimed');
    assert.equal(claimed.status, 'accepted');
    w = await provider.load();
    w = await provider.ownerAction(booking.id, 'verify', w.revision);
    assert.equal(w.bookings[0].status, 'confirmed');
    w = await provider.addBlock(
      {
        start: malaysiaInstant(date, '14:00'),
        end: malaysiaInstant(date, '15:00'),
        note: 'Private appointment',
      },
      w.revision,
    );
    const publicBusy = await customer.availability(profile.slug);
    assert.equal(publicBusy.busy.length, 2);
    assert.equal(JSON.stringify(publicBusy).includes('Private appointment'), false);
    w = await provider.removeBlock(w.blocks[0].id, w.revision);
    const later = {
      ...input,
      requestId: crypto.randomUUID(),
      start: malaysiaInstant(date, '14:00'),
      end: malaysiaInstant(date, '16:00'),
    };
    const late = await customer.request(later);
    w = await provider.load();
    w = await provider.ownerAction(late.id, 'accept', w.revision, accept);
    await db.exec('reset role');
    await db.query(
      "update sl_bookings set payment_deadline=now()-interval '1 second' where id=$1",
      [late.id],
    );
    // Simulate passage of the shared deadline for both the booking and its capacity hold.
    await db.query(
      "update sl_private.capacity set expires_at=now()-interval '1 second' where booking_id=$1",
      [late.id],
    );
    assert.equal((await customer.customerRead(late.id, late.accessToken))?.status, 'expired');
    await assert.rejects(
      customer.customerAction(late.id, late.accessToken, 'claim'),
      /active payment/,
    );
    w = await provider.load();
    assert.equal((await customer.availability(profile.slug)).busy.length, 1);
    const blockPath = new Request(origin + '/api/booking/read?token=secret', { method: 'POST' });
    assert.equal((await handle(blockPath, env, fetcher)).status, 400);
    assert.equal(
      (await handle(new Request(origin + '/api/booking/workspace'), env, fetcher)).status,
      401,
    );
    assert.equal(
      (
        await handle(
          new Request(origin + '/api/booking/request', {
            method: 'POST',
            headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' },
            body: '{}',
          }),
          env,
          fetcher,
        )
      ).status,
      403,
    );
    const disabled = { ...env, SL_BOOKINGS_ENABLED: 'false' };
    assert.equal(
      (await handle(new Request(origin + '/api/booking/workspace'), disabled, fetcher)).status,
      503,
    );
    // A client-side data URL cannot bypass the hosted registry, even through direct database access.
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('update sl_public_profiles set profile=$1 where user_id=$2', [
        JSON.stringify({ ...profile, photo: 'data:image/webp;base64,AAAA' }),
        owner,
      ]),
      /uploaded Service Link/,
    );
    await assert.rejects(
      db.query('select sl_booking_owner_action($1,$2,$3,$4)', [booking.id, 'cancel', null, null]),
      /permission denied/,
    );
    await db.exec('reset role');
    const asset = crypto.randomUUID(),
      foreign = crypto.randomUUID(),
      qr = crypto.randomUUID();
    await db.query('select sl_media_reserve($1,$2,$3,$4)', [asset, owner, 'portrait', 100]);
    await db.query('select sl_media_finish($1,$2,$3)', [asset, owner, 'ready']);
    await db.query('select sl_media_reserve($1,$2,$3,$4)', [foreign, other, 'portrait', 100]);
    await db.query('select sl_media_finish($1,$2,$3)', [foreign, other, 'ready']);
    const ref = `/api/media/${asset}.webp`;
    assert.equal((await db.query('select sl_media_access($1) as key', [asset])).rows[0].key, null);
    assert.equal(
      (await db.query('select sl_media_access($1,$2) as key', [asset, owner])).rows[0].key,
      `${owner}/${asset}.webp`,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('update sl_public_profiles set profile=$1 where user_id=$2', [
        JSON.stringify({ ...profile, photo: `/api/media/${foreign}.webp` }),
        owner,
      ]),
      /uploaded Service Link/,
    );
    await db.query('update sl_public_profiles set profile=$1 where user_id=$2', [
      JSON.stringify({ ...profile, photo: ref }),
      owner,
    ]);
    await db.exec('reset role');
    assert.equal(
      (await db.query('select sl_media_access($1) as key', [asset])).rows[0].key,
      `${owner}/${asset}.webp`,
    );
    await db.query('delete from sl_public_profiles where user_id=$1', [owner]);
    assert.equal((await db.query('select sl_media_access($1) as key', [asset])).rows[0].key, null);
    await db.query('select sl_media_reserve($1,$2,$3,$4)', [qr, owner, 'qr', 100]);
    await db.query('select sl_media_finish($1,$2,$3)', [qr, owner, 'ready']);
    const hash = (await import('../worker/booking.ts')).sha256;
    await db.query('update sl_bookings set payment_snapshot=$1 where id=$2', [
      JSON.stringify({ ...settings.payment, qrPhoto: `/api/media/${qr}.webp` }),
      booking.id,
    ]);
    assert.equal(
      (
        await db.query('select sl_media_access($1,null,$2,$3) as key', [
          qr,
          booking.id,
          await hash(booking.accessToken),
        ])
      ).rows[0].key,
      `${owner}/${qr}.webp`,
    );
    assert.equal(
      (
        await db.query('select sl_media_access($1,null,$2,$3) as key', [
          qr,
          booking.id,
          'a'.repeat(64),
        ])
      ).rows[0].key,
      null,
    );
    await db.query(
      "update sl_private.media_assets set created_at=now()-interval '8 days' where id=$1",
      [asset],
    );
    const gc = await db.query('select sl_media_gc($1) as removed', [owner]);
    assert.equal((gc.rows[0].removed as unknown[]).length, 1);
    assert.equal(
      (await db.query('select sl_api_limit($1,1,60) as allowed', ['c'.repeat(64)])).rows[0].allowed,
      true,
    );
    assert.equal(
      (await db.query('select sl_api_limit($1,1,60) as allowed', ['c'.repeat(64)])).rows[0].allowed,
      false,
    );
    assert.ok(upstream.every((u) => !u.includes(booking.accessToken)));
  } finally {
    await db.close();
  }
});
