// ---------- Config ----------
const API_DETAIL = (id) => `/showdetail/${encodeURIComponent(id)}`;
// ถ้าคุณมี API สำหรับรายการวัตถุดิบ ให้ตั้งตรงนี้
// ตัวอย่าง: /productorderdetail/by-proorder?id=...
const API_MATS = (id) => `/showdetail/materials?id=${encodeURIComponent(id)}`; // ปรับตามหลังบ้าน

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
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
  if (isNaN(d)) return String(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const colorText  = (v) => ({0:"ปกติ",1:"ผิดปกติ"}[Number(v)] ?? "-");
const smellText  = (v) => ({0:"ไม่มีกลิ่น",1:"มีกลิ่น"}[Number(v)] ?? "-");
const statusText = (v) => ({0:"ร่าง",1:"ใช้งาน",2:"ยกเลิก"}[Number(v)] ?? "-");
const getParam   = (k, d=null) => new URLSearchParams(location.search).get(k) ?? d;

// ---------- Main ----------
async function loadDetail() {
  const id = getParam("id");
  if (!id) {
    $("#tbody-mats").innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">ไม่พบพารามิเตอร์ id</td></tr>`;
    return;
  }

const btnEdit = document.querySelector("#btnEdit");
if (btnEdit) btnEdit.href = `/showdetail/edit.html?id=${encodeURIComponent(id)}`;


  // เรียกข้อมูลหลัก (ตาม routes/showdetail.js: GET /showdetail/:id)
  let detail;
  try {
    const r = await fetch(API_DETAIL(id), { headers: { "Accept":"application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    detail = await r.json();
  } catch (err) {
    console.error("load detail error:", err);
    alert("โหลดข้อมูลรายละเอียดไม่สำเร็จ");
    return;
  }

  // หมายเหตุ: ปัจจุบัน API /showdetail/:id ที่คุณให้มา ส่งคืนเฉพาะ
  // id, product_name, product_image, batch_code, brand_name
  // หากต้องการฟิลด์เต็ม (PH, amount, price, order_date/exp, ...),
  // ให้ปรับ query หลังบ้านเพิ่มคอลัมน์ แล้วแมปด้านล่างให้ครบ

  $("#product_name").value   = detail.product_name ?? "-";
  $("#product_code").value   = detail.product_code ?? detail.product_id ?? ""; // ถ้ามีคอลัมน์เพิ่ม
  $("#order_quantity").value = fmtInt(detail.order_quantity ?? 0);
  $("#order_lot").value      = detail.batch_code ?? detail.order_lot ?? "";
  $("#order_date").value     = fmtDate(detail.order_date);
  $("#order_exp").value      = fmtDate(detail.order_exp);
  $("#ph").value             = detail.PH ?? detail.ph ?? "";
  $("#color").value          = colorText(detail.color);
  $("#smell").value          = smellText(detail.smell);
  $("#amount").value         = fmtInt(detail.amount ?? 0);
  $("#price").value          = fmtMoney(detail.price ?? 0);
  $("#status").value         = statusText(detail.status);

  // โหลดวัตถุดิบ/ส่วนผสม (ถ้ามี API)
  await loadMaterials(id);
}

async function loadMaterials(id) {
  try {
    const r = await fetch(API_MATS(id), { headers: { "Accept":"application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      $("#tbody-mats").innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">ไม่พบรายการ</td></tr>`;
      $("#matsSummary").textContent = "";
      return;
    }

    let total = 0;
    const html = rows.map((x) => {
      const name = x.chem_name ?? x.material_name ?? x.name ?? "-";
      const use  = x.use_quantity ?? x.quantity_use ?? x.qty ?? 0;
      const ppu  = x.price_per_unit ?? x.price_unit ?? x.unit_price ?? 0;
      const sum  = x.sum_price ?? (toNum(use) * toNum(ppu));
      total += toNum(sum);
      return `
        <tr>
          <td>${esc(name)}</td>
          <td class="text-end">${fmtInt(use)}</td>
          <td class="text-end">${fmtMoney(ppu)}</td>
          <td class="text-end">${fmtMoney(sum)}</td>
        </tr>`;
    }).join("");

    $("#tbody-mats").innerHTML = html;
    $("#matsSummary").textContent = `รวมทั้งสิ้น: ${fmtMoney(total)} บาท`;
  } catch (err) {
    console.warn("load materials skipped or error:", err);
    $("#tbody-mats").innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">ไม่มีข้อมูลวัตถุดิบ</td></tr>`;
    $("#matsSummary").textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", loadDetail);

function renderTable(list){
  const tbody = $("chemTableBody");
  const tfoot = $("chemTableFoot");
  if (!tbody) return;

  const orderedMap = loadOrderedMap(CURRENT_PROORDER_ID);

  if (!Array.isArray(list) || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">ไม่มีรายการสารเคมี</td></tr>`;
    if (tfoot) tfoot.innerHTML = "";
    return;
  }

  // แสดงแถวรายการ
  let totalNeed = 0;
  let totalShort = 0;
  let totalCost = 0;

  const rowsHtml = list.map((x) => {
    const already = !!orderedMap[x.chemId];
    const noNeed  = !(x.need > 0);
    const noShort = x.actual <= 0;
    const disable = already || noNeed || noShort;

    const percentCell = x.hasPercent
      ? `${Number(x.percent).toFixed(2)}%`
      : `<span class="badge bg-warning text-dark">ไม่มี %</span>`;

    const btnText = already ? 'เพิ่มแล้ว ✓' : (noShort ? 'พอเพียง' : 'สั่งซื้อ');

    // สะสมไว้ทำสรุป
    totalNeed  += Number(x.need || 0);
    totalShort += Number(x.actual || 0);
    totalCost  += Number(x.needPrice || 0);

    return `
      <tr data-chem-id="${x.chemId}">
        <td>${esc(x.name)}</td>
        <td class="text-end">${percentCell}</td>
        <td class="text-end need-cell">${Number(x.need).toFixed(2)}</td>
        <td class="text-end remain-cell">${Number.isFinite(Number(x.remain)) ? Number(x.remain).toFixed(2) : esc(String(x.remain))}</td>
        <td class="text-end actual-cell">${Number(x.actual).toFixed(2)}</td>
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
  }).join("");

  tbody.innerHTML = rowsHtml;

  // แสดงสรุปใน tfoot
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="text-end fw-bold">รวม</td>
        <td></td>
        <td class="text-end fw-bold">${totalNeed.toFixed(2)}</td>
        <td></td>
        <td class="text-end fw-bold">${totalShort.toFixed(2)}</td>
        <td class="text-end">
          <div class="small text-muted">ประมาณการต้นทุนรวม: ${totalCost.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} บาท</div>
        </td>
      </tr>
    `;
  }
}

