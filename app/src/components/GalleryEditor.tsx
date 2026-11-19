import { t } from '../i18n';
import { MediaImage } from './MediaImage';
import { useEffect, useId, useRef, useState } from 'react';
import { Images, Upload, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { compressGalleryPicture } from '../lib/media';
import { moveGalleryPicture } from '../lib/gallery';
import { mediaEnabled } from '../lib/config';
import type { GalleryPicture } from '../lib/types';

export function GalleryEditor({
  pictures = [],
  onChange,
  onProcessingChange,
  projectLimit,
}: {
  pictures: GalleryPicture[];
  onChange: (pictures: GalleryPicture[]) => void;
  onProcessingChange: (busy: boolean) => void;
  projectLimit: number;
}) {
  const input = useRef<HTMLInputElement>(null),
    mounted = useRef(false),
    working = useRef(false);
  const [preparing, setPreparing] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onProcessingChange(preparing);
    return () => onProcessingChange(false);
  }, [preparing, onProcessingChange]);
  const guide = useId();
  const remaining = projectLimit - pictures.length;
  return (
    <section className="panel gallery-editor">
      <div className="section-label">
        <h3>{t('Project pictures')}</h3>
        <span className="count-badge">
          {pictures.length}/{projectLimit}
        </span>
      </div>
      <p className="hint">
        {t('The first picture is your project cover. Use the arrows to reorder.')}
      </p>
      {pictures.length ? (
        <div className="gallery-edit-grid">
          {pictures.map((p, i) => (
            <article key={p.id} className="gallery-edit-card">
              <div className="gallery-edit-image">
                <MediaImage
                  src={p.src}
                  alt={p.caption || t('Work picture {number}', { number: i + 1 })}
                />
                {i === 0 && <span>{t('Cover')}</span>}
              </div>
              <div className="gallery-edit-fields">
                <label htmlFor={`gallery-caption-${p.id}`}>
                  {t('Caption for picture')} {i + 1}
                </label>
                <input
                  id={`gallery-caption-${p.id}`}
                  maxLength={140}
                  value={p.caption}
                  placeholder={t('Optional description')}
                  disabled={preparing}
                  onChange={(e) =>
                    onChange(
                      pictures.map((item) =>
                        item.id === p.id ? { ...item, caption: e.target.value } : item,
                      ),
                    )
                  }
                />
                <div className="gallery-edit-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Move picture {number} earlier', { number: i + 1 })}
                    disabled={preparing || i === 0}
                    onClick={() => onChange(moveGalleryPicture(pictures, i, -1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Move picture {number} later', { number: i + 1 })}
                    disabled={preparing || i === pictures.length - 1}
                    onClick={() => onChange(moveGalleryPicture(pictures, i, 1))}
                  >
                    <ChevronRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Remove picture {number}', { number: i + 1 })}
                    disabled={preparing}
                    onClick={() => {
                      setError('');
                      onChange(pictures.filter((item) => item.id !== p.id));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="gallery-edit-empty">
          <Images size={28} />
          <span>{t('A few pictures can tell your story.')}</span>
        </div>
      )}
      <button
        type="button"
        className="btn-secondary"
        disabled={!mediaEnabled || preparing || remaining === 0}
        onClick={() => input.current?.click()}
      >
        <Upload size={16} />
        {preparing
          ? t('Preparing pictures…')
          : remaining === 0
            ? t('Portfolio picture limit reached')
            : t('Add work pictures')}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label={t('Gallery picture files')}
        aria-describedby={guide}
        tabIndex={-1}
        disabled={!mediaEnabled || preparing || remaining === 0}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length || working.current) return;
          setError('');
          if (files.length > remaining) {
            setError(
              t('You can add {count} more pictures to your portfolio.', { count: remaining }),
            );
            return;
          }
          working.current = true;
          setPreparing(true);
          try {
            const ready: GalleryPicture[] = [];
            for (const file of files)
              ready.push({
                id: crypto.randomUUID(),
                src: await compressGalleryPicture(file),
                caption: '',
              });
            if (mounted.current) onChange([...pictures, ...ready]);
          } catch (e) {
            if (mounted.current)
              setError(e instanceof Error ? e.message : t('Unable to prepare these pictures.'));
          } finally {
            working.current = false;
            if (mounted.current) setPreparing(false);
          }
        }}
      />
      <p className="tiny" id={guide}>
        {t('JPG, PNG or WebP up to 8 MB each. Pictures are resized and compressed.')}
      </p>
      {error && (
        <p role="alert" className="error-text">
          {t(error)}
        </p>
      )}
      {preparing && (
        <p role="status" className="tiny">
          {t('Preparing your pictures. Please wait before saving.')}
        </p>
      )}
      {!mediaEnabled && (
        <p className="tiny">{t('Custom picture uploads are not available yet.')}</p>
      )}
      <p className="tiny">
        {t('Save draft to keep changes, then Publish updates to show them on your profile.')}
      </p>
    </section>
  );
}
