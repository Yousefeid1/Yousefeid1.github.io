// ============================================
// Main App Controller
// ============================================

let currentUser = null;

// ===== ROLE-BASED ACCESS =====
const ROLE_PAGES = {
  'مدير عام':        null, // null = all pages visible
  'مدير':            null,
  'محاسب':           ['dashboard', 'journal', 'accounts', 'trial-balance', 'payments', 'expenses', 'report-pl', 'report-bs', 'report-waste', 'report-inventory', 'settings', 'notifications'],
  'موظف مبيعات':    ['dashboard', 'sales', 'customers', 'aging', 'notifications'],
  'مدير مبيعات':    ['dashboard', 'sales', 'customers', 'aging', 'payments', 'report-pl', 'notifications'],
  'موظف مشتريات':  ['dashboard', 'purchases', 'suppliers', 'payments', 'notifications'],
  'موظف تصنيع':    ['dashboard', 'blocks', 'cutting', 'slabs', 'products', 'notifications'],
  'مدير تصنيع':    ['dashboard', 'blocks', 'cutting', 'slabs', 'products', 'report-waste', 'report-inventory', 'notifications'],
  'مشرف تصنيع':    ['dashboard', 'blocks', 'cutting', 'slabs', 'products', 'notifications'],
  'موظف لوجستيك':  ['dashboard', 'warehouses', 'shipments', 'shipment-report', 'notifications'],
  'مدير قسم':       ['dashboard', 'employees', 'activity-log', 'sales', 'customers', 'report-pl', 'notifications'],
  'موظف عادي':      ['dashboard', 'notifications'],
};

// ===== AUTH =====
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  try {
    const data = await api.login(email, password);
    api.setToken(data.token);
    currentUser = data.user;
    sessionStorage.setItem('marble_user', JSON.stringify(data.user));
    api.logActivity('login', 'auth', data.user.id, `تسجيل دخول: ${data.user.name} (${data.user.role})`);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  } catch (e) {
    errEl.textContent = e.message || 'بيانات الدخول خاطئة';
  }
}

