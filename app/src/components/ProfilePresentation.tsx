// AL's shared ProfilePresentation architecture, adapted to SL's provider/service domain.
import { MapPin, Globe, Briefcase, MessageCircle, ArrowUpRight, Star, Link2 } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { Link } from 'react-router-dom';
import { coverageLabels } from '../lib/geography';
import { categories, type ProviderProfile } from '../lib/types';
import { priceLabel } from '../lib/profile';
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
      <div className="profile-cover">
        <span className="cover-caption">
          <Link2 size={15} /> YOUR NEXT CONNECTION
        </span>
        <span className="cover-orbit" />
        <span className="profile-cover-stamp" aria-hidden="true">
          <CategoryIcon category={p.category} size={35} />
        </span>
        <div className="cover-label">
          Good people.
          <br />
          Great services.
        </div>
      </div>
      <div className="profile-body">
        <div className="profile-top">
          <div className="avatar">
            {p.photo ? (
              <img
                src={p.photo}
                alt={p.name ? `${p.name} profile portrait` : 'Your profile portrait'}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <span className="category-badge">{categories[p.category]}</span>
        </div>
        <h1>{p.name || 'Your name'}</h1>
        <p className="profile-headline">{p.headline || 'A short line about what you do best.'}</p>
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
              {p.experienceYears} years’ experience
            </span>
          )}
          {p.languages && (
            <span>
              <Globe size={15} />
              {p.languages}
            </span>
          )}
        </div>
        <div className="profile-contact">
          {contact ? (
            preview ? (
              <button disabled className="btn-primary">
                <MessageCircle size={17} />
                Chat on WhatsApp
              </button>
            ) : (
              <a className="btn-primary" href={contact} target="_blank" rel="noreferrer">
                <MessageCircle size={17} />
                Chat on WhatsApp
                <ArrowUpRight size={15} />
              </a>
            )
          ) : (
            <span className="contact-note">
              {preview
                ? 'Add a public WhatsApp number to let customers reach you.'
                : 'Contact details are not public yet.'}
            </span>
          )}
        </div>
        <section className="public-section">
          <h2>A little about me</h2>
          <p className="bio">
            {p.bio || 'Tell customers about your approach, experience and the people you help.'}
          </p>
        </section>
        <section className="public-section">
          <div className="section-label">
            <h2>How I can help</h2>
            <span>{p.services.length} services</span>
          </div>
          <div className="public-services">
            {p.services.length ? (
              p.services.map((s) => (
                <div className="public-service" key={s.id}>
                  <div className="service-symbol">
                    <CategoryIcon category={p.category} size={20} />
                  </div>
                  <h3>{s.name || 'Service name'}</h3>
                  <p>{s.description}</p>
                  <div className="service-meta">
                    {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                    <span>
                      {s.delivery === 'in-person'
                        ? 'In person'
                        : s.delivery === 'online'
                          ? 'Online'
                          : 'In person & online'}
                    </span>
                  </div>
                  <strong>{priceLabel(s)}</strong>
                  {preview ? (
                    <button className="btn-secondary service-book-btn" disabled>
                      Request booking
                    </button>
                  ) : (
                    <Link
                      className="btn-secondary service-book-btn"
                      to={`/p/${p.slug}/book?service=${encodeURIComponent(s.id)}`}
                    >
                      Request booking
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <p className="hint">Your services will appear here.</p>
            )}
          </div>
        </section>
        <section className="public-section">
          <h2>Service coverage</h2>
          <div className="coverage-tags">
            {coverageLabels(p.coverage).map((c) => (
              <span key={c}>
                <MapPin size={14} />
                {c}
              </span>
            ))}
            {!p.coverage.length && <p className="hint">Choose the areas you serve.</p>}
          </div>
        </section>
        <section className="review-empty">
          <Star size={19} />
          <div>
            <strong>New on Service Link</strong>
            <p>Customer reviews will appear here when available.</p>
          </div>
        </section>
        <p className="profile-footnote">
          {preview
            ? 'Live preview · contact and booking actions are disabled'
            : 'Connected by Service Link'}
          <span>Digital Sambal</span>
        </p>
      </div>
    </article>
  );
}
