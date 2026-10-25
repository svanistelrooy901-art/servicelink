import { isMediaReference } from './mediaReference.ts';
import type { GalleryPicture } from './types.ts';
export const MAX_GALLERY_PICTURES = 8;
export const GALLERY_IMAGE_LIMIT = 120000;
export function galleryErrors(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_GALLERY_PICTURES)
    return ['Keep your gallery to 8 pictures.'];
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
