const { spawn } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:5180';
const SID = 'uber-eats-runtime-test';
const HARDENED = ['1', 'true'].includes(
  String(process.env.CUA_GYM_HARDENED || '').toLowerCase()
);
const ADMIN_TOKEN = process.env.CUA_GYM_ADMIN_TOKEN || 'uber-eats-test-admin';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    }
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for Vite');
}

async function postState(request, action, state) {
  const response = await request.post(`${BASE_URL}/post?sid=${SID}`, {
    headers: HARDENED ? { 'X-CUA-Admin-Token': ADMIN_TOKEN } : {},
    data: { action, state }
  });
  assert(response.ok(), `State ${action} failed with ${response.status()}`);
  return response.json();
}

async function readState(request) {
  const response = await request.get(`${BASE_URL}/go?sid=${SID}`, {
    headers: HARDENED ? { 'X-CUA-Admin-Token': ADMIN_TOKEN } : {}
  });
  assert(response.ok(), `State read failed with ${response.status()}`);
  return response.json();
}

async function waitForState(request, predicate, message) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const snapshot = await readState(request);
    if (predicate(snapshot.current_state)) return snapshot;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function openSession(page, setupResponse) {
  if (HARDENED) {
    assert(setupResponse.launch_url, 'Hardened setup returned no launch URL');
    await page.goto(`${BASE_URL}${setupResponse.launch_url}`, {
      waitUntil: 'domcontentloaded'
    });
  } else {
    await page.goto(`${BASE_URL}/?sid=${SID}`, { waitUntil: 'domcontentloaded' });
  }
  await page.getByRole('link', { name: /Eats/ }).waitFor({ timeout: 10_000 });
}

async function testFilters(page, request) {
  await page.getByRole('button', { name: 'Offers' }).click();
  await page.getByRole('button', { name: /^Price/ }).click();
  await page.getByRole('button', { name: '$$', exact: true }).click();
  await page.getByRole('button', { name: /^Dietary/ }).click();
  await page.getByRole('button', { name: 'Vegetarian', exact: true }).click();

  await waitForState(
    request,
    state =>
      state.ui.activeFilters.deals === true &&
      state.ui.activeFilters.priceRange.includes('$$') &&
      state.ui.activeFilters.dietary.includes('vegetarian'),
    'Filter changes were not synchronized'
  );
}

async function testCartAndCheckout(page, request) {
  await page.goto(`${BASE_URL}/store/rest_1`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Margherita Pizza', { exact: true }).first().click();
  await page.getByLabel('Medium (12")').check();
  await page.getByLabel('Mushrooms').check();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: /Add to Cart/ }).click();
  await page.getByRole('button', { name: /Cart/ }).click();
  await page.getByRole('button', { name: /Go to Checkout/ }).click();
  await page.getByRole('button', { name: '20%' }).click();
  await page.getByLabel('Promo code').fill('SAVE5');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByLabel('Delivery instructions').fill('Leave at reception');

  await waitForState(
    request,
    state =>
      state.cart.items.some(
        item =>
          item.name === 'Margherita Pizza' &&
          item.quantity === 2 &&
          item.selectedOptions.some(option => option.optionName === 'Mushrooms')
      ) &&
      state.cart.tipPercentage === 20 &&
      state.cart.promoCode === 'SAVE5' &&
      state.cart.promoDiscount === 5 &&
      state.cart.deliveryInstructions === 'Leave at reception',
    'Checkout changes were not synchronized'
  );
}

async function testOrders(page, request) {
  await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded' });
  const rateButton = page.getByRole('button', { name: /Rate order/ }).first();
  await rateButton.click();
  await page.getByRole('button', { name: '4 stars' }).click();
  await page.getByLabel('Order review').fill('Reliable sandbox order');
  await page.getByRole('button', { name: 'Submit rating' }).click();

  await waitForState(
    request,
    state =>
      state.orders.some(
        order => order.rating === 4 && order.review === 'Reliable sandbox order'
      ),
    'Order rating was not synchronized'
  );

  await page.getByRole('button', { name: /Reorder/ }).first().click();
  await page.waitForURL('**/checkout');
  await waitForState(
    request,
    state => state.cart.items.length > 0 && state.cart.restaurantId !== null,
    'Reordered items were not synchronized'
  );
}

async function main() {
  const vitePackage = require.resolve('vite/package.json');
  const viteCli = path.resolve(path.dirname(vitePackage), 'bin/vite.js');
  const server = spawn(
    process.execPath,
    [viteCli, '--host', '127.0.0.1', '--port', '5180', '--strictPort'],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        CUA_GYM_ADMIN_TOKEN: ADMIN_TOKEN
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  let serverOutput = '';
  server.stdout.on('data', chunk => { serverOutput += chunk; });
  server.stderr.on('data', chunk => { serverOutput += chunk; });

  let browser;
  const runtimeErrors = [];
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        const source = message.location().url;
        runtimeErrors.push(source ? `${message.text()} (${source})` : message.text());
      }
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        let action = '';
        try {
          action = response.request().postDataJSON()?.action || '';
        } catch {
          // The failed request did not carry JSON.
        }
        runtimeErrors.push(
          `${response.status()} ${response.url()}${action ? ` (${action})` : ''}`
        );
      }
    });

    const dataModule = await import(
      pathToFileURL(`${__dirname}/src/utils/dataManager.js`).href
    );
    const initialState = dataModule.createInitialData();
    const setupResponse = await postState(page.request, 'set', initialState);

    await openSession(page, setupResponse);
    await testFilters(page, page.request);
    await testCartAndCheckout(page, page.request);
    await testOrders(page, page.request);

    const snapshot = await readState(page.request);
    assert(snapshot.initial_state, 'The state API returned no initial baseline');
    assert(snapshot.current_state, 'The state API returned no current state');
    assert(
      snapshot.state_diff && Object.keys(snapshot.state_diff).length > 0,
      'The state API returned no state diff after mutations'
    );
    assert(
      runtimeErrors.length === 0,
      `Browser runtime errors:\n${runtimeErrors.join('\n')}`
    );
    await context.close();
    console.log(`Uber Eats runtime test passed (${HARDENED ? 'hardened' : 'legacy'} mode)`);
  } catch (error) {
    console.error(error.stack || error);
    if (runtimeErrors.length > 0) {
      console.error(`\nBrowser runtime errors:\n${runtimeErrors.join('\n')}`);
    }
    if (serverOutput) console.error(`\nVite output:\n${serverOutput}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
  }
}

main();
