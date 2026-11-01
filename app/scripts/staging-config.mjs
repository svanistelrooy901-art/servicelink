import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
export const serverSecrets = ['SUPABASE_SECRET_KEY', 'SL_TOKEN_SECRET', 'SL_RATE_SECRET'];
export function validateStaging(browser, worker) {
  const errors = [];
  const requireValue = (env, name) => {
    if (!env[name] || /REPLACE|YOUR_|<|>/.test(env[name]))
      errors.push(`${name}: missing or placeholder value.`);
  };
  if (browser.VITE_DATA_BACKEND !== 'supabase')
    errors.push('VITE_DATA_BACKEND: must be supabase; demo fallback is forbidden.');
  for (const key of ['VITE_SL_PROJECT_REF', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
    requireValue(browser, key);
  for (const key of [
    'SL_PROJECT_REF',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SL_APP_ORIGIN',
    ...serverSecrets,
  ])
    requireValue(worker, key);
  const ref = browser.VITE_SL_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(ref ?? ''))
    errors.push('VITE_SL_PROJECT_REF: must be an exact project reference.');
  if (browser.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`)
    errors.push('VITE_SUPABASE_URL: project reference does not match.');
  for (const [front, back] of [
    ['VITE_SL_PROJECT_REF', 'SL_PROJECT_REF'],
    ['VITE_SUPABASE_URL', 'SUPABASE_URL'],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY'],
  ]) {
    if (browser[front] !== worker[back])
      errors.push(`${front} / ${back}: frontend and Worker must agree.`);
  }
  if (!browser.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY: a publishable key is required.');
  if (!worker.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'))
    errors.push('SUPABASE_SECRET_KEY: use a server-only secret key.');
  if (worker.SL_ENVIRONMENT !== 'staging')
    errors.push('SL_ENVIRONMENT: only staging is supported.');
  try {
    const url = new URL(worker.SL_APP_ORIGIN);
    if (
      url.protocol !== 'https:' ||
      url.origin !== worker.SL_APP_ORIGIN ||
      !url.hostname.startsWith('servicelink-staging.') ||
      !url.hostname.endsWith('.workers.dev')
    )
      throw new Error();
  } catch {
    errors.push(
      'SL_APP_ORIGIN: use the exact https://servicelink-staging.<account>.workers.dev origin, without a path or trailing slash.',
    );
  }
  for (const key of ['SL_TOKEN_SECRET', 'SL_RATE_SECRET'])
    if ((worker[key]?.length ?? 0) < 32)
      errors.push(`${key}: must contain at least 32 characters.`);
  if (worker.SL_TOKEN_SECRET && worker.SL_TOKEN_SECRET === worker.SL_RATE_SECRET)
    errors.push('SL_TOKEN_SECRET / SL_RATE_SECRET: use independent random secrets.');
  for (const suffix of ['BOOKINGS', 'MEDIA']) {
    const front = `VITE_SL_${suffix}_ENABLED`,
      back = `SL_${suffix}_ENABLED`;
    if (!['true', 'false'].includes(browser[front]) || browser[front] !== worker[back])
      errors.push(`${front} / ${back}: use matching explicit true/false flags.`);
  }
  // This initial staging config intentionally declares no billable media bindings.
  if (worker.SL_MEDIA_ENABLED === 'true')
    errors.push(
      'SL_MEDIA_ENABLED: keep false until private R2 and Images bindings are provisioned and reviewed.',
    );
  const allowed = new Set([
    'VITE_DATA_BACKEND',
    'VITE_SL_PROJECT_REF',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SL_BOOKINGS_ENABLED',
    'VITE_SL_MEDIA_ENABLED',
  ]);
  for (const [key, raw] of Object.entries(browser)) {
    const value = typeof raw === 'string' ? raw : '';
    if (key.startsWith('VITE_') && !allowed.has(key))
      errors.push(`${key}: unreviewed browser variable.`);
    if (!key.startsWith('VITE_')) continue;
    if (
      /SECRET|SERVICE_ROLE|TOKEN_SECRET|RATE_SECRET/.test(key) ||
      /sb_secret_|eyJ/.test(value) ||
      serverSecrets.some((name) => worker[name] && value.includes(worker[name]))
    )
      errors.push(`${key}: server credentials must never enter the browser build.`);
  }
  return [...new Set(errors)];
}
export function readStaging(root) {
  let browser, worker;
  try {
    browser = parseEnv(readFileSync(new URL('.env.staging.local', root), 'utf8'));
  } catch {
    throw new Error(
      'Create app/.env.staging.local from .env.staging.example; no values were printed.',
    );
  }
  try {
    worker = parseEnv(readFileSync(new URL('.dev.vars', root), 'utf8'));
  } catch {
    throw new Error('Create app/.dev.vars from .dev.vars.example; no values were printed.');
  }
  const errors = validateStaging(browser, worker);
  if (errors.length) throw new Error(errors.join('\n'));
  return { browser, worker };
}
export function stagingWorker(worker) {
  const publicNames = [
    'SL_ENVIRONMENT',
    'SL_APP_ORIGIN',
    'SL_PROJECT_REF',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SL_BOOKINGS_ENABLED',
    'SL_MEDIA_ENABLED',
  ];
  return {
    name: 'servicelink-staging',
    main: 'worker/index.ts',
    compatibility_date: '2026-10-25',
    workers_dev: true,
    preview_urls: false,
    observability: { enabled: false },
    assets: {
      directory: './dist-staging',
      binding: 'ASSETS',
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api/*', '/booking/*'],
    },
    vars: Object.fromEntries(publicNames.map((name) => [name, worker[name]])),
  };
}
