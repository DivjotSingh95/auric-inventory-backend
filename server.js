const express = require('express');
const cors = require('cors');
const { createHmac, timingSafeEqual, randomBytes } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const path = require('node:path');
const { createPool, createDatabase } = require('./database');

function createApp(database) {
const app = express();
app.use(cors());
app.use(express.json());
const readDb = () => database.read();
const writeDb = data => database.write(data);

function signature(payload, auth) {
  return createHmac('sha256', auth.sessionSecret).update(payload).digest('base64url');
}
function issueToken(auth) {
  const payload = Buffer.from(JSON.stringify({ expires: Date.now() + 30 * 86400000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return payload + '.' + signature(payload, auth);
}
function validToken(token, auth) {
  if (!token || !auth?.sessionSecret) return false;
  try {
    const [payload, supplied, extra] = token.split('.');
    if (extra !== undefined || !payload || !supplied) return false;
    const expected = Buffer.from(signature(payload, auth));
    const actual = Buffer.from(supplied);
    return expected.length === actual.length && timingSafeEqual(expected, actual) && JSON.parse(Buffer.from(payload, 'base64url').toString()).expires > Date.now();
  } catch { return false; }
}
function route(method, url, handler) {
  app[method](url, async (req, res, next) => {
    try {
      const response = await database.run(method !== 'get', () => {
        const reply = { statusCode: 200, body: undefined,
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; }
        };
        if (url !== '/api/login' && !validToken(req.headers.authorization, readDb().auth)) {
          return reply.status(401).json({ error: 'Unauthorized' });
        }
        handler(req, reply);
        return reply;
      });
      // Only acknowledge a write after its database transaction commits.
      res.status(response.statusCode).json(response.body);
    } catch (error) { next(error); }
  });
}
app.get('/api/health', async (req, res) => {
  try {
    await database.health();
    res.json({ status: 'ok', database: 'supabase' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

const DEFAULT_PRODUCTS = [
  { sku: "SU-ANARKALI-01", name: "Anarkali Embroidered Silk Suit Set", category: "Suits", costPrice: 1200.00, sellingPrice: 2800.00, sizes: { S: 2, M: 3, L: 2, XL: 1, XXL: 0 }, threshold: 3 },
  { sku: "KU-COTTON-02", name: "Designer Floral Cotton Kurti", category: "Kurtis", costPrice: 400.00, sellingPrice: 950.00, sizes: { S: 4, M: 5, L: 4, XL: 2, XXL: 0 }, threshold: 5 },
  { sku: "DR-SUMMER-03", name: "Floral Summer Georgette Dress", category: "Dresses", costPrice: 800.00, sellingPrice: 1850.00, sizes: { S: 1, M: 1, L: 0, XL: 0, XXL: 0 }, threshold: 4 },
  { sku: "TR-SLIM-04", name: "Slim Fit Cotton Trouser Pants", category: "Trousers", costPrice: 350.00, sellingPrice: 790.00, sizes: { S: 5, M: 5, L: 5, XL: 3, XXL: 2 }, threshold: 8 },
  { sku: "SA-BANARASI-05", name: "Banarasi Silk Saree Gold Border", category: "Sarees", costPrice: 2500.00, sellingPrice: 5500.00, sizes: { S: 0, M: 1, L: 0, XL: 0, XXL: 0 }, threshold: 2 },
  { sku: "KU-GEORGETTE-06", name: "Embroidered Georgette Kurti Set", category: "Kurtis", costPrice: 600.00, sellingPrice: 1400.00, sizes: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 }, threshold: 3 },
  { sku: "DU-CHIFFON-07", name: "Solid Colored Chiffon Dupatta", category: "Dupattas", costPrice: 150.00, sellingPrice: 350.00, sizes: { S: 10, M: 10, L: 10, XL: 5, XXL: 5 }, threshold: 8 }
];

const DEFAULT_SALES = [
  {
    id: "INV-10020",
    date: "2026-04-15T14:30:00",
    customer: "Priya Sharma",
    items: [
      { sku: "SU-ANARKALI-01", name: "Anarkali Embroidered Silk Suit Set", size: "M", qty: 1, price: 2800.00, cost: 1200.00 },
      { sku: "DU-CHIFFON-07", name: "Solid Colored Chiffon Dupatta", size: "M", qty: 1, price: 350.00, cost: 150.00 }
    ],
    subtotal: 3150.00,
    discount: 5,
    total: 2992.50
  },
  {
    id: "INV-10021",
    date: "2026-05-05T10:15:00",
    customer: "Walk-in Customer",
    items: [
      { sku: "KU-COTTON-02", name: "Designer Floral Cotton Kurti", size: "M", qty: 2, price: 950.00, cost: 400.00 }
    ],
    subtotal: 1900.00,
    discount: 0,
    total: 1900.00
  },
  {
    id: "INV-10022",
    date: "2026-05-12T16:45:00",
    customer: "Komal Gupta",
    items: [
      { sku: "SA-BANARASI-05", name: "Banarasi Silk Saree Gold Border", size: "M", qty: 1, price: 5500.00, cost: 2500.00 }
    ],
    subtotal: 5500.00,
    discount: 10,
    total: 4950.00
  }
];

const DEFAULT_EXPENSES = [
  { id: "EXP-100", date: "2026-04-01", category: "Rent", desc: "Boutique Retail Space Lease - April", amount: 35000.00 },
  { id: "EXP-101", date: "2026-04-10", category: "Utilities", desc: "Electricity bill & Showroom Wifi", amount: 6200.00 },
  { id: "EXP-102", date: "2026-05-01", category: "Rent", desc: "Boutique Retail Space Lease - May", amount: 35000.00 },
  { id: "EXP-103", date: "2026-05-08", category: "Utilities", desc: "High-power AC Electricity Bill", amount: 8900.00 }
];

// AUTH ENDPOINTS
route('post', '/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  if (db.auth.username === username && db.auth.password === password) {
    res.json({ success: true, token: issueToken(db.auth) });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

route('post', '/api/change-credentials', (req, res) => {
  const { oldPassword, newUsername, newPassword } = req.body;
  const db = readDb();
  if (db.auth.password !== oldPassword) {
    return res.status(401).json({ error: "Incorrect current password" });
  }
  db.auth.username = newUsername || db.auth.username;
  db.auth.password = newPassword || db.auth.password;
  db.auth.sessionSecret = randomBytes(32).toString('hex');
  writeDb(db);
  res.json({ success: true, token: issueToken(db.auth) });
});

// 1. GET /api/data
route('get', '/api/data', (req, res) => {
  const { auth, ...data } = readDb();
  res.json(data);
});

// 2. GET /api/products
route('get', '/api/products', (req, res) => {
  res.json(readDb().products);
});

// 3. POST /api/products
route('post', '/api/products', (req, res) => {
  if (!req.body.sku) return res.status(400).json({error: "SKU required"});
  const db = readDb();
  const idx = db.products.findIndex(p => p.sku === req.body.sku);
  if (idx !== -1) db.products[idx] = req.body;
  else db.products.push(req.body);
  writeDb(db);
  res.json(req.body);
});

// 4. DELETE /api/products/:sku
route('delete', '/api/products/:sku', (req, res) => {
  const db = readDb();
  const idx = db.products.findIndex(p => p.sku === req.params.sku);
  if (idx !== -1) {
    db.products.splice(idx, 1);
    writeDb(db);
    return res.json({success: true});
  }
  res.status(404).json({error: "Not found"});
});

// 5. GET /api/sales
route('get', '/api/sales', (req, res) => {
  res.json(readDb().sales);
});

// 6. POST /api/sales
route('post', '/api/sales', (req, res) => {
  const db = readDb();
  const sale = req.body;
  if (!sale.id || !Array.isArray(sale.items) || !sale.items.length || sale.items.some(item => !Number.isInteger(item.qty) || item.qty <= 0)) {
    return res.status(400).json({ error: 'A sale ID and positive whole-number item quantities are required' });
  }
  const existing = db.sales.find(item => item.id === sale.id);
  if (existing) {
    if (isDeepStrictEqual(existing, sale)) return res.json({ success: true, sale: existing });
    return res.status(409).json({ error: 'Invoice ID already exists' });
  }
  const requested = new Map();
  for (const item of sale.items) {
    const key = JSON.stringify([item.sku, item.color || '', item.size]);
    const previous = requested.get(key);
    requested.set(key, { ...item, qty: (previous?.qty || 0) + item.qty });
  }
  // Validate stock
  for (const item of requested.values()) {
    const product = db.products.find(p => p.sku === item.sku);
    if (!product) return res.status(400).json({error: `Product SKU ${item.sku} not found`});
    
    if (product.variants && item.color) {
      const varKey = `${item.color}-${item.size}`;
      if (!product.variants[varKey] || product.variants[varKey].stock < item.qty) {
        return res.status(400).json({error: `Insufficient stock`});
      }
    } else if (product.sizes) {
      if ((product.sizes[item.size] || 0) < item.qty) {
        return res.status(400).json({error: `Insufficient stock`});
      }
    } else {
      return res.status(400).json({ error: 'Product has no stock for the selected size' });
    }
  }
  
  // Deduct stock
  for (const item of sale.items) {
    const product = db.products.find(p => p.sku === item.sku);
    if (item.color) {
      const varKey = `${item.color}-${item.size}`;
      if (product.variants && product.variants[varKey]) {
        product.variants[varKey].stock = Math.max(0, product.variants[varKey].stock - item.qty);
      }
    }
    if (product.sizes && product.sizes[item.size] !== undefined) {
      product.sizes[item.size] = Math.max(0, (product.sizes[item.size] || 0) - item.qty);
    }
  }
  
  db.sales.push(sale);
  writeDb(db);
  res.json({success: true, sale});
});

// 7. GET /api/expenses
route('get', '/api/expenses', (req, res) => {
  res.json(readDb().expenses);
});

// 8. POST /api/expenses
route('post', '/api/expenses', (req, res) => {
  const db = readDb();
  db.expenses.push(req.body);
  writeDb(db);
  res.json(req.body);
});

// 9. DELETE /api/expenses/:id
route('delete', '/api/expenses/:id', (req, res) => {
  const db = readDb();
  const idx = db.expenses.findIndex(e => e.id === req.params.id);
  if (idx !== -1) {
    db.expenses.splice(idx, 1);
    writeDb(db);
    return res.json({success: true});
  }
  res.status(404).json({error: "Not found"});
});

// 10. GET /api/vendors
route('get', '/api/vendors', (req, res) => {
  res.json(readDb().vendors || []);
});

// 11. POST /api/vendors
route('post', '/api/vendors', (req, res) => {
  const db = readDb();
  const vendor = req.body;
  const idx = db.vendors.findIndex(v => v.id === vendor.id);
  if (idx !== -1) db.vendors[idx] = vendor;
  else db.vendors.push(vendor);
  writeDb(db);
  res.json(vendor);
});

// 12. DELETE /api/vendors/:id
route('delete', '/api/vendors/:id', (req, res) => {
  const db = readDb();
  const idx = db.vendors.findIndex(v => v.id === req.params.id);
  if (idx !== -1) {
    db.vendors.splice(idx, 1);
    writeDb(db);
    return res.json({success: true});
  }
  res.status(404).json({error: "Not found"});
});

// 13. GET /api/purchase-orders
route('get', '/api/purchase-orders', (req, res) => {
  res.json(readDb().purchaseOrders || []);
});

// 14. POST /api/purchase-orders
route('post', '/api/purchase-orders', (req, res) => {
  const db = readDb();
  const po = req.body;
  po.poNumber = po.poNumber || po.id;
  po.id = po.id || po.poNumber;
  po.date = po.date || po.orderDate;
  if (!po.poNumber) return res.status(400).json({ error: 'Purchase order ID required' });
  const idx = db.purchaseOrders.findIndex(p => p.poNumber === po.poNumber);
  if (idx !== -1) {
    db.purchaseOrders[idx] = po;
  } else {
    db.purchaseOrders.push(po);
    const vendor = db.vendors.find(v => v.id === po.vendorId || v.name === po.vendorName);
    if (vendor && po.status !== 'Draft') {
      vendor.totalPurchased = (vendor.totalPurchased || 0) + (po.totalAmount || 0);
      if ((vendor.paymentTerms || vendor.terms || '').toLowerCase().includes('credit')) {
        vendor.outstanding = (vendor.outstanding || 0) + (po.totalAmount || 0);
      } else {
        vendor.totalPaid = (vendor.totalPaid || 0) + (po.totalAmount || 0);
      }
    }
  }
  writeDb(db);
  res.json(po);
});

// 15. PUT /api/purchase-orders/:poNumber/receive
route('put', '/api/purchase-orders/:poNumber/receive', (req, res) => {
  const db = readDb();
  const { receivedItems, status } = req.body;
  const po = db.purchaseOrders.find(p => (p.poNumber || p.id) === req.params.poNumber);
  if (!po) return res.status(404).json({error: "PO not found"});
  
  if (receivedItems && Array.isArray(receivedItems)) {
    for (const rec of receivedItems) {
      rec.newlyReceived = rec.newlyReceived ?? rec.receivedQty;
      const item = po.items.find(i => i.sku === rec.sku && i.color === rec.color && i.size === rec.size);
      if (!item || !Number.isInteger(rec.newlyReceived) || rec.newlyReceived <= 0 || rec.newlyReceived > item.qty - (item.qtyReceived ?? item.received ?? 0)) {
        return res.status(400).json({ error: 'Invalid received quantity' });
      }
    }
    receivedItems.forEach(rec => {
      const poItem = po.items.find(i => i.sku === rec.sku && i.color === rec.color && i.size === rec.size);
      if (poItem) {
        poItem.qtyReceived = (poItem.qtyReceived ?? poItem.received ?? 0) + rec.newlyReceived;
        poItem.received = poItem.qtyReceived;
      }
      const prod = db.products.find(p => p.sku === rec.sku);
      if (prod) {
        const varKey = `${rec.color}-${rec.size}`;
        if (!prod.variants) {
          prod.variants = {};
          for (const [size, stock] of Object.entries(prod.sizes || {})) {
            prod.variants[`Standard-${size}`] = { stock, costPrice: prod.costPrice, sellingPrice: prod.sellingPrice };
          }
        }
        if (!prod.variants[varKey]) {
          prod.variants[varKey] = { stock: 0, costPrice: rec.wholesaleCost || prod.costPrice, sellingPrice: prod.sellingPrice };
        }
        prod.variants[varKey].stock += rec.newlyReceived;
        if (prod.sizes && prod.sizes[rec.size] !== undefined) prod.sizes[rec.size] = (prod.sizes[rec.size] || 0) + rec.newlyReceived;
      }
    });
  }
  if (status) po.status = status;
  writeDb(db);
  res.json(po);
});

// 16. GET /api/vendor-payments
route('get', '/api/vendor-payments', (req, res) => {
  res.json(readDb().vendorPayments || []);
});

// 17. POST /api/vendor-payments
route('post', '/api/vendor-payments', (req, res) => {
  const db = readDb();
  const pay = req.body;
  db.vendorPayments.push(pay);
  const vendor = db.vendors.find(v => v.id === pay.vendorId || v.name === pay.vendorName);
  if (vendor) {
    vendor.totalPaid = (vendor.totalPaid || 0) + pay.amount;
    vendor.outstanding = Math.max(0, (vendor.outstanding || 0) - pay.amount);
  }
  writeDb(db);
  res.json(pay);
});

// 18. GET /api/vendor-returns
route('get', '/api/vendor-returns', (req, res) => {
  res.json(readDb().vendorReturns || []);
});

// 19. POST /api/vendor-returns
route('post', '/api/vendor-returns', (req, res) => {
  const db = readDb();
  const ret = req.body;
  db.vendorReturns.push(ret);
  if (ret.items && Array.isArray(ret.items)) {
    ret.items.forEach(item => {
      const prod = db.products.find(p => p.sku === item.sku);
      if (prod) {
        const varKey = `${item.color}-${item.size}`;
        if (prod.variants && prod.variants[varKey]) {
          prod.variants[varKey].stock = Math.max(0, prod.variants[varKey].stock - item.qty);
        }
        if (prod.sizes && prod.sizes[item.size] !== undefined) {
          prod.sizes[item.size] = Math.max(0, (prod.sizes[item.size] || 0) - item.qty);
        }
      }
    });
  }
  ret.creditAmount = ret.creditAmount ?? ret.creditNoteAmount;
  const vendor = db.vendors.find(v => v.id === ret.vendorId || v.name === ret.vendorName);
  if (vendor && ret.creditAmount) {
    vendor.outstanding = Math.max(0, (vendor.outstanding || 0) - ret.creditAmount);
  }
  writeDb(db);
  res.json(ret);
});

// 20. POST /api/sales/:id/settle
route('post', '/api/sales/:id/settle', (req, res) => {
  const db = readDb();
  const sale = db.sales.find(s => s.id === req.params.id);
  if (!sale) return res.status(404).json({error: "Sale not found"});
  sale.paymentStatus = "Paid";
  writeDb(db);
  res.json({success: true, sale});
});

// 21. POST /api/purchase-orders/:poNumber/settle
route('post', '/api/purchase-orders/:poNumber/settle', (req, res) => {
  const db = readDb();
  const po = db.purchaseOrders.find(p => (p.poNumber || p.id) === req.params.poNumber);
  if (!po) return res.status(404).json({error: "PO not found"});
  if (po.paymentStatus === 'Paid') return res.json({ success: true, po });
  po.paymentStatus = "Paid";
  const paymentRecord = {
    id: "PAY-" + Math.floor(10000 + Math.random() * 90000),
    vendorId: po.vendorId || po.vendorName,
    date: new Date().toISOString().split('T')[0],
    amount: po.totalAmount,
    method: "Settled against PO",
    refNo: po.poNumber,
    employee: "System"
  };
  db.vendorPayments.push(paymentRecord);
  const vendor = db.vendors.find(v => v.id === po.vendorId || v.name === po.vendorName);
  if (vendor) {
    vendor.totalPaid = (vendor.totalPaid || 0) + po.totalAmount;
    vendor.outstanding = Math.max(0, (vendor.outstanding || 0) - po.totalAmount);
  }
  writeDb(db);
  res.json({success: true, po});
});

// 22. POST /api/borrowings
route('post', '/api/borrowings', (req, res) => {
  const db = readDb();
  db.borrowings.push(req.body);
  writeDb(db);
  res.json({success: true, borrowing: req.body});
});

route('put', '/api/borrowings/:id', (req, res) => {
  const db = readDb();
  const borrowing = db.borrowings.find(b => b.id === req.params.id);
  if (!borrowing) return res.status(404).json({ error: 'Borrowing not found' });
  const { lenderName, amount, date, dueDate } = req.body || {};
  const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (typeof lenderName !== 'string' || !lenderName.trim()
      || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1
      || !isDate(date) || !isDate(dueDate)) {
    return res.status(400).json({ error: 'Enter a lender, an amount of at least 1, and valid dates' });
  }
  Object.assign(borrowing, { lenderName: lenderName.trim(), amount, date, dueDate });
  writeDb(db);
  res.json({ success: true, borrowing });
});

route('delete', '/api/borrowings/:id', (req, res) => {
  const db = readDb();
  const index = db.borrowings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Borrowing not found' });
  db.borrowings.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

// 23. POST /api/borrowings/:id/writeoff
route('post', '/api/borrowings/:id/writeoff', (req, res) => {
  const db = readDb();
  const b = db.borrowings.find(b => b.id === req.params.id);
  if (!b) return res.status(404).json({error: "not found"});
  b.status = "Settled";
  writeDb(db);
  res.json({success: true});
});

// 24. POST /api/reset
route('post', '/api/reset', (req, res) => {
  const auth = readDb().auth;
  if (req.body.type === 'clear') {
    writeDb({ products: [], sales: [], expenses: [], vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [], auth });
  } else if (req.body.type === 'restore') {
    writeDb({ products: DEFAULT_PRODUCTS, sales: DEFAULT_SALES, expenses: DEFAULT_EXPENSES, vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [], auth });
  } else {
    return res.status(400).json({ error: 'Invalid reset type' });
  }
  const { auth: privateAuth, ...data } = readDb();
  res.json(data);
});

// Serve only the three public assets, never database exports or server files.
for (const [url, file] of [['/', 'index.html'], ['/index.html', 'index.html'], ['/app.js', 'app.js'], ['/style.css', 'style.css']]) {
  app.get(url, (req, res) => res.sendFile(path.join(__dirname, file)));
}
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request' });
  console.error('Request failed:', error.code || 'DATABASE_ERROR');
  res.status(503).json({ error: 'Database unavailable. Your changes were not saved; please retry.' });
});
return app;
}

if (require.main === module) {
  try {
    const database = createDatabase(createPool());
    const app = createApp(database);
    const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Auric backend listening'));
    const shutdown = () => server.close(() => database.close().finally(() => process.exit(0)));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { createApp };
