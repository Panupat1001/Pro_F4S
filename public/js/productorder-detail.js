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
const yearFrom = (iso) => {
  try { const y = new Date(iso).getFullYear(); return Number.isFinite(y) ? y : ""; } catch { return ""; }
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

// 2) ถ้าไม่เจอค่อย fallback ไป productdetail (เผื่อระบบเก่า)
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

// ดึงชื่อสารเคมี (ถ้า backend ไม่ส่งมา)
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
  // ให้ priority กับ 'chem_quantity' ที่มาจาก JOIN ตาราง chem
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

// ---------- Fetch chems (prefer /productorder/:id/chems) ----------
async function fetchChemsByOrderId(orderId, productIdFallback){
  // 1) ลอง endpoint เฉพาะของ order ก่อน
  for (const url of ORDER_CHEMS_URLS(orderId)) {
    try {
      const data = await fetchJson(url);
      const items = Array.isArray(data) ? data : (data.items || data.rows || data.data || []);
      if (Array.isArray(items) && items.length) {
        const normalized = items.map(normalizeChemRow).filter(x => x.chem_id);
        if (normalized.length) {
          console.debug('[productorder-detail] chems from', url, 'sample:', normalized[0]);
          return normalized;
        }
      }
    } catch (e) {
      console.debug('[productorder-detail] fetch order chems fail:', url, String(e));
    }
  }

  // 2) fallback ไปตาม productId (กรณีระบบเก่า)
  if (!productIdFallback) return [];
  for (const url of PRODUCTDETAIL_URLS(productIdFallback)){
    try {
      const data = await fetchJson(url);
      const items = Array.isArray(data) ? data : (data.items || data.chems || data.rows || data.data || []);
      if (!Array.isArray(items) || items.length === 0) continue;

      const filtered = items.filter((n) => {
        const pid2 = Number(
          (n.product_id != null ? n.product_id :
          (n.p_id != null ? n.p_id :
          (n.productId != null ? n.productId : n.productid)))
        );
        return !Number.isFinite(pid2) ? true : (pid2 === Number(productIdFallback));
      });

      const normalized = filtered.map(normalizeChemRow).filter(x => x.chem_id);
      if (normalized.length){
        console.debug('[productorder-detail] chems from', url, 'sample:', normalized[0]);
        return normalized;
      }
    } catch (e) {
      console.debug('[productorder-detail] fetch productdetail fail:', url, String(e));
    }
  }
  console.debug('[productorder-detail] No chems found (orderId:', orderId, ', productId:', productIdFallback, ')');
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
    } catch (e) {
      console.debug('[productorder-detail] fetch chem name fail:', url, String(e));
    }
  }
  chemNameCache[chemId] = `ID ${chemId}`;
  return chemNameCache[chemId];
}
async function fillMissingChemNames(rows){
  const tasks = rows.map(async (r) => {
    const hasName = r.chem_name && String(r.chem_name).trim() !== "";
    if (hasName) return;
    const label = await fetchChemNameById(r.chem_id);
    r.chem_name = label || `ID ${r.chem_id}`;
  });
  await Promise.all(tasks);
}

// ---------- คำนวณสำหรับหน้าจอ ----------
function computeChemLines(chems, orderQtyGram) {
  const qty = Number(orderQtyGram || 0);
  return chems.map((r) => {
    const percent = Number(r.chem_percent || 0);
    const displayName = (r.chem_name && String(r.chem_name).trim() !== "")
      ? r.chem_name
      : `ID ${r.chem_id}`;

    const need = percent * qty * 0.01; // ต้องใช้(กรัม)
    const actual = need * 1.2;         // ผลิต(กรัม) = ต้องใช้ * 1.2

    // ใช้ chem_quantity ก่อน (จาก JOIN chem)
    const remainRaw = (r.chem_quantity ?? r.chem_remain ?? r.remain ?? r.chem_stock ?? 0);

    return {
      name: displayName,
      need,
      actual,
      remain: Number(remainRaw),
      noPercent: !(Number.isFinite(percent) && percent > 0)
    };
  });
}

