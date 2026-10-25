import type { ProfileRepository } from './types.ts';
import type { StorageLike } from './localRepository.ts';
import type {
  BookingRepository,
  BookingWorkspace,
  BookingInput,
  BookingRecord,
  BookingSettings,
  AcceptBooking,
} from './bookingTypes.ts';
import {
  defaultBookingSettings,
  settingsErrors,
  scheduleError,
  overlaps,
  reservesCapacity,
  effectiveStatus,
  rangeError,
  estimateCents,
} from './bookingRules.ts';
import { normalizeMalaysiaWhatsapp } from './whatsappNumber.ts';
import { matchesCoverage } from './geography.ts';
const localLocks = new WeakMap<StorageLike, Promise<unknown>>();
export const BOOKING_STORAGE_KEY = 'servicelink:bookings:v1';
export function createLocalBookingRepository(
  storage: StorageLike,
  profiles: ProfileRepository,
  clock = () => Date.now(),
): BookingRepository {
  const read = (): BookingWorkspace => {
    const raw = storage.getItem(BOOKING_STORAGE_KEY);
    if (!raw) return { settings: defaultBookingSettings(), blocks: [], bookings: [], revision: 0 };
    try {
      const w = JSON.parse(raw);
      if (
        !w.settings ||
        !Array.isArray(w.bookings) ||
        !Array.isArray(w.blocks) ||
        !Number.isInteger(w.revision)
      )
        throw new Error();
      return w;
    } catch {
      throw new Error('Saved booking data could not be read.');
    }
  };
  const load = async () => {
    const w = read();
    w.bookings = w.bookings.map((b) => ({ ...b, status: effectiveStatus(b, clock()) }));
    return w;
  };
  const transact = async <T>(
    fn: (w: BookingWorkspace) => Promise<T> | T,
    revision?: number,
  ): Promise<T> => {
    const run = async () => {
      const w = await load();
      if (revision !== undefined && w.revision !== revision)
        throw new Error('Bookings changed in another tab. Refresh before trying again.');
      const result = await fn(w);
      w.revision++;
      storage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(w));
      return structuredClone(result);
    };
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(BOOKING_STORAGE_KEY, run)
      : serial(run);
  };
  function serial<T>(run: () => Promise<T>) {
    const tail = localLocks.get(storage) ?? Promise.resolve();
    const next = tail.then(run, run);
    localLocks.set(
      storage,
      next.catch(() => {}),
    );
    return next;
  }
  const capacityError = (w: BookingWorkspace, start: string, end: string, exclude = '') => {
    if (w.blocks.some((b) => overlaps(start, end, b.start, b.end, w.settings.bufferMinutes, 0)))
      return 'This time is blocked by the provider.';
    if (
      w.bookings.some(
        (b) =>
          b.id !== exclude &&
          reservesCapacity(b, clock()) &&
          overlaps(start, end, b.start, b.end, w.settings.bufferMinutes, b.bufferMinutes ?? 0),
      )
    )
      return 'This slot is already reserved. Choose another time.';
    return null;
  };
  async function build(
    w: BookingWorkspace,
    input: BookingInput,
    source: 'customer' | 'provider',
  ): Promise<BookingRecord> {
    const listing = await profiles.getPublic(input.slug);
    if (!listing) throw new Error('This provider is not accepting new requests at this link.');
    const p = listing.profile;
    const service = p.services.find((s) => s.id === input.serviceId);
    if (!service) throw new Error('This service is no longer available.');
    if (!w.settings.enabled) throw new Error('Booking requests are not enabled yet.');
    const expected =
      w.settings.modes[service.id] ?? (p.category === 'confinement' ? 'date-range' : 'appointment');
    if (input.mode !== expected)
      throw new Error('This service’s booking mode changed. Refresh and try again.');
    const schedule = scheduleError(w.settings, input.start, input.end, input.mode, clock());
    if (schedule) throw new Error(schedule);
    if (
      input.mode === 'appointment' &&
      service.durationMinutes !== null &&
      Date.parse(input.end) - Date.parse(input.start) !== service.durationMinutes * 60000
    )
      throw new Error('Use the service’s published session duration.');
    if (!matchesCoverage(p.coverage, input.stateId, input.subdivisionId) || !input.subdivisionId)
      throw new Error('Choose a district within the provider’s coverage.');
    if (
      !input.customerName.trim() ||
      input.customerName.length > 80 ||
      !normalizeMalaysiaWhatsapp(input.customerPhone)
    )
      throw new Error('Enter the customer’s name and a valid Malaysian mobile number.');
    if (
      input.customerEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail) || input.customerEmail.length > 254)
    )
      throw new Error('Check the optional email address.');
    if (input.note.length > 600) throw new Error('Keep the request note under 600 characters.');
    if (!input.consent) throw new Error('Agree to share these details with the provider.');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId))
      throw new Error('Refresh this form and try again.');
    const conflict = capacityError(w, input.start, input.end);
    if (conflict) throw new Error(conflict);
    const now = new Date(clock()).toISOString(),
      id = crypto.randomUUID();
    return {
      id,
      requestId: input.requestId,
      requestFingerprint: fingerprint(input),
      reference: `SL-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      accessToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
      service: structuredClone(service),
      providerName: p.name,
      providerWhatsapp: p.showWhatsapp ? (normalizeMalaysiaWhatsapp(p.whatsapp) ?? '') : '',
      serviceId: service.id,
      mode: input.mode,
      start: input.start,
      end: input.end,
      stateId: input.stateId,
      subdivisionId: input.subdivisionId,
      customerName: input.customerName.trim(),
      customerPhone: normalizeMalaysiaWhatsapp(input.customerPhone)!,
      customerEmail: input.customerEmail.trim(),
      note: input.note.trim(),
      status: 'requested',
      paymentStatus: 'not_due',
      bufferMinutes: 0,
      amountDueCents: estimateCents(service, input.start, input.end),
      paymentDeadline: null,
      paymentDetails: null,
      createdAt: now,
      verifiedAt: null,
      refundFollowUp: false,
      source,
      events: [
        {
          at: now,
          action: source === 'customer' ? 'Request received' : 'Booking entered by provider',
        },
      ],
    };
  }
  function accept(w: BookingWorkspace, b: BookingRecord, a: AcceptBooking) {
    const schedule = scheduleError(w.settings, b.start, b.end, b.mode, clock());
    if (schedule) throw new Error(schedule);
    const conflict = capacityError(w, b.start, b.end, b.id);
    if (conflict) throw new Error(conflict);
    if (!Number.isInteger(a.amountDueCents) || a.amountDueCents < 0 || a.amountDueCents > 10000000)
      throw new Error('Enter a valid amount due.');
    if (
      !Number.isFinite(Date.parse(a.paymentDeadline)) ||
      Date.parse(a.paymentDeadline) <= clock() ||
      Date.parse(a.paymentDeadline) > Date.parse(b.start)
    )
      throw new Error(
        'The payment deadline must be in the future and no later than the booking start.',
      );
    const p = w.settings.payment;
    if (
      a.amountDueCents > 0 &&
      !(p.qrPhoto || (p.bankName.trim() && p.accountName.trim() && p.accountNumber.trim()))
    )
      throw new Error('Add bank details or a payment QR before accepting paid bookings.');
    b.status = a.amountDueCents === 0 ? 'confirmed' : 'accepted';
    b.paymentStatus = a.amountDueCents === 0 ? 'not_due' : 'unpaid';
    b.bufferMinutes = w.settings.bufferMinutes;
    b.amountDueCents = a.amountDueCents;
    b.paymentDeadline = a.amountDueCents === 0 ? null : a.paymentDeadline;
    b.paymentDetails = structuredClone(p);
  }
  const fingerprint = (i: BookingInput) =>
    JSON.stringify([
      i.slug,
      i.serviceId,
      i.mode,
      i.start,
      i.end,
      i.stateId,
      i.subdivisionId,
      i.customerName,
      i.customerPhone,
      i.customerEmail,
      i.note,
      i.consent,
    ]);
  return {
    load,
    saveSettings: (s: BookingSettings, r) =>
      transact((w) => {
        const e = settingsErrors(s);
        if (e.length) throw new Error(e.join(' '));
        w.settings = structuredClone(s);
        return w;
      }, r),
    addBlock: (block, r) =>
      transact((w) => {
        const e = rangeError(block.start, block.end, clock());
        if (e) throw new Error(e);
        if (block.note.length > 150) throw new Error('Keep the private block note short.');
        if (
          w.bookings.some(
            (b) =>
              reservesCapacity(b, clock()) &&
              overlaps(block.start, block.end, b.start, b.end, 0, b.bufferMinutes ?? 0),
          )
        )
          throw new Error(
            'A confirmed or accepted booking occupies this time. Cancel it first if needed.',
          );
        w.blocks.push({ ...block, id: crypto.randomUUID() });
        return w;
      }, r),
    removeBlock: (id, r) =>
      transact((w) => {
        w.blocks = w.blocks.filter((b) => b.id !== id);
        return w;
      }, r),
    availability: async (slug) => {
      if (!(await profiles.getPublic(slug))) throw new Error('Profile unavailable.');
      const w = await load();
      const { enabled, weekly, noticeMinutes, bufferMinutes, modes } = w.settings;
      return {
        settings: { enabled, weekly, noticeMinutes, bufferMinutes, modes },
        busy: [
          ...w.blocks.map((b) => ({ start: b.start, end: b.end, bufferMinutes: 0 })),
          ...w.bookings
            .filter((b) => reservesCapacity(b, clock()))
            .map((b) => ({ start: b.start, end: b.end, bufferMinutes: b.bufferMinutes ?? 0 })),
        ],
      };
    },
    request: (input) =>
      transact(async (w) => {
        const old = w.bookings.find((b) => b.requestId === input.requestId);
        if (old) {
          if (old.requestFingerprint !== fingerprint(input))
            throw new Error('This request key was already used. Refresh the form.');
          return old;
        }
        const b = await build(w, input, 'customer');
        w.bookings.push(b);
        return b;
      }),
    manual: (input, a, r) =>
      transact(async (w) => {
        const b = await build(w, input, 'provider');
        accept(w, b, a);
        b.events.push({ at: new Date(clock()).toISOString(), action: 'Accepted by provider' });
        w.bookings.push(b);
        return w;
      }, r),
    ownerAction: (id, action, r, a) =>
      transact((w) => {
        const b = w.bookings.find((x) => x.id === id);
        if (!b) throw new Error('Booking unavailable.');
        if (action === 'accept') {
          if (b.status !== 'requested' || !a)
            throw new Error('Only a pending request can be accepted.');
          accept(w, b, a);
        } else if (action === 'decline') {
          if (b.status !== 'requested') throw new Error('Only a pending request can be declined.');
          b.status = 'declined';
        } else if (action === 'verify') {
          if (b.status !== 'accepted' || b.amountDueCents === null)
            throw new Error('This booking cannot be verified. It may have expired.');
          const conflict = capacityError(w, b.start, b.end, b.id);
          if (conflict) throw new Error(conflict);
          b.status = 'confirmed';
          b.paymentStatus = 'provider_verified';
          b.verifiedAt = new Date(clock()).toISOString();
        } else if (action === 'cancel') {
          if (!['requested', 'accepted', 'confirmed'].includes(b.status))
            throw new Error('This booking is already closed.');
          b.refundFollowUp =
            b.paymentStatus === 'provider_verified' || b.paymentStatus === 'claimed';
          b.status = 'cancelled';
        } else {
          if (b.status !== 'confirmed' || Date.parse(b.end) > clock())
            throw new Error('Complete a confirmed booking after it ends.');
          b.status = 'completed';
        }
        b.events.push({
          at: new Date(clock()).toISOString(),
          action: {
            accept: 'Accepted by provider',
            decline: 'Declined by provider',
            verify: 'Provider verified money received',
            cancel: 'Cancelled by provider',
            complete: 'Marked completed',
          }[action],
        });
        return w;
      }, r),
    customerRead: async (id, token) => {
      if (!token || token.length !== 64) return null;
      const w = await load();
      return w.bookings.find((b) => b.id === id && b.accessToken === token) ?? null;
    },
    customerAction: (id, token, action) =>
      transact((w) => {
        const b = w.bookings.find((x) => x.id === id && x.accessToken === token);
        if (!b) throw new Error('Booking access link is invalid.');
        if (action === 'claim') {
          if (b.status !== 'accepted')
            throw new Error(
              'Payment reporting is only available during an active payment window. Contact the provider if you already paid.',
            );
          b.paymentStatus = 'claimed';
        } else {
          if (!['requested', 'accepted'].includes(b.status) || b.paymentStatus === 'claimed')
            throw new Error('Contact the provider to cancel this booking.');
          b.status = 'cancelled';
        }
        b.events.push({
          at: new Date(clock()).toISOString(),
          action:
            action === 'claim' ? 'Customer reported payment; not verified' : 'Customer cancelled',
        });
        return b;
      }),
  };
}
