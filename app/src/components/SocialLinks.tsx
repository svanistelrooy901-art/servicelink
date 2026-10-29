import { t } from '../i18n';
import { Facebook, Instagram } from 'lucide-react';
import threadsIcon from '../assets/threads.svg';
import type { SocialLinks as Links } from '../lib/types';
import { socialPlatforms, validSocialLink, type SocialPlatform } from '../lib/social';
export function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === 'threads')
    return <img src={threadsIcon} width={19} height={19} alt="" aria-hidden="true" />;
  const Icon = platform === 'facebook' ? Facebook : Instagram;
  return <Icon size={20} aria-hidden="true" />;
}
export function SocialLinks({ links, preview }: { links?: Links; preview: boolean }) {
  const present = (Object.keys(socialPlatforms) as SocialPlatform[]).filter(
    (key) => links?.[key] && validSocialLink(key, links[key]),
  );
  if (!present.length) return null;
  return (
    <nav className="profile-social" aria-label={t('Social media')}>
      {present.map((key) =>
        preview ? (
          <button
            key={key}
            type="button"
            disabled
            aria-label={t('{name} profile (preview)', { name: socialPlatforms[key].label })}
          >
            <SocialIcon platform={key} />
          </button>
        ) : (
          <a
            key={key}
            href={links![key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('{name} profile', { name: socialPlatforms[key].label })}
            title={socialPlatforms[key].label}
          >
            <SocialIcon platform={key} />
          </a>
        ),
      )}
    </nav>
  );
}
