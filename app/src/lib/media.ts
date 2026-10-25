export async function compressProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('Choose a JPG, PNG or WebP under 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const output = canvas.toDataURL('image/webp', quality);
      if (output.startsWith('data:image/webp;') && output.length <= 180000) return output;
    }
    throw new Error('This photo is too detailed. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
