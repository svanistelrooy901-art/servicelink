import { t } from '../i18n';
import { Link, useNavigate } from 'react-router-dom';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { DEMO_ACCESS_KEY } from '../lib/config';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
export function DemoAccess() {
  const navigate = useNavigate();
  return (
    <main className="access-page">
      <section className="access-card">
        <ServiceLinkBrand />
        <span className="access-spark" aria-hidden="true">
          <Sparkles size={28} />
        </span>
        <span className="eyebrow">{t('LOCAL DEMONSTRATION')}</span>
        <h1>
          {t('Your skills.')}
          <br />
          {t('Your own little corner.')}
        </h1>
        <p>
          {t(
            'Build a service profile that feels like you. Start with a fictional provider and make it your own.',
          )}
        </p>
        <div className="demo-features">
          <span>
            <Check size={16} /> {t('Profile & service catalogue')}
          </span>
          <span>
            <Check size={16} /> {t('Nationwide service areas')}
          </span>
          <span>
            <Check size={16} /> {t('Live preview & publication')}
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            sessionStorage.setItem(DEMO_ACCESS_KEY, 'active');
            navigate('/dashboard');
          }}
        >
          {t('Explore the demo')}
          <ArrowRight size={17} />
        </button>
        <p className="tiny">
          {t(
            'Saved on this browser only. Demo publication is visible on this device; it does not create a shareable live website.',
          )}
        </p>
        <Link to="/marketplace">{t('Explore published profiles')}</Link>
        <div className="price-note">
          {t('One plan · 14-day free trial')}
          <br />
          <strong>{t('RM9.90 monthly or RM49 first annual year')}</strong>
          <small>
            {t(
              'Annual renewal RM99 from year two. Optional gateway included; transaction charges separate.',
            )}
          </small>
        </div>
      </section>
    </main>
  );
}
