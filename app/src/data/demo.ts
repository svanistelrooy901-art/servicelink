import type { ProviderProfile, Workspace } from '../lib/types';
export function emptyProfile(): ProviderProfile {
  return {
    name: '',
    slug: '',
    headline: '',
    category: 'nanny',
    bio: '',
    base: '',
    experienceYears: 0,
    languages: '',
    whatsapp: '',
    showWhatsapp: false,
    photo: '',
    accent: 'ocean',
    coverage: [],
    services: [],
  };
}
export function demoProfile(): ProviderProfile {
  return {
    ...emptyProfile(),
    name: 'Aina · Demo Provider',
    slug: 'aina-demo',
    headline: 'A little support. A lot of care.',
    bio: 'Warm, attentive care for your little ones, with space for play, learning and everyday discoveries. This is a fictional profile for exploring Service Link.',
    base: 'George Town, Pulau Pinang',
    experienceYears: 5,
    languages: 'Bahasa Melayu, English',
    coverage: [{ stateId: 'my-07', wholeState: false, subdivisionIds: ['my-07-04', 'my-07-05'] }],
    services: [
      {
        id: 'demo-care',
        name: 'Daytime childcare',
        description:
          'Gentle play, mealtime support and an extra pair of caring hands. Discuss your child’s needs before arranging a session.',
        price: 25,
        priceBasis: 'hour',
        durationMinutes: 120,
        delivery: 'in-person',
      },
    ],
  };
}
export function emptyWorkspace(demo = false): Workspace {
  return {
    draft: demo ? demoProfile() : emptyProfile(),
    published: null,
    revision: 0,
    savedAt: null,
    publishedAt: null,
  };
}
