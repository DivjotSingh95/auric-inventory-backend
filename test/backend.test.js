const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { createDatabase } = require('../database');
const { migrate } = require('../scripts/migrate');
const { createApp } = require('../server');

// Embedded PostgreSQL executes the production schema and SQL. Serialize access
// because PGlite is single-connection; real deployments use Postgres row locks.
async function fixture(t) {
  const pg = new PGlite();
  let queue = Promise.resolve();
  const pool = {
    failCommit: false,
    async connect() {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      return {
        query: (sql, args) => {
          if (sql === 'COMMIT' && pool.failCommit) { pool.failCommit = false; throw new Error('Simulated commit failure'); }
          return args ? pg.query(sql, args) : pg.exec(sql).then(results => results[results.length - 1]);
        },
        release,
      };
    },
    async query(sql, args) {
      const client = await pool.connect();
      try { return await client.query(sql, args); } finally { client.release(); }
    },
    end: () => pg.close(),
  };
  const seed = {
    products: [{ sku: 'TEST', name: 'Test garment', category: 'Kurtis', costPrice: 10, sellingPrice: 20, sizes: { M: 3 }, threshold: 1 }],
    sales: [], expenses: [], vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [],
    auth: { username: 'test-admin', password: 'test-only-password' },
  };
  await migrate(pool, seed);
  const database = createDatabase(pool);
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token;
  const request = async (path, method = 'GET', body, authorization = token) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  token = (await request('/api/login', 'POST', { username: seed.auth.username, password: seed.auth.password })).body.token;
  assert.ok(token);
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
  return { pool, database, seed, request, token, base };
}

test('migration preserves records and never overwrites an initialized database', async t => {
  const f = await fixture(t);
  assert.equal(await migrate(f.pool, { ...f.seed, products: [] }), false);
  assert.equal((await f.request('/api/data')).body.products.length, 1);
  assert.equal((await f.request('/api/data')).body.auth, undefined);
  assert.deepEqual((await f.request('/api/health')).body, { status: 'ok', database: 'supabase' });
  assert.equal((await fetch(f.base + '/db.json')).status, 404);
  assert.equal((await fetch(f.base + '/server.js')).status, 404);
});

test('login rejects invalid credentials and the old publicly known token', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/login', 'POST', { username: 'test-admin', password: 'wrong' })).status, 401);
  assert.equal((await f.request('/api/data', 'GET', undefined, 'AURIC_AUTH_TOKEN_V1')).status, 401);
  assert.equal((await f.request('/api/data', 'GET', undefined, f.token + 'tampered')).status, 401);
});

test('product, expense, and borrowing updates persist for a fresh database instance', async t => {
  const f = await fixture(t);
  const product = { ...f.seed.products[0], sizes: { M: 8 } };
  assert.equal((await f.request('/api/products', 'POST', product)).status, 200);
  await f.request('/api/expenses', 'POST', { id: 'EXP-TEST', amount: 12, category: 'Utilities', desc: 'Test', date: '2026-09-08' });
  await f.request('/api/borrowings', 'POST', { id: 'BOR-TEST', amount: 5 });
  const fresh = createDatabase(f.pool);
  const data = await fresh.run(false, () => structuredClone(fresh.read()));
  assert.equal(data.products[0].sizes.M, 8);
  assert.equal(data.expenses.length, 1);
  assert.equal(data.borrowings.length, 1);
  assert.equal((await f.request('/api/borrowings/BOR-TEST/writeoff', 'POST', {})).status, 200);
  assert.equal((await f.request('/api/expenses/EXP-TEST', 'DELETE')).status, 200);
  assert.equal((await f.request('/api/products/TEST', 'DELETE')).status, 200);
});

test('borrowing edits preserve settlement status and deletion targets only the selected record', async t => {
  const f = await fixture(t);
  const first = { id: 'BOR-1', lenderName: 'Same lender', amount: 500, date: '2026-09-09', dueDate: '2026-10-10', status: 'Active' };
  const second = { ...first, id: 'BOR-2', amount: 900 };
  await f.request('/api/borrowings', 'POST', first);
  await f.request('/api/borrowings', 'POST', second);
  const changes = { lenderName: ' Updated lender ', amount: 750, date: '2026-09-08', dueDate: '2026-12-24' };
  assert.equal((await f.request('/api/borrowings/BOR-1', 'PUT', changes)).status, 200);
  await f.request('/api/borrowings/BOR-1/writeoff', 'POST', {});
  const edited = await f.request('/api/borrowings/BOR-1', 'PUT', { ...changes, id: 'REPLACED', status: 'Active' });
  assert.equal(edited.status, 200);
  const expected = { ...first, ...changes, lenderName: 'Updated lender', status: 'Settled' };
  assert.deepEqual(edited.body.borrowing, expected);
  const fresh = createDatabase(f.pool);
  assert.deepEqual(await fresh.run(false, () => structuredClone(fresh.read().borrowings)), [expected, second]);
  assert.equal((await f.request('/api/borrowings/BOR-1', 'DELETE')).status, 200);
  assert.deepEqual((await f.request('/api/data')).body.borrowings, [second]);
  assert.equal((await f.request('/api/borrowings/BOR-1', 'DELETE')).status, 404);
  assert.equal((await f.request('/api/borrowings/BOR-1', 'PUT', changes)).status, 404);
  assert.equal((await f.request('/api/borrowings/BOR-2', 'DELETE')).status, 200);
  assert.deepEqual((await f.request('/api/data')).body.borrowings, []);
});

