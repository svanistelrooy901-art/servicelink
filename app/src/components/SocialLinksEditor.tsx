import { t } from '../i18n';
import { SocialIcon } from './SocialLinks';
import {
  emptySocialLinks,
  socialPlatforms,
  validSocialLink,
  type SocialPlatform,
} from '../lib/social';
import type { SocialLinks } from '../lib/types';
export function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLinks;
  onChange: (value: SocialLinks) => void;
}) {
  const links = value ?? emptySocialLinks();
  return (
    <section className="panel social-editor">
      <h2>{t('A little more of you')}</h2>
      <p className="hint">
        {t('Add your Facebook, Instagram or Threads link. Empty links stay hidden.')}
      </p>
      {(Object.keys(socialPlatforms) as SocialPlatform[]).map((key) => (
        <div key={key}>
          <label htmlFor={`social-${key}`} className="social-field-label">
            <SocialIcon platform={key} />
            {t('{name} link', { name: socialPlatforms[key].label })}
          </label>
          <input
            id={`social-${key}`}
            type="url"
            inputMode="url"
            maxLength={500}
            value={links[key]}
            placeholder={socialPlatforms[key].placeholder}
            aria-invalid={!validSocialLink(key, links[key])}
            aria-describedby={!validSocialLink(key, links[key]) ? `social-${key}-error` : undefined}
            onChange={(e) => onChange({ ...links, [key]: e.target.value.trim() })}
          />
          {!validSocialLink(key, links[key]) && (
            <p id={`social-${key}-error`} className="error-text">
              {t('Use a full https:// {name} link.', { name: socialPlatforms[key].label })}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
