import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Inbox,
  UserRound,
  Briefcase,
  MapPin,
  Eye,
  ArrowUpRight,
  LogOut,
  Save,
  Check,
  Link2,
} from 'lucide-react';
import { ServiceLinkBrand } from './ServiceLinkBrand';
import { useAppStore } from '../hooks/useAppStore';
import { useAuth } from '../hooks/useAuth';
import { usingLocal, DEMO_ACCESS_KEY } from '../lib/config';
const nav = [
  ['', 'Overview', LayoutDashboard],
  ['profile', 'My profile', UserRound],
  ['services', 'Services', Briefcase],
  ['coverage', 'Coverage', MapPin],
  ['availability', 'Availability', CalendarDays],
  ['bookings', 'Bookings', Inbox],
  ['preview', 'Preview & publish', Eye],
] as const;
export function DashboardLayout() {
  const store = useAppStore();
  const location = useLocation();
  const usesProfileDraft = !['/dashboard/availability', '/dashboard/bookings'].includes(
    location.pathname,
  );
  const { signOut } = useAuth();
  const navigate = useNavigate();
  async function leave() {
    if (store.dirty && !window.confirm('Leave without saving your latest changes?')) return;
    try {
      if (usingLocal) sessionStorage.removeItem(DEMO_ACCESS_KEY);
      else await signOut();
      navigate('/login');
    } catch {
      window.alert('Unable to sign out. Please try again.');
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/dashboard" aria-label="Service Link dashboard">
          <ServiceLinkBrand />
        </Link>
        <span className="sidebar-label">YOUR WORKSPACE</span>
        <nav aria-label="Dashboard">
          {nav.map(([path, label, Icon]) => (
            <NavLink key={path} to={`/dashboard${path ? `/${path}` : ''}`} end>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="market-link" to="/marketplace">
          <GlobeIcon />
          Explore marketplace
          <ArrowUpRight size={15} />
        </Link>
        <div className="sidebar-bottom">
          <div className="solo-note">
            <span className="small-mark">
              <Link2 size={18} />
            </span>
            <p>
              A good service deserves
              <br />a great first impression.
            </p>
          </div>
          <button className="logout" onClick={leave}>
            <LogOut size={16} />
            Sign out{usingLocal ? ' of demo' : ''}
          </button>
          <small>
            Made for independent people.
            <br />
            Made by Digital Sambal.
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">PROVIDER WORKSPACE</span>
            <span className="workspace-title">Let’s make things happen.</span>
          </div>
          <div className="header-status">
            <span className={`status-dot ${store.workspace?.published ? 'live' : ''}`} />
            {store.workspace?.published ? 'Published' : 'Draft profile'}
          </div>
          <button className="icon-btn mobile-signout" aria-label="Sign out" onClick={leave}>
            <LogOut size={16} />
          </button>
        </header>
        {usingLocal && (
          <div className="demo-banner">
            <strong>Local demo</strong>
            <span>Changes stay on this browser. Published links work on this device only.</span>
          </div>
        )}
        <main className="dashboard-main">
          {store.error && (
            <div className="error-box" role="alert">
              {store.error}
            </div>
          )}
          {store.feedback && usesProfileDraft && (
            <div className="success-box" role="status">
              <Check size={17} />
              {store.feedback}
            </div>
          )}
          {store.profile ? (
            <Outlet />
          ) : !store.error ? (
            <p className="loading">Loading your workspace…</p>
          ) : (
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              Reload workspace
            </button>
          )}
        </main>
        {store.profile && usesProfileDraft && (
          <footer className="save-bar">
            <span>
              <span className={`status-dot ${store.dirty ? 'unsaved' : ''}`} />
              {store.busy
                ? 'Saving…'
                : store.dirty
                  ? 'Unsaved changes'
                  : store.workspace?.savedAt
                    ? 'All changes saved'
                    : 'Ready to make it yours'}
            </span>
            <div>
              {store.dirty && (
                <button className="text-btn" disabled={store.busy} onClick={store.reset}>
                  Discard edits
                </button>
              )}
              <button className="btn-primary" disabled={store.busy} onClick={store.save}>
                <Save size={16} />
                Save draft
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
function GlobeIcon() {
  return <MapPin size={17} />;
}
