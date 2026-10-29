import { t } from '../i18n';
import { MediaImage } from './MediaImage';
// AL's shared ProfilePresentation architecture, adapted to SL's provider/service domain.
import { MapPin, Globe, Briefcase, MessageCircle, ArrowUpRight, Star } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { ProfileCover } from './ProfileCover';
import { SocialLinks } from './SocialLinks';
import { ProfileGallery } from './ProfileGallery';
import { Link } from 'react-router-dom';
import { coverageLabels } from '../i18n/format';
import { categories, type ProviderProfile } from '../lib/types';
import { priceLabel } from '../i18n/format';
import { getWhatsappHref } from '../lib/whatsappNumber';
export function ProfilePresentation({
  profile: p,
  preview = false,
}: {
  profile: ProviderProfile;
  preview?: boolean;
}) {
  const contact = p.showWhatsapp ? getWhatsappHref(p.whatsapp) : null;
  const initials =
    p.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || 'YOU';
  return (
    <article className={`provider-profile theme-${p.accent}`} data-testid="profile-presentation">
      <ProfileCover profile={p} />
      <div className="profile-body">
        <div className="profile-top">
          <div className="avatar">
            {p.photo ? (
              <MediaImage
                src={p.photo}
                alt={
                  p.name
                    ? t('{name} profile portrait', { name: p.name })
                    : t('Your profile portrait')
                }
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <span className="category-badge">{t(categories[p.category])}</span>
        </div>
        <h1>{p.name || t('Your name')}</h1>
        <p className="profile-headline">
          {p.headline || t('A short line about what you do best.')}
        </p>
        {p.base && (
          <p className="profile-location">
            <MapPin size={14} />
            {p.base}
          </p>
        )}
        <div className="profile-facts">
          {p.experienceYears > 0 && (
            <span>
              <Briefcase size={15} />
              {p.experienceYears} {t('years’ experience')}
            </span>
          )}
          {p.languages && (
            <span>
              <Globe size={15} />
              {p.languages}
            </span>
          )}
        </div>
        <SocialLinks links={p.social} preview={preview} />
        <div className="profile-contact">
          {contact ? (
            preview ? (
              <button disabled className="btn-primary">
                <MessageCircle size={17} />
                {t('Chat on WhatsApp')}
              </button>
            ) : (
              <a className="btn-primary" href={contact} target="_blank" rel="noreferrer">
                <MessageCircle size={17} />
                {t('Chat on WhatsApp')}
                <ArrowUpRight size={15} />
              </a>
            )
          ) : (
            <span className="contact-note">
              {preview
                ? t('Add a public WhatsApp number to let customers reach you.')
                : t('Contact details are not public yet.')}
            </span>
          )}
        </div>
        <section className="public-section">
          <h2>{t('A little about me')}</h2>
          <p className="bio">
            {p.bio || t('Tell customers about your approach, experience and the people you help.')}
          </p>
        </section>
        <section className="public-section">
          <div className="section-label">
            <h2>{t('How I can help')}</h2>
            <span>
              {p.services.length} {t('services')}
            </span>
          </div>
          <div className="public-services">
            {p.services.length ? (
              p.services.map((s) => (
                <div className="public-service" key={s.id}>
                  <div className="service-symbol">
                    <CategoryIcon category={p.category} size={20} />
                  </div>
                  <h3>{s.name || t('Service name')}</h3>
                  <p>{s.description}</p>
                  <div className="service-meta">
                    {s.durationMinutes && (
                      <span>
                        {s.durationMinutes} {t('min')}
                      </span>
                    )}
                    <span>
                      {s.delivery === 'in-person'
                        ? t('In person')
                        : s.delivery === 'online'
                          ? t('Online')
                          : t('In person & online')}
                    </span>
                  </div>
                  <strong>{priceLabel(s)}</strong>
                  {preview ? (
                    <button className="btn-secondary service-book-btn" disabled>
                      {t('Request booking')}
                    </button>
                  ) : (
                    <Link
                      className="btn-secondary service-book-btn"
                      to={`/p/${p.slug}/book?service=${encodeURIComponent(s.id)}`}
                    >
                      {t('Request booking')}
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <p className="hint">{t('Your services will appear here.')}</p>
            )}
          </div>
        </section>
        <ProfileGallery pictures={p.gallery} name={p.name} />
        <section className="public-section">
          <h2>{t('Service coverage')}</h2>
          <div className="coverage-tags">
            {coverageLabels(p.coverage).map((c) => (
              <span key={c}>
                <MapPin size={14} />
                {c}
              </span>
            ))}
            {!p.coverage.length && <p className="hint">{t('Choose the areas you serve.')}</p>}
          </div>
        </section>
        <section className="review-empty">
          <Star size={19} />
          <div>
            <strong>{t('New on Service Link')}</strong>
            <p>{t('Customer reviews will appear here when available.')}</p>
          </div>
        </section>
        <p className="profile-footnote">
          {preview
            ? t('Live preview · contact and booking actions are disabled')
            : t('Connected by Service Link')}
          <span>{t('Digital Sambal')}</span>
        </p>
      </div>
    </article>
  );
}
