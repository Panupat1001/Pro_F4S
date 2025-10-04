// /public/js/productorderdetail-buy.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const toNum = (v, d = 0) => {
    if (typeof v === "string") v = v.replace(/,/g, "");
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const getParam = (k, d = null) => new URLSearchParams(location.search).get(k) ?? d;

  // back
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorder/index.html";
  });

  // โหลดรายชื่อบริษัท
  async function loadCompanies() {
    const companyUrls = ["/company/read"];
    for (const url of companyUrls) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data.items) ? data.items
          : Array.isArray(data.data)  ? data.data
          : Array.isArray(data.rows)  ? data.rows
          : null;
        if (!arr?.length) continue;

        const mapCompany = (x) => {
          const id = x.id ?? x.company_id ?? x.COMPANY_ID ?? x.companyId;
          const name = x.company_name ?? x.name ?? x.COMPANY_NAME ?? x.companyName;
          if (!id || !name) return null;
          return { id: Number(id), name: String(name) };
        };
        const items = arr.map(mapCompany).filter(Boolean);

        const sel = $("company_id");
        items.forEach((x) => {
          const op = document.createElement("option");
          op.value = x.id;
          op.textContent = x.name;
          sel.appendChild(op);
        });
        return;
      } catch {}
    }
    alert("โหลดรายการบริษัทไม่สำเร็จ");
  }

  // ดึง reorder ตาม chem_id (เหมือน create.js)
  async function updateChemReorder(chemId) {
    const help = $("orderuse_help");
    const qtyInput = $("orderuse");
    if (!chemId) {
      help && (help.textContent = "reorder: -");
      qtyInput?.setAttribute("placeholder", "เช่น 2500");
      return;
    }
    const candidates = [
      `/chem/detail?id=${chemId}`,
      `/chem/read/${chemId}`,
      `/chem/${chemId}`,
    ];
    let reorder = null, ok = false;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        const row = Array.isArray(data) ? (data[0] || null) : data;
        if (!row) continue;

        reorder =
          row.chem_reorder ?? row.CHEM_REORDER ?? row.reorder ??
          row.data?.chem_reorder ?? null;

        ok = true;
        break;
      } catch {}
    }
    if (ok && reorder != null) {
      help && (help.textContent = `reorder: ${fmt(reorder)} กรัม`);
      qtyInput && (qtyInput.placeholder = String(reorder));
    } else {
      help && (help.textContent = "reorder: -");
      qtyInput?.setAttribute("placeholder", "เช่น 2500");
    }
  }

  // คำนวณราคา/กรัม
  const totalInput = $("orderbuy");
  const qtyInput   = $("orderuse");
  const unitBox    = $("chem_price");
  unitBox && (unitBox.readOnly = true);

  function recalc() {
    const total = toNum(totalInput.value, 0);
    const qty   = toNum(qtyInput.value, 0);
    const unit  = qty > 0 ? round2(total / qty) : 0;
    unitBox.value = fmtMoney(unit);
  }
  totalInput.addEventListener("input", recalc);
  qtyInput.addEventListener("input", recalc);

  // ปุ่มอัปโหลด
  $("btnUploadCoa")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด COA ตามระบบของคุณ"));
  $("btnUploadMsds")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด MSDS ตามระบบของคุณ"));

  // Reset
  $("btnReset")?.addEventListener("click", () => {
    $("orderuse").value = "";
    $("orderbuy").value = "";
    $("chem_price").value = "";
    $("coa").value = "";
    $("msds").value = "";
  });

  // ===== Initial load =====
  loadCompanies();

  const chemId = Number(getParam("chem_id", 0)) || 0;
  const chemName = getParam("chem_name", "");
  $("chem_id").value = chemId || "";
  if (chemName) $("chem_name").value = chemName;

  (async () => {
    if (!chemId) {
      $("chem_name").value = "-";
      $("orderuse_help").textContent = "reorder: -";
      alert("ไม่พบ chem_id — กรุณาเปิดจากปุ่มสั่งซื้อในหน้า index");
      return;
    }
    await updateChemReorder(chemId);

    // ถ้าไม่ได้ส่งชื่อมา ให้ลองถามจาก /chem
    if (!chemName) {
      const urls = [`/chem/detail?id=${chemId}`, `/chem/read/${chemId}`];
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) continue;
          const data = await res.json();
          const row = Array.isArray(data) ? (data[0] || null) : data;
          const name =
            row?.chem_name ?? row?.CHEM_NAME ?? row?.name ?? row?.inci_name ?? row?.data?.chem_name ?? null;
          if (name) { $("chem_name").value = String(name); break; }
        } catch {}
      }
      if (!$("chem_name").value) $("chem_name").value = "-";
    }
  })();

  // Submit
  $("formBuy").addEventListener("submit", async (e) => {
    e.preventDefault();

    const chem_id    = toNum(($("chem_id").value || 0), 0);
    const company_id = toNum(($("company_id").value || 0), 0);
    const orderuse   = toNum(($("orderuse").value || 0), 0);
    const orderbuy   = toNum(($("orderbuy").value || 0), 0);
    const chem_price = orderuse > 0 ? round2(orderbuy / orderuse) : 0;

    if (!chem_id)    return alert("กรุณาเลือกชื่อทางการค้า");
    if (!company_id) return alert("กรุณาเลือกชื่อบริษัทที่ขายสารเคมี");
    if (orderuse < 200) return alert("ปริมาณที่สั่งต้องไม่น้อยกว่า 200");

    const payload = {
      prodetail_id: null,
      chem_id,
      proorder_id: null,
      company_id,
      orderuse,
      chem_price,
      orderbuy,
      coa:  ($("coa").value || "").trim() || null,
      msds: ($("msds").value || "").trim() || null,
    };

    try {
      const res = await fetch("/productorderdetail/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (${res.status})`);

      alert("บันทึกสำเร็จ");
      location.href = "/productorderdetail/index.html";
    } catch (err) {
      console.error(err);
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });
});
