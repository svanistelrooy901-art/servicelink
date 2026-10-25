import { normalizeMalaysiaWhatsapp } from '../src/lib/whatsappNumber.ts';
import type { BookingInput } from '../src/lib/bookingTypes.ts';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const tokenPattern = /^[0-9a-f]{64}$/;
export function bookingInput(value: unknown): BookingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'Invalid booking request.');
  const v = value as Record<string, unknown>;
  const fields = [
    'slug',
    'serviceId',
    'mode',
    'start',
    'end',
    'stateId',
    'subdivisionId',
    'customerName',
    'customerPhone',
    'customerEmail',
    'note',
    'consent',
    'requestId',
  ];
  if (
    Object.keys(v).some((k) => !fields.includes(k)) ||
    fields.some((k) => !(k in v)) ||
    fields.filter((k) => k !== 'consent').some((k) => typeof v[k] !== 'string')
  )
    throw new ApiError(400, 'Invalid booking fields.');
  const p = { ...v } as unknown as BookingInput;
  const phone = normalizeMalaysiaWhatsapp(p.customerPhone);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) ||
    p.slug.length > 60 ||
    !p.serviceId ||
    p.serviceId.length > 80 ||
    !['appointment', 'date-range'].includes(p.mode) ||
    !uuid.test(p.requestId) ||
    p.consent !== true ||
    !p.customerName.trim() ||
    p.customerName.length > 80 ||
    !phone ||
    p.customerEmail.length > 254 ||
    (p.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.customerEmail)) ||
    p.note.length > 600 ||
    p.stateId.length > 30 ||
    p.subdivisionId.length > 30
  )
    throw new ApiError(400, 'Check the booking, contact details and consent.');
  const start = Date.parse(p.start),
    end = Date.parse(p.end);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 90 * 86400000
  )
    throw new ApiError(400, 'Choose a valid booking period.');
  return {
    slug: p.slug,
    serviceId: p.serviceId,
    mode: p.mode,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    stateId: p.stateId,
    subdivisionId: p.subdivisionId,
    customerName: p.customerName.trim(),
    customerPhone: phone,
    customerEmail: p.customerEmail.trim(),
    note: p.note.trim(),
    consent: true,
    requestId: p.requestId,
  };
}
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (value: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
export async function requestSecrets(input: BookingInput, proof: unknown, secret: string) {
  if (typeof proof !== 'string' || !tokenPattern.test(proof))
    throw new ApiError(400, 'A private request proof is required.');
  const fingerprint = await sha256(JSON.stringify(input));
  const accessToken = await hmac(secret, `servicelink:booking:v1:${input.requestId}:${proof}`);
  return { accessToken, tokenHash: await sha256(accessToken), fingerprint };
}
