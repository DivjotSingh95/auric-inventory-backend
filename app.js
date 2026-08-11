// AURIC BY SYLVIE AND SHUBHI clothing store core JS engine

// --- State Variables ---
let products = [];
let sales = [];
let expenses = [];
let cart = [];
let vendors = [];
let purchaseOrders = [];
let vendorPayments = [];
let vendorReturns = [];
let borrowings = [];

// Charts Instances
let revenueChart = null;
let expenseDoughnutChart = null;

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  initRouting();
  initTheme();
  initEventListeners();
  updateLiveDate();
  
  // Render current view
  const currentHash = window.location.hash.substring(1) || 'dashboard';
  navigateToSection(currentHash);
  
  // Refresh Lucide Icons once structural injections are complete
  lucide.createIcons();
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    showToast(`Switched to ${newTheme} theme`, "success");
    
    // Rerender charts to update grid color schema
    renderCharts();
  });
}

// Helper to sum all sizes of a product
function getProductStock(p) {
  if (p.variants) {
    return Object.values(p.variants).reduce((sum, v) => sum + (v.stock || 0), 0);
  }
  if (p.sizes) {
    return Object.values(p.sizes).reduce((sum, val) => sum + val, 0);
  }
  return p.stock || 0;
}

// --- LocalStorage Synchronization ---
async function loadData() {
  try {
    const response = await fetch('https://auric-inventory-backend.onrender.com/api/data');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    products = data.products || [];
    sales = data.sales || [];
    expenses = data.expenses || [];
    vendors = data.vendors || [];
    purchaseOrders = data.purchaseOrders || [];
    vendorPayments = data.vendorPayments || [];
    vendorReturns = data.vendorReturns || [];
    borrowings = data.borrowings || [];
  } catch (err) {
    console.error("Failed to load data from backend:", err);
    products = [];
    sales = [];
    expenses = [];
    vendors = [];
    purchaseOrders = [];
    vendorPayments = [];
    vendorReturns = [];
    borrowings = [];
  }
  updateGlobalStockAlerts();
}

function saveData(key) {
  // Deprecated: All data is saved directly to the backend Express server now.
  console.log("saveData called (deprecated): state now managed via REST API on server");
}

// Update low stock flags globally on sidebar
function updateGlobalStockAlerts() {
  const lowStockCount = products.filter(p => getProductStock(p) <= p.threshold).length;
  const alertBadge = document.getElementById("sidebar-alert-badge");
  const alertDesc = document.getElementById("sidebar-alert-desc");
  const alertBell = document.getElementById("sidebar-alert-bell");
  
  if (lowStockCount > 0) {
    alertBadge.textContent = lowStockCount;
    alertBadge.classList.remove("hide");
    alertDesc.textContent = `${lowStockCount} items running low!`;
    alertDesc.style.color = "var(--primary)";
    alertBell.classList.add("glow-icon");
  } else {
    alertBadge.classList.add("hide");
    alertDesc.textContent = "All products stocked";
    alertDesc.style.color = "var(--text-muted)";
    alertBell.classList.remove("glow-icon");
  }
}

// --- Routing Navigation ---
function initRouting() {
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.substring(1) || 'dashboard';
    navigateToSection(hash);
  });
}

function navigateToSection(targetId) {
  // Hide all sections
  document.querySelectorAll(".page-section").forEach(sec => {
    sec.classList.remove("active");
  });
  
  // Remove active class from links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.remove("active");
  });
  
  // Show target section
  const targetSection = document.getElementById(targetId);
  if (targetSection) {
    targetSection.classList.add("active");
  }
  
  // Set active nav link
  const matchingLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
  if (matchingLink) {
    matchingLink.classList.add("active");
  }
  
  // Update header text based on page
  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  const actionBtn = document.getElementById("header-quick-action-btn");
  
  // Defaults
  actionBtn.classList.remove("hide");
  actionBtn.className = "btn btn-primary";
  actionBtn.innerHTML = `<i data-lucide="plus"></i><span>Add Product</span>`;
  actionBtn.onclick = () => {
    document.getElementById("product-form").reset();
    document.getElementById("product-edit-index").value = "";
    document.getElementById("product-sku").readOnly = false;
    document.getElementById("product-modal-title").textContent = "Add Product";
    populateProductVendorSelect();
    openModal("product-modal");
  };
  
  switch (targetId) {
    case "dashboard":
      titleEl.textContent = "Dashboard";
      subtitleEl.textContent = "Welcome back! Here's your AURIC BY SYLVIE AND SHUBHI snapshot.";
      renderDashboard();
      break;
    case "sales":
      titleEl.textContent = "New Sale Invoice";
      subtitleEl.textContent = "Generate invoice orders and bill customers.";
      actionBtn.className = "btn btn-emerald";
      actionBtn.innerHTML = `<i data-lucide="trash-2"></i><span>Clear Cart</span>`;
      actionBtn.onclick = clearCart;
      renderSalesPage();
      break;
    case "sales-ledger":
      titleEl.textContent = "Sales & Debts Ledger";
      subtitleEl.textContent = "View all sales, track customer debts, and analyze payment methods.";
      actionBtn.classList.add("hide");
      renderSalesLedgerPage();
      break;
    case "stock":
      titleEl.textContent = "Stock Catalog";
      subtitleEl.textContent = "Manage AURIC BY SYLVIE AND SHUBHI products database, prices, and stock counts.";
      renderStockPage();
      break;
    case "vendors":
      titleEl.textContent = "Vendor Vault & PO Intelligence";
      subtitleEl.textContent = "Manage textile suppliers, purchase orders, receiving validation, and liabilities.";
      actionBtn.className = "btn btn-primary";
      actionBtn.innerHTML = `<i data-lucide="plus"></i><span>Add Supplier</span>`;
      actionBtn.onclick = () => { openModal("vendor-modal"); resetVendorForm(); };
      renderVendorVault();
      break;
    case "lowstock":
      titleEl.textContent = "Low Stock Replenishment";
      subtitleEl.textContent = "Quick overview and stock reloading for depleting items.";
      actionBtn.classList.add("hide"); // No quick action needed here
      renderLowStockPage();
      break;
    case "borrowings":
      titleEl.textContent = "Business Borrowings";
      subtitleEl.textContent = "Track external loans, borrow money, and monitor repayment dues.";
      actionBtn.classList.add("hide"); // The Log Borrowing is in the section control panel
      renderBorrowingsPage();
      break;
    case "expenses":
      titleEl.textContent = "Expenses Logger";
      subtitleEl.textContent = "Log and track tailor pay, rentals, utilities, and material costs.";
      actionBtn.className = "btn btn-rose";
      actionBtn.innerHTML = `<i data-lucide="plus"></i><span>Log Expense</span>`;
      actionBtn.onclick = () => openModal("expense-modal");
      renderExpensesPage();
      break;
    case "reports":
      titleEl.textContent = "Profitability Reports";
      subtitleEl.textContent = "Observe collection revenue, tailors margins, and net profits.";
      actionBtn.classList.add("hide");
      renderReportsPage();
      break;
  }
  
  lucide.createIcons();
}

function updateLiveDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("live-date").textContent = new Date().toLocaleDateString('en-IN', options);
}

// --- Enhanced Search Logic ---
// Splits query into separate keywords, matches all keywords against Name, SKU, or Category
function matchesSearchQuery(product, query) {
  if (!query) return true;
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  
  return searchTerms.every(term => 
    product.name.toLowerCase().includes(term) ||
    product.sku.toLowerCase().includes(term) ||
    product.category.toLowerCase().includes(term)
  );
}

// --- Render Dashboard Section ---
function renderDashboard() {
  // KPIs calculation
  // 1. Total revenue
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  document.getElementById("kpi-sales-value").textContent = formatCurrency(totalRevenue);
  
  // Revenue Trend comparison (growth month-on-month)
  const prevMonthRevenue = sales.filter(s => new Date(s.date).getMonth() === 3).reduce((sum, s) => sum + s.total, 0); // April
  const currMonthRevenue = sales.filter(s => new Date(s.date).getMonth() === 4).reduce((sum, s) => sum + s.total, 0); // May
  let revTrendPct = 0;
  if (prevMonthRevenue > 0) {
    revTrendPct = ((currMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
  } else if (currMonthRevenue > 0) {
    revTrendPct = 100;
  }
  const trendSalesEl = document.getElementById("kpi-sales-trend");
  trendSalesEl.textContent = `${revTrendPct >= 0 ? '+' : ''}${revTrendPct.toFixed(1)}%`;
  trendSalesEl.className = `kpi-trend ${revTrendPct >= 0 ? 'positive' : 'negative'}`;

  // 2. Stock Valuation (Cost price * Quantity)
  const stockValuation = products.reduce((sum, p) => sum + (p.costPrice * getProductStock(p)), 0);
  const totalItems = products.reduce((sum, p) => sum + getProductStock(p), 0);
  document.getElementById("kpi-stock-value").textContent = formatCurrency(stockValuation);
  document.getElementById("kpi-stock-count").textContent = `${totalItems} items in stock`;

  // 3. Expenses Calculation
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById("kpi-expenses-value").textContent = formatCurrency(totalExpenses);
  const expRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;
  document.getElementById("kpi-expenses-ratio").textContent = `${expRatio.toFixed(1)}% of rev`;

  // 4. Net Profit/Loss
  const totalCOGS = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + (item.cost * item.qty), 0);
  }, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const profitValEl = document.getElementById("kpi-profit-value");
  profitValEl.textContent = formatCurrency(netProfit);
  if (netProfit >= 0) {
    profitValEl.className = "kpi-value text-emerald";
  } else {
    profitValEl.className = "kpi-value text-rose";
  }
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  document.getElementById("kpi-profit-margin").textContent = `${profitMargin.toFixed(1)}% margin`;
  document.getElementById("kpi-profit-margin").className = `kpi-trend ${profitMargin >= 0 ? 'positive' : 'negative'}`;

  // Render Low Stock Alert items list (dashboard preview)
  const alertListEl = document.getElementById("low-stock-alerts-list");
  const lowStockProducts = products.filter(p => getProductStock(p) <= p.threshold);
  document.getElementById("alert-count-badge").textContent = `${lowStockProducts.length} Alerts`;
  
  if (lowStockProducts.length > 0) {
    alertListEl.innerHTML = lowStockProducts.map(p => `
      <div class="alert-item">
        <div class="alert-product-info">
          <span class="name">${p.name}</span>
          <span class="sku">${p.sku} • ${p.category}</span>
        </div>
        <div class="alert-qty-info">
          <span class="qty">${getProductStock(p)} left</span>
          <span class="min">Min: ${p.threshold}</span>
        </div>
      </div>
    `).join("");
  } else {
    alertListEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle" class="success-icon"></i>
        <p>All products are sufficiently stocked.</p>
      </div>
    `;
  }

  // Render Recent Activity Logs
  const activityTable = document.getElementById("dashboard-activity-table");
  let combinedActivities = [];
  
  sales.forEach(s => {
    combinedActivities.push({
      time: new Date(s.date),
      category: "Sale",
      desc: `Invoice ${s.id} (${s.customer || 'Walk-in'})`,
      amount: s.total,
      type: 'sale'
    });
  });

  expenses.forEach(e => {
    combinedActivities.push({
      time: new Date(e.date),
      category: `Expense (${e.category})`,
      desc: e.desc,
      amount: -e.amount,
      type: 'expense'
    });
  });

  // Sort descending
  combinedActivities.sort((a, b) => b.time - a.time);

  // Take top 10
  const topActivities = combinedActivities.slice(0, 10);

  if (topActivities.length > 0) {
    activityTable.innerHTML = topActivities.map(act => `
      <tr>
        <td class="text-muted">${act.time.toLocaleDateString()} ${act.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
        <td>
          <span class="badge ${act.type === 'sale' ? 'badge-success' : 'badge-danger'}">
            ${act.category}
          </span>
        </td>
        <td>${act.desc}</td>
        <td class="${act.type === 'sale' ? 'text-emerald' : 'text-rose'} font-bold">
          ${act.type === 'sale' ? '+' : ''}${formatCurrency(act.amount)}
        </td>
      </tr>
    `).join("");
  } else {
    activityTable.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No transactions recorded yet.</td></tr>`;
  }

  renderCharts();
}

// --- Render Chart JS visualisations ---
function renderCharts() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(212, 175, 55, 0.08)" : "rgba(170, 128, 44, 0.08)";
  const textColor = isDark ? "#a3a3a3" : "#78716c";

  // Chart 1: Revenue vs Expenses (Monthly)
  const ctx = document.getElementById("salesExpensesChart");
  if (!ctx) return;
  
  if (revenueChart) {
    revenueChart.destroy();
  }

  const months = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const revData = [0, 0, 0, 0, 0, 0];
  const expData = [0, 0, 0, 0, 0, 0];
  const monthIndexes = [11, 0, 1, 2, 3, 4]; // Dec=11, Jan=0, etc.

  sales.forEach(s => {
    const d = new Date(s.date);
    const m = d.getMonth();
    const idx = monthIndexes.indexOf(m);
    if (idx !== -1) {
      revData[idx] += s.total;
    }
  });

  expenses.forEach(e => {
    const d = new Date(e.date);
    const m = d.getMonth();
    const idx = monthIndexes.indexOf(m);
    if (idx !== -1) {
      expData[idx] += e.amount;
    }
  });

  // Gradient definitions
  const ctx2d = ctx.getContext('2d');
  const primaryGrad = ctx2d.createLinearGradient(0, 0, 0, 250);
  primaryGrad.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
  primaryGrad.addColorStop(1, 'rgba(212, 175, 55, 0.01)');

  const roseGrad = ctx2d.createLinearGradient(0, 0, 0, 250);
  roseGrad.addColorStop(0, 'rgba(225, 29, 72, 0.4)');
  roseGrad.addColorStop(1, 'rgba(225, 29, 72, 0.01)');

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Revenue',
          data: revData,
          borderColor: '#d4af37',
          backgroundColor: primaryGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#d4af37'
        },
        {
          label: 'Expenses',
          data: expData,
          borderColor: '#e11d48',
          backgroundColor: roseGrad,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#e11d48'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans' } }
        }
      }
    }
  });
}

