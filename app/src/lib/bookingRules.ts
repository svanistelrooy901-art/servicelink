import type { BookingSettings, BookingRecord, BookingStatus, BookingMode } from './bookingTypes.ts';
import type { Service } from './types.ts';
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const MY_ZONE = 'Asia/Kuala_Lumpur';
export function myDate(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MY_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return myDate(d.getTime());
}
export function malaysiaInstant(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00+08:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isFinite(d.getTime()) ||
    myDate(d.getTime()) !== date
  )
    throw new Error('Choose a valid date and time.');
  return d.toISOString();
}
export function formatMY(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: MY_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function localInput(value: string) {
  return `${myDate(new Date(value).getTime())}T${new Intl.DateTimeFormat('en-GB', { timeZone: MY_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))}`;
}
export function defaultBookingSettings(): BookingSettings {
  return {
    enabled: false,
    weekly: DAY_NAMES.map((_, day) => ({ day, enabled: day !== 0, start: '09:00', end: '17:00' })),
    noticeMinutes: 60,
    bufferMinutes: 0,
    modes: {},
    payment: { bankName: '', accountName: '', accountNumber: '', instructions: '', qrPhoto: '' },
  };
}
export function settingsErrors(s: BookingSettings): string[] {
  const e: string[] = [];
  if (s.weekly.length !== 7 || new Set(s.weekly.map((d) => d.day)).size !== 7)
    e.push('Choose one schedule for each day.');
  for (const d of s.weekly) {
    if (
      !Number.isInteger(d.day) ||
      d.day < 0 ||
      d.day > 6 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) ||
      d.start >= d.end
    )
      e.push('Each working day needs a valid start and end time.');
  }
  if (!Number.isInteger(s.noticeMinutes) || s.noticeMinutes < 0 || s.noticeMinutes > 43200)
    e.push('Notice must be 0–43,200 minutes.');
  if (!Number.isInteger(s.bufferMinutes) || s.bufferMinutes < 0 || s.bufferMinutes > 180)
    e.push('Buffer must be 0–180 minutes.');
  if (Object.values(s.modes).some((m) => !['appointment', 'date-range'].includes(m)))
    e.push('Choose a valid booking mode.');
  if (
    s.payment.bankName.length > 80 ||
    s.payment.accountName.length > 120 ||
    s.payment.accountNumber.length > 40 ||
    s.payment.instructions.length > 600
  )
    e.push('Keep payment instructions short.');
  if (
    s.payment.qrPhoto &&
    (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(s.payment.qrPhoto) ||
      s.payment.qrPhoto.length > 180000)
  )
    e.push('Use a compressed QR image.');
  return [...new Set(e)];
}
export function effectiveStatus(b: BookingRecord, now = Date.now()): BookingStatus {
  return b.status === 'accepted' && b.paymentDeadline && Date.parse(b.paymentDeadline) <= now
    ? 'expired'
    : b.status;
}
export function reservesCapacity(b: BookingRecord, now = Date.now()) {
  return ['accepted', 'confirmed'].includes(effectiveStatus(b, now));
}
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  bufferMinutes = 0,
  existingBufferMinutes = bufferMinutes,
) {
  const margin = bufferMinutes * 60000;
  return (
    Date.parse(aStart) < Date.parse(bEnd) + existingBufferMinutes * 60000 &&
    Date.parse(bStart) < Date.parse(aEnd) + margin
  );
}
export function rangeError(start: string, end: string, now = Date.now()): string | null {
  const a = Date.parse(start),
    b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 'Choose a valid start and end.';
  if (a <= now) return 'Choose a future date and time.';
  if (b - a > 90 * 86400000) return 'Request a range of up to 90 days.';
  return null;
}
export function scheduleError(
  settings: BookingSettings,
  start: string,
  end: string,
  mode: BookingMode,
  now = Date.now(),
): string | null {
  const invalid = rangeError(start, end, now);
  if (invalid) return invalid;
  if (Date.parse(start) < now + settings.noticeMinutes * 60000)
    return `This provider needs ${settings.noticeMinutes} minutes’ notice.`;
  if (mode === 'date-range') return null; // Range enquiries are assessed by the provider, not fixed-hour slots.
  const date = myDate(Date.parse(start));
  if (myDate(Date.parse(end) - 1) !== date)
    return 'An appointment must fit within one working day.';
  const day = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  const hours = settings.weekly.find((d) => d.day === day);
  if (
    !hours?.enabled ||
    Date.parse(start) < Date.parse(malaysiaInstant(date, hours.start)) ||
    Date.parse(end) > Date.parse(malaysiaInstant(date, hours.end))
  )
    return 'Choose a time within the provider’s working hours.';
  return null;
}
export function estimateCents(service: Service, start: string, end: string): number | null {
  if (service.price === null || service.priceBasis === 'quote') return null;
  const units =
    service.priceBasis === 'hour'
      ? (Date.parse(end) - Date.parse(start)) / 3600000
      : service.priceBasis === 'day'
        ? Math.ceil((Date.parse(end) - Date.parse(start)) / 86400000)
        : 1;
  return Math.round(service.price * units * 100);
}
export function money(cents: number | null) {
  return cents === null
    ? 'To be quoted'
    : new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(cents / 100);
}
export function statusLabel(status: BookingStatus) {
  return {
    requested: 'Awaiting provider',
    accepted: 'Accepted · awaiting payment',
    confirmed: 'Confirmed',
    completed: 'Completed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    expired: 'Payment window expired',
  }[status];
}
export function paymentLabel(status: BookingRecord['paymentStatus']) {
  return {
    not_due: 'Not due yet',
    unpaid: 'Unpaid',
    claimed: 'Customer says paid · unverified',
    provider_verified: 'Manual payment · provider verified',
  }[status];
}
export function receiptShareHref(b: BookingRecord): string | null {
  if (!b.providerWhatsapp) return null;
  return `https://wa.me/${b.providerWhatsapp}?text=${encodeURIComponent(`Hi, I’m sharing a receipt for Service Link booking ${b.reference} (${b.service.name}). Amount due: ${money(b.amountDueCents)}. Please check your account before verifying payment. I will attach my receipt here.`)}`;
}
