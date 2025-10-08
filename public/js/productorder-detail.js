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
    chem_id: Number(n.chem_id ?? n.id ?? 0),
    chem_percent: Number(n.chem_percent ?? n.percent ?? n.percentage ?? 0),
    chem_name: n.chem_name ?? n.name ?? "",
    inci_name: n.inci_name ?? "",
    product_id: Number(n.product_id ?? n.p_id ?? n.productId ?? n.productid ?? 0),
    chem_quantity: chemQty,
    chem_remain: chemQty,
    price_gram: Number(n.price_gram ?? n.chem_price_gram ?? n.price ?? 0), // ✅ เพิ่ม
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

// ---------- คำนวณ Need / Actual / ราคา ----------
function computeChemLines(chems, orderQtyGram) {
  const qty = Number(orderQtyGram || 0);
  return chems.map((r) => {
    const p = Number(r.chem_percent || 0);
    const percent = (p > 0 && p <= 1) ? (p * 100) : p; // รองรับ 0..1 เป็นสัดส่วน
    const hasPercent = percent > 0;

    const need = hasPercent ? (percent * qty * 0.01) : 0;
    const remainRaw = (r.chem_quantity ?? r.chem_remain ?? r.remain ?? r.chem_stock ?? 0);
    const actual = Math.max(need - Number(remainRaw || 0), 0);

    // ✅ เพิ่มคำนวณราคาต่อสาร โดยไม่ต้องแสดง
    const pricePerGram = Number(r.price_gram ?? r.chem_price_gram ?? 0);
    const needPrice = need * pricePerGram; // ราคาของสารนี้

    return {
      chemId: r.chem_id,
      prodetailId: r.prodetail_id,
      name: r.chem_name ?? `ID ${r.chem_id}`,
      percent, hasPercent,
      need, remain: Number(remainRaw),
      actual,
      // ✅ เก็บไว้เงียบ ๆ เพื่อใช้รวมภายหลัง
      pricePerGram,
      needPrice,
    };
  });
}


let CURRENT_PROORDER_ID = 0;
let CURRENT_LINES = [];
let ORDER_STATUS = 0; // ✅ เพิ่มตัวแปรสถานะ

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

  ORDER_STATUS = Number(order.status ?? order.order_status ?? 0) || 0; // ✅ เพิ่ม

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
  CURRENT_LINES = computeChemLines(baseChems, qtyGram);

  renderTable(CURRENT_LINES);
  refreshProduceButton();

  const alertBox = $("alertBox");
  if (alertBox) alertBox.classList.add("d-none");
});