// --- Sales Section Logic ---
function renderSalesPage() {
  const searchQuery = document.getElementById("sales-search").value;
  const categoryFilter = document.getElementById("sales-category-filter").value;
  const gridEl = document.getElementById("sales-product-grid");
  
  // Populate Categories Filter
  populateCategoriesDropdown("sales-category-filter", categoryFilter);

  // Filter Products using Enhanced Search
  const filtered = products.filter(p => {
    const matchesSearch = matchesSearchQuery(p, searchQuery);
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length > 0) {
    gridEl.innerHTML = filtered.map(p => {
      const totalStock = getProductStock(p);
      let statusClass = "badge-success";
      let statusText = `${totalStock} in stock`;
      let alertBorderClass = "";

      if (totalStock === 0) {
        statusClass = "badge-danger";
        statusText = "Out of Stock";
      } else if (totalStock <= p.threshold) {
        statusClass = "badge-warning";
        statusText = `Low Stock (${totalStock})`;
        alertBorderClass = "low-stock";
      }

      const outOfStockClass = totalStock === 0 ? "out-of-stock" : "";
      
      return `
        <div class="product-sale-card ${outOfStockClass} ${alertBorderClass}" onclick="addToCart('${p.sku}')">
          <span class="card-category">${p.category}</span>
          <span class="card-name" title="${p.name}">${p.name}</span>
          <span class="card-sku">${p.sku}</span>
          <div class="card-pricing-row">
            <span class="card-price">${formatCurrency(p.sellingPrice)}</span>
            <span class="card-qty-badge badge ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    }).join("");
  } else {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="package-search"></i>
        <p>No products match your search/filter.</p>
      </div>
    `;
  }
  
  renderCart();
  lucide.createIcons();
}

function renderCart() {
  const cartList = document.getElementById("cart-items-list");
  const checkoutBtn = document.getElementById("checkout-btn");

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shopping-bag" class="text-muted"></i>
        <p>Cart is empty. Click products on the left to add items.</p>
      </div>
    `;
    document.getElementById("cart-subtotal").textContent = "₹0.00";
    document.getElementById("cart-total").textContent = "₹0.00";
    checkoutBtn.disabled = true;
    lucide.createIcons();
    return;
  }

  checkoutBtn.disabled = false;

  cartList.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-details">
        <span class="name">${item.name} <span class="size-badge">${item.size}</span></span>
        <span class="price">${formatCurrency(item.price)} each</span>
      </div>
      <div class="cart-item-qty">
        <button onclick="updateCartQty('${item.sku}', '${item.size}', -1, '${item.color || ''}')">&minus;</button>
        <span>${item.qty}</span>
        <button onclick="updateCartQty('${item.sku}', '${item.size}', 1, '${item.color || ''}')">&plus;</button>
      </div>
      <div class="cart-item-total">
        ${formatCurrency(item.price * item.qty)}
      </div>
    </div>
  `).join("");

  // Subtotals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountPct = parseFloat(document.getElementById("cart-discount").value) || 0;
  const discountVal = subtotal * (discountPct / 100);
  const total = subtotal - discountVal;

  document.getElementById("cart-subtotal").textContent = formatCurrency(subtotal);
  document.getElementById("cart-total").textContent = formatCurrency(total);
}

function addToCart(sku) {
  const product = products.find(p => p.sku === sku);
  if (!product) return;

  const totalStock = getProductStock(product);
  if (totalStock === 0) {
    showToast("Product is out of stock!", "error");
    return;
  }

  // Open size-select-modal
  document.getElementById("size-select-product-name").textContent = product.name;
  document.getElementById("size-select-sku").value = product.sku;

  const colorContainer = document.getElementById("pos-color-container");
  const sizeContainer = document.getElementById("size-select-buttons-container");
  
  let variantsObj = product.variants;
  if (!variantsObj || Object.keys(variantsObj).length === 0) {
    variantsObj = {};
    const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    sizes.forEach(sz => {
      variantsObj[`Standard-${sz}`] = { stock: product.sizes ? (product.sizes[sz] || 0) : 0, costPrice: product.costPrice, sellingPrice: product.sellingPrice };
    });
  }

  const colors = [...new Set(Object.keys(variantsObj).map(key => key.split("-")[0]))];
  let selectedColor = colors[0] || "Standard";

  const renderColorPills = () => {
    if (colorContainer) {
      colorContainer.innerHTML = colors.map(col => `
        <button type="button" class="color-select-pill ${col === selectedColor ? 'active' : ''}" onclick="selectPOSColor('${product.sku}', '${col}')">
          <span class="color-dot" style="background: ${col === 'Gold Border' ? '#d4af37' : 'var(--primary)'};"></span>${col}
        </button>
      `).join("");
    }
  };

  window.selectPOSColor = (sku, col) => {
    selectedColor = col;
    renderColorPills();
    renderSizeButtons();
  };

  const renderSizeButtons = () => {
    const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    sizeContainer.innerHTML = sizes.map(sz => {
      const varKey = `${selectedColor}-${sz}`;
      const varData = variantsObj[varKey] || { stock: 0, sellingPrice: product.sellingPrice };
      const qty = varData.stock || 0;
      const cartItem = cart.find(item => item.sku === sku && item.size === sz && (item.color === selectedColor || (!item.color && selectedColor === 'Standard')));
      const available = qty - (cartItem ? cartItem.qty : 0);
      const isDisabled = available <= 0;

      return `
        <button type="button" class="size-select-btn" ${isDisabled ? 'disabled' : ''} onclick="confirmAddToCartVariant('${product.sku}', '${selectedColor}', '${sz}')">
          <span>${sz}</span>
          <span class="size-qty">(${available} left)</span>
          <span class="text-xs text-emerald font-mono">₹${varData.sellingPrice || product.sellingPrice}</span>
        </button>
      `;
    }).join("");
  };

  renderColorPills();
  renderSizeButtons();
  openModal("size-select-modal");
}

function confirmAddToCartVariant(sku, color, size) {
  const product = products.find(p => p.sku === sku);
  if (!product) return;

  const varKey = `${color}-${size}`;
  const varData = (product.variants && product.variants[varKey]) ? product.variants[varKey] : { stock: product.sizes ? (product.sizes[size] || 0) : 0, sellingPrice: product.sellingPrice, costPrice: product.costPrice };
  const qtyLimit = varData.stock || 0;

  const existing = cart.find(item => item.sku === sku && item.size === size && (item.color === color || (!item.color && color === 'Standard')));
  if (existing) {
    if (existing.qty >= qtyLimit) {
      showToast(`Cannot exceed current stock level of ${qtyLimit} for size ${size} (${color})`, "warning");
      return;
    }
    existing.qty++;
  } else {
    cart.push({
      sku: product.sku,
      name: `${product.name} (${color})`,
      color: color,
      size: size,
      price: varData.sellingPrice || product.sellingPrice,
      cost: varData.costPrice || product.costPrice,
      qty: 1
    });
  }

  showToast(`Added ${product.name} (${color} - Size ${size}) to cart`, "success");
  closeModal("size-select-modal");
  renderCart();
  renderSalesPage();
}

function confirmAddToCartSize(sku, size) {
  confirmAddToCartVariant(sku, 'Standard', size);
}

function updateCartQty(sku, size, change, color) {
  const col = color || 'Standard';
  const item = cart.find(i => i.sku === sku && i.size === size && (!i.color || i.color === col || (col === 'Standard' && !i.color)));
  const product = products.find(p => p.sku === sku);
  if (!item || !product) return;

  const newQty = item.qty + change;
  const varKey = `${item.color || col}-${size}`;
  const varData = (product.variants && product.variants[varKey]) ? product.variants[varKey] : { stock: product.sizes ? (product.sizes[size] || 0) : 0 };
  const sizeStock = varData.stock || 0;

  if (newQty <= 0) {
    cart = cart.filter(i => !(i.sku === sku && i.size === size && (!i.color || i.color === col || (col === 'Standard' && !i.color))));
    showToast(`Removed ${item.name} from cart`, "warning");
  } else if (newQty > sizeStock) {
    showToast(`Cannot exceed current stock level of ${sizeStock}`, "warning");
    return;
  } else {
    item.qty = newQty;
  }
  
  renderCart();
  renderSalesPage();
}

function clearCart() {
  if (cart.length === 0) return;
  cart = [];
  document.getElementById("cart-discount").value = 0;
  document.getElementById("sale-customer-name").value = "";
  renderCart();
  renderSalesPage();
  showToast("Cart cleared", "success");
}

async function handleCheckout() {
  console.log("handleCheckout: Cart length =", cart.length);
  if (cart.length === 0) return;

  const customerName = document.getElementById("sale-customer-name").value.trim() || "Walk-in Customer";
  const paymentMode = document.getElementById("sale-payment-mode").value || "Cash";
  const discountPct = parseFloat(document.getElementById("cart-discount").value) || 0;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountVal = subtotal * (discountPct / 100);
  const total = subtotal - discountVal;

  console.log("handleCheckout: customer =", customerName, "total =", total);

  // Generate Invoice ID
  const invId = "INV-" + Math.floor(10000 + Math.random() * 90000);
  const saleDate = new Date().toISOString();

  // Save Sales Record
  const newSale = {
    id: invId,
    date: saleDate,
    customer: customerName,
    paymentMode: paymentMode,
    paymentStatus: paymentMode === "Credit" ? "Unpaid" : "Paid",
    items: [...cart],
    subtotal: subtotal,
    discount: discountPct,
    total: total
  };

  try {
    const response = await fetch('https://auric-inventory-backend.onrender.com/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newSale)
    });
    
    if (!response.ok) {
      const errData = await response.json();
      showToast(errData.error || "Checkout failed", "error");
      return;
    }
    
    // Reload state from backend
    await loadData();

    // Show Receipt Modal
    showReceipt(newSale);

    // Clear Cart
    cart = [];
    document.getElementById("cart-discount").value = 0;
    document.getElementById("sale-customer-name").value = "";
    
    // Re-render
    renderCart();
    renderSalesPage();
    showToast("Invoice recorded successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Checkout failed. Check server connection.", "error");
  }
}

function showReceipt(sale) {
  console.log("showReceipt called for sale id:", sale.id);
  document.getElementById("receipt-id").textContent = sale.id;
  document.getElementById("receipt-date").textContent = new Date(sale.date).toLocaleDateString() + " " + new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  document.getElementById("receipt-customer").textContent = sale.customer;
  const pmEl = document.getElementById("receipt-payment-mode");
  if (pmEl) pmEl.textContent = sale.paymentMode || "Cash";

  console.log("showReceipt: Populating items list");
  const itemsList = document.getElementById("receipt-items-list");
  itemsList.innerHTML = sale.items.map(item => `
    <div class="receipt-item-row">
      <span class="col-item">${item.name} <span class="size-badge">${item.size}</span></span>
      <span class="col-qty text-center">${item.qty}</span>
      <span class="col-price text-right">${formatCurrency(item.price)}</span>
      <span class="col-total text-right">${formatCurrency(item.price * item.qty)}</span>
    </div>
  `).join("");

  console.log("showReceipt: Populating totals");
  document.getElementById("receipt-subtotal").textContent = formatCurrency(sale.subtotal);
  const discountVal = sale.subtotal * (sale.discount / 100);
  document.getElementById("receipt-discount").textContent = `-${formatCurrency(discountVal)} (${sale.discount}%)`;
  document.getElementById("receipt-total").textContent = formatCurrency(sale.total);

  openModal("receipt-modal");
}

// --- Stock/Inventory Section Logic ---
function renderStockPage() {
  const searchQuery = document.getElementById("stock-search").value;
  const categoryFilter = document.getElementById("stock-category-filter").value;
  const statusFilter = document.getElementById("stock-status-filter").value;
  const tableBody = document.getElementById("stock-table-body");

  // Populate Dropdown
  populateCategoriesDropdown("stock-category-filter", categoryFilter);

  const filtered = products.filter(p => {
    const matchesSearch = matchesSearchQuery(p, searchQuery);
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    
    let matchesStatus = true;
    const totalStock = getProductStock(p);
    if (statusFilter === "in-stock") matchesStatus = totalStock > p.threshold;
    else if (statusFilter === "low-stock") matchesStatus = totalStock <= p.threshold && totalStock > 0;
    else if (statusFilter === "out-of-stock") matchesStatus = totalStock === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortFilter = document.getElementById("stock-sort-filter") ? document.getElementById("stock-sort-filter").value : "default";
  filtered.sort((a, b) => {
    if (sortFilter === "date-newest") {
      return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
    } else if (sortFilter === "date-oldest") {
      return new Date(a.dateAdded || 0) - new Date(b.dateAdded || 0);
    }
    return 0;
  });

  if (filtered.length > 0) {
    tableBody.innerHTML = filtered.map((p, idx) => {
      const totalStock = getProductStock(p);
      let statusBadge = `<span class="badge badge-success">In Stock</span>`;
      if (totalStock === 0) {
        statusBadge = `<span class="badge badge-danger">Out of Stock</span>`;
      } else if (totalStock <= p.threshold) {
        statusBadge = `<span class="badge badge-warning">Low Stock</span>`;
      }

      // Find original index in master products array to reference for edit/delete
      const masterIdx = products.findIndex(mp => mp.sku === p.sku);

      const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
      const sizesListHTML = sizes.map(sz => {
        const qty = p.sizes ? (p.sizes[sz] || 0) : 0;
        return `<span class="catalog-size-item ${qty === 0 ? 'empty' : ''}">${sz}: <strong>${qty}</strong></span>`;
      }).join("");
      
      const variantsObj = p.variants || { "Gold Border-M": { stock: totalStock, costPrice: p.costPrice, sellingPrice: p.sellingPrice } };
      const variantsHTML = Object.entries(variantsObj).map(([key, val]) => {
        const [col, sz] = key.split("-");
        const sp = val.sellingPrice || p.sellingPrice;
        const isCustomPrice = sp !== p.sellingPrice;
        return `
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem 0.75rem; border-radius: 8px; margin: 0.25rem;">
            <span class="color-pill"><span class="color-dot" style="background: var(--primary);"></span>${col || 'Standard'} • ${sz || 'M'}</span>
            <span class="font-mono text-xs">Stock: <strong>${val.stock || 0}</strong></span>
            <span class="font-mono text-xs ${isCustomPrice ? 'text-warning font-bold' : 'text-emerald'}">₹${sp}</span>
            <button class="btn-icon-only" style="padding: 0.1rem;" onclick="openVariantPriceModal('${p.sku}', '${key}', '${p.name.replace(/'/g, "\\'")}', '${sp}')" title="Edit Variant Price"><i data-lucide="tag" style="width: 14px; height: 14px; color: var(--primary);"></i></button>
          </div>
        `;
      }).join("");

      const detailsRow = `
        <tr id="variant-row-${p.sku}" style="display: none;">
          <td colspan="9" class="variant-row-details">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span class="font-bold text-sm text-primary">🎨 Color & Size Variant Breakdown Matrix</span>
              <span class="text-xs text-muted">Click tag icon to override price for specific variant</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${variantsHTML}
            </div>
          </td>
        </tr>
      `;

      const sizesContainerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div class="catalog-sizes-list">${sizesListHTML}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.2rem;">
            <span class="text-sm font-semibold text-muted">Total: ${totalStock}</span>
            <button class="variant-expand-btn" onclick="toggleVariantRow('${p.sku}')"><i data-lucide="layers"></i> Matrix</button>
          </div>
        </div>
      `;

      return `
        <tr>
          <td class="font-mono text-muted">${p.sku}</td>
          <td class="font-bold">${p.name}${p.vendorName ? `<br><span class="badge badge-warning" style="font-size: 0.7rem; padding: 0.1rem 0.4rem; margin-top: 0.2rem;"><i data-lucide="building" style="width: 10px; height: 10px; display: inline-block;"></i> ${p.vendorName}</span>` : ''}</td>
          <td><span class="text-sm">${p.category}</span></td>
          <td>${formatCurrency(p.costPrice)}</td>
          <td>${formatCurrency(p.sellingPrice)}</td>
          <td>${sizesContainerHTML}</td>
          <td class="text-muted">${p.threshold}</td>
          <td class="font-mono text-xs">${p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : 'N/A'}</td>
          <td>${statusBadge}</td>
          <td class="text-right">
            <div class="action-buttons">
              <button class="btn-icon-only text-emerald" onclick="openRestockModal('${p.sku}')" title="Restock">
                <i data-lucide="plus-circle"></i>
              </button>
              <button class="btn-icon-only text-cyan" onclick="editProduct(${masterIdx})" title="Edit Product">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="btn-icon-only text-danger" onclick="deleteProduct(${masterIdx})" title="Delete Product">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
        ${detailsRow}
      `;
    }).join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No stock items found matching current filters.</td></tr>`;
  }

  lucide.createIcons();
}

// --- Render Dedicated Low Stock Page (NEW) ---
function renderLowStockPage() {
  const searchQuery = document.getElementById("lowstock-search").value;
  const categoryFilter = document.getElementById("lowstock-category-filter").value;
  const tableBody = document.getElementById("lowstock-table-body");

  // Populate Dropdown
  populateCategoriesDropdown("lowstock-category-filter", categoryFilter);

  const lowStockProducts = products.filter(p => getProductStock(p) <= p.threshold);

  const filtered = lowStockProducts.filter(p => {
    const matchesSearch = matchesSearchQuery(p, searchQuery);
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length > 0) {
    tableBody.innerHTML = filtered.map(p => {
      const totalStock = getProductStock(p);
      let statusBadge = totalStock === 0 
        ? `<span class="badge badge-danger">Out of Stock</span>` 
        : `<span class="badge badge-warning">Low Stock</span>`;

      const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
      const sizesListHTML = sizes.map(sz => {
        const qty = p.sizes ? (p.sizes[sz] || 0) : 0;
        return `<span class="catalog-size-item ${qty === 0 ? 'empty' : ''}">${sz}: <strong>${qty}</strong></span>`;
      }).join("");
      const sizesContainerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div class="catalog-sizes-list">${sizesListHTML}</div>
          <span class="text-sm font-semibold text-rose">Total: ${totalStock}</span>
        </div>
      `;

      return `
        <tr>
          <td class="font-mono text-muted">${p.sku}</td>
          <td class="font-bold">${p.name}</td>
          <td><span class="text-sm">${p.category}</span></td>
          <td>${formatCurrency(p.costPrice)}</td>
          <td>${formatCurrency(p.sellingPrice)}</td>
          <td>${sizesContainerHTML}</td>
          <td class="text-muted">${p.threshold}</td>
          <td>${statusBadge}</td>
          <td class="text-right">
            <button class="btn btn-primary" onclick="openRestockModal('${p.sku}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
              <i data-lucide="plus"></i>
              <span>Restock</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No low stock items found matching current filters.</td></tr>`;
  }

  lucide.createIcons();
}

function populateProductVendorSelect(selectedVal = "") {
  const select = document.getElementById("product-vendor");
  if (!select) return;
  select.innerHTML = `<option value="">Direct / No Specific Supplier</option>` +
    vendors.map(v => `<option value="${v.name}" ${v.name === selectedVal ? 'selected' : ''}>${v.name} (${v.id})</option>`).join("");
}

function editProduct(masterIdx) {
  const p = products[masterIdx];
  if (!p) return;

  document.getElementById("product-modal-title").textContent = "Edit Product";
  document.getElementById("product-edit-index").value = masterIdx;
  document.getElementById("product-sku").value = p.sku;
  document.getElementById("product-sku").readOnly = true;
  document.getElementById("product-name").value = p.name;
  document.getElementById("product-category").value = p.category;
  document.getElementById("product-cost-price").value = p.costPrice;
  document.getElementById("product-selling-price").value = p.sellingPrice;
  
  populateProductVendorSelect(p.vendorName || "");
  const colorsStr = p.variants ? [...new Set(Object.keys(p.variants).map(k => k.split("-")[0]))].join(", ") : "";
  const colorInput = document.getElementById("product-colors");
  if (colorInput) colorInput.value = colorsStr;

  document.getElementById("product-stock-s").value = p.sizes ? (p.sizes.S || 0) : 0;
  document.getElementById("product-stock-m").value = p.sizes ? (p.sizes.M || 0) : 0;
  document.getElementById("product-stock-l").value = p.sizes ? (p.sizes.L || 0) : 0;
  document.getElementById("product-stock-xl").value = p.sizes ? (p.sizes.XL || 0) : 0;
  document.getElementById("product-stock-xxl").value = p.sizes ? (p.sizes.XXL || 0) : 0;
  document.getElementById("product-threshold").value = p.threshold;

  openModal("product-modal");
}

async function deleteProduct(masterIdx) {
  const p = products[masterIdx];
  if (!p) return;

  if (confirm(`Are you sure you want to delete product "${p.name}"?`)) {
    try {
      const response = await fetch(`/api/products/${p.sku}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
      await loadData();
      
      // Re-render whatever section is active
      const activeSec = window.location.hash.substring(1) || 'dashboard';
      if (activeSec === 'stock') renderStockPage();
      if (activeSec === 'lowstock') renderLowStockPage();
      
      showToast("Product deleted successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete product.", "error");
    }
  }
}

function openRestockModal(sku) {
  const p = products.find(prod => prod.sku === sku);
  if (!p) return;

  document.getElementById("restock-sku").value = p.sku;
  document.getElementById("restock-product-name").textContent = p.name;
  document.getElementById("restock-current-stock").textContent = `${getProductStock(p)} items total`;
  
  const colorSelect = document.getElementById("restock-color");
  if (colorSelect) {
    const variantsObj = p.variants || { "Standard-M": { stock: 0 } };
    const colors = [...new Set(Object.keys(variantsObj).map(k => k.split("-")[0]))];
    colorSelect.innerHTML = colors.map(col => `<option value="${col}">${col}</option>`).join("");
  }
  
  document.getElementById("restock-size").value = "";
  document.getElementById("restock-quantity").value = "";

  openModal("restock-modal");
}

// --- Expenses Section Logic ---
function renderBorrowingsPage() {
  const tableBody = document.getElementById("borrowings-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";
  
  if (borrowings.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-md">No business borrowings logged yet.</td></tr>`;
    return;
  }
  
  // Sort: active first, then by due date
  const sorted = [...borrowings].sort((a,b) => {
    if(a.status !== b.status) return a.status === "Active" ? -1 : 1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  sorted.forEach(b => {
    const dueDate = new Date(b.dueDate);
    dueDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    let dueClass = "";
    let dueText = dueDate.toLocaleDateString();
    
    if (b.status === "Active") {
      if (diffDays < 0) {
        dueClass = "text-rose font-bold";
        dueText += " (Overdue)";
      } else if (diffDays <= 3) {
        dueClass = "text-warning font-bold";
        dueText += ` (Due in ${diffDays} days)`;
      }
    }
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="font-bold">${b.lenderName}</td>
      <td>${new Date(b.date).toLocaleDateString()}</td>
      <td class="${dueClass}">${dueText}</td>
      <td>
        <span class="status-badge ${b.status === 'Active' ? 'status-lowstock' : 'status-instock'}">${b.status}</span>
      </td>
      <td class="text-right font-bold text-rose">${formatCurrency(b.amount)}</td>
      <td class="text-right">
        ${b.status === 'Active' ? `<button class="btn btn-emerald btn-sm" onclick="writeOffBorrowing('${b.id}')">Write Off / Settle</button>` : `<span class="text-muted">Settled</span>`}
      </td>
    `;
    tableBody.appendChild(row);
  });
}

async function writeOffBorrowing(id) {
  if(!confirm("Are you sure you want to write off/settle this borrowing? It will be marked as paid.")) return;
  try {
    const response = await fetch('https://auric-inventory-backend.onrender.com/api/borrowings/' + id + '/writeoff', { method: 'POST' });
    if(response.ok) {
      showToast("Borrowing settled successfully!", "success");
      await loadData();
      renderBorrowingsPage();
    } else {
      showToast("Failed to settle borrowing", "error");
    }
  } catch(e) {
    showToast("Error settling borrowing", "error");
  }
}

function renderExpensesPage() {
  const searchQuery = document.getElementById("expense-search").value.toLowerCase();
  const categoryFilter = document.getElementById("expense-category-filter").value;
  const tableBody = document.getElementById("expenses-table-body");

  const filtered = expenses.filter(e => {
    const matchesSearch = e.desc.toLowerCase().includes(searchQuery);
    const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length > 0) {
    tableBody.innerHTML = filtered.map(e => {
      const masterIdx = expenses.findIndex(me => me.id === e.id);
      return `
        <tr>
          <td class="text-muted">${new Date(e.date).toLocaleDateString()}</td>
          <td><span class="badge badge-danger">${e.category}</span></td>
          <td class="font-bold">${e.desc}</td>
          <td class="text-rose font-bold">${formatCurrency(e.amount)}</td>
          <td class="text-right">
            <button class="btn-icon-only text-danger" onclick="deleteExpense(${masterIdx})" title="Delete Expense">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No expense items logged.</td></tr>`;
  }

  lucide.createIcons();
}

async function deleteExpense(masterIdx) {
  const e = expenses[masterIdx];
  if (!e) return;

  if (confirm(`Are you sure you want to delete expense logs for "${e.desc}"?`)) {
    try {
      const response = await fetch(`/api/expenses/${e.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }
      await loadData();
      renderExpensesPage();
      showToast("Expense record removed", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete expense record.", "error");
    }
  }
}

// --- Reports & Diagnostics Section Logic ---
function renderReportsPage() {
  const monthPicker = document.getElementById("report-month-picker");
  
  if (!monthPicker.value) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    monthPicker.value = `${yyyy}-${mm}`;
  }

  const [year, month] = monthPicker.value.split("-").map(Number);
  
  // Date filtering logic
  const filteredSales = sales.filter(s => {
    const sd = new Date(s.date);
    return sd.getFullYear() === year && (sd.getMonth() + 1) === month;
  });

  const filteredExpenses = expenses.filter(e => {
    const ed = new Date(e.date);
    return ed.getFullYear() === year && (ed.getMonth() + 1) === month;
  });

  // Calculate stats
  // 1. Monthly revenue
  const monthlyRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  document.getElementById("report-sales-rev").textContent = formatCurrency(monthlyRevenue);
  document.getElementById("report-sales-count").textContent = `${filteredSales.length} Invoices`;

  // 2. Cost of Goods Sold (COGS)
  const monthlyCOGS = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + (item.cost * item.qty), 0);
  }, 0);
  document.getElementById("report-cogs-value").textContent = formatCurrency(monthlyCOGS);
  
  const grossProfit = monthlyRevenue - monthlyCOGS;
  const grossMargin = monthlyRevenue > 0 ? (grossProfit / monthlyRevenue) * 100 : 0;
  document.getElementById("report-gross-margin").textContent = `${grossMargin.toFixed(1)}% gross margin`;

  // 3. Monthly expenses total
  const monthlyExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById("report-expenses-val").textContent = formatCurrency(monthlyExpenses);
  document.getElementById("report-expenses-count").textContent = `${filteredExpenses.length} Records`;

  // 4. Net Monthly Profit
  const netMonthlyProfit = grossProfit - monthlyExpenses;
  const profitMargin = monthlyRevenue > 0 ? (netMonthlyProfit / monthlyRevenue) * 100 : 0;

  const netProfitEl = document.getElementById("report-net-profit");
  netProfitEl.textContent = formatCurrency(netMonthlyProfit);
  if (netMonthlyProfit >= 0) {
    netProfitEl.className = "kpi-value text-emerald";
  } else {
    netProfitEl.className = "kpi-value text-rose";
  }
  document.getElementById("report-net-margin").textContent = `${profitMargin.toFixed(1)}% net margin`;

  // 5. Top Selling Products
  const topProducts = {};
  filteredSales.forEach(s => {
    s.items.forEach(item => {
      if (!topProducts[item.sku]) {
        topProducts[item.sku] = {
          name: item.name,
          qty: 0,
          revenue: 0,
          category: products.find(p => p.sku === item.sku)?.category || "Other"
        };
      }
      topProducts[item.sku].qty += item.qty;
      topProducts[item.sku].revenue += (item.price * item.qty);
    });
  });

  const sortedTopProducts = Object.values(topProducts).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topSellingList = document.getElementById("top-selling-products-list");

  if (sortedTopProducts.length > 0) {
    topSellingList.innerHTML = sortedTopProducts.map(p => `
      <div class="top-selling-item">
        <div class="top-product-details">
          <span class="name">${p.name}</span>
          <span class="category">${p.category}</span>
        </div>
        <div class="top-product-stats">
          <span class="sales">${p.qty} sold</span><br>
          <span class="revenue">${formatCurrency(p.revenue)}</span>
        </div>
      </div>
    `).join("");
  } else {
    topSellingList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="package-2"></i>
        <p>No products sold in this period.</p>
      </div>
    `;
  }

  // 6. Expenses distribution (Category wise totals)
  const expenseCategories = ["Rent", "Utilities", "Salaries", "Marketing", "Inventory", "Other"];
  const expenseDistribution = [0, 0, 0, 0, 0, 0];

  filteredExpenses.forEach(e => {
    const idx = expenseCategories.indexOf(e.category);
    if (idx !== -1) {
      expenseDistribution[idx] += e.amount;
    } else {
      expenseDistribution[5] += e.amount;
    }
  });

  renderExpensesDoughnutChart(expenseCategories, expenseDistribution);
  lucide.createIcons();
}

function renderExpensesDoughnutChart(labels, data) {
  const ctx = document.getElementById("expenseDistributionChart");
  if (!ctx) return;

  if (expenseDoughnutChart) {
    expenseDoughnutChart.destroy();
  }

  const total = data.reduce((s, val) => s + val, 0);
  const displayData = total === 0 ? [1] : data;
  const displayLabels = total === 0 ? ["No Expenses"] : labels;
  const displayColors = total === 0 
    ? ["rgba(156, 163, 175, 0.2)"] 
    : ["#d4af37", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#6b7280"]; // styled with gold colors

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const labelColor = isDark ? "#a3a3a3" : "#78716c";

  expenseDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: displayLabels,
      datasets: [{
        data: displayData,
        backgroundColor: displayColors,
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? "#0d0d0d" : "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: labelColor,
            font: { family: 'Plus Jakarta Sans', size: 11 }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// --- CSV Exports ---
function exportSalesToCSV() {
  const monthPicker = document.getElementById("report-month-picker");
  const [year, month] = monthPicker.value.split("-").map(Number);
  
  const filteredSales = sales.filter(s => {
    const sd = new Date(s.date);
    return sd.getFullYear() === year && (sd.getMonth() + 1) === month;
  });

  if (filteredSales.length === 0) {
    showToast("No sales logs found to export for selected month.", "warning");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Invoice ID,Date,Customer,Subtotal,Discount (%),Total Revenue (INR)\n";

  filteredSales.forEach(s => {
    csvContent += `"${s.id}","${new Date(s.date).toLocaleString()}","${s.customer || 'Walk-in'}","${s.subtotal.toFixed(2)}","${s.discount}","${s.total.toFixed(2)}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `AURIC_BY_SYLVIE_AND_SHUBHI_Sales_Report_${year}_${String(month).padStart(2, '0')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Sales report exported successfully", "success");
}

function exportExpensesToCSV() {
  const monthPicker = document.getElementById("report-month-picker");
  const [year, month] = monthPicker.value.split("-").map(Number);
  
  const filteredExpenses = expenses.filter(e => {
    const ed = new Date(e.date);
    return ed.getFullYear() === year && (ed.getMonth() + 1) === month;
  });

  if (filteredExpenses.length === 0) {
    showToast("No expense logs found to export for selected month.", "warning");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Date,Category,Description,Amount (INR)\n";

  filteredExpenses.forEach(e => {
    csvContent += `"${e.date}","${e.category}","${e.desc.replace(/"/g, '""')}","${e.amount.toFixed(2)}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `AURIC_BY_SYLVIE_AND_SHUBHI_Expenses_Report_${year}_${String(month).padStart(2, '0')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Expenses report exported successfully", "success");
}

// --- Shared Utility Functions ---
function populateCategoriesDropdown(elemId, activeVal = "all") {
  const drop = document.getElementById(elemId);
  if (!drop) return;

  const categories = ["Suits", "Kurtis", "Dresses", "Trousers", "Sarees", "Dupattas", "Other"];
  const isFilter = elemId.includes("filter");
  
  let optionsHTML = isFilter ? `<option value="all">All Categories</option>` : "";
  optionsHTML += categories.map(cat => `<option value="${cat}" ${cat === activeVal ? 'selected' : ''}>${cat}</option>`).join("");
  
  drop.innerHTML = optionsHTML;
}

// Indian Rupees Formatter
function formatCurrency(val) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
}

// --- Sales & Debts Ledger ---

function renderSalesLedgerPage() {
  renderSalesLedger();
  renderCustomerDebts();
  renderPaymentTracker();
}

function renderSalesLedger() {
  const tbody = document.getElementById("sales-ledger-body");
  if(!tbody) return;
  tbody.innerHTML = "";
  
  if (sales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-md">No sales recorded yet.</td></tr>`;
    return;
  }
  
  const filterEl = document.getElementById("sales-ledger-filter");
  const filterVal = filterEl ? filterEl.value : "all";

  // Sort by date descending
  let sortedSales = [...sales].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  if (filterVal !== "all") {
    sortedSales = sortedSales.filter(sale => {
       const status = sale.paymentStatus || (sale.paymentMode === "Credit" ? "Unpaid" : "Paid");
       return status === filterVal;
    });
  }
  
  if (sortedSales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-md">No sales found for this filter.</td></tr>`;
    return;
  }
  
  sortedSales.forEach(sale => {
    const paymentMode = sale.paymentMode || "Cash";
    const status = sale.paymentStatus || (paymentMode === "Credit" ? "Unpaid" : "Paid");
    
    let statusClass = "status-instock"; // Green badge
    if (status === "Unpaid") statusClass = "status-lowstock"; // Red/Orange badge
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="font-bold">${sale.id}</td>
      <td>${new Date(sale.date).toLocaleDateString()}</td>
      <td>${sale.customer}</td>
      <td>${paymentMode}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td class="text-right font-bold text-emerald">${formatCurrency(sale.total)}</td>
    `;
    tbody.appendChild(row);
  });
  lucide.createIcons();
}

function renderCustomerDebts() {
  const tbody = document.getElementById("customer-debts-body");
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const debts = sales.filter(s => (s.paymentStatus === "Unpaid") || (!s.paymentStatus && s.paymentMode === "Credit"));
  
  if (debts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-md">No outstanding customer debts.</td></tr>`;
    return;
  }
  
  debts.forEach(sale => {
    const itemsCount = sale.items.reduce((acc, item) => acc + item.qty, 0);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="font-bold">${sale.id}</td>
      <td>${new Date(sale.date).toLocaleDateString()}</td>
      <td>${sale.customer}</td>
      <td>${itemsCount} Items</td>
      <td class="text-right font-bold text-rose">${formatCurrency(sale.total)}</td>
      <td class="text-right">
        <button class="btn btn-emerald btn-sm" onclick="settleCustomerDebt('${sale.id}')">Settle Debt</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  lucide.createIcons();
}

async function settleCustomerDebt(id) {
  if(!confirm("Are you sure you want to mark this debt as PAID?")) return;
  try {
    const response = await fetch('https://auric-inventory-backend.onrender.com/api/sales/' + id + '/settle', { method: 'POST' });
    if(response.ok) {
      showToast("Debt settled successfully!", "success");
      await loadData();
      renderSalesLedgerPage();
    } else {
      showToast("Failed to settle debt", "error");
    }
  } catch(e) {
    showToast("Error settling debt", "error");
  }
}

function renderPaymentTracker() {
  const cashEl = document.getElementById("sl-total-cash");
  const onlineEl = document.getElementById("sl-total-online");
  if(!cashEl || !onlineEl) return;
  
  let totalCash = 0;
  let totalOnline = 0;
  
  sales.forEach(sale => {
    const status = sale.paymentStatus || (sale.paymentMode === "Credit" ? "Unpaid" : "Paid");
    if(status === "Paid") {
      const mode = sale.paymentMode || "Cash";
      if(mode === "Cash") totalCash += sale.total;
      else if(mode.includes("Online") || mode.includes("UPI")) totalOnline += sale.total;
    }
  });
  
  cashEl.textContent = formatCurrency(totalCash);
  onlineEl.textContent = formatCurrency(totalOnline);
}

// --- Event Listeners and Form Handlers ---
function initEventListeners() {
  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  
  if (mobileMenuBtn && sidebar && overlay) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.add("sidebar-open");
      overlay.classList.add("active");
    });
    
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("sidebar-open");
      overlay.classList.remove("active");
    });
  }

  // Navigation sidebar clicks
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-target");
      window.location.hash = target;
      
      // Auto-close sidebar on mobile after navigating
      if (window.innerWidth <= 1024 && sidebar && overlay) {
        sidebar.classList.remove("sidebar-open");
        overlay.classList.remove("active");
      }
    });
  });

  // Sidebar Low Stock alert link triggers the new view directly
  document.getElementById("sidebar-lowstock-alert").addEventListener("click", () => {
    window.location.hash = "lowstock";
  });

  // Modal Closers
  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-modal");
      closeModal(modalId);
    });
  });

  // Close modals when clicking outside
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Generic Tab Listeners for vv-tabs
  document.querySelectorAll(".vv-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.hasAttribute("onclick")) return; // Skip if it has an inline onclick like Vendor Vault tabs
      
      const section = e.target.closest('.page-section');
      if(section) {
        section.querySelectorAll(".vv-tab-btn").forEach(b => b.classList.remove("active"));
        section.querySelectorAll(".vv-tab-content").forEach(c => c.classList.remove("active"));
        
        e.target.classList.add("active");
        const targetId = e.target.getAttribute("data-tab");
        if(targetId) {
          const tabContent = document.getElementById(targetId);
          if(tabContent) tabContent.classList.add("active");
        }
      }
    });
  });

  // Form Submissions

  // 1. Save/Edit Product
  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editIdx = document.getElementById("product-edit-index").value;
    const sku = document.getElementById("product-sku").value.trim().toUpperCase();
    const name = document.getElementById("product-name").value.trim();
    const category = document.getElementById("product-category").value;
    const costPrice = parseFloat(document.getElementById("product-cost-price").value);
    const sellingPrice = parseFloat(document.getElementById("product-selling-price").value);
    const sizes = {
      S: parseInt(document.getElementById("product-stock-s").value) || 0,
      M: parseInt(document.getElementById("product-stock-m").value) || 0,
      L: parseInt(document.getElementById("product-stock-l").value) || 0,
      XL: parseInt(document.getElementById("product-stock-xl").value) || 0,
      XXL: parseInt(document.getElementById("product-stock-xxl").value) || 0
    };
    const threshold = parseInt(document.getElementById("product-threshold").value);

    if (costPrice > sellingPrice) {
      if (!confirm("Warning: Cost price is higher than Selling price. Do you want to proceed?")) {
        return;
      }
    }

    if (editIdx === "") {
      if (products.some(p => p.sku === sku)) {
        showToast("SKU already exists! Please use a unique identifier.", "error");
        return;
      }
    }

    const vendorName = document.getElementById("product-vendor")?.value || "";
    const colorsVal = document.getElementById("product-colors")?.value.trim() || "";
    const colorList = colorsVal ? colorsVal.split(",").map(c => c.trim()).filter(Boolean) : ["Standard"];

    const variants = {};
    const oldP = editIdx !== "" ? products[editIdx] : null;
    colorList.forEach(col => {
      Object.keys(sizes).forEach(sz => {
        const varKey = `${col}-${sz}`;
        const oldVar = (oldP && oldP.variants) ? oldP.variants[varKey] : null;
        variants[varKey] = {
          stock: oldVar ? oldVar.stock : (sizes[sz] || 0),
          costPrice: oldVar ? oldVar.costPrice : costPrice,
          sellingPrice: oldVar ? oldVar.sellingPrice : sellingPrice
        };
      });
    });

    const updatedProduct = { sku, name, category, costPrice, sellingPrice, sizes, threshold, vendorName, variants };
    
    if (editIdx !== "") {
      updatedProduct.dateAdded = oldP.dateAdded || new Date().toISOString();
    } else {
      updatedProduct.dateAdded = new Date().toISOString();
    }

    try {
      const response = await fetch('https://auric-inventory-backend.onrender.com/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedProduct)
      });
      if (!response.ok) {
        throw new Error('Failed to save product');
      }
      
      await loadData();
      closeModal("product-modal");
      
      const currentHash = window.location.hash.substring(1) || 'dashboard';
      navigateToSection(currentHash);
      
      if (editIdx !== "") {
        showToast(`Product "${name}" updated`, "success");
      } else {
        showToast(`Added new product "${name}"`, "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to save product.", "error");
    }
  });

  // 2. Restock Product
  document.getElementById("restock-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sku = document.getElementById("restock-sku").value;
    const qty = parseInt(document.getElementById("restock-quantity").value);
    const color = document.getElementById("restock-color")?.value || "Standard";
    const size = document.getElementById("restock-size").value;

    const product = products.find(p => p.sku === sku);
    if (product) {
      if (!size) {
        showToast("Please select a size to restock!", "error");
        return;
      }
      const updatedProduct = JSON.parse(JSON.stringify(product));
      if (!updatedProduct.sizes) {
        updatedProduct.sizes = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
      }
      updatedProduct.sizes[size] = (updatedProduct.sizes[size] || 0) + qty;
      
      if (!updatedProduct.variants) updatedProduct.variants = {};
      const varKey = `${color}-${size}`;
      if (!updatedProduct.variants[varKey]) {
        updatedProduct.variants[varKey] = { stock: 0, costPrice: updatedProduct.costPrice, sellingPrice: updatedProduct.sellingPrice };
      }
      updatedProduct.variants[varKey].stock = (updatedProduct.variants[varKey].stock || 0) + qty;

      try {
        const response = await fetch('https://auric-inventory-backend.onrender.com/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedProduct)
        });
        if (!response.ok) {
          throw new Error('Failed to restock product');
        }

        await loadData();
        closeModal("restock-modal");
        
        // Refresh relevant views
        const currentHash = window.location.hash.substring(1) || 'dashboard';
        if (currentHash === 'stock') renderStockPage();
        if (currentHash === 'lowstock') renderLowStockPage();
        if (currentHash === 'dashboard') renderDashboard();
        
        showToast(`Stock replenished for ${product.name} (Size: ${size}, +${qty})`, "success");
      } catch (err) {
        console.error(err);
        showToast("Failed to restock product.", "error");
      }
    }
  });

  // 3. Log Expense
  document.getElementById("borrowing-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newBorrowing = {
      id: "BOR-" + Math.floor(1000 + Math.random() * 9000),
      lenderName: document.getElementById("borrowing-lender").value.trim(),
      amount: parseFloat(document.getElementById("borrowing-amount").value),
      date: document.getElementById("borrowing-date").value,
      dueDate: document.getElementById("borrowing-duedate").value,
      status: "Active"
    };

    try {
      const response = await fetch('https://auric-inventory-backend.onrender.com/api/borrowings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBorrowing)
      });
      if (!response.ok) throw new Error('Failed to log borrowing');

      await loadData();
      closeModal("borrowing-modal");
      
      const currentHash = window.location.hash.substring(1) || 'dashboard';
      navigateToSection(currentHash);
      
      showToast(`Borrowing logged: ${formatCurrency(newBorrowing.amount)} from ${newBorrowing.lenderName}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to log borrowing.", "error");
    }
  });

  document.getElementById("expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const desc = document.getElementById("expense-desc").value.trim();
    const category = document.getElementById("expense-category").value;
    const amount = parseFloat(document.getElementById("expense-amount").value);
    const date = document.getElementById("expense-date").value;

    const newExpense = {
      id: "EXP-" + Math.floor(100 + Math.random() * 900),
      date,
      category,
      desc,
      amount
    };

    try {
      const response = await fetch('https://auric-inventory-backend.onrender.com/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newExpense)
      });
      if (!response.ok) {
        throw new Error('Failed to log expense');
      }

      await loadData();
      closeModal("expense-modal");
      
      const currentHash = window.location.hash.substring(1) || 'dashboard';
      navigateToSection(currentHash);
      
      showToast(`Expense logged: ${formatCurrency(amount)} for ${desc}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to log expense.", "error");
    }
  });

  // Search & Filter Listeners (Real-time updates)
  document.getElementById("sales-search").addEventListener("input", renderSalesPage);
  document.getElementById("sales-category-filter").addEventListener("change", renderSalesPage);
  const slFilter = document.getElementById("sales-ledger-filter");
  if (slFilter) slFilter.addEventListener("change", renderSalesLedger);
  document.getElementById("cart-discount").addEventListener("input", renderCart);
  document.getElementById("checkout-btn").addEventListener("click", handleCheckout);

  document.getElementById("stock-search").addEventListener("input", renderStockPage);
  document.getElementById("stock-category-filter").addEventListener("change", renderStockPage);
  document.getElementById("stock-status-filter").addEventListener("change", renderStockPage);
  const sortFilterEl = document.getElementById("stock-sort-filter");
  if (sortFilterEl) sortFilterEl.addEventListener("change", renderStockPage);

  // New Low Stock filtering events
  document.getElementById("lowstock-search").addEventListener("input", renderLowStockPage);
  document.getElementById("lowstock-category-filter").addEventListener("change", renderLowStockPage);

  document.getElementById("expense-search").addEventListener("input", renderExpensesPage);
  document.getElementById("expense-category-filter").addEventListener("change", renderExpensesPage);
  document.getElementById("report-month-picker").addEventListener("change", renderReportsPage);

  // Vendor Vault Event Listeners
  const vendorSearchEl = document.getElementById("vendor-search");
  if (vendorSearchEl) vendorSearchEl.addEventListener("input", renderVendorDirectory);

  const vendorFormEl = document.getElementById("vendor-form");
  if (vendorFormEl) vendorFormEl.addEventListener("submit", handleVendorSubmit);

  const poFormEl = document.getElementById("po-form");
  if (poFormEl) poFormEl.addEventListener("submit", handlePOSubmit);

  const receivePOFormEl = document.getElementById("receive-po-form");
  if (receivePOFormEl) receivePOFormEl.addEventListener("submit", handleReceivePOSubmit);

  const vendorPayFormEl = document.getElementById("vendor-payment-form");
  if (vendorPayFormEl) vendorPayFormEl.addEventListener("submit", handleVendorPaymentSubmit);

  const vendorRetFormEl = document.getElementById("vendor-return-form");
  if (vendorRetFormEl) vendorRetFormEl.addEventListener("submit", handleVendorReturnSubmit);

  const variantPriceFormEl = document.getElementById("variant-price-form");
  if (variantPriceFormEl) variantPriceFormEl.addEventListener("submit", handleVariantPriceSubmit);

  // Trigger downloads & print
  document.getElementById("export-sales-csv").addEventListener("click", exportSalesToCSV);
  document.getElementById("export-expenses-csv").addEventListener("click", exportExpensesToCSV);
  document.getElementById("print-receipt-btn").addEventListener("click", () => {
    window.print();
  });
  
  // Custom button additions
  document.getElementById("add-product-btn").addEventListener("click", () => {
    document.getElementById("product-form").reset();
    document.getElementById("product-edit-index").value = "";
    document.getElementById("product-sku").readOnly = false;
    document.getElementById("product-modal-title").textContent = "Add Product";
    populateProductVendorSelect();
    openModal("product-modal");
  });

  document.getElementById("add-expense-btn").addEventListener("click", () => {
    document.getElementById("expense-form").reset();
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("expense-date").value = today;
    openModal("expense-modal");
  });

  // Reset database triggers and buttons
  document.getElementById("reset-db-trigger").addEventListener("click", () => {
    openModal("reset-modal");
  });

  document.getElementById("clear-all-data-btn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear ALL products, sales history, and expenses? This will permanently delete everything and start fresh with an empty database.")) {
      try {
        const response = await fetch('https://auric-inventory-backend.onrender.com/api/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type: 'clear' })
        });
        if (!response.ok) {
          throw new Error('Failed to clear database');
        }

        cart = [];
        await loadData();
        closeModal("reset-modal");
        
        const currentHash = window.location.hash.substring(1) || 'dashboard';
        navigateToSection(currentHash);
        showToast("Boutique database cleared successfully", "success");
      } catch (err) {
        console.error(err);
        showToast("Failed to clear database.", "error");
      }
    }
  });

  document.getElementById("restore-demo-data-btn").addEventListener("click", async () => {
    if (confirm("Are you sure you want to restore the preloaded clothing boutique demo data? This will overwrite your current products, sales, and expenses.")) {
      try {
        const response = await fetch('https://auric-inventory-backend.onrender.com/api/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type: 'restore' })
        });
        if (!response.ok) {
          throw new Error('Failed to restore demo data');
        }

        cart = [];
        await loadData();
        closeModal("reset-modal");
        
        const currentHash = window.location.hash.substring(1) || 'dashboard';
        navigateToSection(currentHash);
        showToast("Demo clothing boutique data restored", "success");
      } catch (err) {
        console.error(err);
        showToast("Failed to restore demo data.", "error");
      }
    }
  });
}

