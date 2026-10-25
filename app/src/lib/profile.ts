import { isMediaReference } from './mediaReference.ts';
import { categories, type ProviderProfile } from './types.ts';
import { coverageErrors } from './geography.ts';
import { normalizeMalaysiaWhatsapp } from './whatsappNumber.ts';
import { emptySocialLinks, socialPlatforms, validSocialLink } from './social.ts';
import { galleryErrors } from './gallery.ts';
export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
export const cloneProfile = (p: ProviderProfile): ProviderProfile => structuredClone(p);
// Existing local/cloud profiles predate optional banners; keep their drafts and publications.
export function withProfileDefaults(p: ProviderProfile): ProviderProfile {
  return {
    ...p,
    banner: p.banner ?? '',
    bannerPosition: p.bannerPosition ?? 50,
    social: { ...emptySocialLinks(), ...p.social },
    gallery: p.gallery ?? [],
  };
}
export function publicSnapshot(p: ProviderProfile): ProviderProfile {
  // Explicit allowlist: future private draft fields cannot leak through publication.
  return {
    name: p.name.trim(),
    slug: p.slug,
    headline: p.headline.trim(),
    category: p.category,
    bio: p.bio.trim(),
    base: p.base.trim(),
    experienceYears: p.experienceYears,
    languages: p.languages.trim(),
    whatsapp: p.showWhatsapp ? (normalizeMalaysiaWhatsapp(p.whatsapp) ?? '') : '',
    showWhatsapp: p.showWhatsapp,
    photo: p.photo,
    banner: p.banner ?? '',
    bannerPosition: p.bannerPosition ?? 50,
    social: {
      facebook: p.social?.facebook ?? '',
      instagram: p.social?.instagram ?? '',
      threads: p.social?.threads ?? '',
    },
    gallery: (p.gallery ?? []).map(({ id, src, caption }) => ({ id, src, caption })),
    accent: p.accent,
    coverage: p.coverage.map((c) => ({
      stateId: c.stateId,
      wholeState: c.wholeState,
      subdivisionIds: [...c.subdivisionIds],
    })),
    services: p.services.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      description: s.description.trim(),
      price: s.price,
      priceBasis: s.priceBasis,
      durationMinutes: s.durationMinutes,
      delivery: s.delivery,
    })),
  };
}
export function validateForPublish(p: ProviderProfile): string[] {
  const errors: string[] = [];
  if (!p.name.trim() || p.name.length > 80) errors.push('Add your name (up to 80 characters).');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || p.slug.length < 3 || p.slug.length > 60)
    errors.push('Choose a profile link with 3–60 letters, numbers or hyphens.');
  if (!Object.prototype.hasOwnProperty.call(categories, p.category))
    errors.push('Choose a service category.');
  if (!p.headline.trim() || p.headline.length > 120)
    errors.push('Add a short headline (up to 120 characters).');
  if (!p.bio.trim() || p.bio.length > 1500)
    errors.push('Add an introduction (up to 1,500 characters).');
  if (!Number.isInteger(p.experienceYears) || p.experienceYears < 0 || p.experienceYears > 70)
    errors.push('Check your years of experience.');
  if (!p.coverage.length) errors.push('Choose at least one service area.');
  errors.push(...coverageErrors(p.coverage));
  if (p.showWhatsapp && !normalizeMalaysiaWhatsapp(p.whatsapp))
    errors.push('Enter a valid Malaysian WhatsApp number or hide it.');
  if (!p.services.length) errors.push('Add at least one service.');
  if (p.services.length > 20) errors.push('Keep your catalogue to 20 services.');
  if (new Set(p.services.map((s) => s.id)).size !== p.services.length)
    errors.push('Each service needs a unique identifier.');
  for (const s of p.services) {
    if (!s.id || s.id.length > 80) errors.push('Each service needs a valid identifier.');
    if (!s.name.trim() || s.name.length > 100 || s.description.length > 600)
      errors.push('Give each service a name (up to 100 characters) and a short description.');
    if (
      !['hour', 'session', 'day', 'package', 'quote'].includes(s.priceBasis) ||
      (s.priceBasis !== 'quote' && s.price === null) ||
      (s.price !== null && (!Number.isFinite(s.price) || s.price < 0 || s.price > 100000))
    )
      errors.push(`Check the price for ${s.name || 'your service'}.`);
    if (
      s.durationMinutes !== null &&
      (!Number.isInteger(s.durationMinutes) || s.durationMinutes < 15 || s.durationMinutes > 43200)
    )
      errors.push('Use a duration between 15 and 43,200 minutes, or leave it empty.');
    if (!['in-person', 'online', 'both'].includes(s.delivery))
      errors.push('Choose a valid service location.');
  }
  if (
    p.photo &&
    !isMediaReference(p.photo) &&
    (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(p.photo) || p.photo.length > 180000)
  )
    errors.push('Use a compressed WebP profile photo under 130 KB.');
  if (!['forest', 'plum', 'ocean'].includes(p.accent))
    errors.push('Choose an available colour theme.');
  if (
    p.banner !== undefined &&
    (typeof p.banner !== 'string' ||
      (p.banner !== '' &&
        !isMediaReference(p.banner) &&
        (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(p.banner) || p.banner.length > 220000)))
  )
    errors.push('Use a compressed WebP banner under 165 KB.');
  if (
    p.bannerPosition !== undefined &&
    (!Number.isInteger(p.bannerPosition) || p.bannerPosition < 0 || p.bannerPosition > 100)
  )
    errors.push('Choose a banner position between 0 and 100.');
  if (p.base.length > 100 || p.languages.length > 120)
    errors.push('Keep your base and languages short.');
  if (p.social !== undefined) {
    if (!p.social || typeof p.social !== 'object' || Array.isArray(p.social))
      errors.push('Check your social media links.');
    else
      for (const platform of Object.keys(socialPlatforms) as (keyof typeof socialPlatforms)[])
        if (!validSocialLink(platform, p.social[platform]))
          errors.push(
            `Use a full https:// ${socialPlatforms[platform].label} link, or leave it empty.`,
          );
  }
  if (p.gallery !== undefined) errors.push(...galleryErrors(p.gallery));
  return [...new Set(errors)];
}
export function priceLabel(service: ProviderProfile['services'][number]) {
  if (service.priceBasis === 'quote' || service.price === null) return 'Request a quote';
  return `${new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(service.price)} / ${service.priceBasis}`;
}
