// /public/js/productorder-detail.js

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const getParam = (k, d=null) => new URLSearchParams(location.search).get(k) ?? d;
const toInt = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const esc = (s) => s == null ? "" : String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");
const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
function showAlert(type, msg){
  const alertBox = $("alertBox");
  if (!alertBox) { alert(msg); return; }
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
}
function num(v, d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }

// ---------- Endpoints ----------
const ORDER_URL   = (id)  => `/productorder/${id}`;
const PRODUCT_URL = (pid) => `/product/${pid}`;

// 1) พยายามใช้ของ order ก่อน (JOIN chem ใน backend)
const ORDER_CHEMS_URLS = (id) => [
  `/productorder/${id}/chems`,
  `/api/productorder/${id}/chems`,
];

// 2) fallback productdetail
const PRODUCTDETAIL_URLS = (productId) => [
  `/productdetail/list?product_id=${productId}`,
  `/productdetail/read?product_id=${productId}`,
  `/productdetail/detail?product_id=${productId}`,
  `/productdetail/chems?product_id=${productId}`,
  `/productdetail/read/${productId}`,
  `/productdetail/detail/${productId}`,
  `/productdetail/chems/${productId}`,
  `/api/productdetail/list?product_id=${productId}`,
  `/api/productdetail/read?product_id=${productId}`,
  `/api/productdetail/detail?product_id=${productId}`,
  `/api/productdetail/chems?product_id=${productId}`,
  `/api/productdetail/read/${productId}`,
  `/api/productdetail/detail/${productId}`,
  `/api/productdetail/chems/${productId}`,
];

// ดึงชื่อสารเคมี
const CHEM_DETAIL_URLS = (chemId) => [
  `/chem/detail?id=${chemId}`,
  `/chem/read/${chemId}`,
  `/chem/${chemId}`,
  `/api/chem/detail?id=${chemId}`,
  `/api/chem/read/${chemId}`,
  `/api/chem/${chemId}`,
];

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" }});
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// ---------- Normalizers ----------
function pickChemQuantity(n){
  return num(
    n.chem_quantity ??
    n.chemqty ??
    n.quantity_left ??
    n.chem_qty ??
    n.qty_left ??
    n.qty ??
    n.quantity ??
    n.chem_remain ??
    n.remain ??
    n.chem_stock ??
    0
  );
}
function normalizeChemRow(n){
  const chemQty = pickChemQuantity(n);
  return {
    prodetail_id: Number(n.prodetail_id ?? n.prodetailId ?? n.prodetailid ?? 0),
    chem_id: Number((n.chem_id != null ? n.chem_id : n.id)),
    chem_percent: Number(
      (n.chem_percent != null ? n.chem_percent :
      (n.percent != null ? n.percent :
      (n.percentage != null ? n.percentage : 0)))
    ),
    chem_name: (n.chem_name != null ? n.chem_name :
               (n.name != null ? n.name : "")),
    inci_name: (n.inci_name != null ? n.inci_name : ""),
    product_id: Number(
      (n.product_id != null ? n.product_id :
      (n.p_id != null ? n.p_id :
      (n.productId != null ? n.productId : n.productid)))
    ),
    chem_quantity: chemQty,
    chem_remain: chemQty
  };
}

// ---------- Fetch chems ----------
async function fetchChemsByOrderId(orderId, productIdFallback){
  for (const url of ORDER_CHEMS_URLS(orderId)) {
    try {
      const data = await fetchJson(url);
      const items = Array.isArray(data) ? data : (data.items || data.rows || data.data || []);
      if (Array.isArray(items) && items.length) {
        const normalized = items.map(normalizeChemRow).filter(x => x.chem_id);
        if (normalized.length) return normalized;
      }
    } catch {}
  }
  if (!productIdFallback) return [];
  for (const url of PRODUCTDETAIL_URLS(productIdFallback)){
    try {
      const data = await fetchJson(url);
      const items = Array.isArray(data) ? data : (data.items || data.chems || data.rows || data.data || []);
      if (!Array.isArray(items) || items.length === 0) continue;

      const filtered = items.filter((n) => {
        const pid2 = Number(n.product_id ?? n.p_id ?? n.productId ?? n.productid);
        return !Number.isFinite(pid2) ? true : (pid2 === Number(productIdFallback));
      });
      const normalized = filtered.map(normalizeChemRow).filter(x => x.chem_id);
      if (normalized.length) return normalized;
    } catch {}
  }
  return [];
}

