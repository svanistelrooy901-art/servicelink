import { t } from '../i18n';
import { malaysiaInstant, parseBookingAmount } from '../lib/bookingRules';
import type { AcceptBooking } from '../lib/bookingTypes';

export interface BookingTermsDraft {
  total: string;
  deposit: string;
  deadline: string;
  scope: string;
}

export function bookingTerms(draft: BookingTermsDraft): AcceptBooking {
  const total = parseBookingAmount(draft.total);
  const deposit = parseBookingAmount(draft.deposit);
  if (deposit > total) throw new Error('The deposit must be between RM0 and the total price.');
  const [day, time] = draft.deadline.split('T');
  return {
    amountDueCents: deposit,
    totalPriceCents: total,
    agreedScope: draft.scope.trim(),
    paymentDeadline: deposit > 0 ? malaysiaInstant(day, time) : null,
  };
}

export function BookingTermsFields({
  draft,
  onChange,
}: {
  draft: BookingTermsDraft;
  onChange: (value: BookingTermsDraft) => void;
}) {
  return (
    <>
      <div className="form-grid">
        <label>
          {t('Total price (RM)')}
          <input
            type="number"
            min={0}
            step="0.01"
            max={100000}
            value={draft.total}
            onChange={(e) => onChange({ ...draft, total: e.target.value })}
          />
        </label>
        <label>
          {t('Deposit (RM)')}
          <input
            type="number"
            min={0}
            step="0.01"
            max={100000}
            value={draft.deposit}
            onChange={(e) => onChange({ ...draft, deposit: e.target.value })}
          />
        </label>
      </div>
      <p className="tiny">{t('Enter RM0 if you do not require a deposit.')}</p>
      <label>
        {t('Agreed scope')}
        <textarea
          rows={2}
          maxLength={600}
          value={draft.scope}
          onChange={(e) => onChange({ ...draft, scope: e.target.value })}
        />
      </label>
      {Number(draft.deposit) > 0 && (
        <label>
          {t('Payment deadline (MYT)')}
          <input
            type="datetime-local"
            value={draft.deadline}
            onChange={(e) => onChange({ ...draft, deadline: e.target.value })}
          />
        </label>
      )}
    </>
  );
}
