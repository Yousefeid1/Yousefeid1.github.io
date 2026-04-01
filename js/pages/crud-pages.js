// ============================================
// Products, Projects, Expenses, Settings & Notifications
// ============================================

// ===== PRODUCTS =====
async function renderProducts() {
  const content = document.getElementById('page-content');
  try {
    const products = await api.products();
    window._productsData = products;
    content.innerHTML = `
      <div class="page-header">
        <div><h2>المنتجات</h2><p>إدارة كتالوج المنتجات والمخزون</p></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="exportProductsExcel()">📊 Excel</button>
          <button class="btn btn-secondary" onclick="exportProductsPDF()">📄 PDF</button>
          <button class="btn btn-primary" onclick="openNewProductModal()">＋ منتج جديد</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" id="prod-search" placeholder="بحث بالاسم أو الكود..." oninput="filterProducts()" style="flex:1">
        <select id="prod-cat" onchange="filterProducts()">
          <option value="">كل الفئات</option>
          <option value="ألواح رخام">ألواح رخام</option>
          <option value="ألواح جرانيت">ألواح جرانيت</option>
          <option value="ألواح ترافرتين">ألواح ترافرتين</option>
          <option value="ألواح أونيكس">ألواح أونيكس</option>
          <option value="منتجات مشغولة">منتجات مشغولة</option>
        </select>
      </div>
      <div class="card" style="padding:0">
        <div class="data-table-wrapper">
          <table>
            <thead><tr>
              <th>الكود</th><th>المنتج</th><th>الفئة</th><th>الوحدة</th>
              <th>سعر الكلفة</th><th>سعر البيع</th><th>المخزون</th><th>الحد الأدنى</th><th>الحالة</th>
            </tr></thead>
            <tbody id="prod-tbody">${renderProductRows(products)}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

function renderProductRows(products) {
  if (!products.length) return `<tr><td colspan="9"><div class="empty-state" style="padding:40px"><div class="empty-icon">▦</div><h3>لا توجد منتجات</h3></div></td></tr>`;
  return products.map(p => `
    <tr>
      <td class="number">${p.code}</td>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge ${p.category === 'رخام' ? 'badge-gold' : 'badge-info'}">${p.category}</span></td>
      <td>${p.unit}</td>
      <td class="number">${formatMoney(p.cost)}</td>
      <td class="number">${formatMoney(p.price)}</td>
      <td class="number ${p.stock_qty <= p.min_stock ? 'text-danger' : 'text-success'}">${p.stock_qty}</td>
      <td class="number">${p.min_stock}</td>
      <td>${p.stock_qty <= p.min_stock ? '<span class="badge badge-danger">نقص مخزون</span>' : '<span class="badge badge-success">متوفر</span>'}</td>
    </tr>
  `).join('');
}

async function filterProducts() {
  const search   = document.getElementById('prod-search').value;
  const category = document.getElementById('prod-cat').value;
  const products = await api.products({ search, category });
  document.getElementById('prod-tbody').innerHTML = renderProductRows(products);
}

function openNewProductModal() {
  openModal('منتج جديد', `
    <div class="form-grid">
      <div class="form-group"><label>كود المنتج *</label><input type="text" id="np2-code" placeholder="مثال: MBL-007"></div>
      <div class="form-group form-full"><label>اسم المنتج *</label><input type="text" id="np2-name" placeholder="اسم المنتج"></div>
      <div class="form-group">
        <label>الفئة *</label>
        <select id="np2-cat">
          <option value="ألواح رخام">ألواح رخام</option>
          <option value="ألواح جرانيت">ألواح جرانيت</option>
          <option value="ألواح ترافرتين">ألواح ترافرتين</option>
          <option value="ألواح أونيكس">ألواح أونيكس</option>
          <option value="منتجات مشغولة">منتجات مشغولة (حوض / درج / إلخ)</option>
        </select>
      </div>
      <div class="form-group">
        <label>الوحدة</label>
        <select id="np2-unit">
          <option value="م²">م²</option>
          <option value="طن">طن</option>
          <option value="قطعة">قطعة</option>
        </select>
      </div>
      <div class="form-group"><label>سعر الكلفة</label><input type="number" id="np2-cost" min="0" value="0"></div>
      <div class="form-group"><label>سعر البيع</label><input type="number" id="np2-price" min="0" value="0"></div>
      <div class="form-group"><label>المخزون الحالي</label><input type="number" id="np2-stock" min="0" value="0"></div>
      <div class="form-group"><label>الحد الأدنى للمخزون</label><input type="number" id="np2-min" min="0" value="10"></div>
      <div class="form-group">
        <label>درجة الجودة الافتراضية</label>
        <select id="np2-quality">
          <option value="">-- اختر الدرجة --</option>
          <option value="A">A - ممتاز</option>
          <option value="B">B - جيد</option>
          <option value="C">C - عادي</option>
        </select>
      </div>
      <div class="form-group"><label>بلد المنشأ</label><input type="text" id="np2-origin" placeholder="مثال: مصر، إيطاليا، تركيا"></div>
    </div>
    <div style="margin-top:16px;text-align:left">
      <button class="btn btn-primary" onclick="saveProduct()">💾 حفظ</button>
    </div>
  `);
}

async function saveProduct() {
  const code = document.getElementById('np2-code').value.trim();
  const name = document.getElementById('np2-name').value.trim();
  if (!code || !name) { toast('الرجاء إدخال الكود والاسم', 'error'); return; }
  await api.createProduct({
    code, name,
    category:  document.getElementById('np2-cat').value,
    unit:      document.getElementById('np2-unit').value,
    cost:      parseFloat(document.getElementById('np2-cost').value)  || 0,
    price:     parseFloat(document.getElementById('np2-price').value) || 0,
    stock_qty: parseFloat(document.getElementById('np2-stock').value) || 0,
    min_stock: parseFloat(document.getElementById('np2-min').value)   || 0,
    default_quality: document.getElementById('np2-quality').value || '',
    origin_country:  document.getElementById('np2-origin').value || '',
    status:    'in_stock',
  });
  closeModal();
  toast('تم إضافة المنتج', 'success');
  renderProducts();
}

// ===== PROJECTS =====
async function renderProjects() {
  const content = document.getElementById('page-content');
  try {
    const customers = await api.customers();
    const projects  = await api.projects();
    window._projCustomers = customers;

    const active    = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
    const totalSpent  = projects.reduce((s, p) => s + (p.spent || 0), 0);

    content.innerHTML = `
      <div class="page-header">
        <div><h2>المشاريع</h2><p>متابعة المشاريع والعقود</p></div>
        <button class="btn btn-primary" onclick="openNewProjectModal()">＋ مشروع جديد</button>
      </div>
      <div class="report-summary">
        <div class="summary-box gold">  <div class="label">إجمالي المشاريع</div>   <div class="value">${projects.length}</div></div>
        <div class="summary-box profit"><div class="label">نشطة</div>               <div class="value">${active}</div></div>
        <div class="summary-box">       <div class="label">مكتملة</div>              <div class="value">${completed}</div></div>
        <div class="summary-box gold">  <div class="label">إجمالي الميزانيات</div>  <div class="value">${formatMoney(totalBudget)}</div></div>
        <div class="summary-box">       <div class="label">إجمالي المنصرف</div>      <div class="value">${formatMoney(totalSpent)}</div></div>
      </div>
      <div class="card" style="padding:0">
        <div class="data-table-wrapper">
          <table>
            <thead><tr>
              <th>اسم المشروع</th><th>العميل</th><th>البداية</th><th>النهاية</th>
              <th>الميزانية</th><th>المنصرف</th><th>المتبقي</th><th>% الإنجاز</th><th>الحالة</th>
            </tr></thead>
            <tbody>
              ${projects.length === 0
                ? `<tr><td colspan="9"><div class="empty-state" style="padding:30px"><div class="empty-icon">◫</div><h3>لا توجد مشاريع</h3></div></td></tr>`
                : projects.map(p => {
                  const spent   = p.spent || 0;
                  const remain  = p.budget - spent;
                  const pct     = p.budget > 0 ? Math.min(100, (spent / p.budget * 100)).toFixed(0) : 0;
                  return `
                    <tr>
                      <td><strong>${p.name}</strong></td>
                      <td>${p.customer}</td>
                      <td>${formatDate(p.start_date)}</td>
                      <td>${formatDate(p.end_date)}</td>
                      <td class="number">${formatMoney(p.budget)}</td>
                      <td class="number">${formatMoney(spent)}</td>
                      <td class="number ${remain < 0 ? 'text-danger' : 'text-success'}">${formatMoney(remain)}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px">
                          <div style="flex:1;height:6px;background:var(--bg-input);border-radius:3px">
                            <div style="height:100%;background:${pct > 90 ? 'var(--danger)' : 'var(--accent)'};border-radius:3px;width:${pct}%"></div>
                          </div>
                          <span style="font-size:12px">${pct}%</span>
                        </div>
                      </td>
                      <td>${statusBadge(p.status)}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

function openNewProjectModal() {
  const customers = window._projCustomers || [];
  openModal('مشروع جديد', `
    <div class="form-grid">
      <div class="form-group form-full"><label>اسم المشروع *</label><input type="text" id="nproj-name" placeholder="اسم المشروع"></div>
      <div class="form-group">
        <label>العميل</label>
        <select id="nproj-cust">
          <option value="">اختر العميل</option>
          ${customers.map(c => `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>الميزانية (ج.م)</label><input type="number" id="nproj-budget" min="0" value="0"></div>
      <div class="form-group"><label>تاريخ البداية</label><input type="date" id="nproj-start" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>تاريخ النهاية المتوقعة</label><input type="date" id="nproj-end"></div>
      <div class="form-group form-full"><label>الوصف</label><textarea id="nproj-desc" placeholder="وصف المشروع..."></textarea></div>
    </div>
    <div style="margin-top:16px;text-align:left">
      <button class="btn btn-primary" onclick="saveProject()">💾 حفظ</button>
    </div>
  `);
}

async function saveProject() {
  const name = document.getElementById('nproj-name').value.trim();
  if (!name) { toast('الرجاء إدخال اسم المشروع', 'error'); return; }
  const custEl = document.getElementById('nproj-cust');
  await api.createProject({
    name, description: document.getElementById('nproj-desc').value,
    customer_id: custEl.value ? parseInt(custEl.value) : null,
    customer:    custEl.value ? custEl.options[custEl.selectedIndex].dataset.name : '',
    budget:      parseFloat(document.getElementById('nproj-budget').value) || 0,
    start_date:  document.getElementById('nproj-start').value,
    end_date:    document.getElementById('nproj-end').value,
    status:      'active',
  });
  closeModal();
  toast('تم إضافة المشروع', 'success');
  renderProjects();
}

// ===== EXPENSES =====
async function renderExpenses() {
  const content = document.getElementById('page-content');
  try {
    const projects = await api.projects();
    const { data: expenses } = await api.expenses();
    window._expProjects = projects;
    window._expensesData = expenses;

    const total  = expenses.reduce((s, e) => s + e.amount, 0);
    const groups = {};
    expenses.forEach(e => { groups[e.category] = (groups[e.category] || 0) + e.amount; });

    content.innerHTML = `
      <div class="page-header">
        <div><h2>المصروفات</h2><p>تتبع مصروفات التشغيل</p></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="exportExpensesExcel()">📊 Excel</button>
          <button class="btn btn-secondary" onclick="exportExpensesPDF()">📄 PDF</button>
          <button class="btn btn-primary" onclick="openNewExpenseModal()">＋ مصروف جديد</button>
        </div>
      </div>
      <div class="report-summary">
        <div class="summary-box loss"><div class="label">إجمالي المصروفات</div><div class="value">${formatMoney(total)}</div></div>
        ${Object.entries(groups).slice(0, 3).map(([cat, amt]) => `<div class="summary-box"><div class="label">${cat}</div><div class="value">${formatMoney(amt)}</div></div>`).join('')}
      </div>
      <div class="filters-bar">
        <input type="text" id="exp-search" placeholder="بحث في المصروفات..." oninput="filterExpenses()" style="flex:1">
      </div>
      <div class="card" style="padding:0">
        <div class="data-table-wrapper">
          <table>
            <thead><tr><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th>المشروع</th><th>العملة</th></tr></thead>
            <tbody id="exp-tbody">${renderExpenseRows(expenses, projects)}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

function renderExpenseRows(expenses, projects) {
  if (!expenses.length) return `<tr><td colspan="6"><div class="empty-state" style="padding:30px"><div class="empty-icon">◪</div><h3>لا توجد مصروفات</h3></div></td></tr>`;
  return expenses.map(e => {
    const proj = e.project_id ? (projects || []).find(p => p.id === e.project_id) : null;
    return `
      <tr>
        <td><span class="badge badge-warning">${e.category}</span></td>
        <td>${e.description}</td>
        <td class="number text-danger">${formatMoney(e.amount)}</td>
        <td>${formatDate(e.date)}</td>
        <td>${proj ? proj.name : '-'}</td>
        <td>${e.currency || 'EGP'}</td>
      </tr>
    `;
  }).join('');
}

async function filterExpenses() {
  const search = document.getElementById('exp-search').value;
  const { data } = await api.expenses({ search });
  document.getElementById('exp-tbody').innerHTML = renderExpenseRows(data, window._expProjects || []);
}

function openNewExpenseModal() {
  const projects = window._expProjects || [];
  openModal('مصروف جديد', `
    <div class="form-grid">
      <div class="form-group">
        <label>الفئة *</label>
        <select id="nexp-cat">
          <option value="رواتب وأجور">رواتب وأجور</option>
          <option value="إيجار">إيجار</option>
          <option value="كهرباء ومياه">كهرباء ومياه</option>
          <option value="مصاريف شحن">مصاريف شحن</option>
          <option value="مصاريف جمارك وتخليص">مصاريف جمارك وتخليص</option>
          <option value="عمولات تصدير">عمولات تصدير</option>
          <option value="مصاريف تسويق">مصاريف تسويق</option>
          <option value="مصاريف إدارية">مصاريف إدارية</option>
          <option value="صيانة المستودعات">صيانة المستودعات</option>
          <option value="مصاريف أخرى">مصاريف أخرى</option>
        </select>
      </div>
      <div class="form-group"><label>المبلغ *</label><input type="number" id="nexp-amount" min="0" step="0.01"></div>
      <div class="form-group">
        <label>العملة</label>
        <select id="nexp-currency">
          <option value="EGP">ج.م (EGP)</option>
          <option value="USD">دولار (USD)</option>
        </select>
      </div>
      <div class="form-group form-full"><label>الوصف *</label><input type="text" id="nexp-desc" placeholder="وصف المصروف"></div>
      <div class="form-group"><label>التاريخ</label><input type="date" id="nexp-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group">
        <label>المشروع (اختياري)</label>
        <select id="nexp-proj">
          <option value="">غير مرتبط بمشروع</option>
          ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="margin-top:16px;text-align:left">
      <button class="btn btn-primary" onclick="saveExpense()">💾 حفظ</button>
    </div>
  `);
}

async function saveExpense() {
  const desc   = document.getElementById('nexp-desc').value.trim();
  const amount = parseFloat(document.getElementById('nexp-amount').value);
  if (!desc || !amount || amount <= 0) { toast('الرجاء إدخال الوصف والمبلغ', 'error'); return; }
  const projId = document.getElementById('nexp-proj').value;
  await api.createExpense({
    category:   document.getElementById('nexp-cat').value,
    description: desc, amount,
    date:        document.getElementById('nexp-date').value,
    project_id:  projId ? parseInt(projId) : null,
    currency:    document.getElementById('nexp-currency')?.value || 'EGP',
  });
  closeModal();
  toast('تم تسجيل المصروف', 'success');
  renderExpenses();
}

// ===== SETTINGS =====
async function renderSettings() {
  const content = document.getElementById('page-content');
  try {
    const s = await api.settings();
    content.innerHTML = `
      <div class="page-header"><div><h2>الإعدادات</h2><p>إعدادات الشركة والنظام</p></div></div>
      <div class="card">
        <div class="card-header"><span class="card-title">🏢 بيانات الشركة</span></div>
        <div class="form-grid">
          <div class="form-group form-full"><label>اسم الشركة</label><input type="text" id="set-name"     value="${s.company_name || ''}"></div>
          <div class="form-group"><label>بلد الشركة</label><input type="text" id="set-country" value="${s.country || ''}" placeholder="مثال: مصر"></div>
          <div class="form-group"><label>الهاتف</label>            <input type="text" id="set-phone"    value="${s.phone || ''}"></div>
          <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="set-email"    value="${s.email || ''}"></div>
          <div class="form-group form-full"><label>العنوان</label>  <input type="text" id="set-address"  value="${s.address || ''}"></div>
          <div class="form-group"><label>العملة الرئيسية</label>
            <select id="set-currency">
              <option value="EGP" ${(s.currency||'EGP')==='EGP'?'selected':''}>جنيه مصري (EGP)</option>
              <option value="USD" ${s.currency==='USD'?'selected':''}>دولار أمريكي (USD)</option>
              <option value="EUR" ${s.currency==='EUR'?'selected':''}>يورو (EUR)</option>
              <option value="SAR" ${s.currency==='SAR'?'selected':''}>ريال سعودي (SAR)</option>
              <option value="AED" ${s.currency==='AED'?'selected':''}>درهم إماراتي (AED)</option>
            </select>
          </div>
          <div class="form-group">
            <label>العملات الأخرى المستخدمة</label>
            <div style="display:flex;flex-direction:column;gap:4px;padding:8px;background:var(--bg-input);border-radius:6px">
              ${['USD','EUR','GBP','SAR','AED'].map(c => `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400">
                  <input type="checkbox" id="set-cur-${c}" ${((s.extra_currencies||[]).includes(c))?'checked':''}>
                  ${c}
                </label>`).join('')}
            </div>
          </div>
          <div class="form-group"><label>نسبة ضريبة القيمة المضافة (%)</label><input type="number" id="set-tax" value="${s.tax_rate || 14}" min="0" max="100"></div>
          <div class="form-group"><label>شروط الدفع الافتراضية</label>
            <select id="set-payment-terms">
              <option value="نقداً" ${(s.payment_terms||'')==='نقداً'?'selected':''}>نقداً</option>
              <option value="30 يوم" ${(s.payment_terms||'')==='30 يوم'?'selected':''}>30 يوم</option>
              <option value="60 يوم" ${(s.payment_terms||'')==='60 يوم'?'selected':''}>60 يوم</option>
              <option value="90 يوم" ${(s.payment_terms||'')==='90 يوم'?'selected':''}>90 يوم</option>
              <option value="عند التسليم" ${(s.payment_terms||'')==='عند التسليم'?'selected':''}>عند التسليم</option>
            </select>
          </div>
          <div class="form-group"><label>حد الموافقة على الفواتير (ج.م) — 0 لتعطيل</label><input type="number" id="set-approval-limit" value="${s.approval_limit || 0}" min="0" placeholder="مثال: 50000"></div>
        </div>
        <div style="margin-top:20px;text-align:left">
          <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">🏦 بيانات البنك الرئيسي</span></div>
        <div class="form-grid">
          <div class="form-group"><label>اسم البنك</label><input type="text" id="set-bank-name" value="${s.bank_name || ''}" placeholder="مثال: البنك الأهلي المصري"></div>
          <div class="form-group"><label>اسم صاحب الحساب</label><input type="text" id="set-bank-account-name" value="${s.bank_account_name || ''}"></div>
          <div class="form-group"><label>رقم الحساب / IBAN</label><input type="text" id="set-bank-account-no" value="${s.bank_account_no || ''}"></div>
          <div class="form-group"><label>كود السويفت (SWIFT)</label><input type="text" id="set-bank-swift" value="${s.bank_swift || ''}" placeholder="XXXXEGCX"></div>
          <div class="form-group"><label>عملة الحساب</label><input type="text" id="set-bank-currency" value="${s.bank_currency || 'EGP'}"></div>
          <div class="form-group"><label>فرع البنك</label><input type="text" id="set-bank-branch" value="${s.bank_branch || ''}"></div>
        </div>
        <div style="margin-top:16px;text-align:left">
          <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">🔐 بيانات تسجيل الدخول التجريبي</span></div>
        <div style="background:var(--bg-input);border-radius:8px;padding:16px;font-family:monospace">
          <p>البريد: <strong>admin@marble.com</strong></p>
          <p style="margin-top:8px">كلمة المرور: <strong>admin123</strong></p>
        </div>
        <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">
          ⚠ هذا نظام تجريبي - البيانات محفوظة في المتصفح (localStorage) وليست على سيرفر
        </p>
      </div>

      <!-- ===== إعدادات تيليجرام ===== -->
      <div class="card">
        <div class="card-header"><span class="card-title">📱 إشعارات تيليجرام</span></div>
        <div class="form-grid">
          <div class="form-group form-full">
            <label>رمز البوت (Bot Token)</label>
            <input type="text" id="set-tgBotToken" placeholder="123456789:AAF..." value="${s.tgBotToken || ''}">
          </div>
          <div class="form-group form-full">
            <label>معرّف المحادثة (Chat ID)</label>
            <input type="text" id="set-tgChatId" placeholder="-100123456789" value="${s.tgChatId || ''}">
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="set-tgNotifyLowStock" ${s.tgNotifyLowStock ? 'checked' : ''}>
              إشعار عند نقص المخزون
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="set-tgNotifyOverdue" ${s.tgNotifyOverdue ? 'checked' : ''}>
              إشعار عند تأخر الفواتير
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="set-tgNotifyChecks" ${s.tgNotifyChecks ? 'checked' : ''}>
              إشعار عند استحقاق الشيكات
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="set-tgDailyReport" ${s.tgDailyReport ? 'checked' : ''}>
              إرسال تقرير يومي
            </label>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
          <button class="btn btn-secondary" onclick="testTelegramMessage()">📤 اختبار تيليجرام</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">🗑 إعادة تعيين البيانات</span></div>
        <p style="color:var(--text-secondary);margin-bottom:12px">حذف جميع البيانات المحفوظة وإعادة البيانات التجريبية الافتراضية</p>
        <button class="btn btn-danger" onclick="resetAllData()">⚠ إعادة تعيين جميع البيانات</button>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">💾 النسخ الاحتياطي والاستعادة</span></div>
        <div class="settings-section" style="margin-top:8px">
          <div id="lastBackupInfo" style="
            background:var(--bg-secondary);border:1px solid var(--border-color);
            border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;
            display:flex;justify-content:space-between;align-items:center">
            <span>آخر نسخة احتياطية:</span>
            <strong id="lastBackupDate">لم يتم بعد</strong>
          </div>

          <div id="storageBar" style="margin-bottom:16px"></div>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="exportFullBackup()">
              تصدير نسخة احتياطية (.json)
            </button>
            <label class="btn btn-secondary"
                   style="cursor:pointer;margin:0" data-backup-restore>
              استعادة من ملف
              <input type="file" accept=".json" style="display:none"
                     onchange="importBackup(this.files[0])">
            </label>
            <button class="btn btn-ghost" onclick="restoreAutoSnapshot()">
              استعادة آخر snapshot
            </button>
          </div>

          <hr style="margin:24px 0;border:none;border-top:1px solid var(--border-color)">

          <h3 style="margin-bottom:16px">سجل أسعار الصرف</h3>
          <div class="form-row" style="margin-bottom:12px">
            <div class="form-group">
              <label>العملة</label>
              <select id="newRateCurrency" class="form-control">
                <option value="USD">دولار USD</option>
                <option value="EUR">يورو EUR</option>
                <option value="GBP">إسترليني GBP</option>
                <option value="SAR">ريال SAR</option>
                <option value="AED">درهم AED</option>
              </select>
            </div>
            <div class="form-group">
              <label>السعر (جنيه)</label>
              <input type="number" id="newRateValue" class="form-control"
                     step="0.01" placeholder="مثال: 48.5">
            </div>
            <div class="form-group">
              <label>التاريخ</label>
              <input type="date" id="newRateDate" class="form-control">
            </div>
          </div>
          <button class="btn btn-secondary" onclick="addNewExchangeRate()">
            إضافة سعر صرف
          </button>
          <div id="rateHistoryTable" style="margin-top:16px"></div>
        </div>
      </div>

      <!-- ===== مؤشرات KPI المخصصة ===== -->
      <div class="card">
        <div class="card-header"><span class="card-title">📊 مؤشرات KPI المخصصة للوحة التحكم</span></div>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
          اختر حتى 8 مؤشرات لعرضها في لوحة التحكم. اسحب للترتيب.
        </p>
        <div id="kpi-customizer"></div>
        <div style="margin-top:16px;text-align:left">
          <button class="btn btn-primary" onclick="saveKpiSelection()">💾 حفظ مؤشرات KPI</button>
        </div>
      </div>
    `;
    // تحديث واجهة النسخ الاحتياطي وجدول أسعار الصرف بعد رسم الصفحة
    updateBackupUI();
    renderRateHistory();
    renderKpiCustomizer();
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

async function saveSettings() {
  const data = {
    company_name:      document.getElementById('set-name').value,
    country:           document.getElementById('set-country')?.value || '',
    phone:             document.getElementById('set-phone').value,
    email:             document.getElementById('set-email').value,
    address:           document.getElementById('set-address').value,
    currency:          document.getElementById('set-currency').value,
    extra_currencies:  ['USD','EUR','GBP','SAR','AED'].filter(c => document.getElementById('set-cur-'+c)?.checked),
    tax_rate:          parseFloat(document.getElementById('set-tax').value) || 14,
    payment_terms:     document.getElementById('set-payment-terms')?.value || '',
    approval_limit:    parseFloat(document.getElementById('set-approval-limit')?.value) || 0,
    bank_name:         document.getElementById('set-bank-name')?.value || '',
    bank_account_name: document.getElementById('set-bank-account-name')?.value || '',
    bank_account_no:   document.getElementById('set-bank-account-no')?.value || '',
    bank_swift:        document.getElementById('set-bank-swift')?.value || '',
    bank_currency:     document.getElementById('set-bank-currency')?.value || 'EGP',
    bank_branch:       document.getElementById('set-bank-branch')?.value || '',
    // إعدادات تيليجرام
    tgBotToken:        (document.getElementById('set-tgBotToken')?.value  || '').trim(),
    tgChatId:          (document.getElementById('set-tgChatId')?.value    || '').trim(),
    tgNotifyLowStock:  document.getElementById('set-tgNotifyLowStock')?.checked  || false,
    tgNotifyOverdue:   document.getElementById('set-tgNotifyOverdue')?.checked   || false,
    tgNotifyChecks:    document.getElementById('set-tgNotifyChecks')?.checked    || false,
    tgDailyReport:     document.getElementById('set-tgDailyReport')?.checked     || false,
  };
  await api.saveSettings(data);
  const el = document.getElementById('company-name-sidebar');
  if (el && data.company_name) el.textContent = data.company_name;
  toast('تم حفظ الإعدادات', 'success');
}

// اختبار إرسال رسالة تيليجرام
function testTelegramMessage() {
  sendTelegramNotification('✅ <b>اختبار ناجح</b>\nتم ربط نظام ERP بتيليجرام بنجاح.');
  toast('تم إرسال رسالة الاختبار', 'info');
}

// ===== إرسال إشعار تيليجرام =====
// تُرسل الرسالة فقط إذا كان توكن البوت ومعرّف المحادثة مُعيَّنَين في الإعدادات
function sendTelegramNotification(message) {
  var s = DB.get('settings') || {};
  var token  = s.tgBotToken || '';
  var chatId = s.tgChatId   || '';
  if (!token || !chatId) return; // لا توكن → تجاهل صامت
  var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  }).catch(function(err) { console.warn('Telegram notification failed:', err); }); // تسجيل الخطأ بصمت
}

function resetAllData() {
  if (!confirm('هل أنت متأكد من إعادة تعيين جميع البيانات؟ سيتم حذف كل البيانات المدخلة.')) return;
  const keys = Object.keys(localStorage).filter(k => k.startsWith('marble_db_'));
  keys.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('marble_token');
  localStorage.removeItem('marble_user');
  toast('تم إعادة تعيين البيانات - يتم إعادة التحميل...', 'warning');
  setTimeout(() => location.reload(), 1500);
}

// ===== NOTIFICATIONS =====
async function renderNotifications() {
  const content = document.getElementById('page-content');
  try {
    const notifs = await api.notifications();
    const unread = notifs.filter(n => !n.is_read).length;

    content.innerHTML = `
      <div class="page-header">
        <div><h2>الإشعارات</h2><p>${unread} إشعار غير مقروء</p></div>
        ${unread > 0 ? `<button class="btn btn-secondary" onclick="markAllRead()">✓ تحديد الكل كمقروء</button>` : ''}
      </div>
      <div class="card" style="padding:0">
        ${notifs.length === 0
          ? `<div class="empty-state" style="padding:60px"><div class="empty-icon">🔔</div><h3>لا توجد إشعارات</h3></div>`
          : notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(n => `
            <div onclick="markNotifRead(${n.id})" style="
              display:flex;align-items:flex-start;gap:16px;padding:16px 20px;
              border-bottom:1px solid var(--border);cursor:pointer;
              background:${!n.is_read ? 'rgba(200,169,110,0.04)' : 'transparent'};
              transition:background 0.15s
            " onmouseover="this.style.background='rgba(200,169,110,0.08)'" onmouseout="this.style.background='${!n.is_read ? 'rgba(200,169,110,0.04)' : 'transparent'}'">
              <div style="font-size:22px;flex-shrink:0">
                ${n.type === 'danger' ? '🚨' : n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}
              </div>
              <div style="flex:1">
                <div style="font-weight:${!n.is_read ? '700' : '500'};color:${!n.is_read ? 'var(--text-primary)' : 'var(--text-secondary)'}">
                  ${n.title}
                  ${!n.is_read ? '<span class="badge badge-danger" style="margin-right:8px;font-size:10px">جديد</span>' : ''}
                </div>
                <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${n.message}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${formatDate(n.created_at)}</div>
              </div>
            </div>
          `).join('')}
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

async function markNotifRead(id) {
  await api.markNotificationRead(id);
  loadNotifications();
  renderNotifications();
}

async function markAllRead() {
  const notifs = await api.notifications();
  for (const n of notifs) {
    if (!n.is_read) await api.markNotificationRead(n.id);
  }
  loadNotifications();
  renderNotifications();
}

// ===== EXPORT: EXPENSES =====
function exportExpensesPDF() {
  const expenses = window._expensesData || [];
  const headers = ['#','الفئة','الوصف','المبلغ','العملة','التاريخ','المشروع'];
  const rows = expenses.map((e,i)=>[i+1,e.category,(e.description||'').substring(0,22),parseFloat(e.amount||0).toFixed(2),e.currency||'EGP',formatDate(e.date),e.project_id?'مشروع':'-']);
  const total = expenses.reduce((s,e)=>s+(e.amount||0),0);
  exportGenericPDF({ title:'المصروفات', subtitle:'نظام ERP - الرخام والجرانيت', headers, rows, totalsRow:['','','الإجمالي',total.toFixed(2),'EGP','',''], filename:`expenses-${new Date().toISOString().split('T')[0]}.pdf`, orientation:'portrait' });
}
function exportExpensesExcel() {
  const expenses = window._expensesData || [];
  const headers = ['الفئة','الوصف','المبلغ','العملة','التاريخ'];
  const rows = expenses.map(e=>[e.category,e.description,e.amount||0,e.currency||'EGP',e.date]);
  const total = expenses.reduce((s,e)=>s+(e.amount||0),0);
  exportGenericExcel({ sheetName:'المصروفات', headers, rows, totalsRow:['الإجمالي','',total,'',''], filename:`expenses-${new Date().toISOString().split('T')[0]}.xlsx` });
}

// ===== EXPORT: PRODUCTS =====
function exportProductsPDF() {
  const products = window._productsData || [];
  const headers = ['الكود','المنتج','الفئة','الوحدة','سعر الكلفة','سعر البيع','المخزون'];
  const rows = products.map(p=>[p.code,(p.name||'').substring(0,20),p.category,p.unit,parseFloat(p.cost||0).toFixed(2)+' EGP',parseFloat(p.price||0).toFixed(2)+' EGP',p.stock_qty]);
  exportGenericPDF({ title:'المنتجات', subtitle:'نظام ERP - الرخام والجرانيت', headers, rows, filename:`products-${new Date().toISOString().split('T')[0]}.pdf`, orientation:'portrait' });
}
function exportProductsExcel() {
  const products = window._productsData || [];
  const headers = ['الكود','المنتج','الفئة','الوحدة','سعر الكلفة (EGP)','سعر البيع (EGP)','المخزون','الحد الأدنى'];
  const rows = products.map(p=>[p.code,p.name,p.category,p.unit,p.cost||0,p.price||0,p.stock_qty,p.min_stock]);
  exportGenericExcel({ sheetName:'المنتجات', headers, rows, filename:`products-${new Date().toISOString().split('T')[0]}.xlsx` });
}

// ===== دوال النسخ الاحتياطي والاستعادة =====

// تصدير نسخة احتياطية كاملة من جميع البيانات
function exportFullBackup() {
  const backup = {
    version:   '2.1',
    createdAt: new Date().toISOString(),
    system:    'ERP الرخام والجرانيت',
    data:      {}
  };
  // تصدير جميع مفاتيح marble_db_
  Object.keys(localStorage)
    .filter(k => k.startsWith('marble_db_'))
    .forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw) {
        try { backup.data[k] = JSON.parse(raw); }
        catch { backup.data[k] = raw; }
      }
    });
  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json' }
  );
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'erp-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  localStorage.setItem('_lastBackup', new Date().toISOString());
  toast('تم تصدير النسخة الاحتياطية ✓', 'success');
  api.logActivity('backup', 'system', 0, 'تصدير نسخة احتياطية كاملة');
  updateBackupUI();
}

// استعادة البيانات من ملف نسخة احتياطية
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const b = JSON.parse(e.target.result);
      if (!b.version || !b.data) {
        toast('ملف غير صالح', 'error'); return;
      }
      if (confirm(
        'استعادة نسخة بتاريخ ' + (b.createdAt||'').slice(0,10) +
        '؟\nسيتم استبدال جميع البيانات الحالية.'
      )) {
        Object.entries(b.data).forEach(([k,v]) => {
          // دعم الإصدار القديم (مفاتيح بدون marble_db_) والإصدار الجديد
          const storageKey = k.startsWith('marble_db_') ? k : 'marble_db_' + k;
          localStorage.setItem(storageKey, JSON.stringify(v));
        });
        localStorage.setItem('_lastBackup', b.createdAt || new Date().toISOString());
        toast('تمت الاستعادة ✓ — جاري إعادة التشغيل', 'success');
        setTimeout(() => location.reload(), 1500);
      }
    } catch { toast('تعذر قراءة الملف', 'error'); }
  };
  reader.readAsText(file);
}

