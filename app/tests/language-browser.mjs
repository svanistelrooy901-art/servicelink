import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { continueLocal } from './demo-headers.mjs';
const origin = 'http://127.0.0.1:5198';
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--outDir',
    'dist-demo',
    '--host',
    '127.0.0.1',
    '--port',
    '5198',
    '--strictPort',
  ],
  { stdio: 'pipe' },
);
let browser,
  checks = 0;
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  await mkdir('../docs/qa/language', { recursive: true });
  for (const width of [390, 420, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route('**/*', continueLocal);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const visible = async (text) => {
      await page
        .getByText(text, { exact: true })
        .first()
        .waitFor({ timeout: 5000 })
        .catch(async (e) => {
          console.error(page.url(), (await page.locator('body').innerText()).slice(0, 2200));
          throw e;
        });
      assert.ok(await page.getByText(text, { exact: true }).first().isVisible(), text);
      checks++;
    };
    const switchTo = async (lang) => {
      await page
        .getByRole('button', { name: lang === 'bm' ? 'Bahasa Melayu' : 'English', exact: true })
        .click();
      assert.equal(await page.locator('html').getAttribute('lang'), lang === 'bm' ? 'ms' : 'en');
      checks++;
    };
    const overflow = async () => {
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `overflow ${width} ${page.url()}`,
      );
      checks++;
    };
    await page.goto(origin + '/login');
    await visible('Terokai demo');
    await overflow();
    await switchTo('en');
    await visible('Explore the demo');
    await page.reload();
    await visible('Explore the demo');
    await switchTo('bm');
    await page.getByRole('button', { name: 'Terokai demo', exact: true }).click();
    await visible('Ringkasan');
    await page.getByRole('link', { name: 'Profil saya', exact: true }).click();
    await visible('Banner profil anda');
    await visible('Hasil kerja anda, dalam gambar');
    await page
      .getByPlaceholder('Nama yang pelanggan kenali', { exact: true })
      .fill('Kerja English Kekal');
    await switchTo('en');
    assert.equal(
      await page.getByPlaceholder('How customers know you', { exact: true }).inputValue(),
      'Kerja English Kekal',
    );
    checks++;
    await visible('Unsaved changes');
    await switchTo('bm');
    await visible('Perubahan belum disimpan');
    await page.getByRole('button', { name: 'Simpan draf', exact: true }).click();
    await visible('Semua perubahan disimpan');
    await overflow();
    await page.screenshot({ path: `../docs/qa/language/profile-bm-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Servis', exact: true }).click();
    await visible('Katalog servis anda');
    await overflow();
    assert.ok(
      await page
        .locator('select')
        .first()
        .locator('option[value="hour"]')
        .textContent()
        .then((t) => t.includes('Setiap jam')),
    );
    checks++;
    await page.getByRole('link', { name: 'Kawasan servis', exact: true }).click();
    await visible('Hubungan yang baik, di tempat yang tepat');
    await overflow();
    await page.getByRole('link', { name: 'Ketersediaan', exact: true }).click();
    await visible('Isnin');
    await visible('Cara pelanggan membayar anda');
    await page.getByLabel('Benarkan pelanggan memohon tempahan', { exact: true }).check();
    await page
      .getByRole('button', { name: 'Simpan ketersediaan & maklumat bayaran', exact: true })
      .click();
    await visible('Ketersediaan dan arahan bayaran disimpan.');
    await overflow();
    await switchTo('en');
    await visible('Monday');
    await visible('How customers can pay you');
    await switchTo('bm');
    await page.getByRole('link', { name: 'Tempahan', exact: true }).click();
    await visible('Peti masuk tempahan');
    await overflow();
    await page.getByRole('link', { name: 'Pratonton & terbitkan', exact: true }).click();
    await visible('Terbitkan profil');
    await page.getByRole('button', { name: 'Terbitkan profil', exact: true }).click();
    await visible('Profil anda diterbitkan');
    await overflow();
    await switchTo('en');
    await visible('Your profile is published');
    await page.reload();
    await visible('Your profile is published');
    const profileHref = await page.locator('a[href^="/p/"][target="_blank"]').getAttribute('href');
    await page.goto(origin + profileHref);
    await visible('Kerja English Kekal');
    await visible('A little about me');
    await switchTo('bm');
    await visible('Sedikit tentang saya');
    await visible('Kerja English Kekal');
    await overflow();
    await page.screenshot({ path: `../docs/qa/language/public-bm-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Mohon tempahan', exact: true }).first().click();
    await page.locator('.booking-form select').first().waitFor();
    assert.ok(
      (await page.locator('.booking-form label').first().textContent()).includes('Pilih servis'),
    );
    checks++;
    await page.getByLabel('Nama anda', { exact: true }).fill('Customer BM English');
    await switchTo('en');
    assert.equal(
      await page.getByLabel('Your name', { exact: true }).inputValue(),
      'Customer BM English',
    );
    checks++;
    await visible('Email (optional)');
    await overflow();
    await switchTo('bm');
    await visible('Emel (pilihan)');
    await overflow();
    await page.screenshot({ path: `../docs/qa/language/booking-bm-${width}.png`, fullPage: true });
    await page.goto(origin + '/marketplace');
    assert.ok(
      await page.getByRole('region', { name: 'Cari penyedia servis', exact: true }).isVisible(),
    );
    checks++;
    assert.ok(await page.getByRole('heading', { name: /Sedikit bantuan/ }).isVisible());
    checks++;
    await overflow();
    await switchTo('en');
    assert.ok(
      await page.getByRole('region', { name: 'Search providers', exact: true }).isVisible(),
    );
    checks++;
    assert.ok(await page.getByRole('heading', { name: /A little help/ }).isVisible());
    checks++;
    await overflow();
    // Preferences propagate between tabs without overwriting drafts or publications.
    const other = await context.newPage();
    await other.goto(origin + '/login');
    await switchTo('bm');
    await other.getByRole('button', { name: 'Terokai demo', exact: true }).waitFor();
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    await context.close();
  }
  // Blocked browser storage does not prevent language changes.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  const page = await context.newPage();
  await page.goto(origin + '/login');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).waitFor();
  checks++;
  await context.close();
  console.log(`${checks} language browser checks passed (390, 420, 1440px).`);
} finally {
  await browser?.close();
  server.kill();
}