// ---------- เติมชื่อสารเคมี ----------
const chemNameCache = Object.create(null);
async function fetchChemNameById(chemId) {
  if (!chemId) return null;
  if (chemNameCache[chemId]) return chemNameCache[chemId];
  for (const url of CHEM_DETAIL_URLS(chemId)) {
    try {
      const data = await fetchJson(url);
      const c = Array.isArray(data) ? (data[0] || null) : data;
      if (!c) continue;
      const name = c.chem_name || (c.chem && c.chem.chem_name) || c.name || "";
      const inci = c.inci_name || "";
      const label = name ? (inci ? `${name} (${inci})` : name) : (inci || null);
      if (label) {
        chemNameCache[chemId] = label;
        return label;
      }
    } catch {}
  }
  chemNameCache[chemId] = `ID ${chemId}`;
  return chemNameCache[chemId];
}
async function fillMissingChemNames(rows){
  await Promise.all(rows.map(async (r) => {
    if (r.chem_name && String(r.chem_name).trim() !== "") return;
    const label = await fetchChemNameById(r.chem_id);
    r.chem_name = label || `ID ${r.chem_id}`;
  }));
}

// ---------- คำนวณ Need / Actual ----------
// need = (% * qty) / 100
// actual = max( need - chem_quantity, 0 )
function computeChemLines(chems, orderQtyGram) {
  const qty = Number(orderQtyGram || 0);
  return chems.map((r) => {
    const percent = Number(r.chem_percent || 0);
    const hasPercent = Number.isFinite(percent) && percent > 0;

    const displayName = (r.chem_name && String(r.chem_name).trim() !== "")
      ? r.chem_name
      : `ID ${r.chem_id}`;

    const need = hasPercent ? (percent * qty * 0.01) : 0;
    const remainRaw = (r.chem_quantity ?? r.chem_remain ?? r.remain ?? r.chem_stock ?? 0);
    const actual = Math.max(need - Number(remainRaw || 0), 0);

    return {
      chemId: r.chem_id,
      prodetailId: r.prodetail_id,
      name: displayName,
      percent,
      hasPercent,
      need,
      remain: Number(remainRaw),
      actual
    };
  });
}

// ===== One-click lock helpers =====
const orderedKey = (proorderId) => `poOrdered:${proorderId}`;
function loadOrderedMap(proorderId){
  try { return JSON.parse(localStorage.getItem(orderedKey(proorderId)) || '{}'); }
  catch { return {}; }
}
function saveOrderedMap(proorderId, map){
  try { localStorage.setItem(orderedKey(proorderId), JSON.stringify(map)); } catch {}
}
function markChemOrderedUI(chemId){
  document.querySelectorAll(`.order-chem[data-chem-id="${chemId}"]`).forEach(b=>{
    b.dataset.ordered = '1';
    b.disabled = true;
    b.classList.remove('btn-success');
    b.classList.add('btn-secondary');
    b.textContent = 'เพิ่มแล้ว ✓';
  });
}

let CURRENT_PROORDER_ID = 0;

