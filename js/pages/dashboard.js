// ============================================
// لوحة التحكم الرئيسية - Dashboard
// ============================================

// ===== جمع جميع التنبيهات الذكية =====
function collectAllAlerts() {
  var alerts  = [];
  var today   = new Date();
  var in7Days = new Date(today.getTime() + 7 * 86400000);
  var s = DB.get('settings') || {};

  // 1. مخزون منخفض
  var products = DB.getAll('products');
  products.forEach(function(p) {
    if ((p.stock_qty || 0) <= (p.min_stock || 5)) {
      alerts.push({
        level:    'warning',
        category: 'مخزون',
        text:     p.name + ': متبقي ' + (p.stock_qty || 0) + ' ' + (p.unit || 'وحدة'),
        page:     'products',
        id:       p.id
      });
      if (s.tgNotifyLowStock) sendTelegramNotification(
        '⚠️ <b>مخزون منخفض</b>\n' + p.name +
        ': متبقي ' + (p.stock_qty || 0) + ' ' + (p.unit || 'وحدة')
      );
    }
  });

  // 2. فواتير متأخرة أكثر من 30 يوم
  var sales = DB.getAll('sales');
  sales.forEach(function(inv) {
    if (inv.status !== 'sent') return;
    var days = daysBetween(inv.invoice_date);
    if (days > 30) {
      alerts.push({
        level:    'danger',
        category: 'مديونية',
        text:     (inv.customer || '') + ' — ' +
                  formatCurrency(inv.total_amount) + ' — ' + days + ' يوم',
        page:     'sales',
        id:       inv.id
      });
      if (s.tgNotifyOverdue) sendTelegramNotification(
        '🔴 <b>فاتورة متأخرة ' + days + ' يوم</b>\n' +
        'العميل: ' + (inv.customer || '') + '\n' +
        'المبلغ: ' + formatCurrency(inv.total_amount)
      );
    }
  });

  // 3. شيكات تستحق خلال 7 أيام (غير مستحقة بعد أو مستحقة للتو)
  var checks = DB.getAll('checks');
  checks.forEach(function(chk) {
    if (chk.status !== 'pending') return;
    if (!chk.dueDate) return;
    var due = new Date(chk.dueDate);
    if (isNaN(due.getTime())) return;
    if (due >= today && due <= in7Days) {
      alerts.push({
        level:    'info',
        category: 'شيكات',
        text:     (chk.partyName || '') + ' — ' +
                  formatCurrency(chk.amount) + ' — ' +
                  formatDate(chk.dueDate),
        page:     'checks',
        id:       chk.id
      });
      if (s.tgNotifyChecks) sendTelegramNotification(
        '📅 <b>شيك يستحق قريباً</b>\n' +
        (chk.partyName || '') + '\n' +
        'المبلغ: ' + formatCurrency(chk.amount) + '\n' +
        'الاستحقاق: ' + formatDate(chk.dueDate)
      );
    }
  });

  // 4. تجاوز حد الائتمان
  var crmCustomers = DB.getAll('crm_customers');
  crmCustomers.forEach(function(c) {
    if (!c.creditLimit || c.creditLimit <= 0) return;
    var bal = DB.getAll('sales')
      .filter(function(inv) {
        return inv.customer_id === c.id &&
               inv.status !== 'paid' &&
               inv.status !== 'cancelled';
      })
      .reduce(function(sum, inv) {
        return sum + ((inv.total_amount || 0) - (inv.paid_amount || 0));
      }, 0);
    if (bal > c.creditLimit) {
      alerts.push({
        level:    'danger',
        category: 'ائتمان',
        text:     (c.name || '') + ' — مديونية ' +
                  formatCurrency(bal) +
                  ' / حد ' + formatCurrency(c.creditLimit),
        page:     'crm',
        id:       c.id
      });
    }
  });

  // 5. شحنات متأخرة (تجاوزت تاريخ التسليم المتوقع)
  var shipments = DB.getAll('shipments');
  shipments.forEach(function(sh) {
    if (sh.status === 'delivered' || sh.status === 'cancelled') return;
    if (!sh.delivery_date) return;
    var due = new Date(sh.delivery_date);
    if (isNaN(due.getTime())) return;
    if (due < today) {
      alerts.push({
        level:    'danger',
        category: 'شحن',
        text:     (sh.shipment_number || '') + ' — ' + (sh.customer || '') +
                  ' — متأخرة منذ ' + Math.floor((today - due) / 86400000) + ' يوم',
        page:     'shipments',
        id:       sh.id
      });
    }
  });

  // 6. أوامر تصدير في انتظار التأكيد
  var exportOrders = DB.getAll('export_orders');
  var pendingExports = exportOrders.filter(function(o) {
    return o.status === 'pending' || o.status === 'في انتظار التأكيد';
  });
  if (pendingExports.length > 0) {
    alerts.push({
      level:    'info',
      category: 'تصدير',
      text:     pendingExports.length + ' أمر تصدير في انتظار التأكيد',
      page:     'export',
      id:       null
    });
  }

  // 7. تذكير النسخ الاحتياطي
  var lastBackup = localStorage.getItem('_lastBackup');
  var backupDays = lastBackup ? daysBetween(lastBackup) : 999;
  if (backupDays > 1) {
    alerts.push({
      level:    'warning',
      category: 'نظام',
      text:     'لم يتم عمل نسخة احتياطية منذ ' +
                (backupDays >= 999 ? 'البداية' : backupDays + ' يوم'),
      page:     'settings',
      id:       null
    });
  }

  return alerts;
}

