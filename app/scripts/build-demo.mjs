import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Explicit process values override Vite .env files and Cloudflare build variables.
// The hosted review must remain browser-local even if cloud values are present.
const env = {
  ...process.env,
  VITE_DATA_BACKEND: 'local',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_SL_PROJECT_REF: '',
  VITE_SL_BOOKINGS_ENABLED: 'false',
  VITE_SL_MEDIA_ENABLED: 'false',
};
for (const args of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build', '--mode', 'demo', '--outDir', 'dist-demo'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const output = new URL('../dist-demo/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(
  new URL('_headers', output),
  `/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
/booking/*
  Cache-Control: no-store
`,
);
await writeFile(new URL('robots.txt', output), 'User-agent: *\nDisallow: /\n');
console.log(
  'Demo build ready: browser-local data; no cloud keys, backend or real payment connection.',
);
