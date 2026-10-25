import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ProviderProfile } from '../lib/types';
import type {
  BookingAvailability,
  BookingInput,
  BookingMode,
  BookingRecord,
} from '../lib/bookingTypes';
import { bookingRepository } from '../lib/bookingRepository';
import {
  myDate,
  addDays,
  malaysiaInstant,
  scheduleError,
  overlaps,
  estimateCents,
  money,
} from '../lib/bookingRules';
import { stateById } from '../lib/geography';
export function BookingForm({
  profile,
  initialServiceId,
  onSubmit,
  submitting = false,
  submitLabel = 'Send booking request',
}: {
  profile: ProviderProfile;
  initialServiceId?: string;
  onSubmit: (input: BookingInput) => Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [error, setError] = useState('');
  const [serviceId, setServiceId] = useState(initialServiceId ?? profile.services[0]?.id ?? '');
  const [date, setDate] = useState(addDays(myDate(), 1));
  const [time, setTime] = useState('09:00');
  const [endDate, setEndDate] = useState(addDays(myDate(), 2));
  const [minutes, setMinutes] = useState(60);
  const [customerName, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState(profile.coverage[0]?.stateId ?? '');
  const [district, setDistrict] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    bookingRepository
      .availability(profile.slug)
      .then((a) => active && setAvailability(a))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [profile.slug]);
  const service = profile.services.find((s) => s.id === serviceId);
  const mode: BookingMode =
    availability?.settings.modes[serviceId] ??
    (profile.category === 'confinement' ? 'date-range' : 'appointment');
  const times = useMemo(() => {
    if (!availability || !service || mode === 'date-range') return [];
    const hours = availability.settings.weekly.find(
      (d) => d.day === new Date(`${date}T12:00:00+08:00`).getUTCDay(),
    );
    if (!hours?.enabled) return [];
    const result: string[] = [];
    for (
      let t = Date.parse(malaysiaInstant(date, hours.start));
      t < Date.parse(malaysiaInstant(date, hours.end));
      t += 30 * 60000
    ) {
      const start = new Date(t).toISOString(),
        end = new Date(t + (service.durationMinutes ?? minutes) * 60000).toISOString();
      if (
        !scheduleError(
          {
            ...availability.settings,
            payment: {
              bankName: '',
              accountName: '',
              accountNumber: '',
              instructions: '',
              qrPhoto: '',
            },
          },
          start,
          end,
          'appointment',
        ) &&
        !availability.busy.some((b) =>
          overlaps(
            start,
            end,
            b.start,
            b.end,
            availability.settings.bufferMinutes,
            b.bufferMinutes ?? 0,
          ),
        )
      )
        result.push(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kuala_Lumpur',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(t)),
        );
    }
    return result;
  }, [availability, service, mode, date, minutes]);
  useEffect(() => {
    if (mode === 'appointment' && times.length && !times.includes(time)) setTime(times[0]);
  }, [times, mode, time]);
  const divisions =
    stateById(state)?.subdivisions.filter((d) => {
      const c = profile.coverage.find((c) => c.stateId === state);
      return c?.wholeState || c?.subdivisionIds.includes(d.id);
    }) ?? [];
  let estimate: number | null = null;
  try {
    if (service) {
      const start = malaysiaInstant(date, mode === 'date-range' ? '00:00' : time),
        end =
          mode === 'date-range'
            ? malaysiaInstant(endDate, '00:00')
            : new Date(
                Date.parse(start) + (service.durationMinutes ?? minutes) * 60000,
              ).toISOString();
      estimate = estimateCents(service, start, end);
    }
  } catch {
    /* Invalid partial date stays in the form. */
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !service) return;
    setError('');
    try {
      const start = malaysiaInstant(date, mode === 'date-range' ? '00:00' : time);
      const end =
        mode === 'date-range'
          ? malaysiaInstant(endDate, '00:00')
          : new Date(
              Date.parse(start) + (service.durationMinutes ?? minutes) * 60000,
            ).toISOString();
      await onSubmit({
        slug: profile.slug,
        serviceId,
        mode,
        start,
        end,
        stateId: state,
        subdivisionId: district,
        customerName,
        customerPhone: phone,
        customerEmail: email,
        note,
        consent,
        requestId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send this request.');
    }
  }
  if (!availability)
    return <p role={error ? 'alert' : 'status'}>{error || 'Loading available times…'}</p>;
  if (!availability.settings.enabled)
    return (
      <div className="booking-notice">This provider has not enabled booking requests yet.</div>
    );
  return (
    <form className="booking-form" onSubmit={submit}>
      <fieldset disabled={submitting}>
        <div className="booking-notice">
          All times are Malaysia time (MYT). This is a request; the provider must accept before any
          payment is due.
        </div>
        <label>
          Choose a service
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {profile.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            {mode === 'date-range' ? 'Requested start date' : 'Preferred date'}
            <input
              type="date"
              required
              min={myDate()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (e.target.value && endDate <= e.target.value)
                  setEndDate(addDays(e.target.value, 1));
              }}
            />
          </label>
          {mode === 'date-range' ? (
            <label>
              Departure / end date (not included)
              <input
                type="date"
                required
                min={addDays(date || myDate(), 1)}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Preferred start time
              <select
                required
                value={times.includes(time) ? time : ''}
                onChange={(e) => setTime(e.target.value)}
              >
                <option value="">
                  {times.length ? 'Choose an available time' : 'No available times this day'}
                </option>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {mode === 'appointment' && !service?.durationMinutes && (
          <label>
            Requested duration (minutes)
            <input
              type="number"
              min={30}
              max={720}
              step={30}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        )}
        {mode === 'date-range' && (
          <p className="tiny">
            Dates are an enquiry for the full requested range. Acceptance reserves that continuous
            period; discuss live-in/day-care details with the provider first.
          </p>
        )}
        <div className="form-grid">
          <label>
            Service state / territory
            <select
              required
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setDistrict('');
              }}
            >
              {profile.coverage.map((c) => (
                <option key={c.stateId} value={c.stateId}>
                  {stateById(c.stateId)?.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Service district / zone
            <select required value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Choose your district</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Your name
          <input
            required
            maxLength={80}
            autoComplete="name"
            value={customerName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Mobile number
            <input
              type="tel"
              required
              maxLength={40}
              autoComplete="tel"
              placeholder="e.g. +60 12 345 6789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        <label>
          A short note (optional)
          <textarea
            rows={3}
            maxLength={600}
            placeholder="Share useful service details. Please leave out private addresses or sensitive information."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="booking-estimate">
          Estimated service price <strong>{money(estimate)}</strong>
          <small>Provider confirms the final amount and any extras before you pay.</small>
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I agree to share these details with this provider to handle my booking.
        </label>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <button
          className="btn-primary"
          disabled={submitting || (mode === 'appointment' && !times.length)}
        >
          {submitting ? 'Sending…' : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}
export function bookingAccessPath(b: BookingRecord) {
  return `/booking/${b.id}#${b.accessToken}`;
}
