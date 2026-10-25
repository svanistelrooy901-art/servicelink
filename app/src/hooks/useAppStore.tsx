// Adapted from AdvisorLink useAppStore: separate editable draft, saved draft and publication.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { repository } from '../lib/repository';
import type { ProviderProfile, Workspace } from '../lib/types';
interface Store {
  workspace: Workspace | null;
  profile: ProviderProfile | null;
  busy: boolean;
  mediaBusy: boolean;
  setMediaBusy: (busy: boolean) => void;
  error: string;
  feedback: string;
  dirty: boolean;
  unpublishedChanges: boolean;
  update: (patch: Partial<ProviderProfile>) => void;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  reset: () => void;
}
const Context = createContext<Store | null>(null);
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    let active = true;
    repository
      .load()
      .then((w) => {
        if (active) {
          setWorkspace(w);
          setProfile(w.draft);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  const dirty = useMemo(
    () => Boolean(workspace && JSON.stringify(profile) !== JSON.stringify(workspace.draft)),
    [workspace, profile],
  );
  const unpublishedChanges = Boolean(
    workspace?.published && JSON.stringify(profile) !== JSON.stringify(workspace.published),
  );
  useEffect(() => {
    if (!dirty && !mediaBusy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, mediaBusy]);
  async function run(action: 'save' | 'publish' | 'unpublish') {
    if (!workspace || !profile || busy || mediaBusy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const result =
        action === 'unpublish'
          ? await repository.unpublish(workspace.revision)
          : await repository[action](profile, workspace.revision);
      setWorkspace(result);
      if (action !== 'unpublish') setProfile(result.draft);
      setFeedback(
        action === 'save'
          ? 'Draft saved. Your published profile is unchanged.'
          : action === 'publish'
            ? 'Profile published. Your latest changes are live.'
            : 'Profile unpublished. Your draft is preserved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this profile.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        workspace,
        profile,
        busy,
        mediaBusy,
        setMediaBusy,
        error,
        feedback,
        dirty,
        unpublishedChanges,
        update: (patch) => {
          setError('');
          setFeedback('');
          setProfile((p) => (p ? { ...p, ...patch } : p));
        },
        save: () => run('save'),
        publish: () => run('publish'),
        unpublish: () => run('unpublish'),
        reset: () => {
          if (workspace && !mediaBusy) setProfile(structuredClone(workspace.draft));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAppStore() {
  const c = useContext(Context);
  if (!c) throw new Error('Profile store missing');
  return c;
}
