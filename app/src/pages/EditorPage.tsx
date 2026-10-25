import { useState } from 'react';
import { Plus, Trash2, Upload, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../hooks/useAppStore';
import { ProfilePresentation } from '../components/ProfilePresentation';
import { CoverageSelector } from '../components/CoverageSelector';
import { BannerEditor } from '../components/BannerEditor';
import { categories, type Service } from '../lib/types';
import { normalizeSlug } from '../lib/profile';
import { compressProfilePhoto } from '../lib/media';
import { usingLocal } from '../lib/config';
export function EditorPage({ section }: { section: 'profile' | 'services' | 'coverage' }) {
  const { profile: p, update, busy } = useAppStore();
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState('');
  if (!p) return null;
  const titles = {
    profile: [
      'Make a great introduction.',
      'Tell your story. Help customers get to know the person behind the service.',
    ],
    services: [
      'Good work deserves a clear offer.',
      'Keep it simple: what you do, what’s included and what it costs.',
    ],
    coverage: [
      'Where can you make a difference?',
      'Choose the places you serve. Customers will find you by service coverage.',
    ],
  };
  const changeService = (id: string, patch: Partial<Service>) =>
    update({ services: p.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {section === 'profile'
              ? '01 · YOUR STORY'
              : section === 'services'
                ? '02 · YOUR SERVICES'
                : '03 · YOUR REACH'}
          </span>
          <h1>{titles[section][0]}</h1>
          <p>{titles[section][1]}</p>
        </div>
      </div>
      <div className="editor-grid">
        <fieldset className="editor-fields" disabled={busy || mediaBusy}>
          {section === 'profile' && (
            <>
              <section className="panel">
                <h2>The face behind the service</h2>
                <div className="photo-editor">
                  <div className="editor-avatar">
                    {p.photo ? (
                      <img src={p.photo} alt="Your portrait" />
                    ) : (
                      <span>{p.name[0] || 'Y'}</span>
                    )}
                  </div>
                  <div>
                    <label
                      className={`btn-secondary upload-label ${!usingLocal ? 'disabled' : ''}`}
                    >
                      <Upload size={16} />
                      {mediaBusy ? 'Preparing photo…' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!usingLocal || mediaBusy}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setMediaBusy(true);
                          setMediaError('');
                          try {
                            update({ photo: await compressProfilePhoto(f) });
                          } catch (e) {
                            setMediaError(
                              e instanceof Error ? e.message : 'Unable to prepare image.',
                            );
                          } finally {
                            setMediaBusy(false);
                          }
                        }}
                      />
                    </label>
                    {p.photo && (
                      <button className="text-btn" onClick={() => update({ photo: '' })}>
                        Remove
                      </button>
                    )}
                    <p className="tiny">JPG, PNG or WebP · resized & compressed automatically.</p>
                    {!usingLocal && (
                      <p className="tiny">
                        Cloud photo uploads need the separate SL R2 integration.
                      </p>
                    )}
                  </div>
                </div>
                {mediaError && (
                  <p role="alert" className="error-text">
                    {mediaError}
                  </p>
                )}
                <div className="form-grid">
                  <label>
                    Display name
                    <input
                      maxLength={80}
                      value={p.name}
                      onChange={(e) => update({ name: e.target.value })}
                      autoComplete="name"
                      placeholder="How customers know you"
                    />
                  </label>
                  <label>
                    Service category
                    <select
                      value={p.category}
                      onChange={(e) => update({ category: e.target.value as typeof p.category })}
                    >
                      {Object.entries(categories).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Your headline
                  <input
                    maxLength={120}
                    value={p.headline}
                    onChange={(e) => update({ headline: e.target.value })}
                    placeholder="A short line about what you do best"
                  />
                  <span className="tiny">Make it personal. Make it clear.</span>
                </label>
                <label>
                  About you
                  <textarea
                    maxLength={1500}
                    rows={5}
                    value={p.bio}
                    onChange={(e) => update({ bio: e.target.value })}
                    placeholder="Your approach, experience and who you help…"
                  />
                  <span className="tiny">{p.bio.length}/1500</span>
                </label>
              </section>
              <section className="panel">
                <h2>A few helpful details</h2>
                <div className="form-grid">
                  <label>
                    Based in (city only)
                    <input
                      maxLength={100}
                      value={p.base}
                      onChange={(e) => update({ base: e.target.value })}
                      placeholder="e.g. George Town, Pulau Pinang"
                    />
                  </label>
                  <label>
                    Years of experience
                    <input
                      type="number"
                      min={0}
                      max={70}
                      value={p.experienceYears}
                      onChange={(e) => update({ experienceYears: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Languages
                  <input
                    maxLength={120}
                    value={p.languages}
                    onChange={(e) => update({ languages: e.target.value })}
                    placeholder="Bahasa Melayu, English…"
                  />
                </label>
                <label>
                  Profile link
                  <div className="slug-field">
                    <span>/p/</span>
                    <input
                      aria-label="Profile link"
                      maxLength={60}
                      value={p.slug}
                      onChange={(e) => update({ slug: normalizeSlug(e.target.value) })}
                      placeholder="your-name"
                    />
                  </div>
                  <span className="tiny">
                    Changing your published link retires the old link when you publish again.
                  </span>
                </label>
                <label>
                  WhatsApp number
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={40}
                    value={p.whatsapp}
                    onChange={(e) => update({ whatsapp: e.target.value })}
                    placeholder="e.g. +60 12 345 6789"
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={p.showWhatsapp}
                    onChange={(e) => update({ showWhatsapp: e.target.checked })}
                  />
                  Show my WhatsApp number publicly
                </label>
                <p className="tiny">
                  Only enable this if you want customers to contact you at this number.
                </p>
              </section>
              <BannerEditor profile={p} onChange={update} />
              <section className="panel">
                <h2>Your colour, your character</h2>
                <div className="theme-options">
                  {(['forest', 'plum', 'ocean'] as const).map((t) => (
                    <button
                      type="button"
                      aria-pressed={p.accent === t}
                      className={`theme-option theme-${t} ${p.accent === t ? 'selected' : ''}`}
                      key={t}
                      onClick={() => update({ accent: t })}
                    >
                      <span />
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </section>
              <Link className="editor-next" to="/dashboard/services">
                Next: add your services
                <ArrowRight size={17} />
              </Link>
            </>
          )}
          {section === 'services' && (
            <>
              <section className="panel">
                <div className="section-label">
                  <div>
                    <h2>Your service catalogue</h2>
                    <p className="hint">A clear offer helps customers choose.</p>
                  </div>
                  <span className="count-badge">{p.services.length}/20</span>
                </div>
              </section>
              {p.services.map((s, i) => (
                <section className="panel service-editor" key={s.id}>
                  <div className="section-label">
                    <span className="eyebrow">SERVICE {String(i + 1).padStart(2, '0')}</span>
                    <button
                      className="icon-btn"
                      aria-label={`Delete service ${i + 1}`}
                      onClick={() => update({ services: p.services.filter((x) => x.id !== s.id) })}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <label>
                    Service name
                    <input
                      maxLength={100}
                      value={s.name}
                      onChange={(e) => changeService(s.id, { name: e.target.value })}
                      placeholder="e.g. Weekend home cleaning"
                    />
                  </label>
                  <label>
                    What’s included?
                    <textarea
                      maxLength={600}
                      rows={3}
                      value={s.description}
                      onChange={(e) => changeService(s.id, { description: e.target.value })}
                      placeholder="What will customers get?"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Price basis
                      <select
                        value={s.priceBasis}
                        onChange={(e) =>
                          changeService(s.id, {
                            priceBasis: e.target.value as Service['priceBasis'],
                            ...(e.target.value === 'quote' ? { price: null } : {}),
                          })
                        }
                      >
                        {['hour', 'session', 'day', 'package', 'quote'].map((v) => (
                          <option value={v} key={v}>
                            {v === 'quote' ? 'Request a quote' : `Per ${v}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    {s.priceBasis !== 'quote' && (
                      <label>
                        Price (RM)
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step="0.01"
                          value={s.price ?? ''}
                          onChange={(e) =>
                            changeService(s.id, {
                              price: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <div className="form-grid">
                    <label>
                      Duration (minutes, optional)
                      <input
                        type="number"
                        min={15}
                        max={43200}
                        step={1}
                        value={s.durationMinutes ?? ''}
                        placeholder="Varies / discuss first"
                        onChange={(e) =>
                          changeService(s.id, {
                            durationMinutes: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Service location
                      <select
                        value={s.delivery}
                        onChange={(e) =>
                          changeService(s.id, { delivery: e.target.value as Service['delivery'] })
                        }
                      >
                        <option value="in-person">In person</option>
                        <option value="online">Online</option>
                        <option value="both">In person & online</option>
                      </select>
                    </label>
                  </div>
                </section>
              ))}
              <button
                className="add-service"
                disabled={p.services.length >= 20}
                onClick={() =>
                  update({
                    services: [
                      ...p.services,
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        description: '',
                        price: null,
                        priceBasis: 'quote',
                        durationMinutes: null,
                        delivery: 'in-person',
                      },
                    ],
                  })
                }
              >
                <Plus size={19} />
                Add a service
              </button>
              <Link className="editor-next" to="/dashboard/coverage">
                Next: choose your coverage
                <ArrowRight size={17} />
              </Link>
            </>
          )}
          {section === 'coverage' && (
            <>
              <section className="panel">
                <h2>Good connections, in the right places</h2>
                <CoverageSelector
                  value={p.coverage}
                  onChange={(coverage) => update({ coverage })}
                />
              </section>
              <Link className="editor-next" to="/dashboard/preview">
                Next: preview your profile
                <ArrowRight size={17} />
              </Link>
            </>
          )}
        </fieldset>
        <aside className="live-preview">
          <div className="preview-heading">
            <span className="eyebrow">LIVE PREVIEW</span>
            <span className="live-indicator">Updates as you type</span>
          </div>
          <div className="phone-shell">
            <div className="phone-address">servicelink · /p/{p.slug || 'your-name'}</div>
            <ProfilePresentation profile={p} preview />
          </div>
          <p className="tiny">The same design your customers will see.</p>
        </aside>
      </div>
    </>
  );
}
