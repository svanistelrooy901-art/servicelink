import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { repository } from '../lib/repository';
import { bookingRepository } from '../lib/bookingRepository';
import type { ProviderProfile } from '../lib/types';
import { BookingForm, bookingAccessPath } from '../components/BookingForm';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { usingLocal } from '../lib/config';
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
          if (!x) setError('This provider is unavailable.');
        }
      })
      .catch(() => active && setError('Unable to load this provider.'));
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
        <Link to={`/p/${slug}`}>Back to profile</Link>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>Local booking demo</strong>
          <span>Use fictional details. No real payments or messages are sent.</span>
        </div>
      )}
      <section className="booking-public-card panel">
        <span className="eyebrow">LET’S MAKE A CONNECTION</span>
        <h1>Request a booking</h1>
        {p && <p className="hint">With {p.name}</p>}
        {!usingLocal ? (
          <p className="booking-notice">
            Booking requests are not enabled in this environment yet.
          </p>
        ) : error ? (
          <p role="alert" className="error-box">
            {error}
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
          <p>Loading provider…</p>
        )}
      </section>
    </main>
  );
}
