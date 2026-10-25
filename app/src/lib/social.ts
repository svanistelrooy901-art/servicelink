import type { SocialLinks } from './types.ts';

export const socialPlatforms = {
  facebook: {
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/yourpage',
    host: /^(?:www\.|m\.)?facebook\.com$|^(?:www\.)?fb\.com$/i,
  },
  instagram: {
    label: 'Instagram',
    placeholder: 'https://www.instagram.com/yourname',
    host: /^(?:www\.)?instagram\.com$/i,
  },
  threads: {
    label: 'Threads',
    placeholder: 'https://www.threads.com/@yourname',
    host: /^(?:www\.)?threads\.(?:com|net)$/i,
  },
} as const;
export type SocialPlatform = keyof SocialLinks;
export const emptySocialLinks = (): SocialLinks => ({ facebook: '', instagram: '', threads: '' });
export function validSocialLink(platform: SocialPlatform, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500 || /[\s\\<>]/.test(value)) return false;
  if (!value) return true;
  try {
    // Validate the literal host too: encoded hosts, credentials and lookalikes are rejected.
    const match = /^https:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(value);
    if (!match || !socialPlatforms[platform].host.test(match[1])) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