function doLogout() {
  api.clearToken();
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ===== INIT =====
async function initApp() {
  // Set user info in UI
  const name = currentUser?.name || 'مستخدم';
  const role = currentUser?.role || '';
  document.getElementById('user-name-top').textContent = name;
  document.getElementById('user-role-sidebar').textContent = role;
  
  // Load settings
  try {
    const s = await api.settings();
    if (s.company_name) document.getElementById('company-name-sidebar').textContent = s.company_name;
  } catch(e) {}

  // Apply role-based sidebar
  filterSidebarByRole();

  // Check for delayed shipments and create notifications
  checkDelayedShipments();

  // Load notifications
  loadNotifications();
  setInterval(loadNotifications, 60000);

  // Show dashboard
  showPage('dashboard');
}

async function checkDelayedShipments() {
  try {
    const r = await api.reportShipments();
    if (r.delayed && r.delayed.length > 0) {
      const existingNotifs = await api.notifications();
      r.delayed.forEach(s => {
        const alreadyNotified = existingNotifs.some(n => n.message && n.message.includes(s.shipment_number) && n.title === 'شحنة متأخرة');
        if (!alreadyNotified) {
          DB.save('notifications', {
            id: DB.nextId('notifications'),
            title: 'شحنة متأخرة',
            message: `الشحنة ${s.shipment_number} (${s.customer}) متأخرة عن الموعد المتوقع`,
            type: 'danger',
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      });
    }
  } catch(e) {}
}

async function loadNotifications() {
  try {
    const notifs = await api.notifications();
    const unread = notifs.filter(n => !n.is_read).length;
    document.getElementById('notif-count').textContent = unread;
  } catch(e) {}
}

// ===== SIDEBAR ROLE FILTER =====
function filterSidebarByRole() {
  const role    = currentUser?.role || 'مدير';
  const allowed = ROLE_PAGES[role]; // null = admin sees all

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    if (allowed === null) {
      item.style.display = '';
    } else {
      item.style.display = allowed.includes(item.dataset.page) ? '' : 'none';
    }
  });

  // Hide section labels whose items are all hidden
  document.querySelectorAll('.nav-section-label').forEach(label => {
    let next = label.nextElementSibling;
    let anyVisible = false;
    while (next && !next.classList.contains('nav-section-label')) {
      if (next.classList.contains('nav-item') && next.style.display !== 'none') {
        anyVisible = true;
        break;
      }
      next = next.nextElementSibling;
    }
    label.style.display = anyVisible ? '' : 'none';
  });
}


const pageTitles = {
  'dashboard':        'لوحة التحكم',
  'journal':          'القيود المحاسبية',
  'accounts':         'شجرة الحسابات',
  'trial-balance':    'ميزان المراجعة',
  'sales':            'فواتير المبيعات',
  'customers':        'العملاء',
  'aging':            'تقرير التقادم',
  'purchases':        'فواتير الشراء',
  'suppliers':        'الموردون',
  'payments':         'المدفوعات والمقبوضات',
  'blocks':           'البلوكات الخام',
  'cutting':          'عمليات القطع',
  'slabs':            'الألواح (Slabs)',
  'products':         'المنتجات',
  'expenses':         'المصروفات',
  'report-pl':        'تقرير الأرباح والخسائر',
  'report-bs':        'الميزانية العمومية',
  'report-waste':     'تقرير الهالك',
  'report-inventory': 'تقرير المخزون',
  'settings':         'الإعدادات',
  'employees':        'إدارة الموظفين',
  'activity-log':     'سجل الأنشطة',
  'warehouses':       'إدارة المستودعات',
  'shipments':        'الشحن والتوصيل',
  'shipment-report':  'تقارير التصدير',
};

// Track current page for real-time refresh
let _currentPage = 'dashboard';

function showPage(pageName) {
  // Access control: redirect to dashboard if user lacks permission
  const role    = currentUser?.role || 'مدير';
  const allowed = ROLE_PAGES[role];
  if (allowed !== null && pageName !== 'dashboard' && !allowed.includes(pageName)) {
    pageName = 'dashboard';
  }

  _currentPage = pageName;

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageName);
  });

  // Update title
  document.getElementById('page-title').textContent = pageTitles[pageName] || pageName;

  // Render page
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loader"></div>';

  const renders = {
    'dashboard':        renderDashboard,
    'journal':          renderJournal,
    'accounts':         renderAccounts,
    'trial-balance':    renderTrialBalance,
    'sales':            renderSales,
    'customers':        renderCustomers,
    'aging':            renderAging,
    'purchases':        renderPurchases,
    'suppliers':        renderSuppliers,
    'payments':         renderPayments,
    'blocks':           renderBlocks,
    'cutting':          renderCutting,
    'slabs':            renderSlabs,
    'products':         renderProducts,
    'expenses':         renderExpenses,
    'report-pl':        renderReportPL,
    'report-bs':        renderReportBS,
    'report-waste':     renderReportWaste,
    'report-inventory': renderReportInventory,
    'settings':         renderSettings,
    'notifications':    renderNotifications,
    'employees':        renderEmployees,
    'activity-log':     renderActivityLog,
    'warehouses':       renderWarehouses,
    'shipments':        renderShipments,
    'shipment-report':  renderShipmentReport,
  };

  if (renders[pageName]) renders[pageName]();
  else content.innerHTML = `<div class="empty-state"><div class="empty-icon">🚧</div><h3>قريباً</h3></div>`;
}

// ===== REAL-TIME REFRESH =====
// Debounced refresh: avoids rapid re-renders when multiple DB changes fire at once
let _refreshTimer = null;
function _scheduleRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    // Only refresh if the app is visible and user is logged in
    if (!document.getElementById('app').classList.contains('hidden') && currentUser) {
      const renders = {
        'dashboard': renderDashboard, 'journal': renderJournal, 'accounts': renderAccounts,
        'trial-balance': renderTrialBalance, 'sales': renderSales, 'customers': renderCustomers,
        'aging': renderAging, 'purchases': renderPurchases, 'suppliers': renderSuppliers,
        'payments': renderPayments, 'blocks': renderBlocks, 'cutting': renderCutting,
        'slabs': renderSlabs, 'products': renderProducts, 'expenses': renderExpenses,
        'report-pl': renderReportPL, 'report-bs': renderReportBS, 'report-waste': renderReportWaste,
        'report-inventory': renderReportInventory, 'settings': renderSettings,
        'notifications': renderNotifications, 'employees': renderEmployees,
        'activity-log': renderActivityLog, 'warehouses': renderWarehouses,
        'shipments': renderShipments, 'shipment-report': renderShipmentReport,
      };
      if (renders[_currentPage]) renders[_currentPage]();
      loadNotifications();
    }
  }, 500);
}

