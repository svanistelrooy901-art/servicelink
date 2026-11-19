import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { t } from '../i18n';
import { profileProjects } from '../lib/gallery';
import type { ProviderProfile } from '../lib/types';
import { MediaImage } from './MediaImage';

export function ProfilePortfolio({
  profile,
  preview,
}: {
  profile: ProviderProfile;
  preview?: boolean;
}) {
  const projects = profileProjects(profile).filter((project) => project.title.trim());
  const [all, setAll] = useState(false);
  const [id, setId] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const selected = projects.find((project) => project.id === id);
  const service = profile.services.find((item) => item.id === selected?.serviceId);
  const title = (project: (typeof projects)[number]) =>
    project.id === 'legacy-work' && project.title === 'Past work'
      ? t(project.title)
      : project.title;
  useEffect(() => {
    const el = dialog.current;
    if (!el || !id) return;
    if (!el.open) el.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [id]);
  if (!projects.length) return null;
  return (
    <section className="public-section profile-portfolio">
      <div className="section-label">
        <h2>{t('Portfolio')}</h2>
        {projects.length > 3 && (
          <button
            type="button"
            className="text-btn"
            aria-expanded={all}
            onClick={() => setAll(!all)}
          >
            {t(all ? 'Show featured projects' : 'View all projects')}
          </button>
        )}
      </div>
      <div className="portfolio-grid">
        {(all ? projects : projects.slice(0, 3)).map((project) => (
          <button
            className="portfolio-card"
            type="button"
            key={project.id}
            onClick={() => setId(project.id)}
          >
            {project.pictures[0] && (
              <MediaImage src={project.pictures[0].src} alt="" loading="lazy" />
            )}
            <strong>{title(project)}</strong>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        onClose={() => setId('')}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            event.currentTarget.close();
        }}
        aria-labelledby={heading}
      >
        {selected && (
          <>
            <header className="gallery-dialog-header">
              <h2 id={heading}>{title(selected)}</h2>
              <button
                type="button"
                autoFocus
                className="icon-btn"
                aria-label={t('Close project')}
                onClick={() => dialog.current?.close()}
              >
                <X size={20} />
              </button>
            </header>
            <div className="portfolio-project-detail">
              {selected.description && <p>{selected.description}</p>}
              {service &&
                (preview ? (
                  <button className="btn-secondary" disabled>
                    {t('Book this service')}
                  </button>
                ) : (
                  <Link
                    className="btn-secondary"
                    to={`/p/${profile.slug}/book?service=${encodeURIComponent(service.id)}`}
                  >
                    {t('Book this service')}
                  </Link>
                ))}
            </div>
            {selected.pictures.length > 0 && (
              <div className="gallery-modal-grid">
                {selected.pictures.map((picture, index) => (
                  <figure key={picture.id}>
                    <MediaImage
                      src={picture.src}
                      alt={picture.caption || t('Work picture {number}', { number: index + 1 })}
                      loading="lazy"
                    />
                    {picture.caption && <figcaption>{picture.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </>
        )}
      </dialog>
    </section>
  );
}
