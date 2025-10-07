// /public/js/productorderdetail-buy.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const toNum = (v, d = 0) => {
    if (typeof v === "string") v = v.replace(/,/g, "");
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const getParam = (k, d = null) =>
    new URLSearchParams(location.search).get(k) ?? d;

  // ===== ปุ่มกลับ =====
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorderdetail/index.html";
  });

  // ===== โหลดรายชื่อบริษัท =====
  async function loadCompanies() {
    try {
      const res = await fetch("/company/read", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("โหลดไม่สำเร็จ");
      const data = await res.json();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.items)
        ? data.items
        : [];
      const sel = $("company_id");
      sel.innerHTML = `<option value="">-- เลือกบริษัท --</option>`;
      arr.forEach((x) => {
        const id = x.id ?? x.company_id ?? x.COMPANY_ID;
        const name = x.company_name ?? x.name ?? x.COMPANY_NAME;
        if (id && name) {
          const op = document.createElement("option");
          op.value = id;
          op.textContent = name;
          sel.appendChild(op);
        }
      });
    } catch (err) {
      console.error(err);
      alert("โหลดรายการบริษัทไม่สำเร็จ");
    }
  }

  // ===== ดึง reorder ตาม chem_id =====
  async function updateChemReorder(chemId) {
    const help = $("orderbuy_help");
    if (!chemId) {
      help.textContent = "reorder: -";
      return;
    }
    try {
      const res = await fetch(`/chem/detail?id=${chemId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      const reorder = row?.chem_reorder ?? row?.CHEM_REORDER ?? null;
      help.textContent = reorder ? `reorder: ${fmt(reorder)} กรัม` : "reorder: -";
    } catch {
      help.textContent = "reorder: -";
    }
  }

  // ===== คำนวณราคา/กรัม =====
  const totalPriceInput = $("chem_price"); // ✅ ราคารวมที่จ่าย (บาท)
  const qtyInput = $("orderbuy");          // ✅ ปริมาณที่สั่งซื้อ (กรัม)
  const unitBox = $("price_gram");         // ✅ ราคา/กรัม (readonly)

  const recalc = () => {
    const total = toNum(totalPriceInput.value);
    const qty = toNum(qtyInput.value);
    const unit = qty > 0 ? round2(total / qty) : 0;
    if (unitBox) unitBox.value = fmtMoney(unit);
  };

  totalPriceInput?.addEventListener("input", recalc);
  qtyInput?.addEventListener("input", recalc);

  // ===== โหลดข้อมูลตาม pod_id =====
  async function loadDetailByPodId(podId) {
    const urls = [
      `/productorderdetail/read/${podId}`,
      `/productorderdetail/detail?id=${podId}`,
      `/productorderdetail/${podId}`,
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        return Array.isArray(data) ? data[0] : data;
      } catch {}
    }
    return null;
  }

  // ===== โหลดแถวล่าสุดตาม chem_id =====
  async function loadLatestByChemId(chemId) {
    if (!chemId) return null;
    const res = await fetch(`/productorderdetail/read`);
    if (!res.ok) return null;
    const raw = await res.json();
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.rows)
      ? raw.rows
      : [];
    const rows = arr
      .filter((x) => Number(x.chem_id ?? x.CHEM_ID) === Number(chemId))
      .map((x) => ({
        pod_id: x.pod_id ?? x.POD_ID ?? null,
        chem_id: x.chem_id ?? x.CHEM_ID ?? null,
        chem_name: x.chem_name ?? x.CHEM_NAME ?? null,
        company_id: x.company_id ?? x.COMPANY_ID ?? null,
        orderbuy: x.orderbuy ?? x.ORDERBUY ?? null,
        chem_price: x.chem_price ?? x.CHEM_PRICE ?? null,
        coa: x.coa ?? x.COA ?? null,
        msds: x.msds ?? x.MSDS ?? null,
      }));
    if (!rows.length) return null;
    rows.sort((a, b) => (b.pod_id || 0) - (a.pod_id || 0));
    return rows[0];
  }

  // ===== Initial load =====
  const podId = Number(getParam("pod_id", 0)) || 0;
  let chemId = Number(getParam("chem_id", 0)) || 0;
  let chemName = getParam("chem_name", "");

  (async () => {
    await loadCompanies();

    $("chem_id").value = chemId || "";
    if (chemName) $("chem_name").value = chemName;

    let data = null;
    if (podId) {
      data = await loadDetailByPodId(podId);
    } else if (chemId) {
      data = await loadLatestByChemId(chemId);
    }

    if (!data) {
      await updateChemReorder(chemId);
      return;
    }

    // === Prefill ===
    $("chem_id").value = data.chem_id ?? "";
    $("chem_name").value = data.chem_name ?? chemName ?? "-";
    $("company_id").value = data.company_id ?? "";
    $("orderbuy").value = data.orderbuy ?? "";
    $("chem_price").value = ""; // ✅ ผู้ใช้กรอกเอง
    $("price_gram").value = fmtMoney(data.chem_price ?? 0);
    $("coa").value = data.coa ?? "";
    $("msds").value = data.msds ?? "";
    await updateChemReorder(data.chem_id);

    // ซ่อน pod_id สำหรับ submit
    let hid = document.getElementById("pod_id");
    if (!hid) {
      hid = document.createElement("input");
      hid.type = "hidden";
      hid.id = "pod_id";
      hid.name = "pod_id";
      document.getElementById("formBuy").appendChild(hid);
    }
    hid.value = data.pod_id;
  })();

  // ===== Submit (UPDATE ตาม pod_id) =====
  async function tryUpdate(payload) {
    const res = await fetch(`/productorderdetail/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `อัปเดตไม่สำเร็จ (${res.status})`);
    return data;
  }

  $("formBuy").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pod_id = Number($("pod_id")?.value || 0);
    if (!pod_id) return alert("ไม่พบ pod_id ของรายการนี้");

    const chem_id = toNum($("chem_id").value || 0);
    const company_id = toNum($("company_id").value || 0);
    const orderbuy = toNum($("orderbuy").value || 0);
    const chem_price = toNum($("chem_price").value || 0);
    const price_gram = orderbuy > 0 ? round2(chem_price / orderbuy) : 0;

    if (!chem_id) return alert("กรุณาเลือกชื่อทางการค้า");
    if (!company_id) return alert("กรุณาเลือกชื่อบริษัทที่ขายสารเคมี");

    const payload = {
      pod_id,
      chem_id,
      company_id,
      orderbuy,
      chem_price,
      price_gram,
      coa: ($("coa").value || "").trim() || null,
      msds: ($("msds").value || "").trim() || null,
    };

    try {
      await tryUpdate(payload);
      alert("อัปเดตข้อมูลเรียบร้อยแล้ว");
      location.href = "/productorderdetail/index.html";
    } catch (err) {
      console.error(err);
      alert(err.message || "อัปเดตไม่สำเร็จ");
    }
  });
});

