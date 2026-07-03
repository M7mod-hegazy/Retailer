// Converts an arbitrary image (photo, logo, banner) into a high-contrast 1-bit
// bitmap suitable for thermal printer heads, which can't dither grayscale —
// anything not near-pure-black just disappears on paper. This runs client-side
// BEFORE the receipt HTML is serialized/printed, so the printed document embeds
// the already-processed pure black/white data URI.
//
// Must never break printing: any failure (image fails to load, canvas
// unavailable, tainted-canvas security error, …) resolves the ORIGINAL src
// unchanged rather than rejecting.

const cache = new Map();

function cacheKey(src, threshold) {
  return `${threshold}::${src}`;
}

/**
 * @param {string} src - data URI or resolved URL of the source image.
 * @param {{threshold?: number}} opts - luminance threshold (0..1); pixels
 *   darker than this become pure black, everything else becomes pure white.
 * @returns {Promise<string>} data URI of the processed (or original) image.
 */
export function toThermalBitmap(src, { threshold = 0.55 } = {}) {
  if (!src) return Promise.resolve(src);
  const key = cacheKey(src, threshold);
  if (cache.has(key)) return cache.get(key);

  const promise = new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(src); return; }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(src); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            const alpha = a / 255;
            // Keep alpha as white: transparent pixels blend toward white before thresholding.
            const lum = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * alpha + (1 - alpha);
            const v = lum < threshold ? 0 : 255;
            data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    } catch {
      resolve(src);
    }
  });

  cache.set(key, promise);
  return promise;
}

/** Test/debug helper: clear the in-memory processed-image cache. */
export function clearThermalBitmapCache() {
  cache.clear();
}
