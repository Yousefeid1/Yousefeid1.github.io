// ============================================
// 3. Slab Tracker — تتبع مسار اللوح الكامل
// يعرض جدول زمني شامل من الكتلة الخام حتى الشحن
// ============================================

let _slabTrackerSearch = '';

async function renderSlabTracker() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h2>🔎 تتبع مسار اللوح</h2><p>تتبع رحلة اللوح من الكتلة الخام حتى الشحن</p></div>
    </div>

    <div class="filters-bar">
      <input type="text" id="slab-tracker-search"
             placeholder="ابحث برقم اللوح أو نوع الرخام..."
             oninput="filterSlabTracker(this.value)"
             style="flex:1;min-width:220px">
    </div>

    <div id="slab-tracker-list"></div>
  `;
  _renderSlabList('');
}

function filterSlabTracker(term) {
  _slabTrackerSearch = (term || '').trim().toLowerCase();
  _renderSlabList(_slabTrackerSearch);
}

// عرض قائمة الألواح مع إمكانية عرض تفاصيل كل لوح
function _renderSlabList(term) {
  const container = document.getElementById('slab-tracker-list');
  if (!container) return;

  const slabs = DB.getAll('slabs').filter(s => {
    if (!term) return true;
    return (s.code || '').toLowerCase().includes(term) ||
           (s.type || '').toLowerCase().includes(term) ||
           (s.block_code || '').toLowerCase().includes(term);
  });

  if (!slabs.length) {
    container.innerHTML = `<div class="card"><div class="empty-state" style="padding:40px">
      <div class="empty-icon">🔳</div><h3>لا توجد ألواح</h3>
      <p>أضف ألواحاً عبر صفحة عمليات النشر</p></div></div>`;
    return;
  }

  const rows = slabs.map(s => `
    <tr style="cursor:pointer" onclick="showSlabTimeline(${s.id})" title="عرض الجدول الزمني">
      <td class="number"><strong>${s.code}</strong></td>
      <td>${s.type || '—'}</td>
      <td>${s.block_code || '—'}</td>
      <td><span class="badge badge-info">${s.grade || '—'}</span></td>
      <td class="number">${parseFloat(s.area_m2 || 0).toFixed(2)} م²</td>
      <td>${_slabStatusBadge(s.status)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showSlabTimeline(${s.id})">📋 الجدول الزمني</button></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="card" style="padding:0">
      <div class="data-table-wrapper">
        <table id="slab-tracker-table">
          <thead><tr>
            <th>رقم اللوح</th><th>النوع</th><th>الكتلة</th>
            <th>الدرجة</th><th>المساحة</th><th>الحالة</th><th>إجراءات</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// عرض الجدول الزمني الكامل للوح
function showSlabTimeline(slabId) {
  const slab   = DB.getAll('slabs').find(s => String(s.id) === String(slabId));
  if (!slab) return;

  const block     = DB.getAll('blocks').find(b => String(b.id) === String(slab.block_id));
  const cutting   = DB.getAll('cutting').find(c => String(c.id) === String(slab.cutting_id));
  const mfgStages = DB.getAll('manufacturing_stages')
    .filter(s => String(s.blockId) === String(slab.block_id) ||
                 String(s.block_id) === String(slab.block_id))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const quality = DB.getAll('quality_checks')
    .filter(q => String(q.slab_id) === String(slabId))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // إيجاد فاتورة المبيعات التي تضم هذا اللوح
  const salesInvoices = DB.getAll('sales').filter(s =>
    Array.isArray(s.items) && s.items.some(i =>
      String(i.slab_id) === String(slabId) || String(i.product_id) === String(slab.block_id)
    )
  );
  // أيضاً تحقق عبر حالة اللوح
  const relatedSale = slab.sale_id
    ? DB.getAll('sales').find(s => String(s.id) === String(slab.sale_id))
    : salesInvoices[0] || null;

  // إيجاد الشحنة
  const shipment = relatedSale
    ? DB.getAll('shipments').find(sh =>
        String(sh.invoice_id) === String(relatedSale.id) ||
        sh.invoice_number === relatedSale.invoice_number
      )
    : null;

  // إيجاد المورد
  const purchase = block
    ? DB.getAll('purchases').find(p =>
        Array.isArray(p.items) && p.items.some(i =>
          i.description && i.description.includes(block.code)
        )
      )
    : null;
  const supplier = purchase
    ? DB.getAll('suppliers').find(s => String(s.id) === String(purchase.supplier_id))
    : null;

  // بناء خطوات الجدول الزمني
  const steps = [];

  // 1. المورد والكتلة
  if (block) {
    steps.push({
      status: 'done',
      icon: '🪨',
      title: `شراء الكتلة الخام — ${block.code}`,
      date: block.received_date || purchase?.invoice_date || '—',
      details: [
        `النوع: ${block.type || '—'}`,
        `الأصل: ${block.origin || '—'}`,
        `الوزن: ${block.weight_tons || '—'} طن`,
        supplier ? `المورد: ${supplier.name}` : '',
        purchase ? `رقم فاتورة الشراء: ${purchase.invoice_number}` : '',
        canViewCost() ? `التكلفة: ${formatMoney(block.cost)}` : '',
      ].filter(Boolean),
    });
  }

  // 2. عملية النشر
  if (cutting) {
    steps.push({
      status: 'done',
      icon: '🔪',
      title: `نشر الكتلة — دُفعة ${cutting.batch_number}`,
      date: cutting.date || '—',
      details: [
        `المشغّل: ${cutting.operator || '—'}`,
        `عدد الألواح: ${cutting.slabs_count}`,
        `درجة أ: ${cutting.grade_a || 0} | درجة ب: ${cutting.grade_b || 0}`,
        `هالك: ${cutting.waste || 0} (${cutting.waste_percentage || 0}%)`,
      ],
    });
  }

  // 3. مراحل التصنيع
  mfgStages.forEach(m => {
    const cost = (m.directCost || 0) + (m.laborCost || 0) +
                 (m.materialCost || 0) + (m.transportCost || 0);
    steps.push({
      status: 'done',
      icon: '⚙️',
      title: `تصنيع — ${m.customStage || m.stage || '—'}`,
      date: m.date || '—',
      details: [
        `الكمية المنتجة: ${m.outputQuantity || 0} ${m.unit || ''}`,
        `هالك: ${m.wasteQuantity || 0}`,
        canViewCost() ? `التكلفة: ${formatMoney(cost)}` : '',
      ].filter(Boolean),
    });
  });

  // 4. فحوصات الجودة
  quality.forEach(q => {
    steps.push({
      status: 'done',
      icon: '✦',
      title: `فحص الجودة — ${q.grade || q.result || '—'}`,
      date: q.date || '—',
      details: [
        `المفتش: ${q.inspector || '—'}`,
        `الملاحظات: ${q.notes || '—'}`,
      ],
    });
  });

  // 5. فاتورة المبيعات
  if (relatedSale) {
    steps.push({
      status: 'done',
      icon: '🧾',
      title: `فاتورة مبيعات — ${relatedSale.invoice_number}`,
      date: relatedSale.invoice_date || '—',
      details: [
        `العميل: ${relatedSale.customer || '—'}`,
        canViewCost() ? `الإجمالي: ${formatMoney(relatedSale.total_amount)}` : '',
        `الحالة: ${relatedSale.status || '—'}`,
      ].filter(Boolean),
    });
  } else if (slab.status === 'in_stock') {
    steps.push({
      status: 'pending',
      icon: '🏪',
      title: 'في المخزن — بانتظار البيع',
      date: '—',
      details: [],
    });
  }

  // 6. الشحن
  if (shipment) {
    steps.push({
      status: shipment.status === 'delivered' ? 'done' : 'pending',
      icon: '🚛',
      title: `شحنة — ${shipment.shipment_number}`,
      date: shipment.shipment_date || '—',
      details: [
        `الوجهة: ${shipment.destination || '—'}`,
        `الحالة: ${shipment.status || '—'}`,
        shipment.delivery_date ? `تاريخ التسليم: ${formatDate(shipment.delivery_date)}` : '',
      ].filter(Boolean),
    });
  }

  // تكلفة اللوح الفعلية (للأدوار المصرحة)
  const slabCostSection = canViewCost() ? (() => {
    const actualCost = calculateActualSlabCost(slabId);
    return `<div class="card" style="margin-bottom:16px;border:1px solid var(--warning)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700">💰 التكلفة الفعلية للوح</span>
        <span style="font-size:20px;font-weight:900;color:var(--warning)">${formatMoney(actualCost)}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
        التكلفة الإجمالية شاملة الكتلة + التصنيع + غير المباشرة
      </div>
    </div>`;
  })() : '';

  // بناء HTML الجدول الزمني
  const timelineHTML = steps.map(step => `
    <div class="timeline-item ${step.status}">
      <div class="timeline-date">${step.date !== '—' ? formatDate(step.date) : '—'}</div>
      <div class="timeline-title">${step.icon} ${step.title}</div>
      ${step.details.length
        ? `<div class="timeline-details">${step.details.map(d => `<div>• ${d}</div>`).join('')}</div>`
        : ''}
    </div>
  `).join('');

  openModal(
    `📋 مسار اللوح — ${slab.code}`,
    `<div style="margin-bottom:12px">
       <span class="badge badge-info">${slab.type || '—'}</span>
       <span class="badge badge-gold" style="margin-right:6px">${slab.grade || '—'}</span>
       <span style="font-size:12px;color:var(--text-muted);margin-right:8px">${parseFloat(slab.area_m2||0).toFixed(2)} م²</span>
     </div>
     ${slabCostSection}
     <div class="slab-timeline">${timelineHTML || '<p style="color:var(--text-muted)">لا توجد بيانات مسجلة</p>'}</div>`
  );
}

// حالة اللوح كـ badge
function _slabStatusBadge(status) {
  const map = {
    in_stock:   ['badge-success', 'في المخزن'],
    sold:       ['badge-info',    'مباعة'],
    waste:      ['badge-danger',  'هالك'],
    processed:  ['badge-gold',    'مُصنَّع'],
    in_cutting: ['badge-warning', 'في القطع'],
  };
  const [cls, label] = map[status] || ['badge-info', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
