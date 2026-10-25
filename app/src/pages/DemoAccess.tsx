import { Link, useNavigate } from 'react-router-dom';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { DEMO_ACCESS_KEY } from '../lib/config';
import { ArrowRight, Check } from 'lucide-react';
export function DemoAccess() {
  const navigate = useNavigate();
  return (
    <main className="access-page">
      <section className="access-card">
        <ServiceLinkBrand />
        <span className="eyebrow">LOCAL DEMONSTRATION</span>
        <h1>
          Your skills.
          <br />
          Your own little corner.
        </h1>
        <p>
          Build a service profile that feels like you. Start with a fictional provider and make it
          your own.
        </p>
        <div className="demo-features">
          <span>
            <Check size={16} /> Profile & service catalogue
          </span>
          <span>
            <Check size={16} /> Nationwide service areas
          </span>
          <span>
            <Check size={16} /> Live preview & publication
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            sessionStorage.setItem(DEMO_ACCESS_KEY, 'active');
            navigate('/dashboard');
          }}
        >
          Explore the demo
          <ArrowRight size={17} />
        </button>
        <p className="tiny">
          Saved on this browser only. Demo publication is visible on this device; it does not create
          a shareable live website.
        </p>
        <Link to="/marketplace">Explore published profiles</Link>
        <div className="price-note">
          One plan · 14-day free trial
          <br />
          <strong>RM9.90 monthly or RM49 first annual year</strong>
          <small>
            Annual renewal RM99 from year two. Optional gateway included; transaction charges
            separate.
          </small>
        </div>
      </section>
    </main>
  );
}
