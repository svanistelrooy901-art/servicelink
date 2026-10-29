import { t } from '../i18n';
import { MediaImage } from '../components/MediaImage';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, ArrowUpRight, HeartHandshake, BookOpen, Sparkles, X } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { repository } from '../lib/repository';
import { categories, type PublicListing } from '../lib/types';
import { geography, stateById, matchesCoverage } from '../lib/geography';
import { coverageLabels } from '../i18n/format';
import { priceLabel } from '../i18n/format';
import { usingLocal } from '../lib/config';
export function MarketplacePage() {
  const [list, setList] = useState<PublicListing[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  useEffect(() => {
    let active = true;
    repository
      .listPublic()
      .then((data) => active && setList(data))
      .catch(() => active && setError(t('Unable to load providers. Please try again.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  const results = useMemo(
    () =>
      list.filter(
        ({ profile: p }) =>
          (!category || p.category === category) &&
          (!state || matchesCoverage(p.coverage, state, district)) &&
          [p.name, p.headline, ...p.services.flatMap((s) => [s.name, s.description])]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [list, query, category, state, district],
  );
  const selected = list.filter((p) => compare.includes(p.profile.slug));
  return (
    <div className="marketplace-page">
      <header className="public-header">
        <Link to="/marketplace">
          <ServiceLinkBrand />
        </Link>
        <Link className="btn-secondary" to="/dashboard">
          {t('Provider workspace')}
          <ArrowUpRight size={15} />
        </Link>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>{t('Local demo')}</strong>
          <span>{t('Only profiles published in this browser appear here.')}</span>
        </div>
      )}
      <main className="marketplace-main">
        <section className="market-hero">
          <span className="eyebrow">{t('GOOD PEOPLE. GREAT SERVICES.')}</span>
          <h1>
            {t('A little help.')}
            <br />
            {t('A world of difference.')}
          </h1>
          <p>
            {t('Find independent people who care about what they do.')}
            <br />
            {t('Across Malaysia. Around your corner.')}
          </p>
          <span className="market-hero-mark" aria-hidden="true">
            <HeartHandshake size={52} />
            <span className="market-mini-stamp stamp-book">
              <BookOpen size={23} />
            </span>
            <span className="market-mini-stamp stamp-spark">
              <Sparkles size={23} />
            </span>
          </span>
        </section>
        <section className="market-filters" aria-label={t('Search providers')}>
          <label className="search-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('Search services or providers')}
              placeholder={t('What can we help you with?')}
            />
          </label>
          <div className="filter-row">
            <label>
              {t('Service')}
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t('All services')}</option>
                {Object.entries(categories).map(([id, label]) => (
                  <option key={id} value={id}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('State / territory')}
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setDistrict('');
                }}
              >
                <option value="">{t('All Malaysia')}</option>
                {geography.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('District / zone')}
              <select
                disabled={!state}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="">{t('Whole selected state')}</option>
                {stateById(state)?.subdivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="tiny">
            {t('Matched by service coverage. A provider’s home base does not limit these results.')}
          </p>
        </section>
        <div className="section-label results-label">
          <h2>
            {loading
              ? t('Finding providers…')
              : t(results.length === 1 ? '{count} provider for you' : '{count} providers for you', {
                  count: results.length,
                })}
          </h2>
          <p className="hint">{t('Browse. Compare. Connect.')}</p>
        </div>
        {error && (
          <p role="alert" className="error-box">
            {t(error)}
          </p>
        )}
        {!loading && !results.length && (
          <section className="empty-state">
            <MapPin size={30} />
            <h2>{t('A new connection is on its way.')}</h2>
            <p>{t('No published profiles match these filters yet.')}</p>
            {usingLocal && (
              <Link className="btn-primary" to="/dashboard/preview">
                {t('Publish your demo profile')}
              </Link>
            )}
          </section>
        )}
        <div className="market-grid">
          {results.map(({ profile: p }) => (
            <article className={`listing-card theme-${p.accent}`} key={p.slug}>
              <div className="listing-cover">
                {p.banner && (
                  <MediaImage
                    className="listing-banner"
                    src={p.banner}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: `50% ${p.bannerPosition ?? 50}%` }}
                  />
                )}
                <span className="category-badge">
                  <CategoryIcon category={p.category} size={13} />
                  {t(categories[p.category])}
                </span>
                <div className="listing-avatar">
                  {p.photo ? <MediaImage src={p.photo} alt="" /> : p.name[0]}
                </div>
              </div>
              <div className="listing-body">
                <h2>
                  <Link to={`/p/${p.slug}`}>{p.name}</Link>
                </h2>
                <p className="listing-headline">{p.headline}</p>
                <p className="listing-coverage">
                  <MapPin size={14} />
                  {coverageLabels(p.coverage).join(' · ')}
                </p>
                <p className="tiny">{t('New on Service Link · No reviews yet')}</p>
                <div className="listing-price">{p.services[0] && priceLabel(p.services[0])}</div>
                <div className="listing-actions">
                  <Link className="btn-secondary" to={`/p/${p.slug}`}>
                    {t('View profile')}
                    <ArrowUpRight size={15} />
                  </Link>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={compare.includes(p.slug)}
                      disabled={
                        !compare.includes(p.slug) &&
                        (compare.length >= 3 ||
                          (selected[0] && selected[0].profile.category !== p.category))
                      }
                      onChange={(e) =>
                        setCompare(
                          e.target.checked
                            ? [...compare, p.slug]
                            : compare.filter((s) => s !== p.slug),
                        )
                      }
                    />
                    {t('Compare')}
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
        {selected.length > 0 && (
          <aside className="compare-bar">
            <span>
              {selected.length}
              {t('/3 selected ·')} {t(categories[selected[0].profile.category])}
            </span>
            <button className="btn-primary" onClick={() => setShowCompare((v) => !v)}>
              {showCompare ? t('Hide comparison') : t('Compare providers')}
            </button>
            <button
              className="icon-btn"
              aria-label={t('Clear comparison')}
              onClick={() => {
                setCompare([]);
                setShowCompare(false);
              }}
            >
              <X size={18} />
            </button>
          </aside>
        )}
        {showCompare && selected.length > 0 && (
          <section className="comparison panel">
            <h2>{t('Find the right fit')}</h2>
            <p className="hint">
              {t(
                'Compare up to three providers in one category. Services and packages may have different inclusions.',
              )}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('Provider')}</th>
                    {selected.map(({ profile: p }) => (
                      <th key={p.slug}>
                        <Link to={`/p/${p.slug}`}>{p.name}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    t('Services & prices'),
                    t('Service coverage'),
                    t('Experience'),
                    t('Languages'),
                    t('Reviews'),
                  ].map((label, i) => (
                    <tr key={t(label)}>
                      <th>{t(label)}</th>
                      {selected.map(({ profile: p }) => (
                        <td key={p.slug}>
                          {i === 0
                            ? p.services.map((s) => (
                                <p key={s.id}>
                                  <strong>{s.name}</strong>
                                  <br />
                                  {priceLabel(s)}
                                  {s.durationMinutes ? ` · ${s.durationMinutes} ${t('min')}` : ''}
                                  <br />
                                  {s.description}
                                </p>
                              ))
                            : i === 1
                              ? coverageLabels(p.coverage).join('; ')
                              : i === 2
                                ? t('{count} years', { count: p.experienceYears })
                                : i === 3
                                  ? p.languages || t('Not specified')
                                  : t('New on Service Link')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="market-footer">{t('Service Link · A Digital Sambal product')}</p>
      </main>
    </div>
  );
}
