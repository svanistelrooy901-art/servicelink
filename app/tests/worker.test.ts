import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handle, type Env } from '../worker/index.ts';
import { media } from '../worker/media.ts';
import { bookingInput, requestSecrets } from '../worker/booking.ts';
import { createHttpBookingRepository } from '../src/lib/httpBookingRepository.ts';
const owner = '11111111-1111-4111-8111-111111111111';
const env = {
  SL_ENVIRONMENT: 'staging',
  SL_APP_ORIGIN: 'https://sl.example.invalid',
  SL_PROJECT_REF: 'slfixtureabcdefghijk',
  SUPABASE_URL: 'https://slfixtureabcdefghijk.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_SECRET_KEY: 'sb_secret_fixture',
  SL_TOKEN_SECRET: 'test-only-'.repeat(8),
  SL_RATE_SECRET: 'rate-test-'.repeat(8),
  SL_BOOKINGS_ENABLED: 'true',
  SL_MEDIA_ENABLED: 'true',
  ASSETS: { fetch: async () => new Response('fixture') },
} as Env;
const req = (path: string, body: unknown) =>
  new Request(env.SL_APP_ORIGIN + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: env.SL_APP_ORIGIN },
    body: JSON.stringify(body),
  });
const access = async () => ({ id: owner, token: 'owner-test' });
test('HTTP guards reject foreign origins, oversized JSON, wrong methods and missing configuration', async () => {
  const noFetch = async () => {
    throw new Error('Unexpected upstream request');
  };
  assert.equal(
    (
      await handle(
        new Request(env.SL_APP_ORIGIN + '/api/booking/workspace'),
        { ...env, SL_PROJECT_REF: 'wrong' },
        noFetch,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await handle(
        new Request(env.SL_APP_ORIGIN + '/api/booking/workspace', {
          headers: { Origin: 'https://foreign.invalid' },
        }),
        env,
        noFetch,
      )
    ).status,
    403,
  );
  assert.equal(
    (await handle(req('/api/booking/request', { extra: 'x'.repeat(12000) }), env, noFetch)).status,
    413,
  );
  assert.equal(
    (await handle(new Request(env.SL_APP_ORIGIN + '/api/booking/request'), env, noFetch)).status,
    405,
  );
  const auth = await handle(
    new Request(env.SL_APP_ORIGIN + '/api/booking/workspace', {
      headers: { Authorization: 'Bearer invalid' },
    }),
    env,
    async () => new Response('{}', { status: 401 }),
  );
  assert.equal(auth.status, 401);
  assert.equal((await auth.text()).includes('sb_secret_fixture'), false);
  const privatePage = await handle(
    new Request(env.SL_APP_ORIGIN + '/booking/fixture'),
    env,
    noFetch,
  );
  assert.equal(privatePage.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(privatePage.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    (
      await handle(
        req('/api/booking/request', {}),
        { ...env, SL_TOKEN_SECRET: undefined } as unknown as Env,
        noFetch,
      )
    ).status,
    503,
  );
  assert.equal(
    (await handle(req('/api/media/upload', {}), { ...env, SL_MEDIA_ENABLED: 'false' }, noFetch))
      .status,
    503,
  );
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      String(url).endsWith('/auth/v1/user')
        ? Response.json({ id: owner })
        : Response.json({ revision: 1 });
    const runtimeResponse = await worker.fetch(
      new Request(env.SL_APP_ORIGIN + '/api/booking/workspace', {
        headers: { Authorization: 'Bearer owner-test' },
      }),
      env,
      {} as ExecutionContext,
    );
    assert.equal(
      runtimeResponse.status,
      200,
      'runtime ExecutionContext cannot replace upstream fetch',
    );
    assert.deepEqual(await runtimeResponse.json(), { revision: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('request issuance binds canonical input to an unguessable retry proof without trusting client hashes', async () => {
  const input = bookingInput({
    slug: 'fixture',
    serviceId: 'svc',
    mode: 'appointment',
    start: '2030-01-01T01:00:00.000Z',
    end: '2030-01-01T03:00:00.000Z',
    stateId: 'my-07',
    subdivisionId: 'my-07-04',
    customerName: ' Demo ',
    customerPhone: '0120000000',
    customerEmail: '',
    note: '',
    consent: true,
    requestId: crypto.randomUUID(),
  });
  assert.equal(input.customerName, 'Demo');
  assert.equal(input.customerPhone, '60120000000');
  const a = await requestSecrets(input, 'a'.repeat(64), env.SL_TOKEN_SECRET),
    b = await requestSecrets(input, 'a'.repeat(64), env.SL_TOKEN_SECRET),
    c = await requestSecrets(input, 'b'.repeat(64), env.SL_TOKEN_SECRET);
  assert.deepEqual(a, b);
  assert.notEqual(a.tokenHash, c.tokenHash);
  assert.notEqual(a.accessToken, a.tokenHash);
  await assert.rejects(requestSecrets(input, input.requestId, env.SL_TOKEN_SECRET));
  assert.throws(() => bookingInput({ ...input, customer_token_hash: 'injected' }));
  assert.throws(() => bookingInput({ ...input, consent: false }));
});
test('cloud client does not fall back to browser storage on missing identity or network failure', async () => {
  const denied = createHttpBookingRepository(
    async () => null,
    async () => {
      throw new Error('Unexpected call');
    },
  );
  await assert.rejects(denied.load(), /Sign in/);
  const down = createHttpBookingRepository(
    async () => 'fixture',
    async () => {
      throw new Error('offline');
    },
  );
  await assert.rejects(down.load(), /offline/);
  const missing = createHttpBookingRepository(
    async () => null,
    async () => Response.json({ error: 'Booking unavailable.' }, { status: 404 }),
  );
  assert.equal(await missing.customerRead(crypto.randomUUID(), 'a'.repeat(64)), null);
});
test('media transport validates content, re-encodes, stores R2 objects and cleans failed uploads', async () => {
  const bytes = Uint8Array.from(
    Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'),
  );
  const calls: { name: string; args: any }[] = [];
  const objects = new Map<string, Uint8Array>();
  let fail = false;
  const rpc = async (name: string, args: any) => {
    calls.push({ name, args });
    if (name === 'sl_api_limit') return true;
    if (name === 'sl_media_reserve') return `${owner}/${args.p_id}.webp`;
    return null;
  };
  const bindings = {
    ...env,
    MEDIA: {
      put: async (key: string, value: Uint8Array) => {
        if (fail) throw new Error('R2 down');
        objects.set(key, value);
      },
      delete: async (key: string) => {
        objects.delete(key);
      },
    },
    IMAGES: {
      info: async () => ({ width: 1, height: 1 }),
      input: () => ({
        transform: () => ({ output: async () => ({ response: () => new Response(bytes) }) }),
      }),
    },
  } as unknown as Env;
  const upload = (value: BodyInit, type = 'image/webp') =>
    new Request(env.SL_APP_ORIGIN + '/api/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': type, 'X-SL-Media-Kind': 'gallery' },
      body: value,
    });
  await assert.rejects(media(upload('<svg/>', 'image/svg+xml'), bindings, rpc, access), /WebP/);
  await assert.rejects(media(upload(new Uint8Array(90001)), bindings, rpc, access), /too large/);
  const saved = await media(upload(bytes), bindings, rpc, access);
  assert.equal(saved.status, 201);
  const result = (await saved.json()) as { ref: string };
  assert.match(result.ref, /^\/api\/media\/[a-f0-9-]+\.webp$/);
  assert.equal(result.ref.includes(owner), false);
  assert.equal(objects.size, 1);
  assert.ok(calls.some((c) => c.name === 'sl_media_finish' && c.args.p_state === 'ready'));
  fail = true;
  await assert.rejects(media(upload(bytes), bindings, rpc, access), /could not be saved/);
  assert.ok(calls.some((c) => c.name === 'sl_media_finish' && c.args.p_state === 'failed'));
});
test('media reads pass only verified owner identity or hashed booking proof to the database', async () => {
  const id = crypto.randomUUID(),
    ref = `/api/media/${id}.webp`;
  let last: any;
  const rpc = async (_name: string, args: any) => {
    last = args;
    return 'private/key.webp';
  };
  const bindings = {
    ...env,
    MEDIA: { get: async () => ({ body: new Response('fixture-image').body }) },
  } as unknown as Env;
  const guest = await media(
    req('/api/media/read', {
      ref,
      bookingId: crypto.randomUUID(),
      token: 'a'.repeat(64),
      owner_id: owner,
    }),
    bindings,
    rpc,
    access,
  );
  assert.equal(guest.headers.get('Cache-Control'), 'no-store');
  assert.equal(last.p_owner, null);
  assert.match(last.p_token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(last.p_token_hash, 'a'.repeat(64));
  await media(
    new Request(env.SL_APP_ORIGIN + ref, { headers: { Authorization: 'Bearer fixture' } }),
    bindings,
    rpc,
    access,
  );
  assert.equal(last.p_owner, owner);
  await assert.rejects(
    media(new Request(env.SL_APP_ORIGIN + '/api/media/not-a-file'), bindings, rpc, access),
    /unavailable/,
  );
});
