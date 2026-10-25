import { useEffect, useRef, useState } from 'react';
import { Images, Upload, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { compressGalleryPicture } from '../lib/media';
import { MAX_GALLERY_PICTURES, moveGalleryPicture } from '../lib/gallery';
import { usingLocal } from '../lib/config';
import type { GalleryPicture } from '../lib/types';

export function GalleryEditor({
  pictures = [],
  onChange,
  onProcessingChange,
}: {
  pictures: GalleryPicture[];
  onChange: (pictures: GalleryPicture[]) => void;
  onProcessingChange: (busy: boolean) => void;
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
  const remaining = MAX_GALLERY_PICTURES - pictures.length;
  return (
    <section className="panel gallery-editor">
      <div className="section-label">
        <h2>Your work, in pictures</h2>
        <span className="count-badge">{pictures.length}/8</span>
      </div>
      <p className="hint">
        The first 2 pictures appear on your profile. More opens the full gallery. Use the arrows to
        choose the order.
      </p>
      {pictures.length ? (
        <div className="gallery-edit-grid">
          {pictures.map((p, i) => (
            <article key={p.id} className="gallery-edit-card">
              <div className="gallery-edit-image">
                <img src={p.src} alt={p.caption || `Work picture ${i + 1}`} />
                {i < 2 && <span>On profile</span>}
              </div>
              <div className="gallery-edit-fields">
                <label htmlFor={`gallery-caption-${p.id}`}>Caption for picture {i + 1}</label>
                <input
                  id={`gallery-caption-${p.id}`}
                  maxLength={140}
                  value={p.caption}
                  placeholder="Optional description"
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
                    aria-label={`Move picture ${i + 1} earlier`}
                    disabled={preparing || i === 0}
                    onClick={() => onChange(moveGalleryPicture(pictures, i, -1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move picture ${i + 1} later`}
                    disabled={preparing || i === pictures.length - 1}
                    onClick={() => onChange(moveGalleryPicture(pictures, i, 1))}
                  >
                    <ChevronRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove picture ${i + 1}`}
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
          <span>A few pictures can tell your story.</span>
        </div>
      )}
      <button
        type="button"
        className="btn-secondary"
        disabled={!usingLocal || preparing || remaining === 0}
        onClick={() => input.current?.click()}
      >
        <Upload size={16} />
        {preparing
          ? 'Preparing pictures…'
          : remaining === 0
            ? 'Gallery full · 8 pictures'
            : 'Add work pictures'}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Gallery picture files"
        aria-describedby="gallery-upload-guide"
        tabIndex={-1}
        disabled={!usingLocal || preparing || remaining === 0}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length || working.current) return;
          setError('');
          if (files.length > remaining) {
            setError(
              `You can add ${remaining} more picture${remaining === 1 ? '' : 's'}. Maximum 8 in total.`,
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
              setError(e instanceof Error ? e.message : 'Unable to prepare these pictures.');
          } finally {
            working.current = false;
            if (mounted.current) setPreparing(false);
          }
        }}
      />
      <p className="tiny" id="gallery-upload-guide">
        Up to 8 pictures. JPG, PNG or WebP, max 8 MB each. Resized and compressed automatically.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {preparing && (
        <p role="status" className="tiny">
          Preparing your pictures. Please wait before saving.
        </p>
      )}
      {!usingLocal && <p className="tiny">Custom picture uploads are not available yet.</p>}
      <p className="tiny">
        Save draft to keep changes, then Publish updates to show them on your profile.
      </p>
    </section>
  );
}