// --- Modal Control Utilities ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

// --- Toast System ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconName = "check-circle";
  if (type === "warning") iconName = "alert-triangle";
  if (type === "error") iconName = "alert-circle";

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(15px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

// ==========================================
// VENDOR VAULT & PO INTELLIGENCE CONTROLLER
// ==========================================
let currentVendorTab = "directory";
let tempPOItems = [];

function switchVendorTab(tabId) {
  currentVendorTab = tabId;
  document.querySelectorAll(".vv-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelectorAll(".vv-tab-content").forEach(content => {
    content.classList.remove("active");
  });
  
  const targetBtn = document.querySelector(`.vv-tab-btn[onclick="switchVendorTab('${tabId}')"]`);
  if (targetBtn) targetBtn.classList.add("active");
  
  const targetContent = document.getElementById(`vv-tab-${tabId}`);
  if (targetContent) targetContent.classList.add("active");
  
  renderVendorVault();
}

function renderVendorVault() {
  if (currentVendorTab === "directory") renderVendorDirectory();
  else if (currentVendorTab === "pos") renderPOList();
  else if (currentVendorTab === "performance") renderVendorPerformance();
  else if (currentVendorTab === "liabilities") renderVendorLiabilities();
  else if (currentVendorTab === "returns") renderVendorReturns();
  lucide.createIcons();
}