// استعادة آخر snapshot تلقائي
function restoreAutoSnapshot() {
  const raw = localStorage.getItem('_autoSnapshot');
  if (!raw) { toast('لا توجد نسخة تلقائية', 'info'); return; }
  const snap = JSON.parse(raw);
  if (confirm(
    'استعادة snapshot تلقائي بتاريخ ' +
    (snap.date||'').slice(0,16) + '؟'
  )) {
    Object.entries(snap.data||{}).forEach(([k,v]) =>
      localStorage.setItem(k, v)
    );
    toast('تمت الاستعادة ✓', 'success');
    setTimeout(() => location.reload(), 1000);
  }
}

// تحديث واجهة النسخ الاحتياطي (آخر نسخة + شريط التخزين)
function updateBackupUI() {
  const last = localStorage.getItem('_lastBackup');
  const el   = document.getElementById('lastBackupDate');
  if (el) el.textContent = last ? formatDate(last) : 'لم يتم بعد';

  let total = 0;
  for (let k in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, k))
      total += (localStorage.getItem(k)||'').length * 2;
  }
  const mb  = (total / 1024 / 1024).toFixed(2);
  const pct = Math.min((mb / 10) * 100, 100).toFixed(0);
  const col = pct > 80 ? '#e24b4a' : pct > 60 ? '#ba7517' : '#1d9e75';
  const bar = document.getElementById('storageBar');
  if (bar) bar.innerHTML =
    '<div style="background:var(--bg-secondary);border-radius:8px;overflow:hidden;height:8px;margin-bottom:4px">' +
    '<div style="height:100%;width:' + pct + '%;background:' + col + ';transition:width 0.3s"></div>' +
    '</div>' +
    '<small style="color:var(--text-secondary)">' + mb + ' MB مستخدم من ~10 MB (' + pct + '%)</small>' +
    (pct > 80 ?
      '<p style="color:#e24b4a;margin-top:4px;font-size:12px">⚠️ التخزين على وشك الامتلاء</p>' : '');
}

