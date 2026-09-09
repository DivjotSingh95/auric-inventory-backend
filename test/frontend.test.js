const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function chartFixture() {
  const charts = [];
  let dashboardVisible = true;
  let theme = 'dark';
  const canvas = { getContext: () => ({ createLinearGradient: () => ({ addColorStop() {} }) }) };
  const document = {
    addEventListener() {},
    documentElement: { getAttribute: () => theme },
    getElementById: id => id === 'dashboard'
      ? { classList: { contains: () => dashboardVisible } }
      : canvas,
  };
  class Chart {
    constructor(ctx, config) {
      this.data = config.data;
      this.options = config.options;
      this.updates = [];
      this.resizes = 0;
      charts.push(this);
    }
    resize() { this.resizes++; }
    update(mode) { this.updates.push(mode); }
    destroy() { assert.fail('Navigation must reuse the existing chart'); }
  }
  const context = vm.createContext({ window: { fetch() {} }, document, Chart, queueMicrotask, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  return { charts, run: code => vm.runInContext(code, context), hide: () => { dashboardVisible = false; }, show: () => { dashboardVisible = true; }, light: () => { theme = 'light'; } };
}

test('returning to the dashboard reuses its chart without replaying animations', () => {
  const f = chartFixture();
  f.run('renderCharts()');
  f.hide();
  f.run('renderCharts()');
  f.show();
  f.run('renderCharts(); renderCharts()');
  assert.equal(f.charts.length, 1);
  assert.equal(f.charts[0].options.animation, false);
  assert.equal(f.charts[0].updates.length, 0);
  assert.equal(f.charts[0].resizes, 2);
});

test('new records and theme changes still update the existing dashboard chart', () => {
  const f = chartFixture();
  f.run('renderCharts()');
  f.run("sales = [{ date: '2026-05-10', total: 200 }]; expenses = [{ date: '2026-05-12', amount: 50 }]; renderCharts()");
  assert.equal(f.charts.length, 1);
  assert.equal(f.charts[0].data.datasets[0].data[5], 200);
  assert.equal(f.charts[0].data.datasets[1].data[5], 50);
  f.light();
  f.run('renderCharts()');
  assert.equal(f.charts[0].options.scales.y.ticks.color, '#78716c');
  assert.deepEqual(f.charts[0].updates, ['none', 'none']);
});

test('monthly report reuses its chart as filters switch between empty and populated months', () => {
  const f = chartFixture();
  f.run("renderExpensesDoughnutChart(['Rent'], [0])");
  assert.equal(f.charts[0].data.labels[0], 'No Expenses');
  f.light();
  f.run("renderExpensesDoughnutChart(['Rent'], [35000])");
  assert.equal(f.charts.length, 1);
  assert.equal(f.charts[0].data.datasets[0].data[0], 35000);
  assert.equal(f.charts[0].data.labels[0], 'Rent');
  assert.equal(f.charts[0].options.plugins.legend.labels.color, '#78716c');
  assert.deepEqual(f.charts[0].updates, ['none']);
});

function productFormFixture() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', readOnly: false, listeners: {}, classList: { add() {}, remove() {} }, addEventListener(event, fn) { this.listeners[event] = fn; } });
    return nodes.get(id);
  };
  const requests = [];
  const context = vm.createContext({
    window: { fetch() {}, location: { hash: '#stock' } },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: node },
    console, queueMicrotask,
    fetch: async (url, config) => { requests.push({ url, method: config.method, body: JSON.parse(config.body) }); return { ok: true }; }
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'));
  run('loadData = async () => {}; navigateToSection = () => {}; showToast = () => {}; populateProductVendorSelect = () => {}; initEventListeners();');
  return { node, requests, run, submit: () => node('product-form').listeners.submit({ preventDefault() {} }) };
}

test('editing SKU uses the original identifier and preserves stock, custom prices and metadata', async () => {
  const f = productFormFixture();
  const original = { sku: 'OLD', name: 'Test', category: 'Kurtis', costPrice: 10, sellingPrice: 20, threshold: 1, vendorName: '', dateAdded: '2026-09-01', sizes: { M: 2, '5XL': 4 }, variants: { 'Standard-M': { stock: 2, sellingPrice: 18 }, 'Standard-5XL': { stock: 4, sellingPrice: 30 } }, notes: 'Preserve me' };
  f.run('products = ' + JSON.stringify([original]) + '; editProduct(0);');
  assert.equal(f.node('product-sku').readOnly, false);
  assert.equal(f.node('product-stock-5xl').value, 4);
  f.node('product-edit-index').value = '0';
  f.node('product-sku').value = 'NEW';
  await f.submit();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, '/api/products/OLD');
  assert.equal(f.requests[0].method, 'PUT');
  assert.deepEqual(f.requests[0].body, { ...original, sku: 'NEW' });
});

test('new product form sends all eight sizes and creates their stock variants', async () => {
  const f = productFormFixture();
  for (const [id, value] of Object.entries({ 'product-sku': 'NEW', 'product-name': 'Test', 'product-category': 'Kurtis', 'product-cost-price': '10', 'product-selling-price': '20', 'product-threshold': '1', 'product-stock-3xl': '2', 'product-stock-4xl': '3', 'product-stock-5xl': '4' })) f.node(id).value = value;
  await f.submit();
  assert.equal(f.requests[0].method, 'POST');
  assert.equal(Object.keys(f.requests[0].body.sizes).length, 8);
  for (const [size, stock] of [['3XL', 2], ['4XL', 3], ['5XL', 4]]) {
    assert.equal(f.requests[0].body.sizes[size], stock);
    assert.equal(f.requests[0].body.variants['Standard-' + size].stock, stock);
  }
});
