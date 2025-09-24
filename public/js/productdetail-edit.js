// /public/js/productdetail-edit.js
document.addEventListener("DOMContentLoaded", () => {
  // ===== รับ draft จาก sessionStorage =====
  const draftStr = sessionStorage.getItem("productdetailDraft");
  if (!draftStr) {
    alert("ไม่พบข้อมูลร่าง กรุณาเริ่มจากหน้าก่อนหน้า");
    location.href = "/productdetail/create.html";
    return;
  }
  const draft = JSON.parse(draftStr);

  // ===== DOM =====
  const pName   = document.getElementById("p_name");
  const pCode   = document.getElementById("p_code");
  const pStatus = document.getElementById("p_status");
  const pBrand  = document.getElementById("p_brand");
  const pNotify = document.getElementById("p_notify");

  const chemSelectEl  = document.getElementById("chem_id");
  const chemInfoBox   = document.getElementById("chem_info");
  const percentInput  = document.getElementById("chem_percent");
  const btnAdd        = document.getElementById("btnAddChem");
  const tbody         = document.getElementById("chemTableBody");
  const remainText    = document.getElementById("remainText");
  const btnSave       = document.getElementById("btnSave");

  // ===== แสดงหัวข้อสินค้า =====
  pName.value   = draft.product_name || "";
  pCode.value   = draft.product_code || draft.product_id || "";
  pStatus.value = draft.status ? "เสร็จสิ้น" : "ยังไม่เสร็จ";
  pBrand.value  = draft.brand_name || "";
  pNotify.textContent = draft.notify_text || "-";
  remainText.textContent = (draft.remain_percent ?? 100).toString();

  // ===== ดรอปดาวค้นหาสารเคมี (Server-side search) =====
  let chemSelectTS = null;

  function renderChemInfo(selected) {
    if (!selected) { chemInfoBox.innerHTML = ""; return; }
    const inci = selected.inci_name ? ` (${selected.inci_name})` : "";
    const unit = selected.chem_unit ? ` • หน่วย: ${selected.chem_unit}` : "";
    const type = selected.chem_type ? ` • ชนิด: ${selected.chem_type}` : "";
    chemInfoBox.innerHTML = `
      <div class="alert alert-secondary py-2 mb-0">
        <div><strong>${selected.chem_name || "-"}</strong>${inci}</div>
        <div class="small text-muted">${unit}${type}</div>
      </div>
    `;
  }

(function initChemSearch() {
  chemSelectEl.innerHTML = `<option value="">-- เลือกสารเคมี --</option>`;
  if (chemSelectTS) { try { chemSelectTS.destroy(); } catch {} chemSelectTS = null; }

  chemSelectTS = new TomSelect(chemSelectEl, {
    valueField: "id",
    labelField: "label",
    searchField: ["label", "chem_name", "inci_name", "chem_unit", "chem_type"],
    maxOptions: 200,
    preload: true,                     // ✅ preload ตอนเปิดหน้า
    allowEmptyOption: true,
    plugins: ["dropdown_input","clear_button"],
    placeholder: "พิมพ์ชื่อสารหรือ INCI เพื่อค้นหา…",
    load: function (query, callback) {
      // ถ้ายังไม่พิมพ์: preload จาก read-all
      const url = (query && query.trim().length > 0)
        ? `/chem/search?q=${encodeURIComponent(query)}&limit=50`
        : `/chem/read-all?limit=200`;

      fetch(url, { headers: { "Accept": "application/json" } })
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
        .then(list => {
          const options = (list || []).map(c => ({
            id: Number(c.id ?? c.chem_id),
            chem_name: c.chem_name || "",
            inci_name: c.inci_name || "",
            chem_unit: c.chem_unit || "",
            chem_type: c.chem_type || "",
            label: `${c.chem_name || "-"}${c.inci_name ? " (" + c.inci_name + ")" : ""}`,
          }));
          callback(options);
        })
        .catch(err => { console.error("chem load error:", err); callback(); });
    },
    render: {
      option(data, escape) {
        return `
          <div>
            <div class="fw-semibold">${escape(data.chem_name || "-")}</div>
            <div class="small text-muted">
              ${data.inci_name ? escape(data.inci_name) + " · " : ""}${data.chem_unit ? "หน่วย: " + escape(data.chem_unit) + " · " : ""}${data.chem_type ? "ชนิด: " + escape(data.chem_type) : ""}
            </div>
          </div>
        `;
      },
      item(data, escape) {
        return `<div>${escape(data.chem_name || data.label)}</div>`;
      }
    },
    onChange: (value) => {
      const id = Number(value || 0);
      const raw = id ? chemSelectTS?.options?.[id] : null;
      renderChemInfo(raw || null);
    }
  });

  // ถ้าต้องการ preset จาก data-current-id (ตอนแก้ไข)
  const currentId = Number(chemSelectEl.getAttribute("data-current-id") || 0);
  if (currentId) {
    fetch(`/chem/detail?id=${currentId}`, { headers: { "Accept": "application/json" } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(c => {
        const option = {
          id: Number(c.id ?? c.chem_id),
          chem_name: c.chem_name || "",
          inci_name: c.inci_name || "",
          chem_unit: c.chem_unit || "",
          chem_type: c.chem_type || "",
          label: `${c.chem_name || "-"}${c.inci_name ? " (" + c.inci_name + ")" : ""}`
        };
        chemSelectTS.addOption(option);
        chemSelectTS.setValue(String(option.id));
        renderChemInfo(option);
      })
      .catch(e => console.warn("preset chem error:", e));
  }
})();


  // ===== ฟังก์ชันช่วยคำนวณ/แสดงผล =====
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

  // ===== เพิ่มรายการสาร =====
  btnAdd.addEventListener("click", () => {
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
    renderChemInfo(null);
    renderTable();
  });

  // ===== ลบรายการสาร =====
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-idx]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    draft.chems.splice(idx, 1);
    renderTable();
  });

  // ===== บันทึกลงฐานข้อมูล =====
  function isTotalHundred() {
    const sum = sumPercent();
    return Math.abs(sum - 100) <= 1e-6;
  }

  async function saveProductDetailDraft() {
    const latestStr = sessionStorage.getItem("productdetailDraft");
    if (!latestStr) throw new Error("ไม่พบข้อมูลร่างใน sessionStorage");
    const latest = JSON.parse(latestStr);

    const product_id = latest.product_id || latest.productId || latest.p_id;
    if (!product_id) throw new Error("ไม่พบ product_id ในร่างข้อมูล");

    const chems = Array.isArray(latest.chems) ? latest.chems : [];
    if (chems.length === 0) throw new Error("กรุณาเพิ่มรายการสารเคมีก่อนบันทึก");

    const payload = {
      product_id: Number(product_id),
      chems: chems.map(x => ({
        chem_id: Number(x.chem_id),
        chem_percent: Number(x.chem_percent)
      })),
      productdetail_status: 1
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

  btnSave?.addEventListener("click", async () => {
    try {
      const total = sumPercent();
      if (total > 100 + 1e-9) {
        alert("เปอร์เซ็นต์รวมเกิน 100% กรุณาปรับให้ไม่เกิน 100");
        return;
      }
      const confirmMsg = isTotalHundred()
        ? "ยืนยันบันทึกรายการสารเคมี?"
        : `ยืนยันบันทึก? (เปอร์เซ็นต์รวมปัจจุบัน = ${total}%)`;
      if (!confirm(confirmMsg)) return;

      const result = await saveProductDetailDraft();
      alert("บันทึกสำเร็จ");
      // ถ้าต้องการล้าง draft:
      // sessionStorage.removeItem("productdetailDraft");
      location.href = "/productdetail/index.html";
    } catch (err) {
      console.error("บันทึก error:", err);
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });

  // ===== เริ่มต้น =====
  renderTable();
});