// إضافة سعر صرف جديد من نموذج الإعدادات
function addNewExchangeRate() {
  const cur  = document.getElementById('newRateCurrency')?.value;
  const rate = document.getElementById('newRateValue')?.value;
  const date = document.getElementById('newRateDate')?.value;
  if (!cur || !rate) { toast('يرجى إدخال العملة والسعر', 'warning'); return; }
  saveExchangeRate(cur, parseFloat(rate), date || new Date().toISOString());
  toast('تم حفظ سعر الصرف ✓', 'success');
  renderRateHistory();
}

// عرض جدول سجل أسعار الصرف
function renderRateHistory() {
  const rates = JSON.parse(localStorage.getItem('exchange_rates')||'[]')
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);
  const el = document.getElementById('rateHistoryTable');
  if (!el) return;
  if (!rates.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted)">لا توجد أسعار مسجلة</div>';
    return;
  }
  el.innerHTML =
    '<table><thead><tr>' +
    '<th>العملة</th><th>السعر</th><th>التاريخ</th>' +
    '</tr></thead><tbody>' +
    rates.map(r =>
      '<tr><td>' + r.currency + '</td>' +
      '<td>' + r.rate + ' ج.م</td>' +
      '<td>' + formatDate(r.date) + '</td></tr>'
    ).join('') +
    '</tbody></table>';
}

