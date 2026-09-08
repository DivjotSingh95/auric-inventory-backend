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