// ===== SIDEBAR =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ===== MODAL =====
function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('global-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('global-modal').classList.remove('open');
}

// ===== TOAST =====
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ===== HELPERS =====
function formatMoney(n, currency = 'EGP') {
  const amount = parseFloat(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount + ' ' + currency;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ar-EG');
}

function statusBadge(status) {
  const map = {
    'draft':      ['badge-warning', 'مسودة'],
    'sent':       ['badge-info',    'مرسلة'],
    'partial':    ['badge-warning', 'جزئي'],
    'paid':       ['badge-success', 'مسددة'],
    'cancelled':  ['badge-danger',  'ملغاة'],
    'rejected':   ['badge-danger',  'مرفوضة'],
    'active':     ['badge-success', 'نشط'],
    'completed':  ['badge-info',    'مكتمل'],
    'in_stock':   ['badge-success', 'في المخزن'],
    'sold':       ['badge-info',    'مباعة'],
    'waste':      ['badge-danger',  'هالك'],
    'processed':  ['badge-gold',    'مُصنَّع'],
    'in_cutting': ['badge-warning', 'في القطع'],
    'pending':    ['badge-warning', 'قيد التنفيذ'],
    'ready_to_ship': ['badge-info', 'مستعد للشحن'],
    'in_transit': ['badge-info',    'في الطريق'],
    'arrived':    ['badge-warning', 'وصل المخزن/العميل'],
    'delivered':  ['badge-success', 'تم التسليم'],
    'on_leave':   ['badge-warning', 'إجازة'],
    'resigned':   ['badge-danger',  'مستقيل'],
    'terminated': ['badge-danger',  'تم الفصل'],
  };
  const [cls, label] = map[status] || ['badge-info', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function tableLoader() {
  return '<div class="loader"></div>';
}

// Barcode generator (simple Code128-style visual)
function generateBarcodeHTML(code) {
  return `<div style="font-family:monospace;font-size:12px;letter-spacing:2px;padding:4px 8px;background:#fff;color:#000;border-radius:4px;display:inline-block;">
    ||||| ${code} |||||
  </div>`;
}

// ===== STARTUP =====
window.addEventListener('load', () => {
  const token = sessionStorage.getItem('marble_token') || localStorage.getItem('marble_token');
  const user  = sessionStorage.getItem('marble_user')  || localStorage.getItem('marble_user');
  if (token && user) {
    api.setToken(token);
    currentUser = JSON.parse(user);
    // Migrate to sessionStorage if still only in localStorage
    if (!sessionStorage.getItem('marble_user')) sessionStorage.setItem('marble_user', user);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  }

  // ===== REAL-TIME SYNC (BroadcastChannel) =====
  // Listen for DB changes made in other tabs and refresh the current page
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const syncListener = new BroadcastChannel('marble_erp_sync');
      syncListener.onmessage = (e) => {
        if (e.data && e.data.type === 'db_change') {
          _scheduleRefresh();
        }
      };
    }
  } catch (_) {}
});

// Enter key on login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) {
    doLogin();
  }
});

// ===== ROLE HELPERS =====
function isManager() {
  const role = currentUser?.role || '';
  return ['مدير عام', 'مدير', 'مدير مبيعات', 'مدير قسم'].includes(role);
}

function currencyDropdown(id, selectedValue = 'EGP') {
  return `<select id="${id}">
    <option value="EGP" ${selectedValue === 'EGP' ? 'selected' : ''}>ج.م (EGP)</option>
    <option value="USD" ${selectedValue === 'USD' ? 'selected' : ''}>دولار (USD)</option>
  </select>`;
}

// ===== SHARED EXPORT UTILITIES =====

/**
 * Export table data as PDF using the browser's native print/PDF dialog.
 * This approach renders a proper HTML page with Cairo font which gives
 * perfect Arabic RTL support—far better than jsPDF alone.
 */
