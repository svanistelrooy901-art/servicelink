import { ApiError, hmac, sha256, tokenPattern, uuid } from './booking.ts';
import { readJson, reply, type Env, type Rpc } from './index.ts';
import { mediaRefPattern } from '../src/lib/mediaReference.ts';
export async function media(
  request: Request,
  env: Env,
  rpc: Rpc,
  owner: () => Promise<{ id: string; token: string }>,
): Promise<Response> {
  if (env.SL_MEDIA_ENABLED !== 'true' || !env.MEDIA)
    throw new ApiError(503, 'Image uploads are not enabled yet.');
  const path = new URL(request.url).pathname;
  if (path === '/api/media/upload' && request.method === 'POST') {
    const user = await owner();
    if (!env.IMAGES) throw new ApiError(503, 'Image processing is not configured.');
    const allowed = await rpc('sl_api_limit', {
      p_key: await hmac(env.SL_RATE_SECRET, `media:${user.id}`),
      p_limit: 20,
      p_seconds: 60,
    });
    if (!allowed) throw new ApiError(429, 'Please wait before uploading more pictures.');
    const kinds = {
      portrait: { max: 480, bytes: 135000 },
      qr: { max: 480, bytes: 135000 },
      banner: { max: 1600, bytes: 165000 },
      gallery: { max: 1200, bytes: 90000 },
    };
    const kind = request.headers.get('X-SL-Media-Kind') as keyof typeof kinds;
    const config = kinds[kind];
    if (!config || request.headers.get('content-type') !== 'image/webp')
      throw new ApiError(415, 'Upload a compressed WebP image.');
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError(400, 'Choose an image.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > config.bytes) {
          await reader.cancel();
          throw new ApiError(413, 'This image is too large.');
        }
        chunks.push(item.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    if (
      size < 12 ||
      new TextDecoder().decode(bytes.slice(0, 4)) !== 'RIFF' ||
      new TextDecoder().decode(bytes.slice(8, 12)) !== 'WEBP'
    )
      throw new ApiError(415, 'Choose a valid WebP image.');
    let output: Uint8Array;
    try {
      const info = await env.IMAGES.info(new Response(bytes).body!);
      if (!('width' in info) || !info.width || !info.height || info.width * info.height > 40000000)
        throw new Error();
      const transformed = await env.IMAGES.input(new Response(bytes).body!)
        .transform({ width: config.max, height: config.max, fit: 'scale-down' })
        .output({ format: 'image/webp', quality: 70, anim: false });
      output = new Uint8Array(await transformed.response().arrayBuffer());
    } catch {
      throw new ApiError(400, 'This image could not be prepared.');
    }
    if (output.length > config.bytes || output.length < 12)
      throw new ApiError(413, 'Choose a less detailed image.');
    const id = crypto.randomUUID();
    const key = await rpc('sl_media_reserve', {
      p_id: id,
      p_owner: user.id,
      p_kind: kind,
      p_bytes: output.length,
    });
    try {
      await env.MEDIA.put(key, output, { httpMetadata: { contentType: 'image/webp' } });
      await rpc('sl_media_finish', { p_id: id, p_owner: user.id, p_state: 'ready' });
    } catch {
      await env.MEDIA.delete(key).catch(() => {});
      await rpc('sl_media_finish', { p_id: id, p_owner: user.id, p_state: 'failed' }).catch(
        () => {},
      );
      throw new ApiError(503, 'The upload could not be saved. Try again.');
    }
    return reply({ ref: `/api/media/${id}.webp` }, 201);
  }
  if (path === '/api/media/cleanup' && request.method === 'POST') {
    const user = await owner();
    const assets = await rpc('sl_media_gc', { p_owner: user.id });
    for (const asset of assets) {
      await env.MEDIA.delete(asset.key);
      await rpc('sl_media_deleted', { p_id: asset.id, p_owner: user.id });
    }
    return reply({ removed: assets.length });
  }
  let ref = path,
    ownerId: string | null = null,
    bookingId: string | null = null,
    hash: string | null = null;
  if (path === '/api/media/read' && request.method === 'POST') {
    const body = await readJson(request, 2048);
    ref = body.ref;
    if (
      typeof body.bookingId !== 'string' ||
      !uuid.test(body.bookingId) ||
      typeof body.token !== 'string' ||
      !tokenPattern.test(body.token)
    )
      throw new ApiError(404, 'Image unavailable.');
    bookingId = body.bookingId;
    hash = await sha256(body.token);
  } else if (request.method === 'GET') {
    if (request.headers.has('Authorization')) ownerId = (await owner()).id;
  } else throw new ApiError(405, 'Unsupported image action.');
  if (typeof ref !== 'string' || !mediaRefPattern.test(ref))
    throw new ApiError(404, 'Image unavailable.');
  const id = ref.split('/').pop()!.slice(0, -5);
  const key = await rpc('sl_media_access', {
    p_id: id,
    p_owner: ownerId,
    p_booking: bookingId,
    p_token_hash: hash,
  });
  if (!key) throw new ApiError(404, 'Image unavailable.');
  const object = await env.MEDIA.get(key);
  if (!object) throw new ApiError(404, 'Image unavailable.');
  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