// --- 1. Vendor Directory CRUD ---
function renderVendorDirectory() {
  const query = document.getElementById("vendor-search")?.value.toLowerCase() || "";
  const body = document.getElementById("vendor-directory-body");
  if (!body) return;
  
  const filtered = vendors.filter(v => 
    v.name.toLowerCase().includes(query) ||
    v.id.toLowerCase().includes(query) ||
    (v.categories && v.categories.toLowerCase().includes(query))
  );
  
  if (filtered.length > 0) {
    body.innerHTML = filtered.map(v => `
      <tr>
        <td class="font-mono font-bold text-primary">${v.id}</td>
        <td class="font-bold">${v.name}</td>
        <td>${v.contact} • <span class="text-xs text-muted">${v.phone}</span></td>
        <td><span class="badge badge-warning">${v.terms}</span></td>
        <td><span class="text-sm">${v.categories || 'General'}</span><br><span class="text-xs text-muted">${products.filter(p => p.vendorName === v.name).length} catalog SKUs linked</span></td>
        <td><span class="badge ${v.status === 'Active' ? 'badge-success' : 'badge-danger'}">${v.status}</span></td>
        <td class="text-right">
          <div class="action-buttons">
            <button class="btn-icon-only text-cyan" onclick="editVendor('${v.id}')" title="Edit Vendor">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-icon-only text-danger" onclick="deleteVendor('${v.id}')" title="Delete Vendor">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  } else {
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No suppliers found in directory. Click "Add Supplier" to create one.</td></tr>`;
  }
  lucide.createIcons();
}

function resetVendorForm() {
  const form = document.getElementById("vendor-form");
  if (!form) return;
  form.reset();
  document.getElementById("vendor-edit-id").value = "";
  document.getElementById("vendor-id").readOnly = false;
  document.getElementById("vendor-id").value = `VND-00${vendors.length + 1}`;
  document.getElementById("vendor-modal-title").textContent = "Add Supplier Profile";
  document.getElementById("vendor-terms").value = "Cash on Delivery"; // Obeying user constraint: 1- cash on delivery
}

function editVendor(id) {
  const v = vendors.find(item => item.id === id);
  if (!v) return;
  
  document.getElementById("vendor-edit-id").value = v.id;
  document.getElementById("vendor-id").value = v.id;
  document.getElementById("vendor-id").readOnly = true;
  document.getElementById("vendor-name").value = v.name;
  document.getElementById("vendor-contact").value = v.contact;
  document.getElementById("vendor-phone").value = v.phone;
  document.getElementById("vendor-email").value = v.email || "";
  document.getElementById("vendor-gst").value = v.gst || "";
  document.getElementById("vendor-address").value = v.address || "";
  document.getElementById("vendor-terms").value = v.terms || "Cash on Delivery";
  document.getElementById("vendor-status").value = v.status || "Active";
  document.getElementById("vendor-categories").value = v.categories || "";
  
  document.getElementById("vendor-modal-title").textContent = "Edit Supplier Profile";
  openModal("vendor-modal");
}

async function deleteVendor(id) {
  if (!confirm(`Are you sure you want to remove vendor ${id} from directory?`)) return;
  try {
    const response = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error("Failed to delete vendor");
    await loadData();
    renderVendorDirectory();
    showToast(`Vendor ${id} deleted successfully`, "warning");
  } catch (err) {
    console.error(err);
    showToast("Error deleting vendor", "error");
  }
}

async function handleVendorSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById("vendor-edit-id").value;
  const vendorData = {
    id: document.getElementById("vendor-id").value.trim().toUpperCase(),
    name: document.getElementById("vendor-name").value.trim(),
    contact: document.getElementById("vendor-contact").value.trim(),
    phone: document.getElementById("vendor-phone").value.trim(),
    email: document.getElementById("vendor-email").value.trim(),
    gst: document.getElementById("vendor-gst").value.trim(),
    address: document.getElementById("vendor-address").value.trim(),
    terms: document.getElementById("vendor-terms").value,
    status: document.getElementById("vendor-status").value,
    categories: document.getElementById("vendor-categories").value.trim()
  };
  
  try {
    const url = editId ? `/api/vendors/${editId}` : '/api/vendors';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorData)
    });
    if (!res.ok) throw new Error("Failed to save vendor");
    
    await loadData();
    closeModal("vendor-modal");
    renderVendorDirectory();
    showToast(`Supplier ${vendorData.name} saved successfully!`, "success");
  } catch (err) {
    console.error(err);
    showToast("Error saving supplier profile", "error");
  }
}

