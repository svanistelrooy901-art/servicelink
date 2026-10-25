import { Link2 } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import type { ProviderProfile } from '../lib/types';

export function ProfileCover({ profile: p }: { profile: ProviderProfile }) {
  return (
    <div
      className={`profile-cover ${p.banner ? 'profile-cover-image' : 'profile-cover-template'}`}
      data-testid="profile-cover"
      data-category={p.category}
    >
      {p.banner ? (
        <img
          className="profile-banner-image"
          src={p.banner}
          alt=""
          style={{ objectPosition: `50% ${p.bannerPosition ?? 50}%` }}
        />
      ) : (
        <>
          <span className="cover-caption">
            <Link2 size={15} /> YOUR NEXT CONNECTION
          </span>
          <span className="cover-orbit" aria-hidden="true" />
          <span className="profile-cover-stamp" aria-hidden="true">
            <CategoryIcon category={p.category} size={35} />
          </span>
          <div className="cover-label">
            Good people.
            <br />
            Great services.
          </div>
        </>
      )}
    </div>
  );
}
