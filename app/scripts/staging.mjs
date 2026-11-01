import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { readStaging, serverSecrets, stagingWorker } from './staging-config.mjs';
const root = new URL('../', import.meta.url);
const building = process.argv[2] === '--build';
if (building) await rm(new URL('wrangler.staging.generated.json', root), { force: true });
try {
  const { browser, worker } = readStaging(root);
  console.log(
    'Local staging configuration agrees. This does not verify hosted services, migrations or bindings.',
  );
  if (building) {
    const env = { ...process.env, ...browser };
    // Only reviewed public configuration reaches Vite. Unknown VITE_* values are rejected.
    const allowed = Object.keys(browser);
    for (const key of Object.keys(env))
      if (key.startsWith('VITE_') && !allowed.includes(key)) delete env[key];
    for (const args of [
      ['node_modules/typescript/bin/tsc', '-b'],
      ['node_modules/vite/bin/vite.js', 'build', '--mode', 'staging', '--outDir', 'dist-staging'],
    ]) {
      const result = spawnSync(process.execPath, args, {
        cwd: fileURLToPath(root),
        env,
        stdio: 'inherit',
      });
      if (result.error || result.status !== 0) throw new Error('Staging compilation failed.');
    }
    const assets = new URL('dist-staging/assets/', root);
    for (const name of await readdir(assets)) {
      const bytes = await readFile(new URL(name, assets), 'utf8');
      if (serverSecrets.some((key) => bytes.includes(worker[key])))
        throw new Error('Build rejected: a server-only value entered an asset.');
    }
    await writeFile(
      new URL('dist-staging/_headers', root),
      `/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${browser.VITE_SUPABASE_URL}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'\n/booking/*\n  Cache-Control: no-store\n`,
    );
    await writeFile(new URL('dist-staging/robots.txt', root), 'User-agent: *\nDisallow: /\n');
    await writeFile(
      new URL('wrangler.staging.generated.json', root),
      JSON.stringify(stagingWorker(worker), null, 2) + '\n',
    );
    console.log(
      'Staging build ready in dist-staging. Generated config targets only servicelink-staging and contains no server secrets. Nothing deployed.',
    );
  }
} catch (error) {
  if (building) {
    await rm(new URL('wrangler.staging.generated.json', root), { force: true });
    await rm(new URL('dist-staging/', root), { force: true, recursive: true });
  }
  console.error(error instanceof Error ? error.message : 'Staging preparation failed.');
  process.exitCode = 1;
}