// ---------- Render ----------
function renderTable(list){
  const tbody = $("chemTableBody");
  if (!tbody) return;

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
            <td class="need-cell">${Number(x.need).toFixed(2)}</td>
            <td class="remain-cell">${Number.isFinite(Number(x.remain)) ? Number(x.remain).toFixed(2) : esc(String(x.remain))}</td>
            <td class="actual-cell">${Number(x.actual).toFixed(2)}</td>
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

// ---------- ปุ่มผลิตรวม ----------
function refreshProduceButton() {
  const btnProduce = $("btnProduce");
  if (!btnProduce) return;

  const enoughStock =
    (CURRENT_LINES.length > 0) &&
    CURRENT_LINES.every(x => Number(x.remain) >= Number(x.need));

  const canProduce = (ORDER_STATUS !== 1) && enoughStock;

  btnProduce.disabled = !canProduce;
  btnProduce.title = (ORDER_STATUS === 1)
    ? 'ผลิตแล้ว (status = 1)'
    : (enoughStock ? '' : 'ต้องมีปริมาณคงเหลือของทุกสารมากกว่าหรือเท่ากับปริมาณที่ต้องการใช้');
}

// ===== helper: ยิง API =====
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

async function postChemDecrease(payload) {
  const urls = ['/chem/decrease-quantity', '/api/chem/decrease-quantity'];
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

// ===== ปุ่ม "ผลิตสินค้า" =====
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('#btnProduce');
  if (!btn) return;
  ev.preventDefault();
  if (btn.disabled || btn.dataset.busy === '1') return;

  const targets = (CURRENT_LINES || []).filter(x => Number(x.need) > 0);
  if (targets.length === 0) {
    showAlert('warning', 'ไม่มีปริมาณที่ต้องใช้');
    return;
  }

  const totalNeed = targets.reduce((s, x) => s + Number(x.need || 0), 0);
  if (!confirm(`ยืนยัน "ผลิตสินค้า" โดยตัดสต็อกทั้งหมด ${targets.length} รายการ\nรวม ${totalNeed.toFixed(2)} กรัม ?`)) return;

  btn.dataset.busy = '1';
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'กำลังตัดสต็อก...';

  try {
    const results = await Promise.allSettled(
      targets.map(t => postChemDecrease({ chem_id: t.chemId, orderuse: Number(t.need) }))
    );

    let ok = 0, fail = 0;
    results.forEach((r, idx) => {
      const t = targets[idx];
      if (r.status === 'fulfilled') ok++; else fail++;
    });

    refreshProduceButton();

    if (fail === 0) {
      showAlert('success', `ผลิตสำเร็จ ตัดสต็อก ${ok} รายการ`);
    } else if (ok === 0) {
      showAlert('danger', `ผลิตไม่สำเร็จทั้งหมด (${fail} รายการ)`);
    } else {
      showAlert('warning', `สำเร็จ ${ok} รายการ / ล้มเหลว ${fail} รายการ`);
    }
  } catch (e) {
    showAlert('danger', 'ตัดสต็อกไม่สำเร็จ: ' + e.message);
  }
  // ===== เพิ่มอัปเดตสถานะและราคาหลังผลิตสำเร็จ =====
    try {
      const res2 = await fetch(`/productorder/produce/${CURRENT_PROORDER_ID}`, {
        method: 'PUT',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(data2.error || `HTTP ${res2.status}`);

      showAlert('success', `อัปเดตสถานะเรียบร้อย (status=1), รวมราคา ${Number(data2.total_price || 0).toFixed(2)} บาท`);
    } catch (e) {
      showAlert('warning', 'ตัดสต็อกสำเร็จ แต่ยังอัปเดตสถานะ/ราคาไม่ได้: ' + e.message);
    }
  btn.removeAttribute('data-busy');
  btn.textContent = oldText;
});

// ===== ปุ่ม "สั่งซื้อ" ต่อรายการสาร =====
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.order-chem');
  if (!btn) return;
  ev.preventDefault();

  // กันคลิกซ้ำ/ใบงานถูกผลิตไปแล้ว
  if (btn.disabled || btn.dataset.ordered === '1') return;
  if (ORDER_STATUS === 1) {
    showAlert('warning', 'คำสั่งผลิตนี้ผลิตแล้ว (status=1) ไม่สามารถสั่งซื้อเพิ่มได้');
    return;
  }

  const chemId      = Number(btn.dataset.chemId || btn.getAttribute('data-chem-id'));
  const prodetailId = Number(btn.dataset.prodetailId || btn.getAttribute('data-prodetail-id')) || undefined;
  const qty         = Number(btn.dataset.qty || btn.getAttribute('data-qty')); // ใช้ actual ที่ต้องซื้อ

  if (!chemId || !Number.isFinite(qty) || qty <= 0) {
    showAlert('warning', 'ปริมาณที่ต้องซื้อไม่ถูกต้อง');
    return;
  }

  if (!confirm(`ยืนยันสั่งซื้อสารเคมี ID ${chemId}\nจำนวน ${qty.toFixed(2)} กรัม ?`)) return;

  // Busy UI
  const oldHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'กำลังเพิ่ม...';

  try {
    // หลังบ้านต้องรับ proorder_id, chem_id, orderuse
    await postPOD({
      proorder_id: CURRENT_PROORDER_ID,
      chem_id: chemId,
      orderuse: qty,
      prodetail_id: prodetailId // ถ้ามี
    });

    // mark ว่าสั่งแล้ว (กันคลิกซ้ำทุกปุ่มที่เป็น chemId เดียวกัน)
    const map = loadOrderedMap(CURRENT_PROORDER_ID);
    map[chemId] = { qty, at: Date.now() };
    saveOrderedMap(CURRENT_PROORDER_ID, map);
    markChemOrderedUI(chemId);

    showAlert('success', `เพิ่มคำสั่งซื้อสาร ID ${chemId} จำนวน ${qty.toFixed(2)} กรัม สำเร็จ`);
  } catch (e) {
    // rollback UI เมื่อ error
    btn.disabled = false;
    btn.innerHTML = oldHtml;
    showAlert('danger', `เพิ่มคำสั่งซื้อไม่สำเร็จ: ${e.message || e}`);
  }
});
