import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { GalleryEditor } from './GalleryEditor';
import { MAX_PORTFOLIO_PICTURES, MAX_PORTFOLIO_PROJECTS, profileProjects } from '../lib/gallery';
import type { PortfolioProject, ProviderProfile } from '../lib/types';

export function PortfolioEditor({
  profile,
  onChange,
  onProcessingChange,
}: {
  profile: ProviderProfile;
  onChange: (projects: PortfolioProject[]) => void;
  onProcessingChange: (busy: boolean) => void;
}) {
  const projects = profileProjects(profile);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? projects[0]?.id;
  const pictureCount = projects.reduce((sum, item) => sum + item.pictures.length, 0);
  return (
    <section className="panel portfolio-editor">
      <div className="section-label">
        <h2>{t('Portfolio')}</h2>
        <button
          type="button"
          className="btn-secondary"
          disabled={projects.length >= MAX_PORTFOLIO_PROJECTS}
          onClick={() => {
            const id = crypto.randomUUID();
            onChange([
              ...projects,
              { id, title: '', description: '', serviceId: '', pictures: [] },
            ]);
            setSelectedId(id);
          }}
        >
          <Plus size={16} /> {t('Add project')}
        </button>
      </div>
      <p className="hint">
        {t('Show up to 6 projects and 24 pictures. The first 3 projects appear on your profile.')}
      </p>
      {projects.map((project, index) => {
        const patch = (changes: Partial<PortfolioProject>) =>
          onChange(
            projects.map((item) => (item.id === project.id ? { ...item, ...changes } : item)),
          );
        const move = (step: number) => {
          const next = [...projects];
          [next[index], next[index + step]] = [next[index + step], next[index]];
          onChange(next);
        };
        const open = activeId === project.id;
        return (
          <section className="portfolio-project-editor" key={project.id}>
            <div className="section-label">
              <button
                className="text-btn"
                type="button"
                aria-expanded={open}
                onClick={() => setSelectedId(open ? '' : project.id)}
              >
                {project.id === 'legacy-work' && project.title === 'Past work'
                  ? t(project.title)
                  : project.title || t('New project')}
              </button>
              <div className="portfolio-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Move project up')}
                  disabled={index === 0}
                  onClick={() => move(-1)}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Move project down')}
                  disabled={index === projects.length - 1}
                  onClick={() => move(1)}
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Remove project')}
                  onClick={() => onChange(projects.filter((item) => item.id !== project.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {open && (
              <>
                <label>
                  {t('Project title')}
                  <input
                    maxLength={100}
                    value={project.title}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </label>
                <label>
                  {t('Project description')}
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={project.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </label>
                <label>
                  {t('Linked service (optional)')}
                  <select
                    aria-label={t('Linked service (optional)')}
                    value={project.serviceId}
                    onChange={(e) => patch({ serviceId: e.target.value })}
                  >
                    <option value="">{t('No linked service')}</option>
                    {profile.services.map((service) => (
                      <option value={service.id} key={service.id}>
                        {service.name || t('Untitled service')}
                      </option>
                    ))}
                  </select>
                </label>
                <GalleryEditor
                  pictures={project.pictures}
                  onChange={(pictures) => patch({ pictures })}
                  onProcessingChange={onProcessingChange}
                  projectLimit={MAX_PORTFOLIO_PICTURES - pictureCount + project.pictures.length}
                />
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}
