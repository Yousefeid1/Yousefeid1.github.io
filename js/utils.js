// ============================================
// دوال مساعدة مشتركة - Utility Functions
// ============================================

// تنسيق العملة (يعتمد على formatMoney الموجودة في app.js)
function formatCurrency(n, currency) {
  return formatMoney(n, currency);
}

// حساب عدد الأيام بين تاريخ معين واليوم
function daysBetween(dateStr) {
  if (!dateStr) return 0;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  var today = new Date();
  return Math.floor((today - d) / 86400000);
}

// تقصير الأرقام الكبيرة (مثال: 1500000 → 1.5م)
function shortNumber(n) {
  n = parseFloat(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'م';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'ك';
  return n.toFixed(0);
}

// إظهار رسالة تنبيه (يعتمد على toast الموجودة في app.js)
function showToast(msg, type) {
  toast(msg, type || 'success');
}

// تسجيل النشاط (يعتمد على api.logActivity)
function logActivity(action, entity, entityId, desc) {
  try { api.logActivity(action, entity, entityId, desc); } catch (e) {}
}
