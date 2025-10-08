// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const getParam = (k, d=null) => new URLSearchParams(location.search).get(k) ?? d;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const toNum = (v, d=0) => {
  if (typeof v === "string") v = v.replace(/,/g,"");
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const fmtInt   = (n) => Number(toNum(n)).toLocaleString();
const fmtMoney = (n) => Number(toNum(n)).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate  = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const statusText = (v) => ({0:"ร่าง",1:"ใช้งาน",2:"ยกเลิก"}[Number(v)] ?? "-");

// ---------- Endpoints ----------
const API_DETAIL = (id) => `/showdetail/${encodeURIComponent(id)}`;
const API_MATS = (id) => `/showdetail/materials?id=${encodeURIComponent(id)}`;

// ช่องทางอัปเดต: ลองหลายแบบเพื่อรองรับหลังบ้าน
const API_UPDATE_CANDIDATES = (id) => [
  `/productorder/${encodeURIComponent(id)}`,           // PUT body: { PH, color, smell, amount }
  `/api/productorder/${encodeURIComponent(id)}`,
  `/productorder/update/${encodeURIComponent(id)}`,
  `/api/productorder/update/${encodeURIComponent(id)}`
];

// ---------- Alert ----------
function showAlert(type, msg){
  const el = $("#alertBox");
  if (!el) return alert(msg);
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}

// ---------- Load detail & materials ----------
async function loadDetail() {
  const id = getParam("id");
  if (!id) {
    $("#tbody-mats").innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">ไม่พบพารามิเตอร์ id</td></tr>`;
    return;
  }

  // โหลดหัวใบงาน
  let detail;
  try {
    const r = await fetch(API_DETAIL(id), { headers: { "Accept":"application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    detail = await r.json();
  } catch (e) {
    console.error("load detail error:", e);
    showAlert("danger", "โหลดข้อมูลรายละเอียดไม่สำเร็จ");
    return;
  }

  // เติมค่า
  $("#product_name").value   = detail.product_name ?? "-";
  $("#product_code").value   = detail.product_code ?? detail.product_id ?? "-";
  $("#order_quantity").value = fmtInt(detail.order_quantity ?? 0);
  $("#order_lot").value      = detail.order_lot ?? "";
  $("#order_date").value     = fmtDate(detail.order_date);
  $("#order_exp").value      = fmtDate(detail.order_exp);
  $("#price").value          = fmtMoney(detail.price ?? 0);
  $("#status").value         = statusText(detail.status);

  // ช่องแก้ไขได้
  $("#ph").value     = detail.PH ?? detail.ph ?? "";
  $("#color").value  = (detail.color ?? "") === "" ? "" : String(detail.color);
  $("#smell").value  = (detail.smell ?? "") === "" ? "" : String(detail.smell);
  $("#amount").value = (detail.amount ?? "") === "" ? "" : String(detail.amount);

  // โหลดรายการวัตถุดิบ
  await loadMaterials(id);
}

async function loadMaterials(id) {
  const tbody = $("#tbody-mats");
  const sumEl = $("#matsSummary");
  try {
    const r = await fetch(API_MATS(id), { headers: { "Accept":"application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">ไม่พบรายการ</td></tr>`;
      if (sumEl) sumEl.textContent = "";
      return;
    }

    let total = 0;
    const html = rows.map((x, i) => {
      const name = x.chem_name ?? x.material_name ?? x.name ?? `รายการที่ ${i+1}`;
      const use  = toNum(x.use_quantity ?? x.quantity_use ?? x.qty ?? 0);
      const ppu  = toNum(x.unit_price ?? x.price_per_unit ?? x.price_unit ?? x.price_gram ?? 0);
      const sum  = toNum(x.sum_price ?? (use * ppu));
      total += sum;
      return `
        <tr>
          <td>${esc(name)}</td>
          <td class="text-end">${fmtInt(use)}</td>
          <td class="text-end">${fmtMoney(ppu)}</td>
          <td class="text-end">${fmtMoney(sum)}</td>
        </tr>`;
    }).join("");

    tbody.innerHTML = html;
    if (sumEl) sumEl.textContent = `รวมทั้งสิ้น: ${fmtMoney(total)} บาท`;
  } catch (e) {
    console.warn("materials error:", e);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">โหลดวัตถุดิบล้มเหลว</td></tr>`;
    if (sumEl) sumEl.textContent = "";
  }
}

// ---------- Save (PUT) ----------
async function updateOrder(id, payload){
  let lastErr;
  for (const url of API_UPDATE_CANDIDATES(id)) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("all endpoints failed");
}

// ---------- Events ----------
document.addEventListener("DOMContentLoaded", () => {
  const id = getParam("id");
  if (!id) {
    showAlert("danger", "ไม่พบ id");
    return;
  }

  loadDetail();

  $("#btnSave")?.addEventListener("click", async () => {
    const phRaw    = $("#ph").value.trim();
    const colorRaw = $("#color").value;
    const smellRaw = $("#smell").value;
    const amountRaw= $("#amount").value.trim();

    // validate
    const ph = phRaw === "" ? null : Number(phRaw);
    if (ph != null && (!Number.isFinite(ph) || ph < 0 || ph > 14)) {
      showAlert("warning", "ค่า PH ต้องอยู่ระหว่าง 0 - 14");
      return;
    }
    const color  = colorRaw === "" ? null : Number(colorRaw);
    const smell  = smellRaw === "" ? null : Number(smellRaw);
    const amount = amountRaw === "" ? null : Number(amountRaw);
    if (amount != null && (!Number.isInteger(amount) || amount < 0)) {
      showAlert("warning", "จำนวน (ชิ้น) ต้องเป็นจำนวนเต็มไม่ติดลบ");
      return;
    }

    const payload = {};
    if (ph != null)     payload.PH = ph;         // float(3,2)
    if (color != null)  payload.color = color;   // tinyint(1)
    if (smell != null)  payload.smell = smell;   // tinyint(1)
    if (amount != null) payload.amount = amount; // int(10)

    if (Object.keys(payload).length === 0) {
      showAlert("warning", "ไม่มีข้อมูลที่เปลี่ยนแปลง");
      return;
    }

    const btn = $("#btnSave");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> กำลังบันทึก...';

    try {
      await updateOrder(id, payload);
      showAlert("success", "บันทึกสำเร็จ");
      // รีโหลดค่าเพื่อความชัวร์
      loadDetail();
    } catch (e) {
      showAlert("danger", "บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });
});
