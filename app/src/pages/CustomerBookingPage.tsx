import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingRepository } from '../lib/bookingRepository';
import type { BookingRecord } from '../lib/bookingTypes';
import {
  effectiveStatus,
  formatMY,
  money,
  statusLabel,
  paymentLabel,
  receiptShareHref,
} from '../lib/bookingRules';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { usingLocal } from '../lib/config';
export function CustomerBookingPage() {
  const { id = '' } = useParams();
  const [token] = useState(() => window.location.hash.slice(1));
  const [b, setB] = useState<BookingRecord | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function refresh() {
    try {
      const result = await bookingRepository.customerRead(id, token);
      setB(result);
      setError(result ? '' : 'This private booking link is invalid or unavailable.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking.');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (mounted) refresh();
    };
    update();
    window.addEventListener('focus', update);
    window.addEventListener('storage', update);
    const timer = window.setInterval(update, 30000);
    return () => {
      mounted = false;
      window.removeEventListener('focus', update);
      window.removeEventListener('storage', update);
      window.clearInterval(timer);
    };
  }, [id, token]);
  async function action(value: 'claim' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      setB(await bookingRepository.customerAction(id, token, value));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update booking.');
    } finally {
      setBusy(false);
    }
  }
  const status = b ? effectiveStatus(b) : null;
  const canPay = status === 'accepted';
  const receipt = b ? receiptShareHref(b) : null;
  return (
    <main className="booking-public-page">
      <header className="public-header">
        <Link to="/marketplace">
          <ServiceLinkBrand />
        </Link>
        <button className="btn-secondary" onClick={refresh} disabled={busy}>
          Refresh status
        </button>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>Local booking demo</strong>
          <span>Fictional data only. This link works in this browser, not on another device.</span>
        </div>
      )}
      <section className="booking-public-card panel">
        <span className="eyebrow">YOUR BOOKING</span>
        <h1>{b ? b.reference : 'Booking status'}</h1>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {!loaded && <p>Loading booking…</p>}
        {b && status && (
          <>
            <div className={`booking-status status-${status}`}>{statusLabel(status)}</div>
            <h2>{b.service.name}</h2>
            <p className="hint">With {b.providerName}</p>
            <dl className="booking-summary">
              <div>
                <dt>From</dt>
                <dd>{formatMY(b.start)}</dd>
              </div>
              <div>
                <dt>Until</dt>
                <dd>{formatMY(b.end)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{paymentLabel(b.paymentStatus)}</dd>
              </div>
              <div>
                <dt>{status === 'requested' ? 'Estimated price' : 'Amount due'}</dt>
                <dd>{money(b.amountDueCents)}</dd>
              </div>
            </dl>
            {status === 'requested' && (
              <p className="booking-notice">
                Your request has been recorded. The provider must review and accept it. No payment
                is due, and the time is not reserved yet.
              </p>
            )}
            {canPay && b.paymentDetails && (
              <section className="payment-instructions">
                <h2>Pay the provider directly</h2>
                <p>
                  Payment deadline: <strong>{formatMY(b.paymentDeadline!)}</strong>
                </p>
                {b.paymentDetails.qrPhoto && (
                  <img
                    className="customer-payment-qr"
                    src={b.paymentDetails.qrPhoto}
                    alt="Provider payment QR"
                  />
                )}
                {b.paymentDetails.bankName && (
                  <dl>
                    <dt>Bank</dt>
                    <dd>{b.paymentDetails.bankName}</dd>
                    <dt>Account holder</dt>
                    <dd>{b.paymentDetails.accountName}</dd>
                    <dt>Account number</dt>
                    <dd>{b.paymentDetails.accountNumber}</dd>
                  </dl>
                )}
                <p className="payment-copy">{b.paymentDetails.instructions}</p>
                <p className="tiny">
                  Use {b.reference} as the payment reference. Check the recipient details in your
                  banking app.
                </p>
                {usingLocal && (
                  <p className="booking-notice">
                    Demonstration only. Do not send real money using these details.
                  </p>
                )}
                {b.paymentStatus !== 'claimed' && (
                  <button disabled={busy} className="btn-primary" onClick={() => action('claim')}>
                    I have paid · notify provider
                  </button>
                )}
                {receipt ? (
                  usingLocal ? (
                    <button disabled className="btn-secondary">
                      WhatsApp receipt sharing · demo disabled
                    </button>
                  ) : (
                    <a className="btn-secondary" href={receipt} rel="noreferrer" target="_blank">
                      Open WhatsApp to share receipt
                    </a>
                  )
                ) : (
                  <p className="tiny">
                    The provider has not made a WhatsApp number available. Contact them through your
                    existing conversation to share a receipt.
                  </p>
                )}
                <p className="tiny">
                  WhatsApp opens a draft. You must attach the receipt and send it yourself.
                  Reporting payment does not verify it.
                </p>
              </section>
            )}
            {b.paymentStatus === 'claimed' && (
              <p className="booking-notice">
                Your payment report is unverified. The provider must check that money arrived. If
                the payment window expires, contact them before paying again.
              </p>
            )}
            {status === 'expired' && (
              <p className="booking-notice">
                The payment window expired and the slot was released. Do not pay using this booking.
                If you already paid, contact the provider for manual reconciliation.
              </p>
            )}
            {b.refundFollowUp && (
              <p className="booking-notice">
                Payment or a payment report remains on this cancelled booking. Contact the provider
                to resolve it manually; no refund has been issued by Service Link.
              </p>
            )}
            <div className="booking-customer-actions">
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                  } catch {
                    setError(
                      'Copy this page address from your browser to save the private booking link.',
                    );
                  }
                }}
              >
                {copied ? 'Private link copied' : 'Copy private booking link'}
              </button>
              {['requested', 'accepted'].includes(status) && b.paymentStatus !== 'claimed' && (
                <button
                  disabled={busy}
                  className="text-btn"
                  onClick={() => {
                    if (window.confirm('Cancel this booking request?')) action('cancel');
                  }}
                >
                  Cancel request
                </button>
              )}
            </div>
            <p className="tiny">
              Save this private link to check your booking. Anyone holding it can access this
              booking’s details.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
