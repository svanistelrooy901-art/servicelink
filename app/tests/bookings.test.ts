import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalRepository } from '../src/lib/localRepository.ts';
import { createLocalBookingRepository } from '../src/lib/localBookingRepository.ts';
import {
  defaultBookingSettings,
  malaysiaInstant,
  overlaps,
  scheduleError,
  receiptShareHref,
  effectiveStatus,
} from '../src/lib/bookingRules.ts';
import type { BookingInput, BookingRepository } from '../src/lib/bookingTypes.ts';
const NOW = Date.parse('2026-11-01T08:00:00+08:00');
function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}
async function fixture() {
  const s = storage(),
    p = createLocalRepository(s);
  const w = await p.load();
  await p.publish(w.draft, 0);
  let now = NOW;
  const r = createLocalBookingRepository(s, p, () => now);
  const settings = defaultBookingSettings();
  settings.enabled = true;
  settings.noticeMinutes = 0;
  settings.payment = {
    bankName: 'Demo Bank',
    accountName: 'FICTIONAL DEMO',
    accountNumber: 'DEMO-NOT-A-REAL-ACCOUNT',
    instructions: 'Do not pay. Demo only.',
    qrPhoto: '',
  };
  await r.saveSettings(settings, 0);
  return {
    r,
    p,
    s,
    clock: (v: number) => {
      now = v;
    },
  };
}
function input(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    slug: 'aina-demo',
    serviceId: 'demo-care',
    mode: 'appointment',
    start: malaysiaInstant('2026-11-02', '09:00'),
    end: malaysiaInstant('2026-11-02', '11:00'),
    stateId: 'my-07',
    subdivisionId: 'my-07-04',
    customerName: 'Demo Customer',
    customerPhone: '0120000000',
    customerEmail: '',
    note: 'Fictional request',
    consent: true,
    requestId: crypto.randomUUID(),
    ...overrides,
  };
}
async function accept(r: BookingRepository, id: string) {
  const w = await r.load();
  return r.ownerAction(id, 'accept', w.revision, {
    amountDueCents: 5000,
    paymentDeadline: malaysiaInstant('2026-11-01', '20:00'),
  });
}
test('MYT and interval boundaries: adjacency allowed; buffers and overnight sessions checked', () => {
  assert.equal(malaysiaInstant('2026-11-02', '09:00'), '2026-11-02T01:00:00.000Z');
  assert.equal(
    overlaps('2026-11-02T01:00Z', '2026-11-02T03:00Z', '2026-11-02T03:00Z', '2026-11-02T04:00Z'),
    false,
  );
  assert.equal(
    overlaps(
      '2026-11-02T01:00Z',
      '2026-11-02T03:00Z',
      '2026-11-02T03:00Z',
      '2026-11-02T04:00Z',
      15,
    ),
    true,
  );
  assert.ok(
    scheduleError(
      defaultBookingSettings(),
      '2026-11-02T15:00Z',
      '2026-11-02T17:00Z',
      'appointment',
      NOW,
    ),
  );
  assert.throws(() => malaysiaInstant('2026-02-30', '09:00'));
});
test('pending requests do not reserve capacity; acceptance blocks competing requests and blocks', async () => {
  const { r } = await fixture();
  const a = await r.request(input()),
    b = await r.request(input());
  assert.equal((await r.availability('aina-demo')).busy.length, 0);
  await accept(r, a.id);
  await assert.rejects(accept(r, b.id), /reserved/);
  const w = await r.load();
  await assert.rejects(
    r.addBlock({ start: a.start, end: a.end, note: 'Private note' }, w.revision),
    /booking occupies/,
  );
  const availability = await r.availability('aina-demo');
  assert.equal(availability.busy.length, 1);
  assert.equal(JSON.stringify(availability).includes('Demo Customer'), false);
  assert.equal(JSON.stringify(availability).includes('DEMO-NOT'), false);
});
test('request validation enforces coverage, consent, phone, published services and duration', async () => {
  const { r, p } = await fixture();
  await assert.rejects(r.request(input({ customerPhone: 'x' })), /mobile/);
  await assert.rejects(r.request(input({ consent: false })), /share/);
  await assert.rejects(
    r.request(input({ stateId: 'my-01', subdivisionId: 'my-01-01' })),
    /coverage/,
  );
  await assert.rejects(
    r.request(input({ end: malaysiaInstant('2026-11-02', '10:00') })),
    /duration/,
  );
  await p.unpublish(1);
  await assert.rejects(r.request(input()), /not accepting/);
});
test('request retry is idempotent across reloads and rejects modified payloads', async () => {
  const { r, p, s } = await fixture();
  const i = input();
  const a = await r.request(i);
  const reloaded = createLocalBookingRepository(s, p, () => NOW);
  assert.equal((await reloaded.request(i)).id, a.id);
  await assert.rejects(reloaded.request({ ...i, customerName: 'Different' }), /already used/);
  assert.equal((await reloaded.load()).bookings.length, 1);
});
test('customer token controls one booking; payment claim never verifies receipt; provider verification confirms', async () => {
  const { r } = await fixture();
  const b = await r.request(input());
  assert.equal(await r.customerRead(b.id, '0'.repeat(64)), null);
  await assert.rejects(r.customerAction(b.id, 'invalid', 'claim'));
  await assert.rejects(r.customerAction(b.id, b.accessToken, 'claim'), /payment window/);
  await accept(r, b.id);
  const reported = await r.customerAction(b.id, b.accessToken, 'claim');
  assert.equal(reported.paymentStatus, 'claimed');
  assert.equal(reported.status, 'accepted');
  assert.equal(reported.verifiedAt, null);
  const state = await r.load();
  const verified = await r.ownerAction(b.id, 'verify', state.revision);
  assert.equal(verified.bookings[0].status, 'confirmed');
  assert.equal(verified.bookings[0].paymentStatus, 'provider_verified');
  await assert.rejects(r.ownerAction(b.id, 'verify', verified.revision), /cannot be verified/);
});
test('hold expiry releases capacity; late receipt cannot reactivate or verify an expired booking', async () => {
  const { r, clock } = await fixture();
  const a = await r.request(input()),
    b = await r.request(input());
  await accept(r, a.id);
  await r.customerAction(a.id, a.accessToken, 'claim');
  clock(Date.parse('2026-11-01T21:00:00+08:00'));
  assert.equal((await r.availability('aina-demo')).busy.length, 0);
  assert.equal((await r.customerRead(a.id, a.accessToken))?.status, 'expired');
  const w = await r.load();
  await assert.rejects(r.ownerAction(a.id, 'verify', w.revision), /expired/);
  await assert.rejects(r.customerAction(a.id, a.accessToken, 'claim'), /payment window/);
  await r.ownerAction(b.id, 'accept', w.revision, {
    amountDueCents: 5000,
    paymentDeadline: malaysiaInstant('2026-11-02', '08:00'),
  });
});
test('accepted payment instructions and service price are snapshots; paid cancellation preserves follow-up', async () => {
  const { r } = await fixture();
  const b = await r.request(input());
  let w = await accept(r, b.id);
  w.settings.payment.accountNumber = 'NEW-DEMO-DETAILS';
  w = await r.saveSettings(w.settings, w.revision);
  assert.equal(
    (await r.customerRead(b.id, b.accessToken))?.paymentDetails?.accountNumber,
    'DEMO-NOT-A-REAL-ACCOUNT',
  );
  w = await r.ownerAction(b.id, 'verify', w.revision);
  w = await r.ownerAction(b.id, 'cancel', w.revision);
  assert.equal(w.bookings[0].refundFollowUp, true);
  assert.equal(w.bookings[0].paymentStatus, 'provider_verified');
  assert.equal((await r.availability('aina-demo')).busy.length, 0);
});
test('blocking, manual entry and cross-service capacity share a calendar', async () => {
  const { r } = await fixture();
  let w = await r.load();
  w = await r.addBlock(
    {
      start: malaysiaInstant('2026-11-02', '09:00'),
      end: malaysiaInstant('2026-11-02', '11:00'),
      note: 'Private day off',
    },
    w.revision,
  );
  await assert.rejects(r.request(input()), /blocked/);
  w = await r.removeBlock(w.blocks[0].id, w.revision);
  w = await r.manual(
    input(),
    { amountDueCents: 5000, paymentDeadline: malaysiaInstant('2026-11-01', '20:00') },
    w.revision,
  );
  assert.equal(w.bookings[0].source, 'provider');
  assert.equal((await r.availability('aina-demo')).busy.length, 1);
});
test('date-range enquiries do not require fixed-hour duration and reserve the full accepted range', async () => {
  const { r } = await fixture();
  let w = await r.load();
  w.settings.modes['demo-care'] = 'date-range';
  w = await r.saveSettings(w.settings, w.revision);
  const b = await r.request(
    input({
      mode: 'date-range',
      start: malaysiaInstant('2026-11-03', '00:00'),
      end: malaysiaInstant('2026-11-06', '00:00'),
    }),
  );
  assert.equal((await r.availability('aina-demo')).busy.length, 0);
  await accept(r, b.id);
  await assert.rejects(
    r.request(
      input({
        mode: 'date-range',
        start: malaysiaInstant('2026-11-05', '00:00'),
        end: malaysiaInstant('2026-11-07', '00:00'),
      }),
    ),
    /reserved/,
  );
});
test('serialized concurrent acceptance allows one winner; stale owner revisions are rejected', async () => {
  const { r, p, s } = await fixture();
  const a = await r.request(input()),
    b = await r.request(input());
  const other = createLocalBookingRepository(s, p, () => NOW);
  const w = await r.load();
  const results = await Promise.allSettled([
    r.ownerAction(a.id, 'accept', w.revision, {
      amountDueCents: 5000,
      paymentDeadline: malaysiaInstant('2026-11-01', '20:00'),
    }),
    other.ownerAction(b.id, 'accept', w.revision, {
      amountDueCents: 5000,
      paymentDeadline: malaysiaInstant('2026-11-01', '20:00'),
    }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await r.availability('aina-demo')).busy.length, 1);
});
test('receipt sharing only builds an encoded draft URL, with reference and amount', async () => {
  const { r } = await fixture();
  const b = await r.request(input());
  b.providerWhatsapp = '60120000000';
  const href = receiptShareHref(b)!;
  assert.ok(href.startsWith('https://wa.me/60120000000?text='));
  assert.ok(decodeURIComponent(href).includes(b.reference));
  assert.equal(
    effectiveStatus(
      { ...b, status: 'accepted', paymentDeadline: new Date(NOW - 1).toISOString() },
      NOW,
    ),
    'expired',
  );
});

test('accepted bookings preserve their after-service buffer even if provider changes the default', async () => {
  const { r } = await fixture();
  let w = await r.load();
  w.settings.bufferMinutes = 30;
  w = await r.saveSettings(w.settings, w.revision);
  const a = await r.request(input());
  w = await accept(r, a.id);
  w.settings.bufferMinutes = 0;
  w = await r.saveSettings(w.settings, w.revision);
  await assert.rejects(
    r.request(
      input({
        start: malaysiaInstant('2026-11-02', '11:00'),
        end: malaysiaInstant('2026-11-02', '13:00'),
      }),
    ),
    /reserved/,
  );
  assert.equal((await r.availability('aina-demo')).busy[0].bufferMinutes, 30);
});
test('different service IDs still reserve the same solo provider calendar', async () => {
  const { r, p } = await fixture();
  const w = await p.load();
  w.draft.services.push({ ...w.draft.services[0], id: 'second-service', name: 'Second service' });
  await p.publish(w.draft, w.revision);
  const first = await r.request(input());
  await accept(r, first.id);
  await assert.rejects(r.request(input({ serviceId: 'second-service' })), /reserved/);
});
