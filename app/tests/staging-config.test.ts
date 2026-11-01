import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Node-side build module is deliberately separate from browser/Worker code.
import { validateStaging, stagingWorker } from '../scripts/staging-config.mjs';
const browser = {
  VITE_DATA_BACKEND: 'supabase',
  VITE_SL_PROJECT_REF: 'slfixtureabcdefghijk',
  VITE_SUPABASE_URL: 'https://slfixtureabcdefghijk.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_testvalue',
  VITE_SL_BOOKINGS_ENABLED: 'true',
  VITE_SL_MEDIA_ENABLED: 'false',
};
const worker = {
  SL_ENVIRONMENT: 'staging',
  SL_APP_ORIGIN: 'https://servicelink-staging.example.workers.dev',
  SL_PROJECT_REF: browser.VITE_SL_PROJECT_REF,
  SUPABASE_URL: browser.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: browser.VITE_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: 'sb_secret_test_server_only_123456789',
  SL_TOKEN_SECRET: 'unique-token-secret-'.repeat(3),
  SL_RATE_SECRET: 'unique-rate-secret-'.repeat(3),
  SL_BOOKINGS_ENABLED: 'true',
  SL_MEDIA_ENABLED: 'false',
};
test('staging config accepts matching independent cloud settings and emits no server keys', () => {
  assert.deepEqual(validateStaging(browser, worker), []);
  const config = stagingWorker(worker);
  assert.equal(config.name, 'servicelink-staging');
  assert.equal(config.assets.directory, './dist-staging');
  for (const key of ['SUPABASE_SECRET_KEY', 'SL_TOKEN_SECRET', 'SL_RATE_SECRET'])
    assert.ok(!JSON.stringify(config).includes(worker[key as keyof typeof worker]));
});
test('staging rejects browser-local fallback and project/key/feature mismatches', () => {
  for (const patch of [
    { VITE_DATA_BACKEND: 'local' },
    { VITE_SL_PROJECT_REF: 'otherfixtureabcdefgh' },
    { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' },
    { VITE_SL_BOOKINGS_ENABLED: 'false' },
    { VITE_SL_MEDIA_ENABLED: undefined },
  ])
    assert.ok(validateStaging({ ...browser, ...patch }, worker).length);
});
test('staging refuses production, demo and non-canonical origins', () => {
  for (const origin of [
    'https://servicelink-demo.example.workers.dev',
    'https://app.advisorlink.invalid',
    worker.SL_APP_ORIGIN + '/',
    'http://servicelink-staging.example.workers.dev',
    worker.SL_APP_ORIGIN + '/login',
  ])
    assert.ok(validateStaging(browser, { ...worker, SL_APP_ORIGIN: origin }).length);
  assert.ok(validateStaging(browser, { ...worker, SL_ENVIRONMENT: 'production' }).length);
});
test('staging rejects placeholder, weak/shared secrets and premature media activation', () => {
  for (const patch of [
    { SL_TOKEN_SECRET: 'short' },
    { SL_RATE_SECRET: worker.SL_TOKEN_SECRET },
    { SUPABASE_SECRET_KEY: 'REPLACE' },
    { SL_MEDIA_ENABLED: 'true' },
  ])
    assert.ok(validateStaging(browser, { ...worker, ...patch }).length);
});
test('staging diagnostics do not echo leaked server credentials', () => {
  const errors = validateStaging(
    { ...browser, VITE_BAD: worker.SUPABASE_SECRET_KEY, VITE_TOKEN_SECRET: worker.SL_TOKEN_SECRET },
    worker,
  );
  assert.ok(errors.length);
  assert.ok(!errors.join('').includes(worker.SUPABASE_SECRET_KEY));
  assert.ok(!errors.join('').includes(worker.SL_TOKEN_SECRET));
});
