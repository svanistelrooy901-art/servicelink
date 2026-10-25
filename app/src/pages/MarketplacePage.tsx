import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, ArrowUpRight, HeartHandshake, BookOpen, Sparkles, X } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { repository } from '../lib/repository';
import { categories, type PublicListing } from '../lib/types';
import { geography, stateById, matchesCoverage, coverageLabels } from '../lib/geography';
import { priceLabel } from '../lib/profile';
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
      .catch(() => active && setError('Unable to load providers. Please try again.'))
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
          Provider workspace
          <ArrowUpRight size={15} />
        </Link>
      </header>
      {usingLocal && (
        <div className="demo-banner">
          <strong>Local demo</strong>
          <span>Only profiles published in this browser appear here.</span>
        </div>
      )}
      <main className="marketplace-main">
        <section className="market-hero">
          <span className="eyebrow">GOOD PEOPLE. GREAT SERVICES.</span>
          <h1>
            A little help.
            <br />A world of difference.
          </h1>
          <p>
            Find independent people who care about what they do.
            <br />
            Across Malaysia. Around your corner.
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
        <section className="market-filters" aria-label="Search providers">
          <label className="search-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search services or providers"
              placeholder="What can we help you with?"
            />
          </label>
          <div className="filter-row">
            <label>
              Service
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All services</option>
                {Object.entries(categories).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              State / territory
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setDistrict('');
                }}
              >
                <option value="">All Malaysia</option>
                {geography.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              District / zone
              <select
                disabled={!state}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="">Whole selected state</option>
                {stateById(state)?.subdivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="tiny">
            Matched by service coverage. A provider’s home base does not limit these results.
          </p>
        </section>
        <div className="section-label results-label">
          <h2>
            {loading
              ? 'Finding providers…'
              : `${results.length} ${results.length === 1 ? 'provider' : 'providers'} for you`}
          </h2>
          <p className="hint">Browse. Compare. Connect.</p>
        </div>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {!loading && !results.length && (
          <section className="empty-state">
            <MapPin size={30} />
            <h2>A new connection is on its way.</h2>
            <p>No published profiles match these filters yet.</p>
            {usingLocal && (
              <Link className="btn-primary" to="/dashboard/preview">
                Publish your demo profile
              </Link>
            )}
          </section>
        )}
        <div className="market-grid">
          {results.map(({ profile: p }) => (
            <article className={`listing-card theme-${p.accent}`} key={p.slug}>
              <div className="listing-cover">
                <span className="category-badge">
                  <CategoryIcon category={p.category} size={13} />
                  {categories[p.category]}
                </span>
                <div className="listing-avatar">
                  {p.photo ? <img src={p.photo} alt="" /> : p.name[0]}
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
                <p className="tiny">New on Service Link · No reviews yet</p>
                <div className="listing-price">{p.services[0] && priceLabel(p.services[0])}</div>
                <div className="listing-actions">
                  <Link className="btn-secondary" to={`/p/${p.slug}`}>
                    View profile
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
                    Compare
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
        {selected.length > 0 && (
          <aside className="compare-bar">
            <span>
              {selected.length}/3 selected · {categories[selected[0].profile.category]}
            </span>
            <button className="btn-primary" onClick={() => setShowCompare((v) => !v)}>
              {showCompare ? 'Hide comparison' : 'Compare providers'}
            </button>
            <button
              className="icon-btn"
              aria-label="Clear comparison"
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
            <h2>Find the right fit</h2>
            <p className="hint">
              Compare up to three providers in one category. Services and packages may have
              different inclusions.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    {selected.map(({ profile: p }) => (
                      <th key={p.slug}>
                        <Link to={`/p/${p.slug}`}>{p.name}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    'Services & prices',
                    'Service coverage',
                    'Experience',
                    'Languages',
                    'Reviews',
                  ].map((label, i) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {selected.map(({ profile: p }) => (
                        <td key={p.slug}>
                          {i === 0
                            ? p.services.map((s) => (
                                <p key={s.id}>
                                  <strong>{s.name}</strong>
                                  <br />
                                  {priceLabel(s)}
                                  {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}
                                  <br />
                                  {s.description}
                                </p>
                              ))
                            : i === 1
                              ? coverageLabels(p.coverage).join('; ')
                              : i === 2
                                ? `${p.experienceYears} years`
                                : i === 3
                                  ? p.languages || 'Not specified'
                                  : 'New on Service Link'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="market-footer">Service Link · A Digital Sambal product</p>
      </main>
    </div>
  );
}
