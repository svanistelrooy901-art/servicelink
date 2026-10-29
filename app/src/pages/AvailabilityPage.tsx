import { t } from '../i18n';
import { MediaImage } from '../components/MediaImage';
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useBookings } from '../hooks/useBookings';
import { useAppStore } from '../hooks/useAppStore';
import { bookingRepository } from '../lib/bookingRepository';
import type { BookingSettings } from '../lib/bookingTypes';
import { DAY_NAMES, myDate, addDays, malaysiaInstant } from '../lib/bookingRules';
import { formatMY } from '../i18n/format';
import { compressPaymentQR } from '../lib/media';
import { bookingsEnabled, mediaEnabled } from '../lib/config';
export function AvailabilityPage() {
  const { data, busy, error, feedback, run } = useBookings();
  const { profile } = useAppStore();
  const [draft, setDraft] = useState<BookingSettings | null>(null);
  const [baseRevision, setBase] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [blockDate, setBlockDate] = useState(addDays(myDate(), 1));
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('17:00');
  const [blockNote, setBlockNote] = useState('');
  useEffect(() => {
    if (data && !draft) {
      setDraft(structuredClone(data.settings));
      setBase(data.revision);
    }
  }, [data, draft]);
  if (!bookingsEnabled)
    return (
      <section className="panel">
        <h1>{t('Booking setup')}</h1>
        <p>
          {t(
            'Booking is not enabled in this environment yet. The independent booking backend must be configured before accepting real customers.',
          )}
        </p>
      </section>
    );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const result = await run(
      () => bookingRepository.saveSettings(draft, baseRevision),
      t('Availability and payment instructions saved.'),
    );
    if (result) setBase(result.revision);
  }
  const patch = (p: Partial<BookingSettings>) => setDraft((s) => (s ? { ...s, ...p } : s));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('YOUR TIME, WELL SPENT')}</span>
          <h1>{t('Make room for good work.')}</h1>
          <p>
            {t('One shared calendar across all your services. All times use Malaysia time (MYT).')}
          </p>
        </div>
      </div>
      {error && (
        <p className="error-box" role="alert">
          {t(error)}
        </p>
      )}
      {feedback && (
        <p className="success-box" role="status">
          {t(feedback)}
        </p>
      )}
      {draft && data && (
        <div className="booking-settings-grid">
          <form onSubmit={save} className="booking-settings">
            <fieldset disabled={busy || mediaBusy}>
              <section className="panel">
                <div className="section-label">
                  <h2>{t('Booking requests')}</h2>
                  <CalendarDays size={20} />
                </div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  {t('Let customers request a booking')}
                </label>
                <p className="hint">
                  {t('Requests need your acceptance. They do not reserve time until accepted.')}
                </p>
                <div className="form-grid">
                  <label>
                    {t('Minimum notice (minutes)')}
                    <input
                      type="number"
                      min={0}
                      max={43200}
                      value={draft.noticeMinutes}
                      onChange={(e) => patch({ noticeMinutes: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    {t('Buffer between bookings (minutes)')}
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={draft.bufferMinutes}
                      onChange={(e) => patch({ bufferMinutes: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </section>
              <section className="panel">
                <h2>{t('Your weekly hours')}</h2>
                <p className="hint">
                  {t('For appointments. Date-range enquiries are reviewed separately.')}
                </p>
                <div className="weekly-hours">
                  {draft.weekly.map((day, i) => (
                    <div className="hours-row" key={day.day}>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(e) =>
                            patch({
                              weekly: draft.weekly.map((d, j) =>
                                i === j ? { ...d, enabled: e.target.checked } : d,
                              ),
                            })
                          }
                        />
                        {t(DAY_NAMES[day.day])}
                      </label>
                      <input
                        aria-label={t('{day} start', { day: t(DAY_NAMES[day.day]) })}
                        type="time"
                        disabled={!day.enabled}
                        value={day.start}
                        onChange={(e) =>
                          patch({
                            weekly: draft.weekly.map((d, j) =>
                              i === j ? { ...d, start: e.target.value } : d,
                            ),
                          })
                        }
                      />
                      <span>{t('to')}</span>
                      <input
                        aria-label={t('{day} end', { day: t(DAY_NAMES[day.day]) })}
                        type="time"
                        disabled={!day.enabled}
                        value={day.end}
                        onChange={(e) =>
                          patch({
                            weekly: draft.weekly.map((d, j) =>
                              i === j ? { ...d, end: e.target.value } : d,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>{t('How each service is requested')}</h2>
                {profile?.services.map((s) => (
                  <label key={s.id}>
                    {s.name}
                    <select
                      value={
                        draft.modes[s.id] ??
                        (profile.category === 'confinement' ? 'date-range' : 'appointment')
                      }
                      onChange={(e) =>
                        patch({
                          modes: {
                            ...draft.modes,
                            [s.id]: e.target.value as 'appointment' | 'date-range',
                          },
                        })
                      }
                    >
                      <option value="appointment">{t('Appointment · date and time')}</option>
                      <option value="date-range">{t('Date-range enquiry')}</option>
                    </select>
                  </label>
                ))}
                <p className="tiny">
                  {t(
                    'Acceptance of a date range reserves the entire continuous period. Discuss the scope before accepting.',
                  )}
                </p>
              </section>
              <section className="panel">
                <h2>{t('How customers can pay you')}</h2>
                <p className="hint">
                  {t('Bank transfer or your QR is enough. A gateway account is optional.')}
                </p>
                <label>
                  {t('Bank name')}
                  <input
                    maxLength={80}
                    value={draft.payment.bankName}
                    onChange={(e) =>
                      patch({ payment: { ...draft.payment, bankName: e.target.value } })
                    }
                  />
                </label>
                <label>
                  {t('Account holder')}
                  <input
                    maxLength={120}
                    value={draft.payment.accountName}
                    onChange={(e) =>
                      patch({ payment: { ...draft.payment, accountName: e.target.value } })
                    }
                  />
                </label>
                <label>
                  {t('Account number')}
                  <input
                    inputMode="numeric"
                    maxLength={40}
                    value={draft.payment.accountNumber}
                    onChange={(e) =>
                      patch({ payment: { ...draft.payment, accountNumber: e.target.value } })
                    }
                  />
                </label>
                <label>
                  {t('Payment instructions (optional)')}
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={draft.payment.instructions}
                    onChange={(e) =>
                      patch({ payment: { ...draft.payment, instructions: e.target.value } })
                    }
                  />
                </label>
                <label className="btn-secondary upload-label">
                  {t('Upload payment QR')}
                  <input
                    aria-label={t('Payment QR image')}
                    type="file"
                    disabled={!mediaEnabled}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setMediaBusy(true);
                      setMediaError('');
                      try {
                        patch({
                          payment: { ...draft.payment, qrPhoto: await compressPaymentQR(file) },
                        });
                      } catch (e) {
                        setMediaError(e instanceof Error ? e.message : t('Unable to prepare QR.'));
                      } finally {
                        setMediaBusy(false);
                      }
                    }}
                  />
                </label>
                {draft.payment.qrPhoto && (
                  <div className="payment-qr">
                    <MediaImage alt={t('Your payment QR')} src={draft.payment.qrPhoto} />
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => patch({ payment: { ...draft.payment, qrPhoto: '' } })}
                    >
                      {t('Remove QR')}
                    </button>
                  </div>
                )}
                {mediaError && (
                  <p role="alert" className="error-text">
                    {t(mediaError)}
                  </p>
                )}
                <p className="tiny">
                  {t(
                    'Shown only with an accepted booking. Existing accepted bookings keep their original payment instructions. Test that your QR remains scannable before use.',
                  )}
                </p>
              </section>
              <button className="btn-primary" disabled={busy || mediaBusy}>
                {t('Save availability & payment details')}
              </button>
            </fieldset>
          </form>
          <aside className="booking-blocks">
            <section className="panel">
              <h2>{t('Time off & blocked time')}</h2>
              <p className="hint">
                {t(
                  'Private notes stay in your workspace. Accepted bookings cannot be overwritten by a block.',
                )}
              </p>
              <fieldset disabled={busy}>
                <label>
                  {t('Block date')}
                  <input
                    type="date"
                    min={myDate()}
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    {t('From')}
                    <input
                      type="time"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('Until')}
                    <input
                      type="time"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  {t('Private note')}
                  <input
                    maxLength={150}
                    value={blockNote}
                    onChange={(e) => setBlockNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    const result = await run(
                      async () =>
                        bookingRepository.addBlock(
                          {
                            start: malaysiaInstant(blockDate, blockStart),
                            end: malaysiaInstant(blockDate, blockEnd),
                            note: blockNote,
                          },
                          data.revision,
                        ),
                      t('Time blocked.'),
                    );
                    if (result && baseRevision === data.revision) setBase(result.revision);
                  }}
                >
                  <Plus size={16} />
                  {t('Block time')}
                </button>
              </fieldset>
              <div className="block-list">
                {data.blocks.map((b) => (
                  <article key={b.id}>
                    <div>
                      <strong>{formatMY(b.start)}</strong>
                      <p>
                        {t('Until')} {formatMY(b.end)}
                      </p>
                      <small>{b.note || t('Blocked time')}</small>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={t('Remove block {name}', { name: b.note || formatMY(b.start) })}
                      className="icon-btn"
                      onClick={async () => {
                        const result = await run(
                          () => bookingRepository.removeBlock(b.id, data.revision),
                          t('Block removed.'),
                        );
                        if (result && baseRevision === data.revision) setBase(result.revision);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
                {!data.blocks.length && <p className="tiny">{t('No blocked time yet.')}</p>}
              </div>
            </section>
            <section className="booking-notice">
              {t(
                'A booking is never bank-verified automatically. Check your bank or wallet before confirming a payment.',
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
