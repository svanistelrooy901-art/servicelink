import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { repository } from '../lib/repository';
import { bookingRepository } from '../lib/bookingRepository';
import type { ProviderProfile } from '../lib/types';
import { BookingForm, bookingAccessPath } from '../components/BookingForm';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { usingLocal, bookingsEnabled } from '../lib/config';
export function BookingRequestPage() {
  const { slug = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [p, setP] = useState<ProviderProfile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    repository
      .getPublic(slug)
      .then((x) => {
        if (active) {
          setP(x?.profile ?? null);
          if (!x) setError(t('This provider is unavailable.'));
        }
      })
      .catch(() => active && setError(t('Unable to load this provider.')));
    return () => {
      active = false;
    };
  }, [slug]);
  return (
    <main className="booking-public-page">
      <header className="public-header">
        <Link to="/marketplace">
          <ServiceLinkBrand />
        </Link>
        <Link to={`/p/${slug}`}>{t('Back to profile')}</Link>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>{t('Local booking demo')}</strong>
          <span>{t('Use fictional details. No real payments or messages are sent.')}</span>
        </div>
      )}
      <section className="booking-public-card panel">
        <span className="eyebrow">{t('LET’S MAKE A CONNECTION')}</span>
        <h1>{t('Request a booking')}</h1>
        {p && (
          <p className="hint">
            {t('With')} {p.name}
          </p>
        )}
        {!bookingsEnabled ? (
          <p className="booking-notice">
            {t('Booking requests are not enabled in this environment yet.')}
          </p>
        ) : error ? (
          <p role="alert" className="error-box">
            {t(error)}
          </p>
        ) : p ? (
          <BookingForm
            profile={p}
            initialServiceId={search.get('service') ?? undefined}
            submitting={busy}
            onSubmit={async (input) => {
              setBusy(true);
              try {
                const result = await bookingRepository.request(input);
                navigate(bookingAccessPath(result), { replace: true });
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <p>{t('Loading provider…')}</p>
        )}
      </section>
    </main>
  );
}
