import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Upload, Check } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { ProfileCover } from './ProfileCover';
import { categories, type ProviderProfile } from '../lib/types';
import { compressProfileBanner } from '../lib/media';
import { mediaEnabled } from '../lib/config';

export function BannerEditor({
  profile: p,
  onChange,
  onProcessingChange,
}: {
  profile: ProviderProfile;
  onChange: (patch: Partial<ProviderProfile>) => void;
  onProcessingChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    onProcessingChange(preparing);
    return () => onProcessingChange(false);
  }, [preparing, onProcessingChange]);
  return (
    <section className="panel banner-editor">
      <div>
        <h2>{t('Your profile banner')}</h2>
        <p className="hint">{t('Use a service template, or add your own image.')}</p>
      </div>
      <div
        className={`banner-preview provider-profile theme-${p.accent}`}
        aria-label={t('Banner preview')}
      >
        <ProfileCover profile={p} />
      </div>
      <div className="banner-actions">
        <button
          type="button"
          className="btn-secondary"
          aria-pressed={!p.banner}
          disabled={preparing}
          onClick={() => {
            setError('');
            onChange({ banner: '', bannerPosition: 50 });
          }}
        >
          {!p.banner ? <Check size={16} /> : <CategoryIcon category={p.category} size={16} />}
          {t('Use service template')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!mediaEnabled || preparing}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          {preparing ? t('Preparing banner…') : p.banner ? t('Replace banner') : t('Upload banner')}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={t('Banner image file')}
          aria-describedby="banner-size-guide"
          tabIndex={-1}
          disabled={!mediaEnabled || preparing}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setPreparing(true);
            setError('');
            try {
              onChange({ banner: await compressProfileBanner(file), bannerPosition: 50 });
            } catch (e) {
              setError(e instanceof Error ? e.message : t('Unable to prepare banner.'));
            } finally {
              setPreparing(false);
            }
          }}
        />
      </div>
      <p className="tiny banner-template-note">
        <CategoryIcon category={p.category} size={16} />
        {t(categories[p.category])} {t('template · icon follows your service category.')}
      </p>
      <p className="hint" id="banner-size-guide">
        <strong>{t('Recommended: 1600 × 600 px (8:3).')}</strong>{' '}
        {t(
          'JPG, PNG or WebP, up to 8 MB. Resized and compressed automatically. Keep important details near the centre; other shapes are cropped to fit.',
        )}
      </p>
      {p.banner && (
        <div className="banner-position">
          <label htmlFor="banner-focus">{t('Banner vertical position')}</label>
          <input
            id="banner-focus"
            type="range"
            min={0}
            max={100}
            step={1}
            value={p.bannerPosition ?? 50}
            disabled={preparing}
            onChange={(e) => onChange({ bannerPosition: Number(e.target.value) })}
          />
          <div className="tiny">
            <span>{t('Show top')}</span>
            <span>{t('Show bottom')}</span>
          </div>
          <button
            type="button"
            className="text-btn"
            disabled={preparing}
            onClick={() => {
              setError('');
              onChange({ banner: '', bannerPosition: 50 });
            }}
          >
            {t('Remove banner')}
          </button>
        </div>
      )}
      {preparing && (
        <p role="status" className="tiny">
          {t('Preparing your banner…')}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {t(error)}
        </p>
      )}
      {!mediaEnabled && (
        <p className="tiny">
          {t(
            'Image uploads will be available after Service Link media storage is connected. Service templates work now.',
          )}
        </p>
      )}
      <p className="tiny">
        {t(
          'Save draft to keep changes. Publish updates when you’re ready for customers to see them.',
        )}
      </p>
    </section>
  );
}
