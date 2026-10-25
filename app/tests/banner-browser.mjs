import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const qaRoot = fileURLToPath(new URL('../../docs/qa/banners/', import.meta.url));
await mkdir(qaRoot, { recursive: true });
const port = 5197,
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
  const errors = [],
    outbound = [];
  const check = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks++;
  };
  for (const width of [390, 420, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
    });
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith(origin) && !url.startsWith('data:')) {
        outbound.push(url);
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/login`);
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    const cover = page.locator('.banner-preview').getByTestId('profile-cover');
    for (const [category, icon] of [
      ['nanny', 'baby'],
      ['confinement', 'heart-handshake'],
      ['tutor', 'book-open'],
      ['makeup', 'paintbrush'],
      ['cleaning', 'sparkles'],
    ]) {
      await page.getByLabel('Service category').selectOption(category);
      check(await cover.getAttribute('data-category'), category, 'Template follows category');
      check(
        await cover.locator(`.profile-cover-stamp .lucide-${icon}`).count(),
        1,
        'Service icon matches category',
      );
      check(
        await page
          .getByRole('button', { name: 'Use service template' })
          .getAttribute('aria-pressed'),
        'true',
        'Template selected',
      );
    }
    if (width === 420) {
      await page.getByLabel('Service category').selectOption('tutor');
      await cover.screenshot({ path: `${qaRoot}tutor-template-420.png` });
    }
    await page.getByLabel('Service category').selectOption('nanny');
    const file = page.getByLabel('Banner image file');
    await file.setInputFiles({
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await page.getByRole('alert').filter({ hasText: 'under 8 MB' }).waitFor();
    check(await cover.locator('img').count(), 0, 'Invalid MIME retains template');
    await file.setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
    await page.getByRole('alert').filter({ hasText: 'Could not read' }).waitFor();
    check(await cover.locator('img').count(), 0, 'Corrupt upload retains template');
    if (width === 390) {
      await file.setInputFiles({
        name: 'large.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
      });
      await page.getByRole('alert').filter({ hasText: 'under 8 MB' }).waitFor();
      checks++;
    }
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2400;
      c.height = 1200;
      const g = c.getContext('2d');
      g.fillStyle = '#f7dfca';
      g.fillRect(0, 0, 2400, 1200);
      g.fillStyle = '#dceee3';
      g.beginPath();
      g.arc(1900, 400, 650, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ede3f5';
      g.beginPath();
      g.arc(2250, 1150, 440, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#344e6c';
      g.font = 'bold 90px sans-serif';
      g.fillText('A little kindness.', 170, 500);
      g.fillText('A lot of care.', 170, 625);
      g.font = '32px sans-serif';
      g.fillText('FICTIONAL BANNER · DEMO ONLY', 170, 760);
      return c.toDataURL('image/png').split(',')[1];
    });
    const fixture = {
      name: 'fictional-banner.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    };
    await file.setInputFiles(fixture);
    await page.getByRole('button', { name: 'Replace banner', exact: true }).waitFor();
    await cover.locator('img').evaluate((img) => img.decode());
    const upload = await cover.locator('img').evaluate((img) => ({
      source: img.src.startsWith('data:image/webp;base64,'),
      width: img.naturalWidth,
      height: img.naturalHeight,
      length: img.src.length,
      ratio: img.clientWidth / img.clientHeight,
    }));
    check(upload.source, true, 'Banner re-encoded as WebP');
    check(upload.width, 1600, 'Large image resized');
    check(upload.height, 800, 'Original proportions preserved for positioning');
    check(upload.length <= 220000, true, 'Stored media bounded');
    check(Math.abs(upload.ratio - 8 / 3) < 0.025, true, 'Display uses recommended 8:3 ratio');
    await page.getByLabel('Banner vertical position').evaluate((input) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '20');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    check(
      await cover.locator('img').evaluate((img) => img.style.objectPosition),
      '50% 20%',
      'Focus updates preview',
    );
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Replace banner', exact: true }).waitFor();
    check(
      await page.getByLabel('Banner vertical position').inputValue(),
      '20',
      'Focus persists after reload',
    );
    check(await page.locator('.banner-preview img').count(), 1, 'Banner persists after reload');
    check(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'Editor has no overflow',
    );
    if (width === 390 || width === 1440)
      await page
        .locator('.banner-editor')
        .screenshot({ path: `${qaRoot}banner-editor-${width}.png` });
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page
      .getByRole('heading', { name: 'A final look. A fresh start.', exact: true })
      .waitFor();
    const previewSrc = await page.getByTestId('profile-cover').locator('img').getAttribute('src');
    await page.getByRole('button', { name: 'Publish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    const pub = await context.newPage();
    pub.on('pageerror', (e) => errors.push(e.message));
    await pub.goto(`${origin}/p/aina-demo`);
    await pub.getByTestId('profile-cover').locator('img').waitFor();
    await pub
      .getByTestId('profile-cover')
      .locator('img')
      .evaluate((img) => img.decode());
    check(
      await pub.getByTestId('profile-cover').locator('img').getAttribute('src'),
      previewSrc,
      'Public and preview share banner',
    );
    check(
      await pub
        .getByTestId('profile-cover')
        .locator('img')
        .evaluate((img) => img.style.objectPosition),
      '50% 20%',
      'Published position matches',
    );
    check(
      await pub.getByTestId('profile-cover').locator('.cover-label').count(),
      0,
      'Uploaded banner has no default text overlay',
    );
    check(
      await pub.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'Public profile has no overflow',
    );
    if (width === 390 || width === 1440)
      await pub.screenshot({ path: `${qaRoot}public-banner-${width}.png`, fullPage: true });
    await pub.goto(`${origin}/marketplace`);
    await pub.locator('.listing-banner').waitFor();
    check(
      await pub.locator('.listing-banner').getAttribute('src'),
      previewSrc,
      'Marketplace uses published banner',
    );
    if (width === 1440)
      await pub.locator('.listing-card').screenshot({ path: `${qaRoot}marketplace-banner.png` });
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByRole('button', { name: 'Remove banner', exact: true }).click();
    check(
      await page.getByRole('button', { name: 'Use service template' }).getAttribute('aria-pressed'),
      'true',
      'Removal restores template',
    );
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await pub.goto(`${origin}/p/aina-demo`);
    await pub.getByRole('heading', { name: 'Aina · Demo Provider', exact: true }).waitFor();
    check(
      await pub.getByTestId('profile-cover').locator('img').count(),
      1,
      'Draft removal does not change publication',
    );
    await file.setInputFiles(fixture);
    await page.getByRole('button', { name: 'Replace banner', exact: true }).waitFor();
    check(await page.locator('.banner-preview img').count(), 1, 'Same file can be uploaded again');
    await page.getByRole('button', { name: 'Use service template', exact: true }).click();
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page
      .getByRole('heading', { name: 'A final look. A fresh start.', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Publish updates', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    await pub.reload();
    await pub.getByTestId('profile-cover').locator('.profile-cover-stamp').waitFor();
    check(
      await pub.getByTestId('profile-cover').locator('img').count(),
      0,
      'Publish removal restores public template',
    );
    await page.getByRole('button', { name: 'Unpublish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile unpublished' }).waitFor();
    await pub.reload();
    await pub.getByRole('heading', { name: 'Profile unavailable' }).waitFor();
    checks++;
    await context.close();
  }
  check(errors, [], 'No page exceptions');
  check(outbound, [], 'No external requests');
  console.log(`PASS: ${checks} banner assertions at 390px, 420px and 1440px.`);
} finally {
  if (browser) await browser.close();
  server.kill();
  await once(server, 'exit').catch(() => {});
}
