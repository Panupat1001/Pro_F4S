// public/js/productdetail-edit.js
document.addEventListener("DOMContentLoaded", () => {
  // ----- รับ draft จาก sessionStorage -----
  const draftStr = sessionStorage.getItem("productdetailDraft");
  if (!draftStr) {
    alert("ไม่พบข้อมูลร่าง กรุณาเริ่มจากหน้าก่อนหน้า");
    location.href = "/productdetail/create.html";
    return;
  }
  const draft = JSON.parse(draftStr);

  // ----- DOM -----
  const pName = document.getElementById("p_name");
  const pCode = document.getElementById("p_code");
  const pStatus = document.getElementById("p_status");
  const pBrand = document.getElementById("p_brand");
  const pNotify = document.getElementById("p_notify");

  const chemSelectEl = document.getElementById("chem_id");
  const percentInput = document.getElementById("chem_percent");
  const btnAdd = document.getElementById("btnAddChem");
  const tbody = document.getElementById("chemTableBody");
  const remainText = document.getElementById("remainText");

  // ----- แสดงหัวข้อสินค้า -----
  pName.value   = draft.product_name || "";
  pCode.value   = draft.product_code || draft.product_id || "";
  pStatus.value = draft.status ? "เสร็จสิ้น" : "ยังไม่เสร็จ";
  pBrand.value  = draft.brand_name || "";
  pNotify.textContent = draft.notify_text || "-";
  remainText.textContent = (draft.remain_percent ?? 100).toString();

  // ตัวแปร TomSelect
  let chemSelectTS = null;

  // ----- โหลดรายการสารเคมี + เปิดค้นหาได้ -----
  (async function loadChems() {
    try {
      const res = await fetch("/chem/read-all", { headers: { "Accept": "application/json" } });
      if (!res.ok) {
        throw new Error(`โหลดสารเคมีไม่สำเร็จ: ${res.status} ${res.statusText}`);
      }

      // บางครั้ง backend ส่ง html error กลับมา ให้กันไว้
      const text = await res.text();
      let items;
      try {
        items = JSON.parse(text);
      } catch {
        throw new Error("ข้อมูลสารเคมีที่ได้มาไม่ใช่ JSON");
      }

      // map เป็นโครงสร้างของ Tom Select
      // สมมติว่า /chem/read-all คืนค่า [{ id, chem_name, inci_name, cas_no }, ...]
      const options = (items || []).map(c => ({
        id: Number(c.id),
        chem_name: c.chem_name || "",
        inci_name: c.inci_name || "",
        cas_no: c.cas_no || "",
        // label ใช้แสดงผลในดรอปดาว
        label: `${c.chem_name || "-"}${c.inci_name ? " (" + c.inci_name + ")" : ""}${c.cas_no ? " • CAS: " + c.cas_no : ""}`
      }));

      // เคลียร์ option เดิมสำหรับ fallback
      chemSelectEl.innerHTML = `<option value="">-- เลือกสารเคมี --</option>`;

      // สร้าง Tom Select ให้ค้นหาได้
      chemSelectTS = new TomSelect(chemSelectEl, {
        // ใช้ข้อมูลที่เตรียมไว้
        options,
        valueField: "id",
        labelField: "label",
        searchField: ["label", "chem_name", "inci_name", "cas_no"],
        maxOptions: 1000,
        preload: true,
        allowEmptyOption: true,
        // UX เสริม
        plugins: ["dropdown_input", "clear_button"],
        placeholder: "พิมพ์เพื่อค้นหา…",
        sortField: [{ field: "chem_name", direction: "asc" }],
        render: {
          option(data, escape) {
            return `
              <div>
                <div class="fw-semibold">${escape(data.chem_name || "-")}</div>
                <div class="small text-muted">
                  ${data.inci_name ? escape(data.inci_name) + " · " : ""}${data.cas_no ? "CAS: " + escape(data.cas_no) : ""}
                </div>
              </div>
            `;
          },
          item(data, escape) {
            return `<div>${escape(data.chem_name || data.label)}</div>`;
          }
        }
      });
    } catch (e) {
      console.error("โหลดสารเคมี error:", e);
      // fallback เป็น select ปกติ (พิมพ์หาไม่ได้)
      // ผู้ใช้ยังคงเพิ่มสารได้หาก backend ใช้งานได้ แต่จะแสดง option เปล่าไว้ก่อน
      chemSelectEl.innerHTML = `<option value="">-- โหลดสารเคมีไม่สำเร็จ --</option>`;
    }
  })();

  // ----- ฟังก์ชันช่วย -----
  function sumPercent() {
    return (draft.chems || []).reduce((s, x) => s + Number(x.chem_percent || 0), 0);
  }

  function renderTable() {
    if (!draft.chems || draft.chems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">ยังไม่มีรายการ</td></tr>`;
      remainText.textContent = "100";
      draft.remain_percent = 100;
      sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
      return;
    }
    tbody.innerHTML = draft.chems.map((row, idx) => `
      <tr>
        <td>${row.chem_name || ("ID " + row.chem_id)}</td>
        <td class="text-end">${Number(row.chem_percent).toString()}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" data-idx="${idx}">
            <i class="bi bi-x-lg"></i>
          </button>
        </td>
      </tr>
    `).join("");

    const remain = Math.max(0, 100 - sumPercent());
    draft.remain_percent = remain;
    remainText.textContent = remain.toString();
    sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
  }

  // ----- เพิ่มรายการสาร -----
  btnAdd.addEventListener("click", () => {
    // อ่านค่า chem_id จาก Tom Select (ถ้ามี) หรือจาก select ปกติ
    let chem_id = 0, chem_name = "";
    if (chemSelectTS) {
      const val = chemSelectTS.getValue();
      chem_id = Number(val || 0);
      if (chem_id) {
        const opt = chemSelectTS.options[chem_id];
        chem_name = opt?.chem_name || opt?.label || `ID ${chem_id}`;
      }
    } else {
      chem_id = Number(chemSelectEl.value);
      const optEl = chemSelectEl.options[chemSelectEl.selectedIndex];
      chem_name = optEl ? optEl.textContent : `ID ${chem_id}`;
    }

    const chem_percent = parseFloat(percentInput.value);

    if (!chem_id) { alert("กรุณาเลือกสารเคมี"); return; }
    if (isNaN(chem_percent) || chem_percent <= 0) { alert("กรุณากรอกเปอร์เซ็นต์ให้ถูกต้อง"); return; }

    const currentSum = sumPercent();
    if (currentSum + chem_percent > 100 + 1e-9) {
      alert("เปอร์เซ็นต์รวมเกิน 100%");
      return;
    }

    draft.chems = draft.chems || [];
    draft.chems.push({ chem_id, chem_name, chem_percent });

    percentInput.value = "";
    if (chemSelectTS) chemSelectTS.clear(); else chemSelectEl.value = "";

    renderTable();
  });

  // ----- ลบรายการสาร -----
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-idx]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    draft.chems.splice(idx, 1);
    renderTable();
  });

  // ----- เริ่มต้น -----
  renderTable();
});