// ===== عرض قسم التنبيهات الملوّن =====
function renderAlertsSection(alerts) {
  if (!alerts || !alerts.length) return '';

  var colors = {
    danger:  { bg: '#fcebeb', border: '#a32d2d', text: '#791f1f' },
    warning: { bg: '#faeeda', border: '#854f0b', text: '#633806' },
    info:    { bg: '#e6f1fb', border: '#185fa5', text: '#0c447c' }
  };

  return alerts.map(function(a) {
    var c = colors[a.level] || colors.info;
    var onclick = a.page
      ? (a.id
          ? 'navigateToEntity(\'' + a.page + '\',\'' + a.id + '\')'
          : 'showPage(\'' + a.page + '\')')
      : 'showPage(\'settings\')';
    return '<div onclick="' + onclick + '" style="cursor:pointer;display:flex;align-items:center;gap:8px;' +
      'padding:8px 12px;margin-bottom:6px;background:' + c.bg + ';' +
      'border:1px solid ' + c.border + ';border-radius:8px;font-size:13px;color:' + c.text + '">' +
      '<span style="font-weight:700;font-size:11px;padding:2px 6px;background:' + c.border +
      ';color:#fff;border-radius:4px">' + (a.category || '') + '</span>' +
      '<span>' + a.text + '</span>' +
      '</div>';
  }).join('');
}

// ===== مؤشرات الإنتاج =====
function renderProductionKPIs() {
  var mfg    = DB.getAll('manufacturing_stages');
  var slabs  = DB.getAll('slabs');
  var blocks = DB.getAll('blocks');

  var thisMonth = new Date().toISOString().slice(0, 7);

  // إجمالي الإنتاج هذا الشهر
  var monthlyOutput = mfg
    .filter(function(op) { return (op.date || '').slice(0, 7) === thisMonth; })
    .reduce(function(sum, op) { return sum + (op.outputQuantity || 0); }, 0);

  // نسبة الهالك هذا الشهر
  var mfgThisMonth = mfg.filter(function(op) { return (op.date || '').slice(0, 7) === thisMonth; });
  var totalIn  = mfgThisMonth.reduce(function(sum, op) { return sum + (op.inputQuantity  || 0); }, 0);
  var totalOut = mfgThisMonth.reduce(function(sum, op) { return sum + (op.outputQuantity || 0); }, 0);
  var wasteRate = totalIn > 0
    ? ((totalIn - totalOut) / totalIn * 100).toFixed(1)
    : '0.0';

  // ألواح متاحة في المخزن
  var availableSlabs = slabs.filter(function(s) {
    return s.status === 'in_stock';
  }).length;

  // كتل في مرحلة القطع
  var blocksInCutting = blocks.filter(function(b) {
    return b.status === 'in_cutting';
  }).length;

  // متوسط تكلفة المتر (من مراحل التصنيع هذا الشهر)
  var totalCostThisM = mfgThisMonth.reduce(function(sum, op) {
    return sum + (op.directCost || 0) + (op.laborCost || 0) +
                 (op.materialCost || 0) + (op.transportCost || 0);
  }, 0);
  var avgCost = totalOut > 0
    ? formatCurrency(totalCostThisM / totalOut)
    : '—';

  return renderMiniKPI('إنتاج الشهر', monthlyOutput.toFixed(1) + ' وحدة', '#185fa5') +
         renderMiniKPI('هالك الشهر', wasteRate + '%', parseFloat(wasteRate) > 5 ? '#a32d2d' : '#1a7a4a') +
         renderMiniKPI('ألواح متاحة', availableSlabs + ' لوح', '#854f0b') +
         renderMiniKPI('كتل في القطع', blocksInCutting + ' كتلة', '#6b2fa0') +
         renderMiniKPI('متوسط تكلفة المتر', avgCost, '#0c447c');
}

