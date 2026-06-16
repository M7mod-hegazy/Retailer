import { useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, X } from "lucide-react";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

/**
 * Inline product-image thumbnail for the item-entry row.
 *
 * Renders nothing when the selected item has no image (so the row reclaims the
 * space). When an image exists it shows a larger (~64px) clickable square.
 * Clicking opens a big preview: the host `onView` (e.g. POS gallery) if given,
 * otherwise a built-in fullscreen lightbox — so every page gets a large modal.
 *
 * @param {object|null} item
 * @param {(images: string[]) => void} [onView]
 * @param {number} [size]
 */
export default function EntryItemThumb({ item, onView, size = 64, className = "" }) {
  const [lightbox, setLightbox] = useState(false);
  if (!item) return null;
  const raw =
    item.primary_image_url || item.image_url || item.image ||
    (Array.isArray(item.image_urls) && item.image_urls.length ? item.image_urls[0] : null);
  if (!raw) return null;

  const src = resolveImageUrl(raw);
  const images =
    Array.isArray(item.image_urls) && item.image_urls.length ? item.image_urls : [raw];

  const handleClick = () => {
    if (onView) onView(images);
    else setLightbox(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="عرض صورة الصنف"
        style={{ width: size, height: size }}
        className={`entry-thumb shrink-0 flex items-center justify-center ${className}`}
      >
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
        )}
      </button>

      {lightbox &&
        createPortal(
          <div
            onClick={() => setLightbox(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(2px)" }}
            className="flex items-center justify-center p-6"
          >
            <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