// --- 2. Purchase Orders CRUD & Lifecycle ---
function renderPOList() {
  const query = document.getElementById("po-search")?.value.toLowerCase() || "";
  const body = document.getElementById("po-list-body");
  if (!body) return;
  
  const filtered = purchaseOrders.filter(po => 
    po.id.toLowerCase().includes(query) ||
    po.vendorName.toLowerCase().includes(query) ||
    po.status.toLowerCase().includes(query)
  );
  
  if (filtered.length > 0) {
    body.innerHTML = filtered.map(po => {
      let statusBadge = `<span class="badge badge-warning">${po.status}</span>`;
      if (po.status === "Received") statusBadge = `<span class="badge badge-success">Received</span>`;
      else if (po.status === "Partially Received") statusBadge = `<span class="badge badge-cyan">Partially Received</span>`;
      
      const totalVal = po.items ? po.items.reduce((sum, item) => sum + (item.qty * item.cost), 0) : po.totalAmount;
      
      return `
        <tr>
          <td class="font-mono font-bold text-primary">${po.id}</td>
          <td class="font-bold">${po.vendorName}</td>
          <td>${po.orderDate}</td>
          <td>${po.deliveryDate}</td>
          <td>${statusBadge}</td>
          <td class="font-bold text-emerald">${formatCurrency(totalVal)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline ${po.status === 'Received' ? 'disabled' : ''}" onclick="openReceivePOModal('${po.id}')" ${po.status === 'Received' ? 'disabled' : ''}>
              <i data-lucide="check-square"></i><span>Verify Receipt</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No Purchase Orders issued yet. Click "Create Purchase Order" to begin.</td></tr>`;
  }
  lucide.createIcons();
}

function openCreatePOModal() {
  const form = document.getElementById("po-form");
  if (!form) return;
  form.reset();
  tempPOItems = [];
  
  const vendorSelect = document.getElementById("po-vendor");
  vendorSelect.innerHTML = `<option value="" disabled selected>Select Approved Supplier</option>` + 
    vendors.filter(v => v.status === "Active").map(v => `<option value="${v.name}">${v.name} (${v.id})</option>`).join("");
  
  const skuSelect = document.getElementById("po-item-sku");
  skuSelect.innerHTML = `<option value="" disabled selected>Select Garment SKU</option>` + 
    products.map(p => `<option value="${p.sku}">${p.name} (${p.sku})</option>`).join("");
  
  document.getElementById("po-number").value = `PO-2026-00${purchaseOrders.length + 1}`;
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("po-order-date").value = today;
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  document.getElementById("po-delivery-date").value = nextWeek.toISOString().split("T")[0];
  
  renderPOGrid();
  openModal("po-modal");
}

function updatePOVariantOptions() {
  const sku = document.getElementById("po-item-sku").value;
  const p = products.find(item => item.sku === sku);
  if (!p) return;
  
  const colorSelect = document.getElementById("po-item-color");
  const costInput = document.getElementById("po-item-cost");
  costInput.value = p.costPrice;
  
  const variantsObj = p.variants || { "Standard-M": { costPrice: p.costPrice } };
  const colors = [...new Set(Object.keys(variantsObj).map(k => k.split("-")[0]))];
  colorSelect.innerHTML = colors.map(col => `<option value="${col}">${col}</option>`).join("");
}

function addPOItemToGrid() {
  const skuSelect = document.getElementById("po-item-sku");
  const colorSelect = document.getElementById("po-item-color");
  const sizeSelect = document.getElementById("po-item-size");
  const qtyInput = document.getElementById("po-item-qty");
  const costInput = document.getElementById("po-item-cost");
  
  const sku = skuSelect.value;
  const color = colorSelect.value || "Standard";
  const size = sizeSelect.value || "M";
  const qty = parseInt(qtyInput.value);
  const cost = parseFloat(costInput.value);
  
  if (!sku || !qty || qty <= 0 || isNaN(cost)) {
    showToast("Please select product, quantity, and cost price", "warning");
    return;
  }
  
  const p = products.find(item => item.sku === sku);
  const name = p ? p.name : sku;
  
  tempPOItems.push({ sku, name, color, size, qty, cost, received: 0 });
  renderPOGrid();
  
  qtyInput.value = "";
  showToast(`Added ${name} (${color}-${size}) to order grid`, "success");
}

function removePOItemFromGrid(idx) {
  tempPOItems.splice(idx, 1);
  renderPOGrid();
}

function renderPOGrid() {
  const grid = document.getElementById("po-items-grid");
  const totalEl = document.getElementById("po-total-val");
  if (!grid || !totalEl) return;
  
  let grandTotal = 0;
  if (tempPOItems.length > 0) {
    grid.innerHTML = tempPOItems.map((item, idx) => {
      const lineTotal = item.qty * item.cost;
      grandTotal += lineTotal;
      return `
        <tr>
          <td class="font-bold">${item.name} <span class="font-mono text-xs text-muted">(${item.sku})</span></td>
          <td><span class="color-pill"><span class="color-dot" style="background: var(--primary);"></span>${item.color}</span></td>
          <td><span class="size-badge">${item.size}</span></td>
          <td><strong>${item.qty}</strong></td>
          <td>₹${item.cost}</td>
          <td class="font-bold text-emerald">₹${lineTotal}</td>
          <td>
            <button type="button" class="btn-icon-only text-danger" onclick="removePOItemFromGrid(${idx})"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    grid.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No items added to PO yet. Use selector above to add garment variants.</td></tr>`;
  }
  totalEl.textContent = formatCurrency(grandTotal);
  lucide.createIcons();
}

async function handlePOSubmit(e) {
  e.preventDefault();
  if (tempPOItems.length === 0) {
    showToast("Cannot issue PO with 0 items!", "error");
    return;
  }
  
  const poData = {
    id: document.getElementById("po-number").value.trim(),
    vendorName: document.getElementById("po-vendor").value,
    orderDate: document.getElementById("po-order-date").value,
    deliveryDate: document.getElementById("po-delivery-date").value,
    status: "Issued",
    items: [...tempPOItems],
    totalAmount: tempPOItems.reduce((sum, item) => sum + (item.qty * item.cost), 0)
  };
  
  try {
    const res = await fetch('https://auric-inventory-backend.onrender.com/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poData)
    });
    if (!res.ok) throw new Error("Failed to issue PO");
    
    await loadData();
    closeModal("po-modal");
    renderPOList();
    showToast(`Purchase Order ${poData.id} issued to supplier!`, "success");
  } catch (err) {
    console.error(err);
    showToast("Error issuing purchase order", "error");
  }
}

// --- 3. Stock Receiving Reconciliation ---
function openReceivePOModal(poId) {
  const po = purchaseOrders.find(item => item.id === poId);
  if (!po) return;
  
  document.getElementById("receive-po-number").value = po.id;
  document.getElementById("receive-po-title").textContent = `${po.id} (${po.vendorName})`;
  
  const body = document.getElementById("receive-po-items-body");
  body.innerHTML = (po.items || []).map((item, idx) => {
    const remaining = item.qty - (item.received || 0);
    return `
      <tr>
        <td class="font-bold">${item.name} <span class="color-pill"><span class="color-dot" style="background: var(--primary);"></span>${item.color}</span></td>
        <td><span class="size-badge">${item.size}</span></td>
        <td><strong>${item.qty}</strong></td>
        <td><span class="badge badge-cyan">${item.received || 0} rcvd</span></td>
        <td>
          <input type="number" class="form-control text-center rcv-qty-input" data-idx="${idx}" min="0" max="${remaining}" value="${remaining}" style="width: 90px;">
        </td>
      </tr>
    `;
  }).join("");
  
  document.getElementById("receive-po-status").value = po.status === "Partially Received" ? "Partially Received" : "Received";
  openModal("receive-po-modal");
}

async function handleReceivePOSubmit(e) {
  e.preventDefault();
  const poId = document.getElementById("receive-po-number").value;
  const po = purchaseOrders.find(item => item.id === poId);
  if (!po) return;
  
  const inputs = document.querySelectorAll(".rcv-qty-input");
  const receivedItems = [];
  
  inputs.forEach(input => {
    const idx = parseInt(input.getAttribute("data-idx"));
    const val = parseInt(input.value) || 0;
    if (val > 0 && po.items[idx]) {
      const item = po.items[idx];
      receivedItems.push({
        sku: item.sku,
        color: item.color,
        size: item.size,
        receivedQty: val
      });
    }
  });
  
  if (receivedItems.length === 0) {
    showToast("No newly received quantities specified", "warning");
    return;
  }
  
  const status = document.getElementById("receive-po-status").value;
  
  try {
    const res = await fetch(`/api/purchase-orders/${poId}/receive`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedItems, status })
    });
    if (!res.ok) throw new Error("Failed to process receiving");
    
    await loadData();
    closeModal("receive-po-modal");
    renderPOList();
    showToast(`Stock arrival verified for PO ${poId}. Catalog inventory updated!`, "success");
  } catch (err) {
    console.error(err);
    showToast("Error processing receiving", "error");
  }
}