// ---------- Main ----------
document.addEventListener("DOMContentLoaded", async () => {
  let proorderId = toInt(getParam("id") ?? getParam("proorder_id"), 0);
  if (!proorderId){
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!Number.isNaN(Number(last))) proorderId = Number(last);
  }
  if (!proorderId){
    showAlert("danger", "ไม่พบรหัสการผลิต (id)");
    return;
  }
  CURRENT_PROORDER_ID = proorderId;

  const btnEdit = $("btnEdit");
  if (btnEdit) btnEdit.href = `/productorder/edit.html?id=${encodeURIComponent(proorderId)}`;

  let order;
  try {
    const o = await fetchJson(ORDER_URL(proorderId));
    order = (o?.data ?? o?.item ?? o);
  } catch {
    showAlert("danger", "โหลดคำสั่งผลิตไม่สำเร็จ");
    return;
  }
  if (!order) {
    showAlert("danger", "ไม่พบข้อมูลคำสั่งผลิต");
    return;
  }

  let productId = order.product_id ?? order.productId ?? order.product?.product_id ?? order.product?.id ?? null;
  const lotRaw     = order.order_lot ?? order.lot ?? "";
  const orderDate  = order.order_date ?? order.orderDate ?? "";
  const expDate    = order.order_exp  ?? order.orderExp  ?? "";
  const qtyGram    = order.order_quantity ?? order.quantity ?? "";

  let productName = order.product_name ?? order.productName ?? null;
  let productCode = order.product_code ?? order.productCode ?? null;

  if ((!productName || !productCode) && productId){
    try {
      const p = await fetchJson(PRODUCT_URL(productId));
      const prod = (p?.data ?? p?.item ?? p);
      if (prod){
        productName = productName || prod.product_name || prod.name || null;
        productCode = productCode || prod.product_code || prod.product_fdanum || prod.notify_no || null;
      }
    } catch {}
  }

  $("o_id")   && ($("o_id").value   = `#${order.proorder_id ?? order.id ?? proorderId}`);
  $("p_name") && ($("p_name").value = productName || "-");
  $("o_lot")  && ($("o_lot").value  = String(lotRaw || "").trim() || "-");
  $("o_date") && ($("o_date").value = fmtDate(orderDate));
  $("o_exp")  && ($("o_exp").value  = fmtDate(expDate));
  $("o_qty")  && ($("o_qty").value  = (qtyGram !== "" && qtyGram != null) ? qtyGram : "-");

  let baseChems = [];
  if (Array.isArray(order.chems) && order.chems.length){
    baseChems = order.chems.map(normalizeChemRow);
  } else {
    baseChems = await fetchChemsByOrderId(proorderId, productId);
  }
  await fillMissingChemNames(baseChems);
  const list = computeChemLines(baseChems, qtyGram);

  const tbody = $("chemTableBody");
  if (tbody) {
    const orderedMap = loadOrderedMap(CURRENT_PROORDER_ID);
    tbody.innerHTML = list.length
      ? list.map((x) => {
          const already = !!orderedMap[x.chemId];
          const noNeed  = !(x.need > 0);
          const noShort = x.actual <= 0;
          const disable = already || noNeed || noShort;

          const percentCell = x.hasPercent
            ? `${Number(x.percent).toFixed(2)}%`
            : `<span class="badge bg-warning text-dark">ไม่มี %</span>`;

          const btnText = already ? 'เพิ่มแล้ว ✓' : (noShort ? 'พอเพียง' : 'สั่งซื้อ');

          return `
            <tr data-chem-id="${x.chemId}">
              <td>${esc(x.name)}</td>
              <td>${percentCell}</td>
              <td>${Number(x.need).toFixed(2)}</td>
              <td>${Number.isFinite(Number(x.remain)) ? Number(x.remain).toFixed(2) : esc(String(x.remain))}</td>
              <td>${Number(x.actual).toFixed(2)}</td>
              <td class="text-end">
                <button
                  type="button"
                  class="btn btn-sm ${disable ? 'btn-secondary' : 'btn-success'} order-chem"
                  data-chem-id="${x.chemId}"
                  data-prodetail-id="${x.prodetailId}"
                  data-qty="${Number(x.actual).toFixed(2)}"
                  data-ordered="${already ? '1' : '0'}"
                  ${disable ? 'disabled' : ''}>
                  ${btnText}
                </button>
              </td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="6" class="text-center text-muted">ไม่มีรายการสารเคมี</td></tr>`;
  }

  const alertBox = $("alertBox");
  if (alertBox) alertBox.classList.add("d-none");
});

// ===== helper: ยิงไปสร้าง/บวกเพิ่ม productorderdetail =====
async function postPOD(payload) {
  const urls = ['/productorderdetail/create','/api/productorderdetail/create'];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || String(res.status));
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('all endpoints failed');
}

// ===== จับคลิกปุ่ม "สั่งซื้อ" =====
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.order-chem');
  if (!btn) return;
  ev.preventDefault();
  if (btn.disabled || btn.dataset.busy === '1' || btn.dataset.ordered === '1') return;

  const proorderId  = CURRENT_PROORDER_ID || toInt(getParam('id') ?? getParam('proorder_id'), 0);
  const chemId      = toInt(btn.dataset.chemId, 0);
  const prodetailId = toInt(btn.dataset.prodetailId, 0);
  const qty         = Number(btn.dataset.qty || 0);   // จำนวนที่ “ต้องสั่งเพิ่ม”

  if (!proorderId || !chemId || !(qty > 0)) {
    showAlert('warning', 'ข้อมูลไม่ครบ หรือไม่มีจำนวนที่ต้องสั่งเพิ่ม (qty <= 0)');
    return;
  }

  btn.dataset.busy = '1';
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'กำลังเพิ่ม...';

  try {
    // ✅ ส่งเฉพาะ orderuse
    const payload = {
      proorder_id: proorderId,
      chem_id: chemId,
      orderuse: qty,
      prodetail_id: prodetailId || null
    };

    // กันพลาด: ตัด field orderbuy ทิ้งถ้ามีหลงมา
    delete payload.orderbuy;

    await postPOD(payload);

    const map = loadOrderedMap(proorderId);
    map[chemId] = true;
    saveOrderedMap(proorderId, map);
    markChemOrderedUI(chemId);

    showAlert('success', 'บันทึกรายการสั่งซื้อเรียบร้อย');
  } catch (e) {
    btn.removeAttribute('data-busy');
    btn.disabled = false;
    btn.textContent = oldText;
    showAlert('danger', 'เพิ่มรายการไม่สำเร็จ: ' + e.message);
  }
});

