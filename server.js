const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'db.json');

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

function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(raw);
      data.vendors = data.vendors || [];
      data.purchaseOrders = data.purchaseOrders || [];
      data.vendorPayments = data.vendorPayments || [];
      data.vendorReturns = data.vendorReturns || [];
      data.borrowings = data.borrowings || [];
      return data;
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return { products: [], sales: [], expenses: [], vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [] };
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// 1. GET /api/data
app.get('/api/data', (req, res) => {
  res.json(readDb());
});

// 2. GET /api/products
app.get('/api/products', (req, res) => {
  res.json(readDb().products);
});

// 3. POST /api/products
app.post('/api/products', (req, res) => {
  if (!req.body.sku) return res.status(400).json({error: "SKU required"});
  const db = readDb();
  const idx = db.products.findIndex(p => p.sku === req.body.sku);
  if (idx !== -1) db.products[idx] = req.body;
  else db.products.push(req.body);
  writeDb(db);
  res.json(req.body);
});

// 4. DELETE /api/products/:sku
app.delete('/api/products/:sku', (req, res) => {
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
app.get('/api/sales', (req, res) => {
  res.json(readDb().sales);
});

// 6. POST /api/sales
app.post('/api/sales', (req, res) => {
  const db = readDb();
  const sale = req.body;
  // Validate stock
  for (const item of sale.items) {
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
app.get('/api/expenses', (req, res) => {
  res.json(readDb().expenses);
});

// 8. POST /api/expenses
app.post('/api/expenses', (req, res) => {
  const db = readDb();
  db.expenses.push(req.body);
  writeDb(db);
  res.json(req.body);
});

// 9. DELETE /api/expenses/:id
app.delete('/api/expenses/:id', (req, res) => {
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
app.get('/api/vendors', (req, res) => {
  res.json(readDb().vendors || []);
});

// 11. POST /api/vendors
app.post('/api/vendors', (req, res) => {
  const db = readDb();
  const vendor = req.body;
  const idx = db.vendors.findIndex(v => v.id === vendor.id);
  if (idx !== -1) db.vendors[idx] = vendor;
  else db.vendors.push(vendor);
  writeDb(db);
  res.json(vendor);
});

// 12. DELETE /api/vendors/:id
app.delete('/api/vendors/:id', (req, res) => {
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
app.get('/api/purchase-orders', (req, res) => {
  res.json(readDb().purchaseOrders || []);
});

// 14. POST /api/purchase-orders
app.post('/api/purchase-orders', (req, res) => {
  const db = readDb();
  const po = req.body;
  const idx = db.purchaseOrders.findIndex(p => p.poNumber === po.poNumber);
  if (idx !== -1) {
    db.purchaseOrders[idx] = po;
  } else {
    db.purchaseOrders.push(po);
    const vendor = db.vendors.find(v => v.id === po.vendorId);
    if (vendor && po.status !== 'Draft') {
      vendor.totalPurchased = (vendor.totalPurchased || 0) + (po.totalAmount || 0);
      if (vendor.paymentTerms && vendor.paymentTerms.toLowerCase().includes('credit')) {
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
app.put('/api/purchase-orders/:poNumber/receive', (req, res) => {
  const db = readDb();
  const { receivedItems, status } = req.body;
  const po = db.purchaseOrders.find(p => p.poNumber === req.params.poNumber);
  if (!po) return res.status(404).json({error: "PO not found"});
  
  if (receivedItems && Array.isArray(receivedItems)) {
    receivedItems.forEach(rec => {
      const poItem = po.items.find(i => i.sku === rec.sku && i.color === rec.color && i.size === rec.size);
      if (poItem) poItem.qtyReceived = (poItem.qtyReceived || 0) + rec.newlyReceived;
      const prod = db.products.find(p => p.sku === rec.sku);
      if (prod) {
        const varKey = `${rec.color}-${rec.size}`;
        if (!prod.variants) prod.variants = {};
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
app.get('/api/vendor-payments', (req, res) => {
  res.json(readDb().vendorPayments || []);
});

// 17. POST /api/vendor-payments
app.post('/api/vendor-payments', (req, res) => {
  const db = readDb();
  const pay = req.body;
  db.vendorPayments.push(pay);
  const vendor = db.vendors.find(v => v.id === pay.vendorId);
  if (vendor) {
    vendor.totalPaid = (vendor.totalPaid || 0) + pay.amount;
    vendor.outstanding = Math.max(0, (vendor.outstanding || 0) - pay.amount);
  }
  writeDb(db);
  res.json(pay);
});

// 18. GET /api/vendor-returns
app.get('/api/vendor-returns', (req, res) => {
  res.json(readDb().vendorReturns || []);
});

// 19. POST /api/vendor-returns
app.post('/api/vendor-returns', (req, res) => {
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
  const vendor = db.vendors.find(v => v.id === ret.vendorId);
  if (vendor && ret.creditAmount) {
    vendor.outstanding = Math.max(0, (vendor.outstanding || 0) - ret.creditAmount);
  }
  writeDb(db);
  res.json(ret);
});

// 20. POST /api/sales/:id/settle
app.post('/api/sales/:id/settle', (req, res) => {
  const db = readDb();
  const sale = db.sales.find(s => s.id === req.params.id);
  if (!sale) return res.status(404).json({error: "Sale not found"});
  sale.paymentStatus = "Paid";
  writeDb(db);
  res.json({success: true, sale});
});

// 21. POST /api/purchase-orders/:poNumber/settle
app.post('/api/purchase-orders/:poNumber/settle', (req, res) => {
  const db = readDb();
  const po = db.purchaseOrders.find(p => p.poNumber === req.params.poNumber);
  if (!po) return res.status(404).json({error: "PO not found"});
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
app.post('/api/borrowings', (req, res) => {
  const db = readDb();
  db.borrowings.push(req.body);
  writeDb(db);
  res.json({success: true, borrowing: req.body});
});

// 23. POST /api/borrowings/:id/writeoff
app.post('/api/borrowings/:id/writeoff', (req, res) => {
  const db = readDb();
  const b = db.borrowings.find(b => b.id === req.params.id);
  if (!b) return res.status(404).json({error: "not found"});
  b.status = "Settled";
  writeDb(db);
  res.json({success: true});
});

// 24. POST /api/reset
app.post('/api/reset', (req, res) => {
  if (req.body.type === 'clear') {
    writeDb({ products: [], sales: [], expenses: [], vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [] });
  } else if (req.body.type === 'restore') {
    writeDb({ products: DEFAULT_PRODUCTS, sales: DEFAULT_SALES, expenses: DEFAULT_EXPENSES, vendors: [], purchaseOrders: [], vendorPayments: [], vendorReturns: [], borrowings: [] });
  }
  res.json(readDb());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
