// ============================================
// لوحة تتبع الماكينات — Machines Tracking
// ============================================

async function renderMachines() {
  const content = document.getElementById('page-content');
  _destroyActiveCharts();

  const machines = DB.getAll('machines');
  const stages   = DB.getAll('manufacturing_stages');
  const today    = new Date();

  // احسب ساعات التشغيل منذ آخر صيانة لكل ماكينة
  function calcHoursSinceMaint(m) {
    const stages_m = stages.filter(s => s.machineId === m.id);
    return stages_m.reduce((sum, s) => sum + (s.operatingHours || 0), 0);
  }

  // احسب تكلفة الماكينة من مراحل التصنيع
  function calcMachineCost(m) {
    return stages.filter(s => s.machineId === m.id)
      .reduce((sum, s) => sum + ((s.operatingHours || 0) * (m.hourly_cost || 0)), 0);
  }

  const MAINT_ALERT_HOURS = 500;

  // تحديث تكلفة الماكينة في مراحل التصنيع
  function updateStageMachineCosts(machine) {
    const updated = stages.filter(s => s.machineId === machine.id);
    updated.forEach(s => {
      s.machineCost = (s.operatingHours || 0) * (machine.hourly_cost || 0);
      DB.save('manufacturing_stages', s);
    });
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>🏭 لوحة تتبع الماكينات</h2>
        <p>متابعة حالة الماكينات وتكاليف التشغيل والصيانة</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="openMachineModal()">＋ إضافة ماكينة</button>
      </div>
    </div>

    <!-- تنبيهات الصيانة -->
    <div id="machine-alerts"></div>

    <!-- جدول الماكينات -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">⚙️ الماكينات المسجلة</span>
      </div>
      <div class="data-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>اسم الماكينة</th>
              <th>الرقم التسلسلي</th>
              <th>آخر صيانة</th>
              <th>ساعات التشغيل الإجمالية</th>
              <th>ساعات منذ الصيانة</th>
              <th>تكلفة الساعة</th>
              <th>إجمالي التكلفة</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${machines.length === 0
              ? '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد ماكينات مسجلة</td></tr>'
              : machines.map(m => {
                  const hoursSince = calcHoursSinceMaint(m);
                  const totalCost  = calcMachineCost(m);
                  const needsMaint = hoursSince >= MAINT_ALERT_HOURS;
                  return `<tr>
                    <td><strong>${m.name || '—'}</strong></td>
                    <td class="number">${m.serial_number || '—'}</td>
                    <td>${m.last_maintenance ? formatDate(m.last_maintenance) : 'لم تتم بعد'}</td>
                    <td class="number">${(m.total_operating_hours || 0).toFixed(1)} ساعة</td>
                    <td class="number ${needsMaint ? 'text-danger' : ''}" style="font-weight:${needsMaint?'700':'400'}">
                      ${hoursSince.toFixed(1)} ساعة
                      ${needsMaint ? '<span class="badge badge-danger" style="margin-right:4px">صيانة!</span>' : ''}
                    </td>
                    <td class="number">${formatMoney(m.hourly_cost || 0)}</td>
                    <td class="number text-accent">${formatMoney(totalCost)}</td>
                    <td><span class="badge ${m.status === 'active' ? 'badge-success' : m.status === 'maintenance' ? 'badge-warning' : 'badge-danger'}">${
                      m.status === 'active' ? 'تشغيل' : m.status === 'maintenance' ? 'صيانة' : 'متوقفة'
                    }</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="openMachineModal(${m.id})">تعديل</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteMachine(${m.id})">حذف</button>
                    </td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- مخطط تكاليف الماكينات -->
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">📊 مقارنة تكاليف الماكينات</span></div>
      <canvas id="machines-cost-chart" height="80"></canvas>
    </div>
  `;

  // تنبيهات الصيانة
  const alertMachines = machines.filter(m => calcHoursSinceMaint(m) >= MAINT_ALERT_HOURS);
  const alertEl = document.getElementById('machine-alerts');
  if (alertEl && alertMachines.length > 0) {
    alertEl.innerHTML = '<div class="card" style="border-right:3px solid var(--danger);padding:12px 16px;margin-bottom:12px">' +
      '<strong>⚠️ تنبيه صيانة:</strong> الماكينات التالية تجاوزت ' + MAINT_ALERT_HOURS + ' ساعة منذ آخر صيانة:<br>' +
      alertMachines.map(m => `<span style="margin-left:8px;color:var(--danger)">• ${m.name}</span>`).join(' ') +
      '</div>';
  }

  // مخطط التكاليف
  if (machines.length > 0) {
    const ctx = document.getElementById('machines-cost-chart');
    if (ctx) {
      _registerChart('machines-cost', new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: machines.map(m => m.name),
          datasets: [{
            label: 'إجمالي التكلفة (ج.م)',
            data: machines.map(m => calcMachineCost(m)),
            backgroundColor: 'rgba(200,169,110,0.4)',
            borderColor: '#c8a96e',
            borderWidth: 2,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#8892aa', font: { family: 'Cairo' } } } },
          scales: {
            x: { ticks: { color: '#8892aa' }, grid: { color: 'rgba(42,47,63,0.8)' } },
            y: { ticks: { color: '#8892aa' }, grid: { color: 'rgba(42,47,63,0.8)' } }
          }
        }
      }));
    }
  }
}

function openMachineModal(id) {
  const m = id ? DB.findById('machines', id) : null;
  openModal(m ? 'تعديل ماكينة' : 'إضافة ماكينة جديدة', `
    <div class="form-grid">
      <div class="form-group form-full">
        <label>اسم الماكينة *</label>
        <input type="text" id="mach-name" value="${m ? m.name : ''}" placeholder="مثال: ماكينة قطع 1">
      </div>
      <div class="form-group">
        <label>الرقم التسلسلي</label>
        <input type="text" id="mach-serial" value="${m ? (m.serial_number || '') : ''}" placeholder="SN-001">
      </div>
      <div class="form-group">
        <label>تاريخ آخر صيانة</label>
        <input type="date" id="mach-maint" value="${m ? (m.last_maintenance || '') : ''}">
      </div>
      <div class="form-group">
        <label>تكلفة الساعة (ج.م)</label>
        <input type="number" id="mach-cost" value="${m ? (m.hourly_cost || 0) : 0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="mach-status">
          <option value="active"      ${(!m || m.status === 'active')      ? 'selected' : ''}>تشغيل</option>
          <option value="maintenance" ${m && m.status === 'maintenance'    ? 'selected' : ''}>صيانة</option>
          <option value="stopped"     ${m && m.status === 'stopped'        ? 'selected' : ''}>متوقفة</option>
        </select>
      </div>
    </div>
    <div style="text-align:left;margin-top:12px">
      <button class="btn btn-primary" onclick="saveMachine(${id || 0})">💾 حفظ</button>
    </div>
  `);
}

function saveMachine(id) {
  const name   = document.getElementById('mach-name').value.trim();
  if (!name) { showFieldError('mach-name', 'اسم الماكينة مطلوب'); return; }

  const machine = {
    id:                   id || DB.nextId('machines'),
    name,
    serial_number:        document.getElementById('mach-serial').value.trim(),
    last_maintenance:     document.getElementById('mach-maint').value || null,
    hourly_cost:          parseFloat(document.getElementById('mach-cost').value) || 0,
    status:               document.getElementById('mach-status').value,
    total_operating_hours: id ? (DB.findById('machines', id)?.total_operating_hours || 0) : 0,
  };

  DB.save('machines', machine);
  closeModal();
  toast(id ? 'تم تحديث الماكينة' : 'تمت إضافة الماكينة', 'success');
  renderMachines();
}

function deleteMachine(id) {
  if (!confirm('هل تريد حذف هذه الماكينة؟')) return;
  DB.remove('machines', id);
  toast('تم حذف الماكينة', 'success');
  renderMachines();
}
