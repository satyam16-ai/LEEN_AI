import { fetchBlobUrl } from '@/utils/blobUrl';

/**
 * Photos on the board (a photo doubt's question). They are private, so they are fetched
 * with the student's session rather than by URL. Tests swap the loader.
 */
let loader = null;

export function setImageLoader(fn) {
  loader = fn;
}

function loadThroughApi(url) {
  return fetchBlobUrl(url).then(
    (src) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(src);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(src);
          reject(new Error('The photo could not be shown.'));
        };
        image.src = src;
      })
  );
}

export function loadBoardImage(url) {
  return (loader ?? loadThroughApi)(url);
}
