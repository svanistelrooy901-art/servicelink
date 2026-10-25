import { usingLocal, mediaEnabled } from './config';
import { getSupabaseClient } from './supabase';
async function compressImage(file: File, maxDimension: number, maxLength: number): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('Choose a JPG, PNG or WebP under 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('Could not read this image. Choose another JPG, PNG or WebP.');
    }
    if (!img.width || !img.height || img.width * img.height > 40000000)
      throw new Error('Choose an image smaller than 40 megapixels.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const output = canvas.toDataURL('image/webp', quality);
      if (output.startsWith('data:image/webp;') && output.length <= maxLength) return output;
    }
    throw new Error('This image is too detailed. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function prepare(
  file: File,
  kind: 'portrait' | 'banner' | 'gallery' | 'qr',
  dimension: number,
  limit: number,
) {
  const data = await compressImage(file, dimension, limit);
  if (usingLocal) return data;
  if (!mediaEnabled) throw new Error('Image uploads are not enabled yet.');
  const { data: session } = await getSupabaseClient().auth.getSession();
  if (!session.session) throw new Error('Sign in to upload pictures.');
  const bytes = Uint8Array.from(atob(data.split(',')[1]), (c) => c.charCodeAt(0));
  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
      'Content-Type': 'image/webp',
      'X-SL-Media-Kind': kind,
    },
    body: bytes,
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Unable to upload image.');
  return result.ref as string;
}
export const compressProfilePhoto = (file: File) => prepare(file, 'portrait', 480, 180000);
export const compressPaymentQR = (file: File) => prepare(file, 'qr', 480, 180000);
export const compressProfileBanner = (file: File) => prepare(file, 'banner', 1600, 220000);
export const compressGalleryPicture = (file: File) => prepare(file, 'gallery', 1200, 120000);
