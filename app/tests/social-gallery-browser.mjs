import { continueLocal } from './demo-headers.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const qaRoot = fileURLToPath(new URL('../../docs/qa/social-gallery/', import.meta.url));
await mkdir(qaRoot, { recursive: true });
const port = 5199,
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    ...(process.env.SL_BROWSER_DIST ? ['preview', '--outDir', process.env.SL_BROWSER_DIST] : []),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
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
  const check = (a, b, message) => {
    assert.deepEqual(a, b, message);
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
      } else await continueLocal(route);
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/login`);
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Your work, in pictures' }).waitFor();
    const editor = page.locator('.gallery-editor');
    check(await editor.locator('.gallery-edit-card').count(), 0, 'Empty gallery starts blank');
    const links = {
      Facebook: 'https://www.facebook.com/fictional-servicelink-demo-only',
      Instagram: 'https://www.instagram.com/fictional.servicelink.demo',
      Threads: 'https://www.threads.com/@fictional.servicelink.demo',
    };
    await page.getByLabel('Facebook link').fill('javascript:alert(1)');
    check(
      await page.getByLabel('Facebook link').getAttribute('aria-invalid'),
      'true',
      'Unsafe link flagged',
    );
    for (const [name, url] of Object.entries(links))
      await page.getByLabel(`${name} link`).fill(url);
    check(
      await page.getByLabel('Facebook link').getAttribute('aria-invalid'),
      'false',
      'Valid platform link accepted',
    );
    const fixtures = (
      await page.evaluate(() =>
        Array.from({ length: 9 }, (_, i) => {
          const c = document.createElement('canvas');
          c.width = 1600;
          c.height = 1200;
          const g = c.getContext('2d');
          const backgrounds = [
            '#f5dec9',
            '#e5dff3',
            '#daebe2',
            '#dce7fa',
            '#f5e9c7',
            '#efdae2',
            '#e0edf0',
            '#e9e4d7',
            '#efe1d1',
          ];
          g.fillStyle = backgrounds[i];
          g.fillRect(0, 0, 1600, 1200);
          g.fillStyle = '#ffffff66';
          g.beginPath();
          g.arc(1250, 250, 500, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#465c78';
          g.font = 'bold 100px sans-serif';
          g.fillText(`Work ${i + 1}`, 160, 560);
          g.font = '35px sans-serif';
          g.fillText('FICTIONAL GALLERY · DEMO ONLY', 160, 660);
          return c.toDataURL('image/png').split(',')[1];
        }),
      )
    ).map((data, i) => ({
      name: `fictional-work-${i + 1}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(data, 'base64'),
    }));
    const input = page.getByLabel('Gallery picture files');
    await input.setInputFiles(fixtures);
    await editor.getByRole('alert').filter({ hasText: 'Maximum 8' }).waitFor();
    check(await editor.locator('.gallery-edit-card').count(), 0, 'Nine-file batch rejected');
    await input.setInputFiles({
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await editor.getByRole('alert').filter({ hasText: 'under 8 MB' }).waitFor();
    check(await editor.locator('.gallery-edit-card').count(), 0, 'Unsupported SVG rejected');
    await input.setInputFiles([
      fixtures[0],
      { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') },
    ]);
    await editor.getByRole('alert').filter({ hasText: 'Could not read' }).waitFor();
    check(
      await editor.locator('.gallery-edit-card').count(),
      0,
      'Failed batch leaves gallery unchanged',
    );
    // Slow decoding models a busy device and makes pending-save protection observable.
    await page.evaluate(() => {
      const decode = Image.prototype.decode;
      Image.prototype.decode = function () {
        return new Promise((r) => setTimeout(r, 100)).then(() => decode.call(this));
      };
    });
    await input.setInputFiles(fixtures.slice(0, 8));
    await page.getByRole('button', { name: 'Preparing pictures…', exact: true }).waitFor();
    check(
      await page.getByRole('button', { name: 'Save draft', exact: true }).isDisabled(),
      true,
      'Cannot save unfinished batch',
    );
    await page.getByRole('button', { name: 'Gallery full · 8 pictures', exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save draft'))
          ?.disabled,
    );
    check(await editor.locator('.gallery-edit-card').count(), 8, 'Eight pictures added');
    check(
      await page
        .getByRole('button', { name: 'Gallery full · 8 pictures', exact: true })
        .isDisabled(),
      true,
      'Ninth upload disabled',
    );
    const media = await editor.locator('.gallery-edit-image img').evaluateAll((imgs) =>
      imgs.map((img) => ({
        webp: img.src.startsWith('data:image/webp;base64,'),
        width: img.naturalWidth,
        length: img.src.length,
      })),
    );
    check(
      media.every((p) => p.webp && p.width === 1200 && p.length <= 120000),
      true,
      'All eight resized and compressed',
    );
    for (let i = 1; i <= 8; i++)
      await page
        .getByLabel(`Caption for picture ${i}`, { exact: true })
        .fill(`Fictional work ${i}`);
    await page.getByRole('button', { name: 'Move picture 3 earlier', exact: true }).click();
    check(
      await page.getByLabel('Caption for picture 2', { exact: true }).inputValue(),
      'Fictional work 3',
      'Provider chooses first two pictures',
    );
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Gallery full · 8 pictures', exact: true }).waitFor();
    check(await editor.locator('.gallery-edit-card').count(), 8, 'Gallery survives reload');
    check(
      await page.getByLabel('Caption for picture 2', { exact: true }).inputValue(),
      'Fictional work 3',
      'Order and captions persist',
    );
    for (const [name, url] of Object.entries(links))
      check(await page.getByLabel(`${name} link`).inputValue(), url, 'Social link persists');
    const preview = page.getByTestId('profile-presentation');
    check(
      await preview.getByTestId('gallery-teasers').locator('img').count(),
      2,
      'Preview shows two thumbnails',
    );
    check(
      await preview.locator('.profile-social button:disabled').count(),
      3,
      'Preview social actions disabled',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'Editor fits viewport',
    );
    if (width === 390 || width === 1440)
      await editor.screenshot({
        path: `${qaRoot}editor-${width}.png`,
        style: '.save-bar { visibility: hidden; }',
      });
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page
      .getByRole('heading', { name: 'A final look. A fresh start.', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Publish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    const pub = await context.newPage();
    pub.on('pageerror', (e) => errors.push(e.message));
    await pub.goto(`${origin}/p/aina-demo`);
    await pub.getByRole('heading', { name: 'Aina · Demo Provider', exact: true }).waitFor();
    const teasers = pub.getByTestId('gallery-teasers');
    check(await teasers.locator('img').count(), 2, 'Public profile shows only two pictures');
    check(
      await teasers.locator('img').nth(1).getAttribute('alt'),
      'Fictional work 3',
      'Published order matches preview',
    );
    for (const [name, url] of Object.entries(links)) {
      const link = pub.getByRole('link', { name: `${name} profile`, exact: true });
      check(await link.getAttribute('href'), url, 'Published social target matches');
      check(await link.getAttribute('target'), '_blank', 'Social target opens new tab');
      check(
        (await link.getAttribute('rel')).includes('noopener'),
        true,
        'External link isolates opener',
      );
    }
    await teasers.locator('img').first().click();
    check(await pub.getByRole('dialog').count(), 0, 'Thumbnail does not open a picture');
    check(context.pages().length, 2, 'Thumbnail creates no individual tab');
    const more = pub.getByRole('button', { name: 'More gallery pictures', exact: true });
    await more.click();
    const modal = pub.getByRole('dialog', { name: /Gallery/ });
    await modal.waitFor();
    check(await modal.locator('img').count(), 8, 'More opens all eight pictures');
    check(
      await modal.locator('img').nth(1).getAttribute('alt'),
      'Fictional work 3',
      'Modal order matches',
    );
    check(await modal.locator('a').count(), 0, 'No individual image links');
    check(await modal.locator('button').count(), 1, 'Only modal close is interactive');
    check(
      await pub.evaluate(() => document.body.style.overflow),
      'hidden',
      'Background scroll locked',
    );
    await modal.locator('img').nth(4).click();
    check(await modal.locator('img').count(), 8, 'Clicking modal picture does not open detail');
    check(context.pages().length, 2, 'Modal picture creates no new tab');
    check(new URL(pub.url()).pathname, '/p/aina-demo', 'Image clicks keep current page');
    check(
      await modal
        .locator('img')
        .first()
        .evaluate((img) => getComputedStyle(img).objectFit),
      'contain',
      'Popup shows complete pictures',
    );
    check(
      await pub.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'Public profile fits viewport',
    );
    if (width === 390 || width === 420 || width === 1440)
      await pub.screenshot({ path: `${qaRoot}gallery-modal-${width}.png` });
    await pub.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    check(await pub.evaluate(() => document.body.style.overflow), '', 'Scroll restored on Escape');
    check(
      await more.evaluate((el) => el === document.activeElement),
      true,
      'Focus returns to More',
    );
    await more.click();
    await modal.waitFor();
    await modal.getByRole('button', { name: 'Close gallery' }).click();
    await modal.waitFor({ state: 'hidden' });
    checks++;
    await more.click();
    await modal.waitFor();
    await pub.mouse.click(2, 2);
    await modal.waitFor({ state: 'hidden' });
    checks++;
    if (width === 390 || width === 1440)
      await pub.screenshot({ path: `${qaRoot}public-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByRole('button', { name: 'Gallery full · 8 pictures', exact: true }).waitFor();
    for (let i = 0; i < 6; i++)
      await page.getByRole('button', { name: 'Remove picture 3', exact: true }).click();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await pub.reload();
    await pub.getByRole('heading', { name: 'Aina · Demo Provider', exact: true }).waitFor();
    await more.click();
    await modal.waitFor();
    check(await modal.locator('img').count(), 8, 'Saved removal leaves public snapshot intact');
    await pub.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish updates', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    await pub.reload();
    await pub.getByRole('heading', { name: 'Aina · Demo Provider', exact: true }).waitFor();
    check(await teasers.locator('img').count(), 2, 'Two-picture gallery renders correctly');
    check(await more.count(), 0, 'No More button when all pictures fit');
    await page.getByRole('link', { name: 'My profile', exact: true }).click();
    await page.getByRole('button', { name: 'Remove picture 2', exact: true }).click();
    await page.getByRole('button', { name: 'Remove picture 1', exact: true }).click();
    for (const name of Object.keys(links)) await page.getByLabel(`${name} link`).fill('');
    await page.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish updates', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    await pub.reload();
    await pub.getByRole('heading', { name: 'Aina · Demo Provider', exact: true }).waitFor();
    check(await pub.locator('.profile-gallery').count(), 0, 'Empty gallery hidden');
    check(
      await pub.getByRole('navigation', { name: 'Social media' }).count(),
      0,
      'Empty social links hidden',
    );
    await page.getByRole('button', { name: 'Unpublish profile', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile unpublished' }).waitFor();
    await pub.reload();
    await pub.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor();
    checks++;
    await context.close();
  }
  check(errors, [], 'No page errors');
  check(outbound, [], 'No external requests');
  console.log(`PASS: ${checks} social/gallery browser assertions at 390px, 420px and 1440px.`);
} finally {
  if (browser) await browser.close();
  server.kill();
  await once(server, 'exit').catch(() => {});
}
