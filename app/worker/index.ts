import {
  ApiError,
  bookingInput,
  hmac,
  requestSecrets,
  sha256,
  tokenPattern,
  uuid,
} from './booking.ts';
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SL_ENVIRONMENT: string;
  SL_APP_ORIGIN: string;
  SL_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  SL_TOKEN_SECRET: string;
  SL_RATE_SECRET: string;
  SL_BOOKINGS_ENABLED: string;
  SL_MEDIA_ENABLED?: string;
  MEDIA?: R2Bucket;
  IMAGES?: ImagesBinding;
}
export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type Rpc = (name: string, args: Record<string, unknown>, token?: string) => Promise<any>;
const security = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
export function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...security, 'Content-Type': 'application/json' },
  });
}
export async function readJson(request: Request, limit = 220000) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError(415, 'Use JSON for this request.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, 'Request is too large.');
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  try {
    const p = JSON.parse(new TextDecoder().decode(all));
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error();
    return p as Record<string, any>;
  } catch {
    throw new ApiError(400, 'Invalid JSON object.');
  }
}
export function configured(env: Env) {
  if (
    env.SL_ENVIRONMENT !== 'staging' ||
    !env.SL_APP_ORIGIN ||
    !env.SL_PROJECT_REF ||
    !/^[a-z0-9]{20}$/.test(env.SL_PROJECT_REF) ||
    env.SUPABASE_URL !== `https://${env.SL_PROJECT_REF}.supabase.co` ||
    !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
    !env.SUPABASE_SECRET_KEY ||
    !env.SL_TOKEN_SECRET ||
    env.SL_TOKEN_SECRET.length < 32 ||
    !env.SL_RATE_SECRET ||
    env.SL_RATE_SECRET.length < 32
  )
    throw new ApiError(503, 'Service Link staging is not configured.');
}
export function database(env: Env, fetcher: Fetcher): Rpc {
  return async (name, args, token) => {
    const result = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: token ? env.SUPABASE_PUBLISHABLE_KEY : env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${token ?? env.SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) {
      const error = (await result.json().catch(() => ({}))) as { message?: string; code?: string };
      const message = error.message ?? '';
      if (/changed in another tab|Request key already used/.test(message))
        throw new ApiError(
          409,
          'Bookings changed or this request was already used. Refresh before trying again.',
        );
      if (error.code === '23P01' || /Time unavailable|conflicting key/.test(message))
        throw new ApiError(409, 'This time is already reserved. Choose another time.');
      const safe = [
        'Outside working hours or notice.',
        'Outside service coverage.',
        'Booking mode changed.',
        'Session duration changed.',
        'Invalid availability or payment settings.',
        'Media quota reached.',
        'Invalid acceptance or payment deadline.',
        'Payment instructions are required.',
        'Booking is not in an active payment window.',
        'Reservation is no longer active.',
        'No active payment window. Contact the provider if already paid.',
        'Contact the provider to cancel this booking.',
        'Only pending requests can be declined.',
        'Booking is already closed.',
        'Complete a confirmed booking after it ends.',
        'Booking requests are not enabled.',
      ];
      if (safe.includes(message)) throw new ApiError(400, message);
      throw new ApiError(
        result.status >= 500 ? 503 : 400,
        'Unable to complete this request. Refresh and try again.',
      );
    }
    return result.status === 204 ? null : result.json();
  };
}
export async function authenticate(request: Request, env: Env, fetcher: Fetcher) {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ') || value.length > 10000)
    throw new ApiError(401, 'Sign in required.');
  const token = value.slice(7);
  const result = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!result.ok) throw new ApiError(401, 'Sign in again to continue.');
  const user = (await result.json()) as { id?: string; is_anonymous?: boolean };
  if (!user.id || !uuid.test(user.id) || user.is_anonymous)
    throw new ApiError(401, 'A provider account is required.');
  return { id: user.id, token };
}
async function limit(
  request: Request,
  env: Env,
  rpc: Rpc,
  bucket: string,
  count: number,
  seconds: number,
) {
  // Cloudflare overwrites this header at the edge; never accept a body-supplied IP/hash.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const allowed = await rpc('sl_api_limit', {
    p_key: await hmac(env.SL_RATE_SECRET, `${bucket}:${ip}`),
    p_limit: count,
    p_seconds: seconds,
  });
  if (!allowed) throw new ApiError(429, 'Too many requests. Please wait and try again.');
}
export async function handle(
  request: Request,
  env: Env,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Referrer-Policy', 'no-referrer');
    if (url.pathname.startsWith('/booking/')) {
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    return new Response(response.body, { status: response.status, headers });
  }
  try {
    if (url.search || url.hash)
      throw new ApiError(400, 'API credentials belong in the request body, not the URL.');
    if (url.pathname === '/api/health' && request.method === 'GET')
      return reply({
        environment: env.SL_ENVIRONMENT ?? 'unconfigured',
        bookings: env.SL_BOOKINGS_ENABLED === 'true',
        media: env.SL_MEDIA_ENABLED === 'true',
      });
    configured(env);
    if (
      new URL(env.SL_APP_ORIGIN).origin !== url.origin ||
      (request.headers.get('origin') && request.headers.get('origin') !== env.SL_APP_ORIGIN)
    )
      throw new ApiError(403, 'This origin is not allowed.');
    const rpc = database(env, fetcher);
    if (url.pathname.startsWith('/api/media/')) {
      const { media } = await import('./media.ts');
      return await media(request, env, rpc, () => authenticate(request, env, fetcher));
    }
    if (env.SL_BOOKINGS_ENABLED !== 'true')
      throw new ApiError(503, 'Booking requests are not enabled yet.');
    if (url.pathname === '/api/booking/workspace' && request.method === 'GET') {
      const user = await authenticate(request, env, fetcher);
      return reply(await rpc('sl_booking_workspace', {}, user.token));
    }
    if (request.method !== 'POST') throw new ApiError(405, 'This endpoint requires POST.');
    const body = await readJson(request, url.pathname === '/api/booking/owner' ? 24000 : 10000);
    if (url.pathname === '/api/booking/owner') {
      const user = await authenticate(request, env, fetcher);
      if (
        !['settings', 'block', 'removeBlock', 'manual', 'action'].includes(body.action) ||
        !Number.isInteger(body.revision) ||
        body.revision < 0 ||
        !body.payload ||
        typeof body.payload !== 'object' ||
        Array.isArray(body.payload)
      )
        throw new ApiError(400, 'Invalid owner update.');
      let payload = body.payload;
      if (body.action === 'manual') {
        const input = bookingInput(payload.input);
        const secrets = await requestSecrets(input, payload.proof, env.SL_TOKEN_SECRET);
        payload = {
          input,
          tokenHash: secrets.tokenHash,
          fingerprint: secrets.fingerprint,
          accept: payload.accept,
        };
      }
      if (
        body.action === 'action' &&
        (!uuid.test(payload.id) ||
          !['accept', 'decline', 'verify', 'cancel', 'complete'].includes(payload.action))
      )
        throw new ApiError(400, 'Invalid booking action.');
      return reply(
        await rpc(
          'sl_booking_write',
          { p_action: body.action, p_payload: payload, p_revision: body.revision },
          user.token,
        ),
      );
    }
    if (url.pathname === '/api/booking/availability') {
      await limit(request, env, rpc, 'availability', 120, 60);
      if (typeof body.slug !== 'string' || !/^[a-z0-9-]{3,60}$/.test(body.slug))
        throw new ApiError(400, 'Invalid provider link.');
      const data = await rpc('sl_booking_availability', { p_slug: body.slug });
      if (!data) throw new ApiError(404, 'Provider unavailable.');
      return reply(data);
    }
    if (url.pathname === '/api/booking/request') {
      await limit(request, env, rpc, 'request', 20, 3600);
      const input = bookingInput(body.input);
      const secrets = await requestSecrets(input, body.proof, env.SL_TOKEN_SECRET);
      const id = await rpc('sl_booking_create_request', {
        p_input: input,
        p_token_hash: secrets.tokenHash,
        p_fingerprint: secrets.fingerprint,
      });
      const record = await rpc('sl_booking_customer_read', {
        p_id: id,
        p_token_hash: secrets.tokenHash,
      });
      return reply({ ...record, accessToken: secrets.accessToken }, 201);
    }
    if (url.pathname === '/api/booking/read' || url.pathname === '/api/booking/customer') {
      await limit(request, env, rpc, 'customer', 100, 60);
      if (
        typeof body.id !== 'string' ||
        !uuid.test(body.id) ||
        typeof body.token !== 'string' ||
        !tokenPattern.test(body.token)
      )
        throw new ApiError(404, 'Booking unavailable.');
      const args = { p_id: body.id, p_token_hash: await sha256(body.token) };
      if (url.pathname.endsWith('/customer')) {
        if (!['claim', 'cancel'].includes(body.action))
          throw new ApiError(400, 'Invalid customer action.');
        await rpc('sl_booking_customer_action', { ...args, p_action: body.action });
      }
      const record = await rpc('sl_booking_customer_read', args);
      if (!record) throw new ApiError(404, 'Booking unavailable.');
      return reply({ ...record, accessToken: body.token });
    }
    throw new ApiError(404, 'Endpoint unavailable.');
  } catch (e) {
    return reply(
      { error: e instanceof ApiError ? e.message : 'Service Link is temporarily unavailable.' },
      e instanceof ApiError ? e.status : 503,
    );
  }
}
// The runtime passes ExecutionContext as argument three, not the test fetch transport.
export default {
  fetch(request: Request, env: Env, _context: ExecutionContext) {
    return handle(request, env);
  },
};