// ---------- Main ----------
document.addEventListener("DOMContentLoaded", async () => {
  // อ่าน id จาก query หรือ path
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

  // ปุ่มแก้ไข
  const btnEdit = $("btnEdit");
  if (btnEdit) btnEdit.href = `/productorder/edit.html?id=${encodeURIComponent(proorderId)}`;

  // โหลดคำสั่งผลิต (หัวใบสั่ง)
  let order;
  try {
    const o = await fetchJson(ORDER_URL(proorderId));
    order = (o?.data ?? o?.item ?? o);
  } catch (e) {
    console.debug('[productorder-detail] load order fail:', e);
    showAlert("danger", "โหลดคำสั่งผลิตไม่สำเร็จ");
    return;
  }
  if (!order) {
    showAlert("danger", "ไม่พบข้อมูลคำสั่งผลิต");
    return;
  }

  // ฟิลด์หัวใบสั่ง
  let productId = order.product_id ?? order.productId ??
                  order.product?.product_id ?? order.product?.id ??
                  order.productIdRef ?? null;

  const lotRaw     = order.order_lot ?? order.lot ?? "";   // << ใช้เลขล็อตอย่างเดียว
  const orderDate  = order.order_date ?? order.orderDate ?? "";
  const expDate    = order.order_exp  ?? order.orderExp  ?? "";
  const qtyGram    = order.order_quantity ?? order.quantity ?? "";

  // ชื่อ/โค้ดสินค้า (ยังโหลดไว้แสดงชื่อสินค้าได้ตามเดิม)
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
    } catch (e) {
      console.debug('[productorder-detail] load product fail:', e);
    }
  }

  // === แสดงรหัสล็อต "เลขล็อตอย่างเดียว" ===
  $("o_id")   && ($("o_id").value   = `#${order.proorder_id ?? order.id ?? proorderId}`);
  $("p_name") && ($("p_name").value = productName || "-");
  $("o_lot")  && ($("o_lot").value  = String(lotRaw || "").trim() || "-");  // <<<< สำคัญ: ไม่ประกอบปี/รหัสสินค้า
  $("o_date") && ($("o_date").value = fmtDate(orderDate));
  $("o_exp")  && ($("o_exp").value  = fmtDate(expDate));
  $("o_qty")  && ($("o_qty").value  = (qtyGram !== "" && qtyGram != null) ? qtyGram : "-");

  // ===== โหลดสารเคมี (ใช้ /productorder/:id/chems เป็นหลัก) =====
  let baseChems = [];
  if (Array.isArray(order.chems) && order.chems.length){
    baseChems = order.chems.map(normalizeChemRow);
    console.debug('[productorder-detail] chems from order payload, sample:', baseChems[0]);
  } else {
    baseChems = await fetchChemsByOrderId(proorderId, productId);
  }

  // เติมชื่อสารเคมี (ถ้าขาด)
  await fillMissingChemNames(baseChems);

  // คำนวณ need/actual + ใช้ chem_quantity เป็น "ปริมาณคงเหลือ"
  const list = computeChemLines(baseChems, qtyGram);

  // เติมตาราง
  const tbody = $("chemTableBody");
  if (tbody) {
    tbody.innerHTML = list.length
      ? list.map((x) => `
          <tr>
            <td>
              ${esc(x.name)}${x.noPercent ? '<span class="badge bg-warning text-dark ms-2">ไม่มี %</span>' : ''}
            </td>
            <td>${Number(x.need).toFixed(2)}</td>
            <td>${Number.isFinite(Number(x.remain)) ? Number(x.remain).toFixed(2) : esc(String(x.remain))}</td>
            <td>${Number(x.actual).toFixed(2)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4" class="text-center text-muted">ไม่มีรายการสารเคมี</td></tr>`;
  }

  const alertBox = $("alertBox");
  if (alertBox) alertBox.classList.add("d-none");
});
