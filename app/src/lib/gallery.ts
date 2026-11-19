import { isMediaReference } from './mediaReference.ts';
import type { GalleryPicture, PortfolioProject, ProviderProfile } from './types.ts';
export const MAX_GALLERY_PICTURES = 8;
export const GALLERY_IMAGE_LIMIT = 120000;
export function galleryErrors(value: unknown, limit = MAX_GALLERY_PICTURES): string[] {
  if (!Array.isArray(value) || value.length > limit) return ['Keep your gallery to 8 pictures.'];
  if (new Set(value.map((p) => p?.id)).size !== value.length)
    return ['Each gallery picture needs a unique identifier.'];
  for (const p of value) {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !p.id ||
      p.id.length > 80 ||
      typeof p.src !== 'string' ||
      (!isMediaReference(p.src) && !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(p.src)) ||
      p.src.length > GALLERY_IMAGE_LIMIT ||
      typeof p.caption !== 'string' ||
      p.caption.length > 140
    )
      return [
        'Use compressed WebP gallery pictures under 90 KB, with captions up to 140 characters.',
      ];
  }
  return [];
}
export function moveGalleryPicture(
  pictures: GalleryPicture[],
  index: number,
  step: -1 | 1,
): GalleryPicture[] {
  const next = [...pictures],
    target = index + step;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const MAX_PORTFOLIO_PROJECTS = 6;
export const MAX_PORTFOLIO_PICTURES = 24;

export function profileProjects(profile: ProviderProfile): PortfolioProject[] {
  if (profile.portfolio) return profile.portfolio;
  return profile.gallery?.length
    ? [
        {
          id: 'legacy-work',
          title: 'Past work',
          description: '',
          serviceId: '',
          pictures: profile.gallery,
        },
      ]
    : [];
}

export function portfolioErrors(value: unknown, serviceIds: Set<string>): string[] {
  if (!Array.isArray(value) || value.length > MAX_PORTFOLIO_PROJECTS)
    return ['Use up to 6 portfolio projects.'];
  const ids = new Set<string>();
  let pictures = 0;
  for (const project of value) {
    if (
      !project ||
      typeof project.id !== 'string' ||
      !project.id ||
      project.id.length > 80 ||
      ids.has(project.id) ||
      typeof project.title !== 'string' ||
      !project.title.trim() ||
      project.title.length > 100 ||
      typeof project.description !== 'string' ||
      project.description.length > 600 ||
      typeof project.serviceId !== 'string' ||
      (project.serviceId && !serviceIds.has(project.serviceId)) ||
      !Array.isArray(project.pictures)
    )
      return ['Give each project a title and link only to a service in your catalogue.'];
    ids.add(project.id);
    pictures += project.pictures.length;
    if (pictures > MAX_PORTFOLIO_PICTURES) return ['Use up to 24 portfolio pictures.'];
    const errors = galleryErrors(project.pictures, MAX_PORTFOLIO_PICTURES);
    if (errors.length) return errors;
  }
  return [];
}
