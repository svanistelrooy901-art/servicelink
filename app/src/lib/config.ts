const backend = import.meta.env.VITE_DATA_BACKEND ?? 'local';
if (!['local', 'supabase'].includes(backend))
  throw new Error('Choose local or supabase for VITE_DATA_BACKEND.');
export const usingLocal = backend === 'local';
export const DEMO_ACCESS_KEY = 'servicelink:demo-access:v1';
