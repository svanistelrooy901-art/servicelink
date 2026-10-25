import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import QRCode from 'qrcode';
const root = fileURLToPath(new URL('..', import.meta.url)),
  qa = fileURLToPath(new URL('../../docs/qa/m2/', import.meta.url));
await mkdir(qa, { recursive: true });
const origin = 'http://127.0.0.1:5194';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_DATA_BACKEND: 'local' },
  },
);
let errorLog = '';
server.stderr.on('data', (d) => (errorLog += d));
let browser;
const myDate = (v = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(v));
const bookingDate = myDate(Date.now() + 2 * 86400000),
  blockDate = myDate(Date.now() + 4 * 86400000),
  deadline = `${myDate(Date.now() + 86400000)}T08:00`;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try {
      await fetch(origin);
      ready = true;
      break;
    } catch {
      if (server.exitCode !== null) throw new Error(errorLog);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(ready);
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu'],
  });
  let checks = 0;
  const errors = [],
    external = [];
  for (const width of [390, 420, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
    });
    await context.route('**/*', async (route) => {
      const u = route.request().url();
      if (!u.startsWith(origin) && !u.startsWith('data:')) {
        external.push(u);
        await route.abort();
      } else await route.continue();
    });
    const owner = await context.newPage();
    owner.on('pageerror', (e) => errors.push(e.message));
    const noOverflow = async (page) => {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      checks++;
    };
    await owner.goto(`${origin}/login`);
    await owner.getByRole('button', { name: 'Explore the demo' }).click();
    await owner.getByRole('link', { name: 'My profile', exact: true }).click();
    await owner.getByLabel('WhatsApp number', { exact: true }).fill('0120000000');
    await owner.getByLabel('Show my WhatsApp number publicly').check();
    await owner.getByRole('link', { name: 'Preview & publish', exact: true }).click();
    await owner.getByRole('button', { name: 'Publish profile', exact: true }).click();
    await owner.getByRole('status').filter({ hasText: 'Profile published' }).waitFor();
    await owner.getByRole('link', { name: 'Availability', exact: true }).click();
    await owner.getByLabel('Let customers request a booking').check();
    await owner.getByLabel('Sunday', { exact: true }).check();
    await owner.getByLabel('Bank name', { exact: true }).fill('Demo Bank');
    await owner.getByLabel('Account holder', { exact: true }).fill('FICTIONAL TEST ONLY');
    await owner.getByLabel('Account number', { exact: true }).fill('DEMO-DO-NOT-PAY');
    await owner
      .getByLabel('Payment instructions (optional)')
      .fill('Demonstration details only. Do not transfer real money.');
    await owner
      .getByLabel('Payment QR image')
      .setInputFiles({
        name: 'demo-payment-qr.png',
        mimeType: 'image/png',
        buffer: await QRCode.toBuffer('SERVICE LINK DEMO - DO NOT PAY', { width: 256, margin: 4 }),
      });
    await owner.getByAltText('Your payment QR', { exact: true }).waitFor();
    checks++;
    await owner
      .getByRole('button', { name: 'Save availability & payment details', exact: true })
      .click();
    await owner
      .getByRole('status')
      .filter({ hasText: 'Availability and payment instructions saved' })
      .waitFor();
    checks++;
    await owner.getByLabel('Block date', { exact: true }).fill(blockDate);
    await owner.getByLabel('Private note', { exact: true }).fill('Private family time');
    await owner.getByRole('button', { name: 'Block time', exact: true }).click();
    await owner.getByRole('status').filter({ hasText: 'Time blocked' }).waitFor();
    checks++;
    await noOverflow(owner);
    await owner.evaluate(() => scrollTo(0, 0));
    if (width === 1440)
      await owner.screenshot({ path: `${qa}desktop-availability.png`, fullPage: true });
    if (width === 420)
      await owner.screenshot({ path: `${qa}mobile-availability-420.png`, fullPage: true });
    const customer = await context.newPage();
    customer.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('PAGE ERROR', e.message);
    });
    await customer.goto(`${origin}/p/aina-demo`);
    await customer.getByRole('link', { name: 'Request booking', exact: true }).click();
    await customer.getByLabel('Preferred date', { exact: true }).fill(bookingDate);
    await customer.getByLabel('Preferred start time').selectOption('09:00');
    await customer.getByLabel('Service district / zone').selectOption('my-07-04');
    await customer.getByLabel('Your name', { exact: true }).fill('Demo Guest');
    await customer.getByLabel('Mobile number', { exact: true }).fill('0120000000');
    await customer
      .getByLabel('I agree to share these details with this provider to handle my booking.')
      .check();
    await noOverflow(customer);
    if (width === 390)
      await customer.screenshot({ path: `${qa}mobile-request-390.png`, fullPage: true });
    await customer.getByRole('button', { name: 'Send booking request', exact: true }).click();
    await customer.getByText('Awaiting provider', { exact: true }).waitFor();
    const privateUrl = customer.url();
    assert.ok(privateUrl.includes('#'));
    assert.equal(
      await customer.getByRole('heading', { name: 'Pay the provider directly' }).count(),
      0,
    );
    checks++;
    await owner.getByRole('link', { name: 'Bookings', exact: true }).click();
    await owner.getByRole('heading', { name: 'Demo Guest', exact: true }).waitFor();
    await owner.getByLabel('Final amount due (RM)').fill('50');
    await owner.getByLabel('Payment deadline (MYT)').fill(deadline);
    await owner.getByRole('button', { name: 'Accept & reserve slot', exact: true }).click();
    await owner.getByRole('status').filter({ hasText: 'Booking accepted' }).waitFor();
    checks++;
    await customer.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await customer
      .getByRole('heading', { name: 'Pay the provider directly', exact: true })
      .waitFor();
    await customer.getByText('DEMO-DO-NOT-PAY', { exact: true }).waitFor();
    await customer.getByAltText('Provider payment QR', { exact: true }).waitFor();
    assert.equal(
      await customer
        .getByRole('button', { name: 'WhatsApp receipt sharing · demo disabled', exact: true })
        .isDisabled(),
      true,
    );
    checks++;
    await customer
      .getByRole('button', { name: 'I have paid · notify provider', exact: true })
      .click();
    await customer.getByText('Customer says paid · unverified', { exact: true }).waitFor();
    assert.equal(await customer.getByText('Confirmed', { exact: true }).count(), 0);
    checks++;
    await noOverflow(customer);
    if (width === 390)
      await customer.screenshot({ path: `${qa}mobile-payment-390.png`, fullPage: true });
    await owner.getByRole('button', { name: 'Refresh bookings', exact: true }).click();
    await owner.getByRole('button', { name: 'Awaiting payment', exact: true }).click();
    await owner.getByRole('heading', { name: 'Demo Guest', exact: true }).waitFor();
    assert.equal(
      await owner.getByRole('button', { name: 'Verify money received', exact: true }).isDisabled(),
      true,
    );
    checks++;
    await owner
      .getByLabel('I checked my bank / wallet and the full amount due has arrived.')
      .check();
    await owner.getByRole('button', { name: 'Verify money received', exact: true }).click();
    await owner.getByRole('status').filter({ hasText: 'manually verified' }).waitFor();
    await owner.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await owner.getByRole('heading', { name: 'Demo Guest', exact: true }).waitFor();
    await owner.getByLabel('View date', { exact: true }).fill(bookingDate);
    await noOverflow(owner);
    await owner.evaluate(() => scrollTo(0, 0));
    if (width === 1440)
      await owner.screenshot({ path: `${qa}desktop-bookings.png`, fullPage: true });
    if (width === 420)
      await owner.screenshot({ path: `${qa}mobile-bookings-420.png`, fullPage: true });
    await customer.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await customer.getByText('Manual payment · provider verified', { exact: true }).waitFor();
    checks++;
    const invalid = await context.newPage();
    await invalid.goto(privateUrl.split('#')[0] + '#' + '0'.repeat(64));
    await invalid
      .getByRole('alert')
      .filter({ hasText: 'private booking link is invalid' })
      .waitFor();
    checks++;
    await invalid.close();
    await customer.goto(`${origin}/p/aina-demo/book`);
    await customer.getByLabel('Preferred date', { exact: true }).fill(bookingDate);
    assert.equal(
      await customer.getByLabel('Preferred start time').locator('option[value="09:00"]').count(),
      0,
    );
    checks++;
    await owner.getByRole('button', { name: 'Add phone / WhatsApp booking', exact: true }).click();
    await owner.getByLabel('Agreed amount due (RM)', { exact: true }).fill('50');
    await owner.getByLabel('Manual booking payment deadline', { exact: true }).fill(deadline);
    const manual = owner.locator('.manual-booking');
    await manual.getByLabel('Preferred date', { exact: true }).fill(bookingDate);
    await manual.getByLabel('Preferred start time').selectOption('11:00');
    await manual.getByLabel('Service district / zone').selectOption('my-07-04');
    await manual.getByLabel('Your name', { exact: true }).fill('Demo Manual Customer');
    await manual.getByLabel('Mobile number', { exact: true }).fill('0120000000');
    await manual
      .getByLabel('I agree to share these details with this provider to handle my booking.')
      .check();
    await manual.getByRole('button', { name: 'Add accepted manual booking', exact: true }).click();
    await owner.getByRole('status').filter({ hasText: 'Manual booking added' }).waitFor();
    await owner.getByRole('button', { name: 'Awaiting payment', exact: true }).click();
    await owner.getByRole('heading', { name: 'Demo Manual Customer', exact: true }).waitFor();
    checks++;
    owner.once('dialog', (d) => d.accept());
    await owner
      .locator('.owner-booking')
      .filter({ hasText: 'Demo Manual Customer' })
      .getByRole('button', { name: 'Cancel booking', exact: true })
      .click();
    await owner.getByRole('status').filter({ hasText: 'Booking cancelled' }).waitFor();
    checks++;
    await owner.reload();
    await owner.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await owner.getByRole('heading', { name: 'Demo Guest', exact: true }).waitFor();
    checks++;
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    `PASS: ${checks} booking browser assertions at 390px, 420px, 1440px. No external requests or page errors.`,
  );
} finally {
  if (browser) await browser.close();
  server.kill();
  await once(server, 'exit').catch(() => {});
}
