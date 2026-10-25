export const categories = {
  nanny: 'Private nanny',
  confinement: 'Confinement lady',
  tutor: 'Private tutor',
  makeup: 'Makeup artist',
  cleaning: 'Cleaning service',
} as const;
export type Category = keyof typeof categories;
export interface Coverage {
  stateId: string;
  wholeState: boolean;
  subdivisionIds: string[];
}
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number | null;
  priceBasis: 'hour' | 'session' | 'day' | 'package' | 'quote';
  durationMinutes: number | null;
  delivery: 'in-person' | 'online' | 'both';
}
export interface ProviderProfile {
  name: string;
  slug: string;
  headline: string;
  category: Category;
  bio: string;
  base: string;
  experienceYears: number;
  languages: string;
  whatsapp: string;
  showWhatsapp: boolean;
  photo: string;
  accent: 'forest' | 'plum' | 'ocean';
  coverage: Coverage[];
  services: Service[];
}
export interface Workspace {
  draft: ProviderProfile;
  published: ProviderProfile | null;
  revision: number;
  savedAt: string | null;
  publishedAt: string | null;
}
export interface PublicListing {
  profile: ProviderProfile;
  publishedAt: string;
}
export interface ProfileRepository {
  load(): Promise<Workspace>;
  save(profile: ProviderProfile, revision: number): Promise<Workspace>;
  publish(profile: ProviderProfile, revision: number): Promise<Workspace>;
  unpublish(revision: number): Promise<Workspace>;
  getPublic(slug: string): Promise<PublicListing | null>;
  listPublic(): Promise<PublicListing[]>;
}