test('invalid or unauthorized borrowing edits and failed commits leave records unchanged', async t => {
  const f = await fixture(t);
  const borrowing = { id: 'BOR-1', lenderName: 'Test lender', amount: 500, date: '2026-09-09', dueDate: '2026-10-10', status: 'Active' };
  await f.request('/api/borrowings', 'POST', borrowing);
  for (const invalid of [{ lenderName: '  ' }, { amount: -5 }, { amount: null }, { amount: '10' }, { date: '2026-02-30' }, { dueDate: 'bad' }]) {
    assert.equal((await f.request('/api/borrowings/BOR-1', 'PUT', { ...borrowing, ...invalid })).status, 400);
  }
  for (const method of ['PUT', 'DELETE']) {
    assert.equal((await f.request('/api/borrowings/BOR-1', method, borrowing, '')).status, 401);
    f.pool.failCommit = true;
    assert.equal((await f.request('/api/borrowings/BOR-1', method, { ...borrowing, amount: 800 })).status, 503);
    assert.deepEqual((await f.request('/api/data')).body.borrowings, [borrowing]);
  }
});

test('SKU rename preserves product details and history while keeping pending deliveries connected', async t => {
  const f = await fixture(t);
  const product = { ...f.seed.products[0], sizes: { M: 3, '3XL': 2, '4XL': 3, '5XL': 4 }, dateAdded: '2026-09-01', variants: { 'Standard-5XL': { stock: 4, costPrice: 10, sellingPrice: 25 } } };
  await f.request('/api/products', 'POST', product);
  await f.request('/api/purchase-orders', 'POST', { id: 'PENDING', status: 'Issued', items: [{ sku: 'TEST', color: 'Standard', size: '5XL', qty: 2 }], totalAmount: 20 });
  await f.request('/api/purchase-orders', 'POST', { id: 'DONE', status: 'Received', items: [{ sku: 'TEST', size: 'M', qty: 1, received: 1 }] });
  const before = (await f.request('/api/data')).body;
  assert.equal((await f.request('/api/products/TEST', 'PUT', { sku: 'renamed' })).status, 200);
  const after = (await f.request('/api/data')).body;
  assert.deepEqual(after.products, [{ ...product, sku: 'RENAMED' }]);
  const expected = structuredClone(before);
  expected.products[0].sku = 'RENAMED';
  expected.purchaseOrders[0].items[0].sku = 'RENAMED';
  assert.deepEqual(after, expected);
  assert.equal((await f.request('/api/purchase-orders/PENDING/receive', 'PUT', { receivedItems: [{ sku: 'RENAMED', color: 'Standard', size: '5XL', receivedQty: 2 }], status: 'Received' })).status, 200);
  assert.equal((await f.request('/api/data')).body.products[0].sizes['5XL'], 6);
});

test('SKU conflicts, missing products, unauthorized updates and failed commits cannot alter inventory', async t => {
  const f = await fixture(t);
  await f.request('/api/products', 'POST', { ...f.seed.products[0], sku: 'OTHER' });
  const before = (await f.request('/api/data')).body;
  assert.equal((await f.request('/api/products/TEST', 'PUT', { sku: 'other' })).status, 409);
  assert.equal((await f.request('/api/products/TEST', 'PUT', { sku: ' ' })).status, 400);
  assert.equal((await f.request('/api/products/MISSING', 'PUT', { sku: 'NEW' })).status, 404);
  assert.equal((await f.request('/api/products/TEST', 'PUT', { sku: 'NEW' }, '')).status, 401);
  f.pool.failCommit = true;
  assert.equal((await f.request('/api/products/TEST', 'PUT', { sku: 'NEW' })).status, 503);
  assert.deepEqual((await f.request('/api/data')).body, before);
});

test('3XL through 5XL stock survives reload and can be sold by size', async t => {
  const f = await fixture(t);
  await f.request('/api/purchase-orders', 'POST', { id: 'NEW-SIZE', status: 'Issued', items: [{ sku: 'TEST', color: 'Standard', size: '5XL', qty: 2 }] });
  assert.equal((await f.request('/api/purchase-orders/NEW-SIZE/receive', 'PUT', { receivedItems: [{ sku: 'TEST', color: 'Standard', size: '5XL', receivedQty: 2 }], status: 'Received' })).status, 200);
  assert.equal((await f.request('/api/data')).body.products[0].sizes['5XL'], 2);
  const sizes = { '3XL': 2, '4XL': 3, '5XL': 4 };
  const variants = Object.fromEntries(Object.entries(sizes).map(([size, stock]) => ['Standard-' + size, { stock, costPrice: 10, sellingPrice: 20 }]));
  const product = { ...f.seed.products[0], sizes, variants };
  await f.request('/api/products', 'POST', product);
  const fresh = createDatabase(f.pool);
  assert.deepEqual(await fresh.run(false, () => structuredClone(fresh.read().products[0])), product);
  for (const size of Object.keys(sizes)) {
    assert.equal((await f.request('/api/sales', 'POST', { id: 'SALE-' + size, items: [{ sku: 'TEST', color: 'Standard', size, qty: 1, price: 20 }], total: 20 })).status, 200);
  }
  const saved = (await f.request('/api/data')).body.products[0];
  for (const [size, stock] of Object.entries(sizes)) {
    assert.equal(saved.sizes[size], stock - 1);
    assert.equal(saved.variants['Standard-' + size].stock, stock - 1);
  }
});

