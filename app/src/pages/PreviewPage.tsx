import { t } from '../i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Globe, ExternalLink, Copy, Check } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { ProfilePresentation } from '../components/ProfilePresentation';
import { validateForPublish } from '../lib/profile';
import { usingLocal } from '../lib/config';
export function PreviewPage() {
  const {
    profile: p,
    workspace,
    busy,
    mediaBusy,
    publish,
    unpublish,
    unpublishedChanges,
  } = useAppStore();
  const [width, setWidth] = useState<'mobile' | 'desktop'>('mobile');
  const [copied, setCopied] = useState(false);
  if (!p) return null;
  const errors = validateForPublish(p);
  const live = workspace?.published;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('04 · READY WHEN YOU ARE')}</span>
          <h1>{t('A final look. A fresh start.')}</h1>
          <p>{t('Review your profile, then make your latest work public.')}</p>
        </div>
      </div>
      <section className="publish-panel panel">
        <div>
          <h2>{live ? t('Your profile is published') : t('Your profile is still a draft')}</h2>
          <p className="hint">
            {unpublishedChanges
              ? t('You have changes that are not published yet.')
              : live
                ? t('Save drafts freely. Only Publish changes what customers see.')
                : t('Your draft stays private until you publish.')}
          </p>
          {usingLocal && (
            <p className="tiny">{t('Demo publication stays on this browser and device.')}</p>
          )}
          {live && (
            <div className="published-link">
              <Link to={`/p/${live.slug}`} target="_blank">
                {t('/p/')}
                {live.slug}
                <ExternalLink size={14} />
              </Link>
              <button
                className="icon-btn"
                aria-label={t('Copy published profile link')}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL(`/p/${live.slug}`, window.location.origin).href,
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>
        <div className="publish-actions">
          <button disabled={busy || mediaBusy} className="btn-primary" onClick={publish}>
            <Globe size={17} />
            {live ? t('Publish updates') : t('Publish profile')}
          </button>
          {live && (
            <button disabled={busy || mediaBusy} className="text-btn" onClick={unpublish}>
              {t('Unpublish profile')}
            </button>
          )}
        </div>
      </section>
      {errors.length > 0 && (
        <div className="publish-checklist">
          <strong>{t('A little more to finish before publishing')}</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
          </ul>
          <Link to="/dashboard/profile">
            {t('Continue editing')}
            <Arrow />
          </Link>
        </div>
      )}
      <div className="preview-toolbar">
        <span>
          <Eye size={16} />
          {t('Draft preview · actions disabled')}
        </span>
        <div className="segmented">
          <button aria-pressed={width === 'mobile'} onClick={() => setWidth('mobile')}>
            {t('Mobile')}
          </button>
          <button aria-pressed={width === 'desktop'} onClick={() => setWidth('desktop')}>
            {t('Desktop')}
          </button>
        </div>
      </div>
      <div className={`standalone-preview ${width}`}>
        <ProfilePresentation profile={p} preview />
      </div>
    </>
  );
}
function Arrow() {
  return <span aria-hidden="true"> →</span>;
}
