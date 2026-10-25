import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, RefreshCw, Plus, ExternalLink } from 'lucide-react';
import { useBookings } from '../hooks/useBookings';
import { useAppStore } from '../hooks/useAppStore';
import { bookingRepository } from '../lib/bookingRepository';
import { BookingForm, bookingAccessPath } from '../components/BookingForm';
import type { BookingRecord, AcceptBooking, BookingWorkspace } from '../lib/bookingTypes';
import {
  myDate,
  formatMY,
  statusLabel,
  paymentLabel,
  money,
  localInput,
  malaysiaInstant,
  addDays,
  effectiveStatus,
} from '../lib/bookingRules';
import { bookingsEnabled } from '../lib/config';
export function BookingsPage() {
  const { data, busy, error, feedback, refresh, run } = useBookings();
  const { workspace } = useAppStore();
  const [filter, setFilter] = useState('requested');
  const [date, setDate] = useState(myDate());
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDeadline, setManualDeadline] = useState(`${addDays(myDate(), 1)}T08:00`);
  if (!bookingsEnabled)
    return (
      <section className="panel">
        <h1>Bookings</h1>
        <p>Bookings are not enabled in this environment yet.</p>
      </section>
    );
  const bookings = data?.bookings ?? [];
  const requested = bookings.filter((b) => effectiveStatus(b) === 'requested');
  const confirmed = bookings.filter((b) => effectiveStatus(b) === 'confirmed');
  const awaiting = bookings.filter((b) => effectiveStatus(b) === 'accepted');
  const agenda = [
    ...bookings
      .filter(
        (b) =>
          ['accepted', 'confirmed'].includes(effectiveStatus(b)) &&
          myDate(Date.parse(b.start)) <= date &&
          myDate(Date.parse(b.end) - 1) >= date,
      )
      .map((b) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        label: b.service.name,
        detail: b.customerName,
      })),
    ...(data?.blocks
      .filter((b) => myDate(Date.parse(b.start)) <= date && myDate(Date.parse(b.end) - 1) >= date)
      .map((b) => ({ ...b, label: 'Blocked time', detail: b.note || 'Unavailable' })) ?? []),
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const visible = bookings
    .filter((b) => filter === 'all' || effectiveStatus(b) === filter)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE MORE ORGANISED</span>
          <h1>Good work, on the calendar.</h1>
          <p>Review requests, protect your time and keep payment records clear.</p>
        </div>
        <button className="btn-secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={15} />
          Refresh bookings
        </button>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="success-box">
          {feedback}
        </p>
      )}
      <div className="booking-stats">
        <div>
          <span>Awaiting your reply</span>
          <strong>{requested.length}</strong>
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>{awaiting.length}</strong>
        </div>
        <div>
          <span>Confirmed bookings</span>
          <strong>{confirmed.length}</strong>
        </div>
      </div>
      <section className="panel booking-calendar">
        <div className="section-label">
          <div>
            <h2>
              <CalendarDays size={19} />
              Your daily agenda
            </h2>
            <p className="hint">Shared across every service · Malaysia time.</p>
          </div>
          <label>
            View date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="agenda-list">
          {agenda.length ? (
            agenda.map((a) => (
              <div className="agenda-entry" key={a.id}>
                <span>
                  {formatMY(a.start)}
                  <small>to {formatMY(a.end)}</small>
                </span>
                <div>
                  <strong>{a.label}</strong>
                  <p>{a.detail}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="hint">No accepted bookings or blocked time for this date.</p>
          )}
        </div>
        <Link className="editor-next" to="/dashboard/availability">
          Edit working hours & blocked time →
        </Link>
      </section>
      <div className="booking-inbox-toolbar">
        <h2>Booking inbox</h2>
        <button className="btn-secondary" onClick={() => setManualOpen((v) => !v)}>
          <Plus size={15} />
          {manualOpen ? 'Close manual entry' : 'Add phone / WhatsApp booking'}
        </button>
      </div>
      {manualOpen && (
        <section className="panel manual-booking">
          <h2>Add a booking received elsewhere</h2>
          <p className="hint">
            Record an agreed booking to keep availability accurate. Customer details remain private.
          </p>
          {!workspace?.published ? (
            <p>Publish your profile first to choose a service.</p>
          ) : (
            <>
              <div className="form-grid">
                <label>
                  Agreed amount due (RM)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                  />
                </label>
                <label>
                  Manual booking payment deadline
                  <input
                    type="datetime-local"
                    required
                    value={manualDeadline}
                    onChange={(e) => setManualDeadline(e.target.value)}
                  />
                </label>
              </div>
              <BookingForm
                profile={workspace.published}
                submitLabel="Add accepted manual booking"
                submitting={busy}
                onSubmit={async (input) => {
                  if (!data) return;
                  if (manualAmount === '') throw new Error('Enter the agreed amount due.');
                  const amount = Math.round(Number(manualAmount) * 100);
                  const [day, time] = manualDeadline.split('T');
                  const result = await run(
                    () =>
                      bookingRepository.manual(
                        input,
                        { amountDueCents: amount, paymentDeadline: malaysiaInstant(day, time) },
                        data.revision,
                      ),
                    'Manual booking added; slot reserved.',
                  );
                  if (result) setManualOpen(false);
                }}
              />
            </>
          )}
        </section>
      )}
      <div className="booking-filters" aria-label="Booking filters">
        {[
          ['requested', 'Requests'],
          ['accepted', 'Awaiting payment'],
          ['confirmed', 'Confirmed'],
          ['all', 'All bookings'],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="booking-cards">
        {data &&
          visible.map((b) => (
            <OwnerBookingCard
              key={`${b.id}:${data.revision}`}
              booking={b}
              busy={busy}
              onAction={(action, a) =>
                run(
                  () => bookingRepository.ownerAction(b.id, action, data.revision, a),
                  action === 'verify'
                    ? 'Payment recorded as manually verified by provider.'
                    : `Booking ${action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : action === 'cancel' ? 'cancelled' : 'completed'}.`,
                )
              }
            />
          ))}
        {data && !visible.length && (
          <section className="panel empty-booking">
            <CalendarDays size={27} />
            <h2>Your next connection is on its way.</h2>
            <p>
              No bookings in this view yet. Enable booking requests in Availability and publish your
              profile.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
function OwnerBookingCard({
  booking: b,
  busy,
  onAction,
}: {
  booking: BookingRecord;
  busy: boolean;
  onAction: (
    action: 'accept' | 'decline' | 'verify' | 'cancel' | 'complete',
    a?: AcceptBooking,
  ) => Promise<BookingWorkspace | undefined>;
}) {
  const [amount, setAmount] = useState(
    b.amountDueCents === null ? '' : String(b.amountDueCents / 100),
  );
  const [deadline, setDeadline] = useState(
    localInput(
      new Date(Math.min(Date.now() + 24 * 3600000, Date.parse(b.start) - 60000)).toISOString(),
    ),
  );
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const status = effectiveStatus(b);
  async function accept() {
    setError('');
    try {
      if (amount === '') throw new Error('Enter a final amount before accepting.');
      const [day, time] = deadline.split('T');
      await onAction('accept', {
        amountDueCents: Math.round(Number(amount) * 100),
        paymentDeadline: malaysiaInstant(day, time),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to accept booking.');
    }
  }
  return (
    <article className="panel owner-booking">
      <div className="section-label">
        <div>
          <span className="eyebrow">
            {b.reference} · {b.source === 'provider' ? 'MANUAL ENTRY' : 'CUSTOMER REQUEST'}
          </span>
          <h2>{b.service.name}</h2>
        </div>
        <span className={`booking-status status-${status}`}>{statusLabel(status)}</span>
      </div>
      <div className="owner-booking-grid">
        <section>
          <h3>{b.customerName}</h3>
          <p>{b.customerPhone}</p>
          {b.customerEmail && <p>{b.customerEmail}</p>}
          <p className="booking-time">
            {formatMY(b.start)}
            <br />
            to {formatMY(b.end)}
          </p>
          <p className="tiny">
            {b.mode === 'date-range' ? 'Full date-range request' : 'Appointment request'}
          </p>
          {b.note && <p className="customer-note">{b.note}</p>}
          {b.accessToken && (
            <Link className="private-booking-link" to={bookingAccessPath(b)} target="_blank">
              View private customer page
              <ExternalLink size={13} />
            </Link>
          )}
        </section>
        <section>
          <p className="payment-state">{paymentLabel(b.paymentStatus)}</p>
          <strong className="booking-amount">{money(b.amountDueCents)}</strong>
          {b.paymentDeadline && <p className="tiny">Deadline: {formatMY(b.paymentDeadline)}</p>}
          {b.verifiedAt && <p className="tiny">Provider verified on {formatMY(b.verifiedAt)}</p>}
          {status === 'requested' && (
            <fieldset disabled={busy} className="accept-booking">
              <label>
                Final amount due (RM)
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Payment deadline (MYT)
                <input
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
              <p className="tiny">
                Choose a deadline before the service starts. The slot is released when an unpaid
                window expires.
              </p>
              <div className="booking-action-row">
                <button className="btn-primary" onClick={accept}>
                  Accept & reserve slot
                </button>
                <button className="text-btn" onClick={() => onAction('decline')}>
                  Decline request
                </button>
              </div>
            </fieldset>
          )}
          {status === 'accepted' && (
            <fieldset disabled={busy}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                I checked my bank / wallet and the full amount due has arrived.
              </label>
              <button
                disabled={!checked}
                className="btn-primary"
                onClick={() => onAction('verify')}
              >
                Verify money received
              </button>
              <p className="tiny">
                A receipt or customer payment report alone is not bank verification.
              </p>
            </fieldset>
          )}
          {status === 'confirmed' && (
            <button
              disabled={busy || Date.parse(b.end) > Date.now()}
              className="btn-secondary"
              onClick={() => onAction('complete')}
            >
              Mark completed
            </button>
          )}
          {['requested', 'accepted', 'confirmed'].includes(status) && (
            <button
              disabled={busy}
              className="text-btn danger-btn"
              onClick={() => {
                if (
                  window.confirm(
                    'Cancel this booking? Any payment/refund must be handled manually.',
                  )
                )
                  onAction('cancel');
              }}
            >
              Cancel booking
            </button>
          )}
          {(b.refundFollowUp || (status === 'expired' && b.paymentStatus === 'claimed')) && (
            <p className="booking-notice">
              Payment follow-up needed. Reconcile with the customer manually; Service Link has not
              issued a refund or restored a reservation.
            </p>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </section>
      </div>
      <details className="booking-audit">
        <summary>Booking history</summary>
        <ol>
          {b.events.map((e, i) => (
            <li key={i}>
              <span>{formatMY(e.at)}</span>
              {e.action}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