function exportGenericPDF({ title, subtitle, headers, rows, totalsRow, filename, orientation }) {
  if (!rows || !rows.length) { toast('لا توجد بيانات للتصدير', 'error'); return; }

  const settings = DB.get('settings') || {};
  const companyName = settings.company_name || 'شركة الرخام والجرانيت';

  const tableRows = rows.map((row, rIdx) =>
    `<tr class="${rIdx % 2 === 0 ? 'even' : ''}">${row.map(cell => `<td>${cell === null || cell === undefined ? '-' : String(cell)}</td>`).join('')}</tr>`
  ).join('');

  const totalsHTML = totalsRow
    ? `<tr class="totals">${totalsRow.map(cell => `<td><strong>${cell === null || cell === undefined ? '' : String(cell)}</strong></td>`).join('')}</tr>`
    : '';

  const pageSize = orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Cairo','Arial',sans-serif;direction:rtl;color:#1a1a1a;background:#fff;padding:14mm 18mm}
    .report-header{text-align:center;margin-bottom:18px;border-bottom:3px solid #c8a96e;padding-bottom:14px}
    .report-header .company{font-size:13px;color:#555;font-weight:600;margin-bottom:6px}
    .report-header h1{font-size:20px;font-weight:900;color:#1a1a1a;margin-bottom:5px}
    .report-header .sub{font-size:12px;color:#666;margin-bottom:4px}
    .report-header .date{color:#999;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10.5px}
    th{background:#2c2c2c;color:#fff;padding:7px 9px;text-align:center;font-weight:700;border:1px solid #444}
    td{padding:6px 9px;text-align:center;border:1px solid #ddd;color:#333}
    tr.even td{background:#f8f7f5}
    tr.totals td{background:#2c2c2c;color:#c8a96e;font-size:11.5px;border-top:2px solid #c8a96e}
    .footer{margin-top:18px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
    @media print{@page{size:${pageSize};margin:12mm 16mm}body{padding:0}}
  </style>
</head>
<body>
  <div class="report-header">
    <div class="company">${companyName}</div>
    <h1>${title}</h1>
    ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
    <div class="date">تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}${totalsHTML}</tbody>
  </table>
  <div class="footer">${companyName} &mdash; نظام ERP للرخام والجرانيت</div>
  <script>
    document.fonts.ready.then(function(){setTimeout(function(){window.print();},300)});
  </scr` + `ipt>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) { toast('يرجى السماح بالنوافذ المنبثقة لتصدير PDF', 'error'); return; }
  win.document.write(html);
  win.document.close();
  toast('جاري فتح نافذة الطباعة — اختر "حفظ كـ PDF"', 'success');
}

function exportGenericExcel({ sheetName, headers, rows, totalsRow, filename }) {
  if (!rows || !rows.length) { toast('لا توجد بيانات للتصدير', 'error'); return; }
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة', 'error'); return; }
  const data = [headers, ...rows];
  if (totalsRow) data.push(totalsRow);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  // Auto-filter on header row
  ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + headers.length)}1` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'تقرير');
  XLSX.writeFile(wb, filename || `report-${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('تم تصدير Excel بنجاح', 'success');
}

// ===== PAGINATION HELPERS =====
const ROWS_PER_PAGE = 25;

/**
 * Returns a slice of `items` for the given 1-based `page`.
 */
function slicePage(items, page, pageSize = ROWS_PER_PAGE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Renders a pagination bar HTML string.
 * @param {number} currentPage  1-based current page
 * @param {number} total        total number of items
 * @param {string} onClickFn    name of the JS function to call with the new page number
 * @param {number} [pageSize]   rows per page (default ROWS_PER_PAGE)
 */
function renderPaginationBar(currentPage, total, onClickFn, pageSize = ROWS_PER_PAGE) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return '';

  const MAX_BTNS = 5;
  let start = Math.max(1, currentPage - Math.floor(MAX_BTNS / 2));
  let end   = Math.min(totalPages, start + MAX_BTNS - 1);
  if (end - start < MAX_BTNS - 1) start = Math.max(1, end - MAX_BTNS + 1);

  const btns = [];
  if (currentPage > 1)          btns.push(`<button class="page-btn" onclick="${onClickFn}(${currentPage - 1})">&#8249;</button>`);
  for (let i = start; i <= end; i++) {
    btns.push(`<button class="page-btn${i === currentPage ? ' active' : ''}" onclick="${onClickFn}(${i})">${i}</button>`);
  }
  if (currentPage < totalPages) btns.push(`<button class="page-btn" onclick="${onClickFn}(${currentPage + 1})">&#8250;</button>`);

  const from = (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, total);

  return `<div class="pagination-bar">
    <span class="pagination-info">${from}–${to} من ${total} سجل</span>
    <div class="pagination-btns">${btns.join('')}</div>
  </div>`;
}