// ===== เพิ่มท้ายไฟล์ productdetail-edit.js =====

// ตรวจ sum = 100% ไหม (อนุโลมส่วนเกินนิดหน่อย)
function isTotalHundred() {
  const sum = sumPercent();
  return Math.abs(sum - 100) <= 1e-6;
}

// เรียกบันทึกไปหลังบ้าน
async function saveProductDetailDraft() {
  // โหลด draft จาก sessionStorage อีกรอบเพื่อให้เป็นค่าล่าสุด
  const draftStr = sessionStorage.getItem("productdetailDraft");
  if (!draftStr) throw new Error("ไม่พบข้อมูลร่างใน sessionStorage");
  const draft = JSON.parse(draftStr);

  const product_id = draft.product_id || draft.productId || draft.p_id;
  if (!product_id) throw new Error("ไม่พบ product_id ในร่างข้อมูล");

  const chems = Array.isArray(draft.chems) ? draft.chems : [];
  if (chems.length === 0) throw new Error("กรุณาเพิ่มรายการสารเคมีก่อนบันทึก");

  // (ถ้าต้องการบังคับรวม = 100% ให้เปิดคอมเมนต์ด้านล่าง)
  // if (!isTotalHundred()) throw new Error("เปอร์เซ็นต์รวมต้องเท่ากับ 100%");

  const payload = {
    product_id: Number(product_id),
    chems: chems.map(x => ({
      chem_id: Number(x.chem_id),
      chem_percent: Number(x.chem_percent)
    }))
  };

  const res = await fetch("/productdetail/save-chems", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let msg = `บันทึกไม่สำเร็จ (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    throw new Error(msg);
  }
  return await res.json(); // { success:true, affected:n }
}

// ผูกปุ่มบันทึก
document.getElementById("btnSave")?.addEventListener("click", async () => {
  try {
    // ตรวจรวมเปอร์เซ็นต์ล่วงหน้า (แสดงเตือน แต่ยังให้ไปต่อได้)
    const total = sumPercent();
    if (total > 100 + 1e-9) {
      alert("เปอร์เซ็นต์รวมเกิน 100% กรุณาปรับให้ไม่เกิน 100");
      return;
    }

    const confirmMsg = isTotalHundred()
      ? "ยืนยันบันทึกรายการสารเคมี?"
      : `ยืนยันบันทึก? (เปอร์เซ็นต์รวมปัจจุบัน = ${total}%)`;
    if (!confirm(confirmMsg)) return;

    // call API
    const result = await saveProductDetailDraft();

    // ล้าง draft ถ้าต้องการ
    // sessionStorage.removeItem("productdetailDraft");

    alert("บันทึกสำเร็จ");
    // กลับหน้า index หรือหน้า detail ตามต้องการ
    location.href = "/productdetail/index.html";
  } catch (err) {
    console.error("บันทึก error:", err);
    alert(err.message || "บันทึกไม่สำเร็จ");
  }
});
