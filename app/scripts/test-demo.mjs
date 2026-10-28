import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await access(new URL('../dist-demo/index.html', import.meta.url));
// Exercise the deployment artifact, rather than Vite's development transform.
for (const file of ['browser', 'booking-browser', 'banner-browser', 'social-gallery-browser']) {
  const result = spawnSync(process.execPath, [`tests/${file}.mjs`], {
    cwd: root,
    env: { ...process.env, SL_BROWSER_DIST: 'dist-demo' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