// ===== مؤشرات KPI المخصصة =====
const ALL_KPI_INDICATORS = [
  { id: 'monthly_sales',       label: 'مبيعات الشهر الحالي' },
  { id: 'monthly_purchases',   label: 'مشتريات الشهر الحالي' },
  { id: 'cash_balance',        label: 'الرصيد النقدي' },
  { id: 'overdue_amount',      label: 'المستحقات المتأخرة' },
  { id: 'inventory_value',     label: 'قيمة المخزون' },
  { id: 'low_stock_count',     label: 'منتجات نقص المخزون' },
  { id: 'cpm_this_month',      label: 'متوسط تكلفة المتر' },
  { id: 'waste_rate',          label: 'نسبة الهالك الفعلية' },
  { id: 'export_revenue',      label: 'إيرادات التصدير' },
  { id: 'local_revenue',       label: 'إيرادات السوق المحلي' },
  { id: 'available_slabs',     label: 'ألواح متاحة في المخزن' },
  { id: 'blocks_in_cutting',   label: 'كتل في مرحلة القطع' },
  { id: 'pending_invoices',    label: 'فواتير معلقة للموافقة' },
  { id: 'overdue_count',       label: 'عدد الفواتير المتأخرة' },
  { id: 'monthly_output',      label: 'إنتاج الشهر (وحدات)' },
  { id: 'avg_collection_days', label: 'متوسط أيام التحصيل' },
  { id: 'crm_leads',           label: 'عدد الفرص التجارية النشطة' },
  { id: 'pending_checks',      label: 'شيكات معلقة' },
  { id: 'total_customers',     label: 'إجمالي العملاء' },
  { id: 'top_product',         label: 'أكثر منتج مبيعاً' },
];