// ===== Upload helpers =====
function enableLink(aEl, url) {
  if (!aEl) return;
  if (url) {
    aEl.href = url;
    aEl.removeAttribute("disabled");
    aEl.classList.remove("disabled");
  } else {
    aEl.removeAttribute("href");
    aEl.setAttribute("disabled", "true");
    aEl.classList.add("disabled");
  }
}

async function uploadPdf(fieldName) {
  // fieldName = 'coa' | 'msds'
  const podId = Number(document.getElementById("pod_id")?.value || 0);
  if (!podId) return alert("ยังไม่พบ pod_id ของรายการนี้ (ยังไม่โหลดข้อมูลเสร็จ?)");

  const fileInput = document.getElementById(fieldName + "_file");
  const textBox   = document.getElementById(fieldName);
  const linkBtn   = document.getElementById(fieldName + "_link");

  const file = fileInput?.files?.[0];
  if (!file) return alert("กรุณาเลือกไฟล์ก่อน");

  if (file.type !== "application/pdf") {
    return alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
  }
  if (file.size > 10 * 1024 * 1024) {
    return alert("ไฟล์เกิน 10MB");
  }

  const fd = new FormData();
  fd.append("pod_id", String(podId));
  fd.append(fieldName, file); // ชื่อคีย์ต้องเป็น 'coa' หรือ 'msds'

  try {
    const res = await fetch("/upload/coa-msds", {
      method: "PUT",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `อัปโหลดไม่สำเร็จ (${res.status})`);

    // เซ็ต URL ที่ได้กลับมา
    const url = data[fieldName] || null;
    if (url) {
      if (textBox) textBox.value = url;
      enableLink(linkBtn, url);
      alert(`อัปโหลด ${fieldName.toUpperCase()} สำเร็จ`);
    } else {
      alert(`อัปโหลดสำเร็จ แต่ไม่พบ URL ของ ${fieldName.toUpperCase()}`);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "อัปโหลดไม่สำเร็จ");
  } finally {
    // ล้างไฟล์ที่เลือก
    if (fileInput) fileInput.value = "";
  }
}

// ปุ่มอัปโหลด
document.getElementById("btnUploadCoa")?.addEventListener("click", () => uploadPdf("coa"));
document.getElementById("btnUploadMsds")?.addEventListener("click", () => uploadPdf("msds"));

// ถ้าอยากให้อัปโหลดอัตโนมัติเมื่อเลือกไฟล์ (ไม่ต้องกดปุ่ม)
// document.getElementById("coa_file")?.addEventListener("change", () => uploadPdf("coa"));
// document.getElementById("msds_file")?.addEventListener("change", () => uploadPdf("msds"));
