import { t } from '../i18n';
import { MediaImage } from './MediaImage';
import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { GalleryPicture } from '../lib/types';

export function ProfileGallery({
  pictures = [],
  name,
}: {
  pictures?: GalleryPicture[];
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!open || pictures.length < 3 || !node) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = previous;
    };
  }, [open, pictures.length]);
  if (!pictures.length) return null;
  const alt = (p: GalleryPicture, index: number) =>
    p.caption ||
    t('{name} · work example {number}', { name: name || t('Provider'), number: index + 1 });
  return (
    <section className="public-section profile-gallery">
      <div className="section-label">
        <h2>{t('A glimpse of my work')}</h2>
        {pictures.length > 2 && (
          <button
            type="button"
            className="gallery-more"
            aria-label={t('More gallery pictures')}
            onClick={() => setOpen(true)}
          >
            {t('More')} <span>+{pictures.length - 2}</span>
          </button>
        )}
      </div>
      <div className="gallery-teasers" data-testid="gallery-teasers">
        {pictures.slice(0, 2).map((p, i) => (
          <MediaImage key={p.id} src={p.src} alt={alt(p, i)} loading="lazy" draggable={false} />
        ))}
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-labelledby={title}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.target === e.currentTarget &&
            (e.clientX < box.left ||
              e.clientX > box.right ||
              e.clientY < box.top ||
              e.clientY > box.bottom)
          )
            setOpen(false);
        }}
      >
        <header className="gallery-dialog-header">
          <div>
            <span className="eyebrow">{t('A GLIMPSE OF MY WORK')}</span>
            <h2 id={title}>
              {t('Gallery')}{' '}
              <small>
                {pictures.length} {t('pictures')}
              </small>
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            className="icon-btn"
            aria-label={t('Close gallery')}
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </header>
        <div className="gallery-modal-grid">
          {open &&
            pictures.map((p, i) => (
              <figure key={p.id}>
                <MediaImage src={p.src} alt={alt(p, i)} loading="lazy" draggable={false} />
                {p.caption && <figcaption>{p.caption}</figcaption>}
              </figure>
            ))}
        </div>
      </dialog>
    </section>
  );
}
