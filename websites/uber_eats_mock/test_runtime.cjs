const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  FIXTURE_IDS,
  FIXTURE_VALUES,
  createInjectedStateFixture
} = require('./test_fixture.cjs');

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
  await page.getByText(FIXTURE_VALUES.restaurantName, { exact: true }).first().waitFor();
}

async function testDiscovery(page, request) {
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

  await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await waitForState(
    request,
    state => state.ui.recentSearches.length === 0,
    'Recent searches were not cleared'
  );

  await page.locator('.search-page__input').fill('contract');
  await page.locator('.search-page__input').press('Enter');
  await page.getByText(FIXTURE_VALUES.restaurantName, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add to favorites' }).click();
  await waitForState(
    request,
    state =>
      state.ui.searchQuery === 'contract' &&
      state.ui.recentSearches.includes('contract') &&
      state.user.favoriteRestaurantIds.includes(FIXTURE_IDS.restaurant),
    'Search or favorite changes were not synchronized'
  );
}

async function testAccountAndAddress(page, request) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /101 Fixture Avenue/ }).click();
  await page.getByRole('button', { name: 'Add new address' }).click();
  await page.getByPlaceholder('Label (Home, Work...)').fill('QA Lab');
  await page.getByPlaceholder('Street address *').fill('500 Test Lane');
  await page.getByPlaceholder('Apt / Suite (optional)').fill('Suite 5');
  await page.getByPlaceholder('City *').fill('Test City');
  await page.getByPlaceholder('ZIP').fill('94107');
  await page.getByPlaceholder('Delivery instructions (optional)').fill('Buzz the test suite');
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.getByRole('button', { name: /QA Lab/ }).click();

  await page.getByRole('button', { name: 'Pickup', exact: true }).click();
  await waitForState(
    request,
    state => state.cart.deliveryMode === 'pickup' && state.ui.deliveryMode === 'pickup',
    'Pickup mode was not synchronized'
  );
  await page.getByRole('button', { name: 'Delivery', exact: true }).click();

  await waitForState(
    request,
    state => {
      const address = state.user.addresses.find(candidate => candidate.label === 'QA Lab');
      return (
        address?.street === '500 Test Lane' &&
        address.instructions === 'Buzz the test suite' &&
        state.ui.selectedAddressId === address.id &&
        state.cart.deliveryMode === 'delivery' &&
        state.ui.deliveryMode === 'delivery'
      );
    },
    'Address or delivery mode changes were not synchronized'
  );

  await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: FIXTURE_VALUES.userName }).waitFor();
  await page.getByRole('button', { name: 'Try free for 1 month' }).click();
  await page.getByRole('button', { name: 'Start free trial' }).click();
  await waitForState(
    request,
    state => state.user.uberOneActive === true,
    'Uber One activation was not synchronized'
  );
}

async function testCartAndCheckout(page, request) {
  await page.goto(`${BASE_URL}/store/${FIXTURE_IDS.restaurant}`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText(FIXTURE_VALUES.pizzaName, { exact: true }).first().click();
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
          item.name === FIXTURE_VALUES.pizzaName &&
          item.quantity === 2 &&
          item.selectedOptions.some(option => option.optionName === 'Mushrooms')
      ) &&
      state.cart.tipPercentage === 20 &&
      state.cart.promoCode === 'SAVE5' &&
      state.cart.promoDiscount === 5 &&
      state.cart.deliveryInstructions === 'Leave at reception',
    'Checkout changes were not synchronized'
  );

  await page.getByRole('button', { name: /Place Order/ }).click();
  await page.waitForURL('**/orders/*');
  await waitForState(
    request,
    state => {
      const placedOrder = state.orders.find(order => order.status === 'placed');
      return (
        placedOrder?.restaurantId === FIXTURE_IDS.restaurant &&
        placedOrder.items.some(item => item.name === FIXTURE_VALUES.pizzaName) &&
        placedOrder.deliveryAddress.label === 'QA Lab' &&
        placedOrder.deliveryFee === 0 &&
        placedOrder.promoDiscount === 5 &&
        state.cart.items.length === 0
      );
    },
    'Placed order was not synchronized'
  );
}

async function testOrders(page, request) {
  await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded' });
  const deliveredOrder = page
    .getByRole('heading', { name: 'Past orders' })
    .locator('..')
    .locator('article.order-card')
    .first();
  await deliveredOrder.getByRole('button', { name: /Rate order/ }).click();
  await page.getByRole('button', { name: '4 stars' }).click();
  await page.getByLabel('Order review').fill('Reliable sandbox order');
  await page.getByRole('button', { name: 'Submit rating' }).click();

  await waitForState(
    request,
    state =>
      state.orders.some(order =>
        order.id === FIXTURE_IDS.deliveredOrder &&
        order.rating === 4 &&
        order.review === 'Reliable sandbox order'
      ),
    'Order rating was not synchronized'
  );

  await deliveredOrder.getByRole('button', { name: /Reorder/ }).click();
  await page.waitForURL('**/checkout');
  await waitForState(
    request,
    state =>
      state.cart.restaurantId === FIXTURE_IDS.restaurant &&
      state.cart.items.some(item => item.menuItemId === FIXTURE_IDS.pizza),
    'Reordered items were not synchronized'
  );

  await page.goto(`${BASE_URL}/store/${FIXTURE_IDS.restaurant}`, {
    waitUntil: 'domcontentloaded'
  });
  await page.getByText(FIXTURE_VALUES.dessertName, { exact: true }).first().click();
  await page.getByRole('button', { name: /Add to Cart/ }).click();
  await page.getByRole('button', { name: /Cart/ }).click();
  await page.getByRole('button', { name: /Go to Checkout/ }).click();
  await page.getByLabel('Promo code').fill('SAVE5');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await waitForState(
    request,
    state =>
      state.cart.items.some(item => item.menuItemId === FIXTURE_IDS.pizza) &&
      state.cart.items.some(item => item.menuItemId === FIXTURE_IDS.dessert) &&
      state.cart.promoCode === 'SAVE5' &&
      state.ui.selectedAddressId ===
        state.user.addresses.find(address => address.label === 'QA Lab')?.id,
    'Task-style reorder changes were not synchronized'
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

    const initialState = createInjectedStateFixture();
    const setupResponse = await postState(page.request, 'set', initialState);

    await openSession(page, setupResponse);
    await testDiscovery(page, page.request);
    await testAccountAndAddress(page, page.request);
    await testCartAndCheckout(page, page.request);
    await testOrders(page, page.request);

    const snapshot = await readState(page.request);
    assert(snapshot.initial_state, 'The state API returned no initial baseline');
    assert(snapshot.current_state, 'The state API returned no current state');
    assert(
      snapshot.initial_state.user.id === FIXTURE_IDS.user &&
      snapshot.current_state.user.id === FIXTURE_IDS.user,
      'The externally injected fixture was not preserved'
    );
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