// --- 4. Vendor Performance Analytics ---
function renderVendorPerformance() {
  const summaryEl = document.getElementById("vv-kpi-summary");
  const bodyEl = document.getElementById("vendor-performance-body");
  if (!summaryEl || !bodyEl) return;
  
  const totalPOVal = purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  const totalCatalogVal = products.reduce((sum, p) => p.vendorName ? sum + (getProductStock(p) * (p.costPrice || 0)) : sum, 0);
  const totalPurchasesVal = totalPOVal + totalCatalogVal;
  const totalPaid = vendorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalLiab = Math.max(0, totalPurchasesVal - totalPaid);
  
  summaryEl.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">Total Wholesale Purchases</span>
      <span class="kpi-value">${formatCurrency(totalPurchasesVal)}</span>
      <span class="kpi-trend positive">${purchaseOrders.length} POs & Catalog Stock</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Total Payments Settled</span>
      <span class="kpi-value text-emerald">${formatCurrency(totalPaid)}</span>
      <span class="kpi-trend positive">${vendorPayments.length} Transactions</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Outstanding Liabilities</span>
      <span class="kpi-value text-rose">${formatCurrency(totalLiab)}</span>
      <span class="kpi-trend ${totalLiab > 0 ? 'negative' : 'positive'}">${vendors.length} Active Suppliers</span>
    </div>
  `;
  
  if (vendors.length > 0) {
    bodyEl.innerHTML = vendors.map(v => {
      const vPOs = purchaseOrders.filter(po => po.vendorName === v.name);
      const poPurchasedVal = vPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
      const poUnits = vPOs.reduce((sum, po) => sum + (po.items || []).reduce((s, i) => s + (i.qty || 0), 0), 0);
      
      let catalogUnits = 0;
      let catalogVal = 0;
      products.forEach(p => {
        if (p.vendorName === v.name || (!p.vendorName && v.categories && v.categories.includes(p.category))) {
          const stk = getProductStock(p);
          catalogUnits += stk;
          catalogVal += (stk * (p.costPrice || 0));
        }
      });
      const totalPurchased = poPurchasedVal + catalogVal;
      
      let unitsSold = 0;
      let revGenerated = 0;
      let profitGenerated = 0;
      
      sales.forEach(s => {
        s.items.forEach(item => {
          const p = products.find(prod => prod.sku === item.sku);
          if (p && (p.vendorName === v.name || (!p.vendorName && v.categories && v.categories.includes(p.category)))) {
            unitsSold += item.qty;
            revGenerated += (item.price * item.qty);
            profitGenerated += ((item.price - item.cost) * item.qty);
          }
        });
      });
      
      const sellThrough = totalPurchased > 0 ? Math.min(100, (revGenerated / totalPurchased) * 100) : 0;
      
      return `
        <tr>
          <td class="font-bold text-primary">${v.name} <span class="font-mono text-xs text-muted">(${v.id})</span></td>
          <td class="font-bold">${formatCurrency(totalPurchased)}<br><span class="text-xs text-muted font-normal">${poUnits + catalogUnits} units in stock/POs</span></td>
          <td><strong>${unitsSold}</strong> units</td>
          <td class="text-emerald font-bold">${formatCurrency(revGenerated)}</td>
          <td class="text-cyan font-bold">${formatCurrency(profitGenerated)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="flex: 1; background: var(--bg-main); height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: var(--primary); height: 100%; width: ${sellThrough}%;"></div>
              </div>
              <span class="text-xs font-mono">${sellThrough.toFixed(1)}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    bodyEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No vendor performance data available yet.</td></tr>`;
  }
}

// --- 5. Liabilities & Payments ---
function renderVendorLiabilities() {
  const cardsEl = document.getElementById("vv-liabilities-cards");
  const bodyEl = document.getElementById("vendor-payments-body");
  const unpaidPOsBody = document.getElementById("vendor-unpaid-pos-body");
  if (!cardsEl || !bodyEl || !unpaidPOsBody) return;
  
  const unpaidPOs = purchaseOrders.filter(po => po.paymentStatus !== "Paid" && po.status !== "Draft");
  
  const totalPOVal = purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  const totalCatalogVal = products.reduce((sum, p) => p.vendorName ? sum + (getProductStock(p) * (p.costPrice || 0)) : sum, 0);
  const totalPurchasesVal = totalPOVal + totalCatalogVal;
  const totalPaid = vendorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalLiab = Math.max(0, totalPurchasesVal - totalPaid);
  
  cardsEl.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">Pending Supplier Accounts Payable</span>
      <span class="kpi-value text-rose">${formatCurrency(totalLiab)}</span>
      <span class="kpi-trend negative">Due across active credit terms</span>
    </div>
  `;
  
  if (unpaidPOs.length > 0) {
    unpaidPOsBody.innerHTML = unpaidPOs.map(po => {
      const poDate = new Date(po.date || Date.now());
      const dueDate = po.dueDate ? new Date(po.dueDate) : new Date(poDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      return `
        <tr>
          <td class="font-bold">${po.poNumber}</td>
          <td>${poDate.toLocaleDateString()}</td>
          <td class="text-rose font-bold">${dueDate.toLocaleDateString()}</td>
          <td>${po.vendorName || po.vendorId}</td>
          <td class="text-right font-bold text-rose">${formatCurrency(po.totalAmount)}</td>
          <td class="text-right">
            <button class="btn btn-emerald btn-sm" onclick="settleVendorPO('${po.poNumber}')">Record Payment</button>
          </td>
        </tr>
      `;
    }).join("");
  } else {
    unpaidPOsBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No unpaid stock orders found.</td></tr>`;
  }
  
  if (vendorPayments.length > 0) {
    bodyEl.innerHTML = vendorPayments.map(p => `
      <tr>
        <td class="font-mono font-bold text-primary">${p.id}</td>
        <td class="font-bold">${p.vendorName}</td>
        <td>${p.date}</td>
        <td class="font-bold text-emerald">₹${p.amount}</td>
        <td><span class="badge badge-warning">${p.method}</span></td>
        <td class="font-mono text-xs text-muted">${p.refNo || '-'}</td>
      </tr>
    `).join("");
  } else {
    bodyEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No supplier settlement transactions logged yet.</td></tr>`;
  }
}

async function settleVendorPO(poNumber) {
  if(!confirm("Are you sure you want to log a payment and settle this Purchase Order?")) return;
  try {
    const response = await fetch('https://auric-inventory-backend.onrender.com/api/purchase-orders/' + poNumber + '/settle', { method: 'POST' });
    if(response.ok) {
      showToast("Purchase Order settled successfully!", "success");
      await loadData();
      renderVendorLiabilities();
    } else {
      showToast("Failed to settle PO", "error");
    }
  } catch(e) {
    showToast("Error settling PO", "error");
  }
}

function populateVendorPaymentSelect() {
  const select = document.getElementById("vpay-vendor");
  if (!select) return;
  select.innerHTML = `<option value="" disabled selected>Select Supplier to Settle</option>` + 
    vendors.map(v => `<option value="${v.name}">${v.name} (${v.id})</option>`).join("");
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("vpay-date").value = today;
}

async function handleVendorPaymentSubmit(e) {
  e.preventDefault();
  const payData = {
    id: "VPAY-" + Math.floor(100 + Math.random() * 900),
    vendorName: document.getElementById("vpay-vendor").value,
    amount: parseFloat(document.getElementById("vpay-amount").value),
    method: document.getElementById("vpay-method").value,
    refNo: document.getElementById("vpay-ref").value.trim(),
    date: document.getElementById("vpay-date").value
  };
  
  try {
    const res = await fetch('https://auric-inventory-backend.onrender.com/api/vendor-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payData)
    });
    if (!res.ok) throw new Error("Failed to log payment");
    await loadData();
    closeModal("vendor-payment-modal");
    renderVendorLiabilities();
    showToast(`Settled ₹${payData.amount} for ${payData.vendorName}`, "success");
  } catch (err) {
    console.error(err);
    showToast("Error logging supplier payment", "error");
  }
}

// --- 6. Defective Stock Returns ---
function renderVendorReturns() {
  const bodyEl = document.getElementById("vendor-returns-body");
  if (!bodyEl) return;
  
  if (vendorReturns.length > 0) {
    bodyEl.innerHTML = vendorReturns.map(r => `
      <tr>
        <td class="font-mono font-bold text-primary">${r.id}</td>
        <td class="font-mono text-sm">${r.poNumber || '-'}</td>
        <td class="font-bold">${r.vendorName}</td>
        <td>${r.date}</td>
        <td><span class="font-bold text-rose">${r.items ? r.items[0].sku : 'Defective item'} (${r.items ? r.items[0].qty : 1} pcs)</span></td>
        <td><span class="badge badge-warning">${r.status || 'Returned'}</span></td>
        <td class="font-bold text-emerald">${formatCurrency(r.creditNoteAmount || 0)}</td>
      </tr>
    `).join("");
  } else {
    bodyEl.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No defective returns recorded.</td></tr>`;
  }
}

function populateVendorReturnSelect() {
  const vSelect = document.getElementById("vret-vendor");
  const skuSelect = document.getElementById("vret-sku");
  if (!vSelect || !skuSelect) return;
  
  vSelect.innerHTML = `<option value="" disabled selected>Select Vendor</option>` + 
    vendors.map(v => `<option value="${v.name}">${v.name}</option>`).join("");
  skuSelect.innerHTML = products.map(p => `<option value="${p.sku}">${p.name} (${p.sku})</option>`).join("");
  
  document.getElementById("vret-id").value = `RET-2026-00${vendorReturns.length + 1}`;
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("vret-date").value = today;
}

function updateVRetPOSelect() {
  const vendorName = document.getElementById("vret-vendor").value;
  const poSelect = document.getElementById("vret-po");
  if (!poSelect) return;
  
  const vPOs = purchaseOrders.filter(po => po.vendorName === vendorName);
  poSelect.innerHTML = `<option value="Direct Return">Direct Return (No PO)</option>` + 
    vPOs.map(po => `<option value="${po.id}">${po.id} (${po.orderDate})</option>`).join("");
}

async function handleVendorReturnSubmit(e) {
  e.preventDefault();
  const retData = {
    id: document.getElementById("vret-id").value.trim(),
    vendorName: document.getElementById("vret-vendor").value,
    poNumber: document.getElementById("vret-po").value,
    date: document.getElementById("vret-date").value,
    items: [{
      sku: document.getElementById("vret-sku").value,
      size: document.getElementById("vret-size").value,
      qty: parseInt(document.getElementById("vret-qty").value) || 1,
      reason: document.getElementById("vret-reason").value.trim()
    }],
    creditNoteAmount: parseFloat(document.getElementById("vret-credit").value) || 0,
    status: "Returned to Vendor"
  };
  
  try {
    const res = await fetch('https://auric-inventory-backend.onrender.com/api/vendor-returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retData)
    });
    if (!res.ok) throw new Error("Failed to log return");
    await loadData();
    closeModal("vendor-return-modal");
    renderVendorReturns();
    showToast(`Logged return ${retData.id}. Stock deducted & credit note generated!`, "warning");
  } catch (err) {
    console.error(err);
    showToast("Error logging vendor return", "error");
  }
}

// --- 7. Product Variant Matrix Breakdown & Price Overrides ---
function toggleVariantRow(sku) {
  const row = document.getElementById(`variant-row-${sku}`);
  if (!row) return;
  const isHidden = row.style.display === "none" || !row.style.display;
  row.style.display = isHidden ? "table-row" : "none";
}

function openVariantPriceModal(sku, varKey, prodName, currentPrice) {
  document.getElementById("var-price-sku").value = sku;
  document.getElementById("var-price-key").value = varKey;
  document.getElementById("var-price-product-title").textContent = prodName;
  document.getElementById("var-price-variant-title").textContent = varKey.replace("-", " • Size ");
  document.getElementById("var-price-input").value = currentPrice;
  openModal("variant-price-modal");
}

async function handleVariantPriceSubmit(e) {
  e.preventDefault();
  const sku = document.getElementById("var-price-sku").value;
  const varKey = document.getElementById("var-price-key").value;
  const customPrice = parseFloat(document.getElementById("var-price-input").value);
  
  const p = products.find(item => item.sku === sku);
  if (!p) return;
  
  if (!p.variants) {
    p.variants = {};
    const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    sizes.forEach(sz => {
      p.variants[`Standard-${sz}`] = { stock: p.sizes ? (p.sizes[sz] || 0) : 0, costPrice: p.costPrice, sellingPrice: p.sellingPrice };
    });
  }
  
  if (!p.variants[varKey]) {
    p.variants[varKey] = { stock: 0, costPrice: p.costPrice };
  }
  
  p.variants[varKey].sellingPrice = customPrice; // Obeying user constraint: variant selling price override
  
  try {
    const masterIdx = products.findIndex(mp => mp.sku === sku);
    const res = await fetch(`/api/products/${masterIdx}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    if (!res.ok) throw new Error("Failed to update variant price");
    
    await loadData();
    closeModal("variant-price-modal");
    renderStockPage();
    showToast(`Variant selling price updated to ₹${customPrice}!`, "success");
  } catch (err) {
    console.error(err);
    showToast("Error updating variant selling price", "error");
  }
}
