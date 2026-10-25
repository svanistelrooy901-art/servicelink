import { usingLocal } from './config';
import { createLocalRepository } from './localRepository';
import { getSupabaseClient } from './supabase';
import { emptyWorkspace } from '../data/demo';
import { publicSnapshot, validateForPublish } from './profile';
import type { ProfileRepository, ProviderProfile, Workspace, PublicListing } from './types';
function supabaseRepository(): ProfileRepository {
  const load = async (): Promise<Workspace> => {
    const client = getSupabaseClient();
    const { data: identity, error: authError } = await client.auth.getUser();
    if (authError || !identity.user) throw new Error('Sign in to load your profile.');
    const { data, error } = await client
      .from('sl_workspaces')
      .select('*')
      .eq('user_id', identity.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return emptyWorkspace();
    const { data: published, error: pubError } = await client
      .from('sl_public_profiles')
      .select('*')
      .eq('user_id', identity.user.id)
      .maybeSingle();
    if (pubError) throw pubError;
    return {
      draft: data.draft,
      published: published?.profile ?? null,
      revision: data.revision,
      savedAt: data.saved_at,
      publishedAt: published?.published_at ?? null,
    };
  };
  const mutate = async (
    profile: ProviderProfile | null,
    revision: number,
    action: string,
  ): Promise<Workspace> => {
    if (profile && action === 'publish') {
      const errors = validateForPublish(profile);
      if (errors.length) throw new Error(errors.join(' '));
    }
    const { error } = await getSupabaseClient().rpc('sl_write_workspace', {
      p_draft: profile,
      p_snapshot: action === 'publish' && profile ? publicSnapshot(profile) : null,
      p_revision: revision,
      p_action: action,
    });
    if (error)
      throw new Error(
        error.code === '23505'
          ? 'That profile link is already taken. Choose another.'
          : error.message,
      );
    return load();
  };
  return {
    load,
    save: (p, r) => mutate(p, r, 'save'),
    publish: (p, r) => mutate(p, r, 'publish'),
    unpublish: (r) => mutate(null, r, 'unpublish'),
    getPublic: async (slug) => {
      const { data, error } = await getSupabaseClient()
        .from('sl_public_profiles')
        .select('profile,published_at')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data ? { profile: data.profile, publishedAt: data.published_at } : null;
    },
    listPublic: async () => {
      const { data, error } = await getSupabaseClient()
        .from('sl_public_profiles')
        .select('profile,published_at')
        .order('published_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(
        (p): PublicListing => ({ profile: p.profile, publishedAt: p.published_at }),
      );
    },
  };
}
// Selection is explicit. A broken cloud configuration never falls back to browser data.
export const repository: ProfileRepository = usingLocal
  ? createLocalRepository(window.localStorage)
  : supabaseRepository();
