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
      label: 'Introduce yourself',
      detail: 'Your name, story and the work you love.',
      done: !!p.name && !!p.bio,
      to: 'profile',
      icon: UserRound,
    },
    {
      label: 'Add your services',
      detail: 'Make it easy to see how you can help.',
      done: p.services.length > 0,
      to: 'services',
      icon: Briefcase,
    },
    {
      label: 'Choose your service areas',
      detail: 'Reach the right people, in the right places.',
      done: p.coverage.length > 0,
      to: 'coverage',
      icon: MapPin,
    },
    {
      label: 'Preview and publish',
      detail: 'A little final polish. Then you’re ready.',
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
          <span className="eyebrow">A SPACE FOR YOUR AMBITION</span>
          <h1>
            Welcome{p.name ? `, ${p.name.split(' ')[0]}` : ''}
            <span className="warm-dot">.</span>
          </h1>
          <p>Your next customer starts with a great first impression.</p>
        </div>
        <Link className="btn-secondary" to="/marketplace">
          Explore marketplace
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">GOOD WORK. HAPPY CONNECTIONS.</span>
          <h2>
            Do what you love.
            <br />
            Let people find you.
          </h2>
          <p>Bring your story, services and service areas together in one link.</p>
          <Link className="btn-cream" to="/dashboard/profile">
            Make it yours
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
            <Check size={16} /> Made for your kind of work.
          </span>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel setup-panel">
          <div className="section-label">
            <div>
              <h2>Your profile, step by step</h2>
              <p className="hint">A few simple steps to get you ready.</p>
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
            <span className="eyebrow">SIMPLE, FROM THE START</span>
            <h2>
              One plan.
              <br />
              Room to grow.
            </h2>
            <span className="plan-price">
              RM9.90<small>/ month</small>
            </span>
            <p>
              Or RM49 for your first annual year.
              <br />
              <strong>Renews at RM99/year from year two.</strong>
            </p>
            <span className="plan-trial">14-day free trial</span>
            <p className="tiny">
              All MVP features included. Gateway optional. Transaction charges separate. Billing is
              not activated yet.
            </p>
          </section>
          <section className="next-card">
            <CalendarDays size={22} />
            <div>
              <strong>Your booking workspace</strong>
              <p>A place for your time, your bookings and your next happy customer.</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
