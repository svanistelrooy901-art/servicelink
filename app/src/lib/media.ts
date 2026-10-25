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
export const compressProfilePhoto = (file: File) => compressImage(file, 480, 180000);
export const compressProfileBanner = (file: File) => compressImage(file, 1600, 220000);
export const compressGalleryPicture = (file: File) => compressImage(file, 1200, 120000);
