import { t } from '../i18n';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  UserRound,
  Briefcase,
  MapPin,
  Eye,
  CalendarDays,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { useAppStore } from '../hooks/useAppStore';
export function DashboardOverview() {
  const { profile: p, workspace } = useAppStore();
  if (!p) return null;
  const steps = [
    {
      label: t('Introduce yourself'),
      detail: t('Your name, story and the work you love.'),
      done: !!p.name && !!p.bio,
      to: 'profile',
      icon: UserRound,
    },
    {
      label: t('Add your services'),
      detail: t('Make it easy to see how you can help.'),
      done: p.services.length > 0,
      to: 'services',
      icon: Briefcase,
    },
    {
      label: t('Choose your service areas'),
      detail: t('Reach the right people, in the right places.'),
      done: p.coverage.length > 0,
      to: 'coverage',
      icon: MapPin,
    },
    {
      label: t('Preview and publish'),
      detail: t('A little final polish. Then you’re ready.'),
      done: !!workspace?.published,
      to: 'preview',
      icon: Eye,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('A SPACE FOR YOUR AMBITION')}</span>
          <h1>
            {t('Welcome')}
            {p.name ? `, ${p.name.split(' ')[0]}` : ''}
            <span className="warm-dot">.</span>
          </h1>
          <p>{t('Your next customer starts with a great first impression.')}</p>
        </div>
        <Link className="btn-secondary" to="/marketplace">
          {t('Explore marketplace')}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">{t('GOOD WORK. HAPPY CONNECTIONS.')}</span>
          <h2>
            {t('Do what you love.')}
            <br />
            {t('Let people find you.')}
          </h2>
          <p>{t('Bring your story, services and service areas together in one link.')}</p>
          <Link className="btn-cream" to="/dashboard/profile">
            {t('Make it yours')}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit" />
          <span className="art-spark art-spark-one">
            <Sparkles size={24} />
          </span>
          <span className="art-spark art-spark-two">
            <HeartHandshake size={24} />
          </span>
          <div className="mini-profile">
            <span className="mini-avatar">
              <CategoryIcon category={p.category} size={27} />
            </span>
            <span className="mini-line long" />
            <span className="mini-line" />
            <div className="mini-tiles">
              <span>
                <CategoryIcon category={p.category} size={17} />
              </span>
              <span>
                <Sparkles size={17} />
              </span>
            </div>
            <div className="mini-button" />
          </div>
          <span className="art-badge">
            <Check size={16} /> {t('Made for your kind of work.')}
          </span>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel setup-panel">
          <div className="section-label">
            <div>
              <h2>{t('Your profile, step by step')}</h2>
              <p className="hint">{t('A few simple steps to get you ready.')}</p>
            </div>
            <span className="progress-number">
              {completed}
              <small>/4</small>
            </span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${completed * 25}%` }} />
          </div>
          <div className="setup-steps">
            {steps.map((s) => (
              <Link to={`/dashboard/${s.to}`} key={s.to}>
                <span className={`step-icon ${s.done ? 'done' : ''}`}>
                  {s.done ? <Check size={17} /> : <s.icon size={17} />}
                </span>
                <div>
                  <strong>{s.label}</strong>
                  <p>{s.detail}</p>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
        <aside className="overview-side">
          <section className="panel membership-card">
            <span className="eyebrow">{t('SIMPLE, FROM THE START')}</span>
            <h2>
              {t('One plan.')}
              <br />
              {t('Room to grow.')}
            </h2>
            <span className="plan-price">
              {t('RM9.90')}
              <small>{t('/ month')}</small>
            </span>
            <p>
              {t('Or RM49 for your first annual year.')}
              <br />
              <strong>{t('Renews at RM99/year from year two.')}</strong>
            </p>
            <span className="plan-trial">{t('14-day free trial')}</span>
            <p className="tiny">
              {t(
                'All MVP features included. Gateway optional. Transaction charges separate. Billing is not activated yet.',
              )}
            </p>
          </section>
          <section className="next-card">
            <CalendarDays size={22} />
            <div>
              <strong>{t('Your booking workspace')}</strong>
              <p>{t('A place for your time, your bookings and your next happy customer.')}</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
