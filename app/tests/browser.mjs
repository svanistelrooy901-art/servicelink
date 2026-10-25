import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const qaRoot = fileURLToPath(new URL('../../docs/qa/', import.meta.url));
await mkdir(qaRoot, { recursive: true });
const port = 5193,
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_DATA_BACKEND: 'local' },
  },
);
let serverError = '';
server.stderr.on('data', (d) => (serverError += d));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin);
      ready = true;
      break;
    } catch {
      if (server.exitCode !== null) throw new Error(serverError);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(ready, 'Vite started');
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu'],
  });
  let checks = 0;
  const pageErrors = [],
    outbound = [];
  for (const width of [390, 420, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      deviceScaleFactor: 1,
    });
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith(origin) && !url.startsWith('data:')) {
        outbound.push(url);
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const assertNoOverflow = async () => {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `No horizontal overflow at ${width}`,
      );
      checks++;
    };
    await page.goto(`${origin}/dashboard`);
    await page.getByRole('button', { name: 'Explore the demo' }).waitFor();
    checks++;
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.getByRole('heading', { name: /Welcome/ }).waitFor();
    await assertNoOverflow();
    if (width === 1440)
      await page.screenshot({ path: `${qaRoot}desktop-overview.png`, fullPage: true });
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByLabel('Display name').fill('Nadia · Demo Provider');
    await page.getByLabel('Your headline').fill('Thoughtful care, right around the corner.');
    if (width === 1440) {
      await page
        .getByTestId('profile-presentation')
        .getByRole('heading', { name: 'Nadia · Demo Provider', exact: true })
        .waitFor();
      checks++;
    }
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await page.reload();
    await page.getByLabel('Display name').waitFor();
    assert.equal(await page.getByLabel('Display name').inputValue(), 'Nadia · Demo Provider');
    checks++;
    await page.getByRole('link', { name: 'Services', exact: true }).click();
    await page.getByRole('button', { name: 'Add a service', exact: true }).click();
    await page.getByLabel('Service name').nth(1).fill('Weekend care');
    await page
      .getByLabel('What’s included?')
      .nth(1)
      .fill('A flexible session tailored to your family.');
    await page.getByLabel('Price basis').nth(1).selectOption('session');
    await page.getByLabel('Price (RM)').nth(1).fill('80');
    await page.getByRole('button', { name: 'Add a service', exact: true }).click();
    await page.getByRole('button', { name: 'Delete service 3' }).click();
    assert.equal(await page.getByLabel('Service name').count(), 2);
    checks++;
    await page.getByRole('link', { name: 'Coverage', exact: true }).click();
    await page.getByLabel('Add a state or federal territory').selectOption('my-01');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await assertNoOverflow();
    if (width === 420)
      await page.screenshot({ path: `${qaRoot}mobile-coverage-420.png`, fullPage: true });
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByLabel('Display name').fill('');
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish profile', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Add your name' }).waitFor();
    checks++;
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByLabel('Display name').fill('Nadia · Demo Provider');
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1440)
      await page.screenshot({ path: `${qaRoot}desktop-editor.png`, fullPage: false });
    if (width === 390)
      await page.screenshot({ path: `${qaRoot}mobile-editor-390.png`, fullPage: true });
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    checks++;
    const publicPage = await context.newPage();
    publicPage.on('pageerror', (e) => pageErrors.push(e.message));
    await publicPage.goto(`${origin}/p/aina-demo`);
    await publicPage.getByRole('heading', { name: 'Nadia · Demo Provider', exact: true }).waitFor();
    checks++;
    if (width === 390)
      await publicPage.screenshot({ path: `${qaRoot}mobile-public-390.png`, fullPage: true });
    if (width === 420)
      await publicPage.screenshot({ path: `${qaRoot}mobile-public-420.png`, fullPage: true });
    if (width === 1440)
      await publicPage.screenshot({ path: `${qaRoot}desktop-public.png`, fullPage: true });
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByLabel('Display name').fill('Private unpublished name');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await publicPage.reload();
    await publicPage.getByRole('heading', { name: 'Nadia · Demo Provider', exact: true }).waitFor();
    checks++;
    await publicPage.goto(`${origin}/marketplace`);
    await publicPage.getByLabel('State / territory').selectOption('my-01');
    await publicPage.getByLabel('District / zone').selectOption('my-01-01');
    assert.equal(await publicPage.locator('.listing-card').count(), 1);
    checks++;
    await publicPage.getByLabel('Compare', { exact: true }).check();
    await publicPage.getByRole('button', { name: 'Compare providers' }).click();
    await publicPage.getByRole('table').waitFor();
    checks++;
    if (width === 1440)
      await publicPage.screenshot({ path: `${qaRoot}desktop-marketplace.png`, fullPage: true });
    await publicPage.getByLabel('State / territory').selectOption('my-10');
    assert.equal(await publicPage.locator('.listing-card').count(), 0);
    checks++;
    await page.getByLabel('Profile link', { exact: true }).fill('nadia-demo');
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish updates', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    await publicPage.goto(`${origin}/p/aina-demo`);
    await publicPage.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor();
    checks++;
    await publicPage.goto(`${origin}/p/nadia-demo`);
    await publicPage
      .getByRole('heading', { name: 'Private unpublished name', exact: true })
      .waitFor();
    checks++;
    await page.getByRole('button', { name: 'Unpublish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile unpublished' }).waitFor();
    await publicPage.reload();
    await publicPage.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor();
    checks++;
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    assert.equal(await page.getByLabel('Display name').inputValue(), 'Private unpublished name');
    checks++;
    await assertNoOverflow();
    await context.close();
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(outbound, []);
  console.log(
    `PASS: ${checks} browser assertions at 390px, 420px and 1440px; no page errors or external requests.`,
  );
} finally {
  if (browser) await browser.close();
  server.kill();
  await once(server, 'exit').catch(() => {});
}