// ===== بطاقة KPI صغيرة =====
function renderMiniKPI(label, value, color) {
  return '<div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;' +
    'padding:10px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;' +
    'margin:0 4px 8px 4px;min-width:130px;text-align:center">' +
    '<div style="font-size:16px;font-weight:700;color:' + (color || 'var(--accent)') + '">' + value + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">' + label + '</div>' +
    '</div>';
}

// ===== التقرير اليومي التلقائي عبر تيليجرام =====
function checkAndSendDailyReport() {
  var today = new Date().toISOString().slice(0, 10);
  var lastReport = localStorage.getItem('_lastDailyReport');
  if (lastReport === today) return; // أُرسل اليوم بالفعل

  var s = DB.get('settings') || {};
  if (!s.tgDailyReport || !s.tgBotToken || !s.tgChatId) return; // غير مُفعَّل

  // بناء ملخص سريع
  var sales      = DB.getAll('sales');
  var todaySales = sales.filter(function(inv) {
    return inv.invoice_date === today && inv.status !== 'cancelled';
  });
  var todayTotal = todaySales.reduce(function(sum, inv) {
    return sum + (inv.total_amount || 0);
  }, 0);

  var overdue = sales.filter(function(inv) {
    return inv.status === 'sent' && daysBetween(inv.invoice_date) > 30;
  }).length;

  var lowStock = DB.getAll('products').filter(function(p) {
    return (p.stock_qty || 0) <= (p.min_stock || 5);
  }).length;

  var msg =
    '📊 <b>التقرير اليومي — ' + today + '</b>\n\n' +
    '💰 مبيعات اليوم: ' + formatCurrency(todayTotal) + ' (' + todaySales.length + ' فاتورة)\n' +
    '⚠️ فواتير متأخرة: ' + overdue + '\n' +
    '📦 منتجات بمخزون منخفض: ' + lowStock;

  sendTelegramNotification(msg);
  localStorage.setItem('_lastDailyReport', today);
}

