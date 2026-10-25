import { emptyWorkspace } from '../data/demo.ts';
import {
  cloneProfile,
  publicSnapshot,
  validateForPublish,
  withProfileDefaults,
} from './profile.ts';
import type { ProfileRepository, ProviderProfile, Workspace } from './types.ts';
export const LOCAL_WORKSPACE_KEY = 'servicelink:workspace:v1';
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function createLocalRepository(storage: StorageLike): ProfileRepository {
  const read = (): Workspace => {
    const raw = storage.getItem(LOCAL_WORKSPACE_KEY);
    if (!raw) return emptyWorkspace(true);
    try {
      const w = JSON.parse(raw);
      if (!w.draft || !Number.isInteger(w.revision)) throw new Error();
      return {
        ...w,
        draft: withProfileDefaults(w.draft),
        published: w.published ? withProfileDefaults(w.published) : null,
      };
    } catch {
      throw new Error(
        'The saved demo could not be read. Export or clear this site’s data to start again.',
      );
    }
  };
  const load = async () => read();
  const mutate = async (
    p: ProviderProfile | null,
    revision: number,
    action: 'save' | 'publish' | 'unpublish',
  ) => {
    const run = async () => {
      const old = read();
      if (old.revision !== revision)
        throw new Error('This profile changed in another tab. Reload before saving.');
      if (action === 'publish' && p) {
        const errors = validateForPublish(p);
        if (errors.length) throw new Error(errors.join(' '));
      }
      const next: Workspace = {
        ...old,
        draft: p ? cloneProfile(p) : old.draft,
        revision: old.revision + 1,
        savedAt: new Date().toISOString(),
      };
      if (action === 'publish' && p) {
        next.published = publicSnapshot(p);
        next.publishedAt = next.savedAt;
      }
      if (action === 'unpublish') {
        next.published = null;
        next.publishedAt = null;
      }
      storage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(next)); // Quota failures leave the old state intact.
      return structuredClone(next);
    };
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(LOCAL_WORKSPACE_KEY, run)
      : run();
  };
  return {
    load,
    save: (p, r) => mutate(p, r, 'save'),
    publish: (p, r) => mutate(p, r, 'publish'),
    unpublish: (r) => mutate(null, r, 'unpublish'),
    getPublic: async (slug) => {
      const w = await load();
      return w.published?.slug === slug && w.publishedAt
        ? { profile: w.published, publishedAt: w.publishedAt }
        : null;
    },
    listPublic: async () => {
      const w = await load();
      return w.published && w.publishedAt
        ? [{ profile: w.published, publishedAt: w.publishedAt }]
        : [];
    },
  };
}
