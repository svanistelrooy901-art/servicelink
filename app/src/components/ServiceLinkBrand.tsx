import { t } from '../i18n';
import approvedLogo from '../../../assets/brand/servicelink-logo.svg';

export function ServiceLinkBrand() {
  return (
    <span className="brand">
      <img src={approvedLogo} alt={t('Service Link')} />
    </span>
  );
}