async function renderDashboard() {
  const content = document.getElementById('page-content');
  try {
    // إرسال التقرير اليومي إن لزم
    checkAndSendDailyReport();

    // ===== حساب مؤشرات لوحة التحكم =====
    const now   = new Date();
    const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevM = (() => {
      const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
    })();

    // إيرادات التصدير والمحلية هذا الشهر
    const exportOrders   = DB.getAll('export_orders');
    const thisExportRev  = exportOrders.filter(o => o.shippingDate && o.shippingDate.startsWith(thisM))
      .reduce((s, o) => s + (o.totalRevenue || 0), 0);
    const allSales       = DB.getAll('sales');
    const thisLocalRev   = allSales.filter(s => s.invoice_date && s.invoice_date.startsWith(thisM)
                            && s.status !== 'cancelled')
      .reduce((s, inv) => s + (inv.total_amount || 0), 0);
    const thisTotalRev   = thisExportRev + thisLocalRev;

    const prevExportRev  = exportOrders.filter(o => o.shippingDate && o.shippingDate.startsWith(prevM))
      .reduce((s, o) => s + (o.totalRevenue || 0), 0);
    const prevLocalRev   = allSales.filter(s => s.invoice_date && s.invoice_date.startsWith(prevM)
                            && s.status !== 'cancelled')
      .reduce((s, inv) => s + (inv.total_amount || 0), 0);
    const prevTotalRev   = prevExportRev + prevLocalRev;
    const revGrowth      = prevTotalRev > 0 ? ((thisTotalRev - prevTotalRev) / prevTotalRev * 100).toFixed(1) : null;

    // مشتريات الشهر
    const purchases   = DB.getAll('purchases');
    const thisPurchases = purchases.filter(p => (p.invoice_date||'').startsWith(thisM) && p.status !== 'cancelled')
      .reduce((s, p) => s + (p.total_amount || 0), 0);

    // صافي الأرباح هذا الشهر
    const expenses     = DB.getAll('expenses');
    const thisExpenses = expenses.filter(e => (e.date||'').startsWith(thisM))
      .reduce((s, e) => s + (e.amount || 0), 0);
    const mfgStages    = DB.getAll('manufacturing_stages');
    const thisMfgCost  = mfgStages.filter(m => (m.date||'').startsWith(thisM))
      .reduce((s, m) => s + (m.directCost||0) + (m.laborCost||0) + (m.materialCost||0) + (m.transportCost||0), 0);
    const thisNetProfit = thisTotalRev - thisPurchases - thisExpenses - thisMfgCost;

    // أوامر التصدير النشطة
    const activeExportOrders = exportOrders.filter(o => o.status && !['تم التسليم','مكتمل','ملغى','cancelled'].includes(o.status)).length;

    // مخزون الألواح الجاهزة (م²)
    const slabs = DB.getAll('slabs');
    const readySlabsM2 = slabs.filter(s => s.status === 'in_stock')
      .reduce((sum, s) => sum + (s.area_m2 || s.length_cm && s.width_cm ? (s.length_cm||0) * (s.width_cm||0) / 10000 : 0), 0);

    // إجمالي مديونية العملاء
    const totalDebt = allSales.filter(s => s.status !== 'paid' && s.status !== 'cancelled')
      .reduce((sum, s) => sum + Math.max(0, (s.total_amount||0) - (s.paid_amount||0)), 0);

    // أعلى 5 عملاء إيراداً هذا الشهر
    const top5Customers = (() => {
      const map = {};
      allSales.filter(s => s.invoice_date && s.invoice_date.startsWith(thisM) && s.status !== 'cancelled')
        .forEach(s => { map[s.customer] = (map[s.customer] || 0) + (s.total_amount || 0); });
      return Object.entries(map).map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total).slice(0, 5);
    })();

    // إيرادات التصدير آخر 12 شهر
    const exportRevLast12 = (() => {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const rev = exportOrders.filter(o => (o.shippingDate||'').startsWith(m))
          .reduce((s, o) => s + (o.totalRevenue||0), 0);
        months.push({ month: m.slice(5) + '/' + m.slice(0,4), revenue: rev });
      }
      return months;
    })();

    // توزيع التكاليف (مشتريات / تصنيع / شحن / إدارية)
    const shipments = DB.getAll('shipments');
    const costDistrib = {
      'مشتريات': purchases.reduce((s, p) => s + (p.total_amount||0), 0),
      'تصنيع':   mfgStages.reduce((s, m) => s + (m.directCost||0)+(m.laborCost||0)+(m.materialCost||0)+(m.transportCost||0), 0),
      'شحن':     shipments.reduce((s, sh) => s + (sh.freight_cost||sh.cost||0), 0),
      'إدارية':  expenses.reduce((s, e) => s + (e.amount||0), 0),
    };

    content.innerHTML = `
      <!-- ===== التنبيهات الذكية ===== -->
      <div id="alertsContainer" style="margin-bottom:12px"></div>

      <!-- ===== فواتير معلقة للموافقة (للمديرين فقط) ===== -->
      <div id="pendingApprovalsContainer" style="margin-bottom:12px"></div>

      <!-- ===== KPIs الأساسية ===== -->
      <div class="kpi-grid">
        <div class="kpi-card gold">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value number">${formatMoney(thisTotalRev)}</div>
          <div class="kpi-label">إجمالي الإيرادات (الشهر الحالي)
            ${revGrowth !== null ? `<span style="font-size:12px;font-weight:700;color:${parseFloat(revGrowth)>=0?'var(--success)':'var(--danger)'};margin-right:6px">${parseFloat(revGrowth)>=0?'▲':'▼'} ${Math.abs(revGrowth)}%</span>` : ''}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🛒</div>
          <div class="kpi-value number">${formatMoney(thisPurchases)}</div>
          <div class="kpi-label">إجمالي المشتريات (الشهر الحالي)</div>
        </div>
        <div class="kpi-card ${thisNetProfit >= 0 ? 'green' : 'red'}">
          <div class="kpi-icon">📊</div>
          <div class="kpi-value number">${formatMoney(thisNetProfit)}</div>
          <div class="kpi-label">صافي الأرباح (الشهر الحالي)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🚢</div>
          <div class="kpi-value">${activeExportOrders}</div>
          <div class="kpi-label">أوامر التصدير النشطة</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🪨</div>
          <div class="kpi-value number">${readySlabsM2.toFixed(1)} م²</div>
          <div class="kpi-label">مخزون الألواح الجاهزة</div>
        </div>
        <div class="kpi-card ${totalDebt > 0 ? 'red' : 'green'}">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-value number">${formatMoney(totalDebt)}</div>
          <div class="kpi-label">إجمالي مديونية العملاء</div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📈 إيرادات التصدير — آخر 12 شهر</span>
          </div>
          <canvas id="export-revenue-chart" height="80"></canvas>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🥧 توزيع التكاليف</span>
          </div>
          <canvas id="cost-dist-chart" height="80"></canvas>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:4px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">🥇 أعلى 5 عملاء إيراداً هذا الشهر</span>
            <button class="btn btn-secondary btn-sm" onclick="showPage('crm')">CRM</button>
          </div>
          <div style="padding:4px">
            ${top5Customers.length > 0 ? (() => {
              const maxT = Math.max(...top5Customers.map(c => c.total));
              return top5Customers.map((c, i) => `
                <div style="margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="font-size:13px;font-weight:600">${i+1}. ${c.name}</span>
                    <span style="font-size:13px;color:var(--accent)">${formatMoney(c.total)}</span>
                  </div>
                  <div style="height:5px;background:var(--bg-input);border-radius:3px">
                    <div style="height:100%;background:linear-gradient(90deg,var(--accent-dark),var(--accent));border-radius:3px;width:${(c.total/maxT*100).toFixed(1)}%"></div>
                  </div>
                </div>`).join('');
            })() : '<div class="empty-state" style="padding:20px"><p>لا توجد مبيعات هذا الشهر</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🚢 آخر 5 أوامر تصدير</span>
            <button class="btn btn-secondary btn-sm" onclick="showPage('export')">التصدير</button>
          </div>
          <div class="data-table-wrapper">
            <table>
              <thead><tr><th>رقم الأمر</th><th>العميل</th><th>الإيراد</th><th>الحالة</th></tr></thead>
              <tbody>
                ${exportOrders.slice().sort((a,b) => new Date(b.createdAt||b.orderDate||0) - new Date(a.createdAt||a.orderDate||0)).slice(0,5).map(o => `
                  <tr>
                    <td class="number">${o.exportOrderNo || o.id}</td>
                    <td>${o.customerName || '-'}</td>
                    <td class="number text-success">${formatMoney(o.totalRevenue||0)}</td>
                    <td>${statusBadge(o.status || 'pending')}</td>
                  </tr>`).join('') || '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:12px">لا توجد أوامر تصدير</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">🪨 آخر 5 مشتريات كتل</span>
          <button class="btn btn-primary btn-sm" onclick="showPage('purchases')">عرض الكل</button>
        </div>
        <div class="data-table-wrapper">
          <table>
            <thead><tr>
              <th>كود الكتلة</th>
              <th>النوع</th>
              <th>المورد</th>
              <th>التاريخ</th>
              <th>التكلفة</th>
              <th>الحالة</th>
            </tr></thead>
            <tbody>
              ${(() => {
                const blocks = DB.getAll('blocks').slice().sort((a,b) => new Date(b.received_date||0) - new Date(a.received_date||0)).slice(0,5);
                if (!blocks.length) return '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:12px">لا توجد كتل</td></tr>';
                return blocks.map(b => `
                  <tr>
                    <td class="number">${b.code}</td>
                    <td>${b.type || '-'}</td>
                    <td>${b.supplier || '-'}</td>
                    <td>${formatDate(b.received_date)}</td>
                    <td class="number">${formatMoney(b.cost||0)}</td>
                    <td>${statusBadge(b.status)}</td>
                  </tr>`).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // ===== ملء التنبيهات الذكية =====
    var allAlerts = collectAllAlerts();
    var alertsEl = document.getElementById('alertsContainer');
    if (alertsEl) {
      if (allAlerts.length > 0) {
        alertsEl.innerHTML =
          '<div class="card" style="border-right:3px solid var(--warning);padding:12px 16px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<span style="font-size:16px">🔔</span>' +
          '<strong>تنبيهات تحتاج متابعة</strong>' +
          '<span class="badge badge-danger">' + allAlerts.length + '</span>' +
          '</div>' +
          renderAlertsSection(allAlerts) +
          '</div>';
      }
    }

    // ===== فواتير معلقة للموافقة (للمديرين فقط) =====
    if (isManager()) {
      var pendingApproval = DB.getAll('sales').filter(function(inv) { return inv.status === 'pending_approval'; });
      var paEl = document.getElementById('pendingApprovalsContainer');
      if (paEl && pendingApproval.length > 0) {
        paEl.innerHTML = '<div class="card" style="border-right:3px solid var(--accent);padding:12px 16px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<span style="font-size:16px">⏳</span>' +
          '<strong>فواتير معلقة للموافقة</strong>' +
          '<span class="badge badge-warning">' + pendingApproval.length + '</span>' +
          '</div>' +
          '<table class="data-table"><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ</th><th>الإجراء</th></tr></thead><tbody>' +
          pendingApproval.map(function(inv) {
            return '<tr>' +
              '<td class="number">' + inv.invoice_number + '</td>' +
              '<td>' + (inv.customer || '') + '</td>' +
              '<td class="number">' + formatMoney(inv.total_amount) + '</td>' +
              '<td>' +
              '<button class="btn btn-success btn-sm" style="margin-left:4px" onclick="approveSaleInvoice(' + inv.id + ')">✓ موافقة</button>' +
              '<button class="btn btn-danger btn-sm" onclick="rejectSaleInvoice(' + inv.id + ')">✗ رفض</button>' +
              '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>' +
          '</div>';
      }
    }

    // ===== رسم مخطط إيرادات التصدير =====
    requestAnimationFrame(() => {
      const expCtx = document.getElementById('export-revenue-chart');
      if (expCtx && exportRevLast12.length > 0) {
        _registerChart('dashboard-export-rev', new Chart(expCtx.getContext('2d'), {
          type: 'line',
          data: {
            labels: exportRevLast12.map(r => r.month),
            datasets: [{
              label: 'إيرادات التصدير (EGP)',
              data: exportRevLast12.map(r => r.revenue),
              backgroundColor: 'rgba(200,169,110,0.2)',
              borderColor: '#c8a96e',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 3,
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#8892aa', font: { family: 'Cairo' } } } },
            scales: {
              x: { ticks: { color: '#8892aa' }, grid: { color: 'rgba(42,47,63,0.8)' } },
              y: { ticks: { color: '#8892aa', callback: v => formatMoney(v) }, grid: { color: 'rgba(42,47,63,0.8)' } }
            }
          }
        }));
      }

      // ===== رسم مخطط توزيع التكاليف (دونات) =====
      const costCtx = document.getElementById('cost-dist-chart');
      const costVals = Object.values(costDistrib);
      if (costCtx && costVals.some(v => v > 0)) {
        _registerChart('dashboard-cost-dist', new Chart(costCtx.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: Object.keys(costDistrib),
            datasets: [{
              data: costVals,
              backgroundColor: ['rgba(200,169,110,0.7)', 'rgba(29,158,117,0.7)', 'rgba(185,133,36,0.7)', 'rgba(226,75,74,0.7)'],
              borderColor: ['#c8a96e', '#1d9e75', '#b98524', '#e24b4a'],
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { labels: { color: '#8892aa', font: { family: 'Cairo' } } },
              tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatMoney(ctx.parsed) } },
            }
          }
        }));
      }
    });

  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--danger)">${e.message}</p></div>`;
  }
}

// ===== الموافقة على فاتورة من لوحة التحكم =====
async function approveSaleInvoice(id) {
  try {
    await api.approveSale(id);
    toast('تمت الموافقة على الفاتورة', 'success');
    renderDashboard();
  } catch(e) { toast(e.message, 'error'); }
}

async function rejectSaleInvoice(id) {
  const reason = prompt('سبب الرفض:');
  if (reason === null) return;
  try {
    await api.rejectSale(id, reason);
    toast('تم رفض الفاتورة', 'warning');
    renderDashboard();
  } catch(e) { toast(e.message, 'error'); }
}
