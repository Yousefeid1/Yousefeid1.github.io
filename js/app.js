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
    localStorage.setItem('marble_user', JSON.stringify(data.user));
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

function showPage(pageName) {
  // Access control: redirect to dashboard if user lacks permission
  const role    = currentUser?.role || 'مدير';
  const allowed = ROLE_PAGES[role];
  if (allowed !== null && pageName !== 'dashboard' && !allowed.includes(pageName)) {
    pageName = 'dashboard';
  }

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
  const token = localStorage.getItem('marble_token');
  const user  = localStorage.getItem('marble_user');
  if (token && user) {
    api.setToken(token);
    currentUser = JSON.parse(user);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  }
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
function exportGenericPDF({ title, subtitle, headers, rows, totalsRow, filename, orientation }) {
  if (!rows || !rows.length) { toast('لا توجد بيانات للتصدير', 'error'); return; }
  if (typeof window.jspdf === 'undefined') { toast('مكتبة PDF غير محملة', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: orientation || 'landscape', unit: 'mm', format: 'a4' });
  const pageW = orientation === 'portrait' ? 210 : 297;
  const margin = 12;
  const usableW = pageW - margin * 2;

  doc.setFillColor(30, 30, 30);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(14);
  doc.text(title, pageW / 2, 11, { align: 'center' });
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  if (subtitle) doc.text(subtitle, pageW / 2, 18, { align: 'center' });
  doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`, pageW / 2, 24, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const colW = usableW / headers.length;
  const colPositions = headers.map((_, i) => margin + i * colW);

  let y = 36;

  doc.setFillColor(50, 50, 50);
  doc.rect(margin, y - 5, usableW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  headers.forEach((h, i) => {
    const x = colPositions[i] + colW / 2;
    doc.text(String(h), x, y, { align: 'center' });
  });
  doc.setTextColor(0, 0, 0);
  y += 8;

  rows.forEach((row, rIdx) => {
    if (y > (orientation === 'portrait' ? 265 : 185)) { doc.addPage(); y = 20; }
    if (rIdx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(margin, y - 5, usableW, 7, 'F'); }
    doc.setFontSize(7.5);
    row.forEach((cell, i) => {
      const x = colPositions[i] + colW / 2;
      const text = String(cell === null || cell === undefined ? '-' : cell);
      doc.text(text.substring(0, 28), x, y, { align: 'center' });
    });
    y += 7;
  });

  if (totalsRow) {
    y += 2;
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, y - 5, usableW, 8, 'F');
    doc.setTextColor(255, 215, 0);
    doc.setFontSize(8.5);
    totalsRow.forEach((cell, i) => {
      const x = colPositions[i] + colW / 2;
      doc.text(String(cell === null || cell === undefined ? '' : cell), x, y, { align: 'center' });
    });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(filename || `report-${new Date().toISOString().split('T')[0]}.pdf`);
  toast('تم تصدير PDF بنجاح', 'success');
}

function exportGenericExcel({ sheetName, headers, rows, totalsRow, filename }) {
  if (!rows || !rows.length) { toast('لا توجد بيانات للتصدير', 'error'); return; }
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة', 'error'); return; }
  const data = [headers, ...rows];
  if (totalsRow) data.push(totalsRow);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'تقرير');
  XLSX.writeFile(wb, filename || `report-${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('تم تصدير Excel بنجاح', 'success');
}
