import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, X } from 'lucide-react';
import { t } from '../i18n';
import { formatMY } from '../i18n/format';
import { effectiveStatus, money, statusLabel } from '../lib/bookingRules';
import type { BookingRecord } from '../lib/bookingTypes';
import { MediaImage } from './MediaImage';

export function BookingInvoice({
  booking,
  access,
}: {
  booking: BookingRecord;
  access?: { id: string; token: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!access) return;
    let privateLink = '';
    const beforePrint = () => {
      if (!dialog.current?.open || !window.location.hash) return;
      privateLink = window.location.href;
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    };
    const afterPrint = () => {
      if (
        privateLink &&
        !window.location.hash &&
        window.location.pathname === new URL(privateLink).pathname
      )
        window.history.replaceState(window.history.state, '', privateLink);
      privateLink = '';
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      afterPrint();
    };
  }, [access?.id, access?.token]);
  const invoice = booking.invoice;
  if (!invoice || booking.totalPriceCents == null || booking.amountDueCents == null) return null;
  const status = effectiveStatus(booking);
  const confirmed = booking.paymentStatus === 'provider_verified';
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => dialog.current?.showModal()}>
        <FileText size={16} /> {t('View invoice')}
      </button>
      {createPortal(
        <dialog ref={dialog} className="invoice-dialog" aria-label={t('Invoice')}>
          <div className="invoice-controls">
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const image = dialog.current?.querySelector('img');
                if (image?.getAttribute('src')) await image.decode().catch(() => {});
                window.print();
              }}
            >
              <Printer size={16} /> {t('Print / Save as PDF')}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('Close invoice')}
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <article className="invoice-document">
            <header className="invoice-header">
              <div>
                {invoice.logo && (
                  <MediaImage src={invoice.logo} access={access} alt={t('Business logo')} />
                )}
                <h2>{invoice.businessName}</h2>
                {invoice.registration && (
                  <p>
                    {t('Business registration')} · {invoice.registration}
                  </p>
                )}
                {invoice.contact && <p>{invoice.contact}</p>}
                {invoice.address && <p>{invoice.address}</p>}
              </div>
              <div>
                <h1>{t('Invoice')}</h1>
                <strong>INV-{booking.reference}</strong>
                <p>
                  {t('Issued')} · {formatMY(invoice.issuedAt)}
                </p>
                <p>{t(statusLabel(status))}</p>
              </div>
            </header>
            <section className="invoice-customer">
              <h3>{t('Bill to')}</h3>
              <strong>{booking.customerName}</strong>
              <p>{booking.customerPhone}</p>
              {booking.customerEmail && <p>{booking.customerEmail}</p>}
            </section>
            <section className="invoice-service">
              <h3>{t('Service')}</h3>
              <strong>{booking.service.name}</strong>
              <p>
                {formatMY(booking.start)} · {t('to')} {formatMY(booking.end)}
              </p>
              {booking.event && (
                <p>
                  {t('Venue or area')} · {booking.event.venue}
                </p>
              )}
              {(booking.agreedScope || booking.service.description) && (
                <p>{booking.agreedScope || booking.service.description}</p>
              )}
            </section>
            <dl className="invoice-totals">
              <div>
                <dt>{t('Total price')}</dt>
                <dd>{money(booking.totalPriceCents)}</dd>
              </div>
              <div>
                <dt>{t(confirmed ? 'Deposit verified' : 'Deposit')}</dt>
                <dd>{money(booking.amountDueCents)}</dd>
              </div>
              <div>
                <dt>{t('Balance after deposit')}</dt>
                <dd>{money(booking.totalPriceCents - booking.amountDueCents)}</dd>
              </div>
            </dl>
            {status === 'accepted' && booking.paymentDeadline && (
              <p>
                {t('Deposit deadline')} · {formatMY(booking.paymentDeadline)}
              </p>
            )}
            {invoice.note && (
              <section className="invoice-note">
                <h3>{t('Invoice note')}</h3>
                <p>{invoice.note}</p>
              </section>
            )}
          </article>
        </dialog>,
        document.body,
      )}
    </>
  );
}