function getSelectedKpis() {
  const s = DB.get('settings') || {};
  return s.custom_kpis || ['monthly_sales','cash_balance','overdue_amount','inventory_value','waste_rate','cpm_this_month','monthly_purchases','low_stock_count'];
}

function renderKpiCustomizer() {
  const el = document.getElementById('kpi-customizer');
  if (!el) return;
  const selected = getSelectedKpis();
  el.innerHTML = ALL_KPI_INDICATORS.map(kpi => {
    const isChecked = selected.includes(kpi.id);
    const idx = selected.indexOf(kpi.id);
    return `<label draggable="true" data-kpi-id="${kpi.id}"
      ondragstart="_kpiDragStart(event)"
      ondragover="_kpiDragOver(event)"
      ondrop="_kpiDrop(event)"
      style="display:flex;align-items:center;gap:10px;padding:8px 12px;
             border:1px solid var(--border);border-radius:8px;margin-bottom:6px;
             cursor:grab;background:${isChecked ? 'var(--bg-secondary)' : 'var(--bg-card)'}">
      <input type="checkbox" data-kpi="${kpi.id}" ${isChecked ? 'checked' : ''} onchange="_kpiCheckChange()">
      <span style="flex:1;font-size:13px">${kpi.label}</span>
      ${isChecked ? `<span style="font-size:11px;color:var(--accent)">#${idx+1}</span>` : ''}
      <span style="color:var(--text-muted);font-size:14px">⠿</span>
    </label>`;
  }).join('');
}

function _kpiCheckChange() {
  const checked = [...document.querySelectorAll('[data-kpi]:checked')].map(el => el.dataset.kpi);
  if (checked.length > 8) {
    toast('يمكن اختيار 8 مؤشرات كحد أقصى', 'warning');
    event.target.checked = false;
    return;
  }
}

let _kpiDragId = null;
function _kpiDragStart(e) { _kpiDragId = e.currentTarget.dataset.kpiId; e.dataTransfer.effectAllowed = 'move'; }
function _kpiDragOver(e)  { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function _kpiDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.kpiId;
  if (!_kpiDragId || _kpiDragId === targetId) return;
  const container = e.currentTarget.parentElement;
  const items = [...container.querySelectorAll('[data-kpi-id]')];
  const fromEl = items.find(el => el.dataset.kpiId === _kpiDragId);
  const toEl   = items.find(el => el.dataset.kpiId === targetId);
  if (fromEl && toEl) container.insertBefore(fromEl, toEl);
}

function saveKpiSelection() {
  const selected = [...document.querySelectorAll('#kpi-customizer [data-kpi-id]')]
    .filter(el => el.querySelector('[data-kpi]:checked'))
    .map(el => el.dataset.kpiId)
    .slice(0, 8);
  if (!selected.length) { toast('اختر مؤشراً واحداً على الأقل', 'warning'); return; }
  const s = DB.get('settings') || {};
  s.custom_kpis = selected;
  DB.set('settings', s);
  toast('تم حفظ مؤشرات KPI المخصصة', 'success');
}
