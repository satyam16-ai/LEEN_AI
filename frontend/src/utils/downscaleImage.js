const SMALL_ENOUGH = 1.5 * 1024 * 1024;

/**
 * Shrink a phone photo to a JPEG whose long edge is at most `maxPx` before uploading it
 * (the server keeps 2000 px anyway). PDFs, small images and browsers that can't decode the
 * file go through untouched.
 */
export async function downscaleImage(file, maxPx = 2000) {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
