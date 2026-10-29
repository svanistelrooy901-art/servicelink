import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProfilePresentation } from '../components/ProfilePresentation';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { repository } from '../lib/repository';
import { usingLocal } from '../lib/config';
import type { PublicListing } from '../lib/types';
export function PublicProfilePage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const p = await repository.getPublic(slug);
        if (active) {
          setData(p);
          setError('');
        }
      } catch {
        if (active) setError(t('Unable to load this profile. Try again shortly.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [slug]);
  return (
    <div className="public-page">
      <header className="public-header">
        <Link to="/marketplace">
          <ServiceLinkBrand />
        </Link>
        <Link to="/marketplace">{t('Find a service')}</Link>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>{t('Local demo')}</strong>
          <span>{t('Fictional/sample profile. Publication is visible on this browser only.')}</span>
        </div>
      )}
      {loading ? (
        <p className="loading">{t('Loading profile…')}</p>
      ) : error ? (
        <p className="empty-state" role="alert">
          {t(error)}
        </p>
      ) : data ? (
        <div className="public-container">
          <ProfilePresentation profile={data.profile} />
        </div>
      ) : (
        <section className="empty-state">
          <h1>{t('Profile unavailable')}</h1>
          <p>{t('This link may have changed, or the provider has unpublished their profile.')}</p>
          <Link className="btn-primary" to="/marketplace">
            {t('Explore services')}
          </Link>
        </section>
      )}
    </div>
  );
}
