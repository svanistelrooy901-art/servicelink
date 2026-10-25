// Adapted from the reviewed AdvisorLink client; no inherited URL, key or auth storage.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null = null;
export function getSupabaseClient() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const ref = import.meta.env.VITE_SL_PROJECT_REF;
  if (!url || !key || !ref || new URL(url).hostname !== `${ref}.supabase.co`)
    throw new Error('Configure the independent Service Link Supabase project in app/.env.local.');
  if (!key.startsWith('sb_publishable_'))
    throw new Error('Use a Supabase publishable key. Secret and service-role keys are forbidden.');
  client = createClient(url, key, {
    auth: {
      storageKey: 'servicelink:auth:v1',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}
