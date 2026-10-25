import { Link2 } from 'lucide-react';
export function ServiceLinkBrand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Link2 size={23} />
      </span>
      <span>
        service<span className="brand-light">link</span>
        <small>BY DIGITAL SAMBAL</small>
      </span>
    </span>
  );
}