test('simultaneous checkouts cannot oversell, and a retry cannot deduct twice', async t => {
  const f = await fixture(t);
  const sale = id => ({ id, items: [{ sku: 'TEST', size: 'M', qty: 2, price: 20, cost: 10 }], total: 40 });
  const responses = await Promise.all([f.request('/api/sales', 'POST', sale('SALE-1')), f.request('/api/sales', 'POST', sale('SALE-2'))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  const state = (await f.request('/api/data')).body;
  assert.equal(state.products[0].sizes.M, 1);
  assert.equal(state.sales.length, 1);
  assert.equal((await f.request('/api/sales', 'POST', state.sales[0])).status, 200);
  assert.equal((await f.request('/api/data')).body.products[0].sizes.M, 1);
});

test('invalid quantities and duplicate cart lines leave stock and sales untouched', async t => {
  const f = await fixture(t);
  for (const qty of [-1, 0, 1.5]) {
    assert.equal((await f.request('/api/sales', 'POST', { id: 'BAD', items: [{ sku: 'TEST', size: 'M', qty }] })).status, 400);
  }
  assert.equal((await f.request('/api/sales', 'POST', { id: 'BAD', items: [{ sku: 'TEST', size: 'M', qty: 2 }, { sku: 'TEST', size: 'M', qty: 2 }] })).status, 400);
  const state = (await f.request('/api/data')).body;
  assert.equal(state.products[0].sizes.M, 3);
  assert.equal(state.sales.length, 0);
});

test('a failed commit returns an error and rolls back the sale and stock', async t => {
  const f = await fixture(t);
  f.pool.failCommit = true;
  assert.equal((await f.request('/api/sales', 'POST', { id: 'FAIL', items: [{ sku: 'TEST', size: 'M', qty: 1 }] })).status, 503);
  const state = (await f.request('/api/data')).body;
  assert.equal(state.products[0].sizes.M, 3);
  assert.equal(state.sales.length, 0);
});

test('existing frontend purchase-order payloads receive stock and settle only once', async t => {
  const f = await fixture(t);
  await f.request('/api/vendors', 'POST', { id: 'VENDOR', name: 'Test vendor', terms: '30 days credit' });
  const po = { id: 'PO-TEST', vendorName: 'Test vendor', orderDate: '2026-09-08', status: 'Issued', totalAmount: 20, items: [{ sku: 'TEST', color: 'Standard', size: 'M', qty: 2, cost: 10 }] };
  assert.equal((await f.request('/api/purchase-orders', 'POST', po)).status, 200);
  const received = await f.request('/api/purchase-orders/PO-TEST/receive', 'PUT', { receivedItems: [{ sku: 'TEST', color: 'Standard', size: 'M', receivedQty: 2 }], status: 'Received' });
  assert.equal(received.status, 200);
  assert.equal(received.body.items[0].received, 2);
  assert.equal((await f.request('/api/data')).body.products[0].sizes.M, 5);
  assert.equal((await f.request('/api/data')).body.products[0].variants['Standard-M'].stock, 5);
  await f.request('/api/purchase-orders/PO-TEST/settle', 'POST', {});
  await f.request('/api/purchase-orders/PO-TEST/settle', 'POST', {});
  assert.equal((await f.request('/api/data')).body.vendorPayments.length, 1);
});

test('reset preserves login and rejects unknown reset types', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/reset', 'POST', { type: 'invalid' })).status, 400);
  assert.equal((await f.request('/api/data')).body.products.length, 1);
  const result = await f.request('/api/reset', 'POST', { type: 'clear' });
  assert.equal(result.body.auth, undefined);
  assert.equal((await f.request('/api/data')).status, 200);
  assert.equal((await f.request('/api/data')).body.products.length, 0);
});

test('credential changes persist and invalidate previous sessions without exposing secrets', async t => {
  const f = await fixture(t);
  const changed = await f.request('/api/change-credentials', 'POST', { oldPassword: f.seed.auth.password, newUsername: 'new-admin', newPassword: 'new-test-password' });
  assert.equal(changed.status, 200);
  assert.ok(changed.body.token);
  assert.equal((await f.request('/api/data')).status, 401);
  const login = await f.request('/api/login', 'POST', { username: 'new-admin', password: 'new-test-password' });
  assert.equal(login.status, 200);
  assert.equal((await f.request('/api/data', 'GET', undefined, login.body.token)).body.auth, undefined);
});
