import { t } from '../i18n';
import { MediaImage } from '../components/MediaImage';
import { useState } from 'react';
import { Plus, Trash2, Upload, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../hooks/useAppStore';
import { ProfilePresentation } from '../components/ProfilePresentation';
import { CoverageSelector } from '../components/CoverageSelector';
import { BannerEditor } from '../components/BannerEditor';
import { GalleryEditor } from '../components/GalleryEditor';
import { SocialLinksEditor } from '../components/SocialLinksEditor';
import { categories, type Service } from '../lib/types';
import { normalizeSlug } from '../lib/profile';
import { compressProfilePhoto } from '../lib/media';
import { mediaEnabled } from '../lib/config';
export function EditorPage({ section }: { section: 'profile' | 'services' | 'coverage' }) {
  const { profile: p, update, busy, mediaBusy, setMediaBusy } = useAppStore();
  const [mediaError, setMediaError] = useState('');
  if (!p) return null;
  const titles = {
    profile: [
      t('Make a great introduction.'),
      t('Tell your story. Help customers get to know the person behind the service.'),
    ],
    services: [
      t('Good work deserves a clear offer.'),
      t('Keep it simple: what you do, what’s included and what it costs.'),
    ],
    coverage: [
      t('Where can you make a difference?'),
      t('Choose the places you serve. Customers will find you by service coverage.'),
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
              ? t('01 · YOUR STORY')
              : section === 'services'
                ? t('02 · YOUR SERVICES')
                : t('03 · YOUR REACH')}
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
                <h2>{t('The face behind the service')}</h2>
                <div className="photo-editor">
                  <div className="editor-avatar">
                    {p.photo ? (
                      <MediaImage src={p.photo} alt={t('Your portrait')} />
                    ) : (
                      <span>{p.name[0] || 'Y'}</span>
                    )}
                  </div>
                  <div>
                    <label
                      className={`btn-secondary upload-label ${!mediaEnabled ? 'disabled' : ''}`}
                    >
                      <Upload size={16} />
                      {mediaBusy ? t('Preparing photo…') : t('Upload photo')}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!mediaEnabled || mediaBusy}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setMediaBusy(true);
                          setMediaError('');
                          try {
                            update({ photo: await compressProfilePhoto(f) });
                          } catch (e) {
                            setMediaError(
                              e instanceof Error ? e.message : t('Unable to prepare image.'),
                            );
                          } finally {
                            setMediaBusy(false);
                          }
                        }}
                      />
                    </label>
                    {p.photo && (
                      <button className="text-btn" onClick={() => update({ photo: '' })}>
                        {t('Remove')}
                      </button>
                    )}
                    <p className="tiny">
                      {t('JPG, PNG or WebP · resized & compressed automatically.')}
                    </p>
                    {!mediaEnabled && (
                      <p className="tiny">
                        {t('Cloud photo uploads need the separate SL R2 integration.')}
                      </p>
                    )}
                  </div>
                </div>
                {mediaError && (
                  <p role="alert" className="error-text">
                    {t(mediaError)}
                  </p>
                )}
                <div className="form-grid">
                  <label>
                    {t('Display name')}
                    <input
                      maxLength={80}
                      value={p.name}
                      onChange={(e) => update({ name: e.target.value })}
                      autoComplete="name"
                      placeholder={t('How customers know you')}
                    />
                  </label>
                  <label>
                    {t('Service category')}
                    <select
                      value={p.category}
                      onChange={(e) => update({ category: e.target.value as typeof p.category })}
                    >
                      {Object.entries(categories).map(([id, label]) => (
                        <option key={id} value={id}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  {t('Your headline')}
                  <input
                    maxLength={120}
                    value={p.headline}
                    onChange={(e) => update({ headline: e.target.value })}
                    placeholder={t('A short line about what you do best')}
                  />
                  <span className="tiny">{t('Make it personal. Make it clear.')}</span>
                </label>
                <label>
                  {t('About you')}
                  <textarea
                    maxLength={1500}
                    rows={5}
                    value={p.bio}
                    onChange={(e) => update({ bio: e.target.value })}
                    placeholder={t('Your approach, experience and who you help…')}
                  />
                  <span className="tiny">{p.bio.length}/1500</span>
                </label>
              </section>
              <section className="panel">
                <h2>{t('A few helpful details')}</h2>
                <div className="form-grid">
                  <label>
                    {t('Based in (city only)')}
                    <input
                      maxLength={100}
                      value={p.base}
                      onChange={(e) => update({ base: e.target.value })}
                      placeholder={t('e.g. George Town, Pulau Pinang')}
                    />
                  </label>
                  <label>
                    {t('Years of experience')}
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
                  {t('Languages')}
                  <input
                    maxLength={120}
                    value={p.languages}
                    onChange={(e) => update({ languages: e.target.value })}
                    placeholder={t('Bahasa Melayu, English…')}
                  />
                </label>
                <label>
                  {t('Profile link')}
                  <div className="slug-field">
                    <span>{t('/p/')}</span>
                    <input
                      aria-label={t('Profile link')}
                      maxLength={60}
                      value={p.slug}
                      onChange={(e) => update({ slug: normalizeSlug(e.target.value) })}
                      placeholder={t('your-name')}
                    />
                  </div>
                  <span className="tiny">
                    {t('Changing your published link retires the old link when you publish again.')}
                  </span>
                </label>
                <label>
                  {t('WhatsApp number')}
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={40}
                    value={p.whatsapp}
                    onChange={(e) => update({ whatsapp: e.target.value })}
                    placeholder={t('e.g. +60 12 345 6789')}
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={p.showWhatsapp}
                    onChange={(e) => update({ showWhatsapp: e.target.checked })}
                  />
                  {t('Show my WhatsApp number publicly')}
                </label>
                <p className="tiny">
                  {t('Only enable this if you want customers to contact you at this number.')}
                </p>
              </section>
              <SocialLinksEditor value={p.social} onChange={(social) => update({ social })} />
              <BannerEditor profile={p} onChange={update} onProcessingChange={setMediaBusy} />
              <GalleryEditor
                pictures={p.gallery}
                onChange={(gallery) => update({ gallery })}
                onProcessingChange={setMediaBusy}
              />
              <section className="panel">
                <h2>{t('Your colour, your character')}</h2>
                <div className="theme-options">
                  {(['forest', 'plum', 'ocean'] as const).map((theme) => (
                    <button
                      type="button"
                      aria-pressed={p.accent === theme}
                      className={`theme-option theme-${theme} ${p.accent === theme ? 'selected' : ''}`}
                      key={theme}
                      onClick={() => update({ accent: theme })}
                    >
                      <span />
                      {t(theme[0].toUpperCase() + theme.slice(1))}
                    </button>
                  ))}
                </div>
              </section>
              <Link className="editor-next" to="/dashboard/services">
                {t('Next: add your services')}
                <ArrowRight size={17} />
              </Link>
            </>
          )}
          {section === 'services' && (
            <>
              <section className="panel">
                <div className="section-label">
                  <div>
                    <h2>{t('Your service catalogue')}</h2>
                    <p className="hint">{t('A clear offer helps customers choose.')}</p>
                  </div>
                  <span className="count-badge">{p.services.length}/20</span>
                </div>
              </section>
              {p.services.map((s, i) => (
                <section className="panel service-editor" key={s.id}>
                  <div className="section-label">
                    <span className="eyebrow">
                      {t('SERVICE')} {String(i + 1).padStart(2, '0')}
                    </span>
                    <button
                      className="icon-btn"
                      aria-label={t('Delete service {number}', { number: i + 1 })}
                      onClick={() => update({ services: p.services.filter((x) => x.id !== s.id) })}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <label>
                    {t('Service name')}
                    <input
                      maxLength={100}
                      value={s.name}
                      onChange={(e) => changeService(s.id, { name: e.target.value })}
                      placeholder={t('e.g. Weekend home cleaning')}
                    />
                  </label>
                  <label>
                    {t('What’s included?')}
                    <textarea
                      maxLength={600}
                      rows={3}
                      value={s.description}
                      onChange={(e) => changeService(s.id, { description: e.target.value })}
                      placeholder={t('What will customers get?')}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      {t('Price basis')}
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
                            {v === 'quote' ? t('Request a quote') : t(`Per ${v}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {s.priceBasis !== 'quote' && (
                      <label>
                        {t('Price (RM)')}
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
                      {t('Duration (minutes, optional)')}
                      <input
                        type="number"
                        min={15}
                        max={43200}
                        step={1}
                        value={s.durationMinutes ?? ''}
                        placeholder={t('Varies / discuss first')}
                        onChange={(e) =>
                          changeService(s.id, {
                            durationMinutes: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      {t('Service location')}
                      <select
                        value={s.delivery}
                        onChange={(e) =>
                          changeService(s.id, { delivery: e.target.value as Service['delivery'] })
                        }
                      >
                        <option value="in-person">{t('In person')}</option>
                        <option value="online">{t('Online')}</option>
                        <option value="both">{t('In person & online')}</option>
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
                {t('Add a service')}
              </button>
              <Link className="editor-next" to="/dashboard/coverage">
                {t('Next: choose your coverage')}
                <ArrowRight size={17} />
              </Link>
            </>
          )}
          {section === 'coverage' && (
            <>
              <section className="panel">
                <h2>{t('Good connections, in the right places')}</h2>
                <CoverageSelector
                  value={p.coverage}
                  onChange={(coverage) => update({ coverage })}
                />
              </section>
              <Link className="editor-next" to="/dashboard/preview">
                {t('Next: preview your profile')}
                <ArrowRight size={17} />
              </Link>
            </>
          )}
        </fieldset>
        <aside className="live-preview">
          <div className="preview-heading">
            <span className="eyebrow">{t('LIVE PREVIEW')}</span>
            <span className="live-indicator">{t('Updates as you type')}</span>
          </div>
          <div className="phone-shell">
            <div className="phone-address">
              {t('servicelink · /p/')}
              {p.slug || t('your-name')}
            </div>
            <ProfilePresentation profile={p} preview />
          </div>
          <p className="tiny">{t('The same design your customers will see.')}</p>
        </aside>
      </div>
    </>
  );
}
