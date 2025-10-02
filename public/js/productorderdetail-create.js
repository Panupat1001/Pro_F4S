// /public/js/productorderdetail-create.js (no /api/*; no ?id= required)
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

  // ===== Back button (optional) =====
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorder/index.html";
  });

  // ===== Load options using existing routes only (no /api/*) =====
  async function loadOptions() {
    // Try these in order (stop at first that returns non-empty list)
    const chemUrls = [
      "/chem/read-all?limit=5000",
      "/chem/read",             // returns all in your route
      "/chem/search?q=a"        // fallback
    ];
    const companyUrls = [
      "/company/read"           // returns all
    ];

    async function tryFetch(urls, mapper) {
      for (const url of urls) {
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
          if (!arr || !arr.length) continue;
          const mapped = arr.map(mapper).filter(Boolean);
          if (mapped.length) return mapped;
        } catch {
          // ignore and try next
        }
      }
      return [];
    }

    const mapChem = (x) => {
      const id = x.id ?? x.chem_id ?? x.CHEM_ID ?? x.chemId;
      const name = x.chem_name ?? x.name ?? x.CHEM_NAME ?? x.chemName ?? x.inci_name;
      if (!id || !name) return null;
      return { id: Number(id), name: String(name) };
    };
    const mapCompany = (x) => {
      const id = x.id ?? x.company_id ?? x.COMPANY_ID ?? x.companyId;
      const name = x.company_name ?? x.name ?? x.COMPANY_NAME ?? x.companyName;
      if (!id || !name) return null;
      return { id: Number(id), name: String(name) };
    };

    const [chemItems, compItems] = await Promise.all([
      tryFetch(chemUrls, mapChem),
      tryFetch(companyUrls, mapCompany),
    ]);

    if (!chemItems.length) throw new Error("โหลดรายการสารเคมีไม่สำเร็จ");
    if (!compItems.length) throw new Error("โหลดรายการบริษัทไม่สำเร็จ");

    const chemSel = $("chem_id");
    chemItems.forEach((x) => {
      const op = document.createElement("option");
      op.value = x.id;
      op.textContent = x.name;
      chemSel.appendChild(op);
    });

    const compSel = $("company_id");
    compItems.forEach((x) => {
      const op = document.createElement("option");
      op.value = x.id;
      op.textContent = x.name;
      compSel.appendChild(op);
    });
  }

  loadOptions().catch((err) => {
    console.error(err);
    alert(err.message || "โหลดตัวเลือกไม่สำเร็จ");
  });

  // ===== Calculate chem_price (price per gram) from orderbuy / orderuse =====
  const totalInput = $("orderbuy");   // user inputs total price
  const qtyInput   = $("orderuse");   // grams
  const unitBox    = $("chem_price"); // price per gram (readonly recommended)

  function recalc() {
    const total = toNum(totalInput.value, 0);
    const qty   = toNum(qtyInput.value, 0);
    const unit  = qty > 0 ? round2(total / qty) : 0;
    unitBox.value = fmtMoney(unit);
  }
  totalInput.addEventListener("input", recalc);
  qtyInput.addEventListener("input", recalc);

  // ===== Upload buttons (placeholder) =====
  $("btnUploadCoa")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด COA ตามระบบของคุณ"));
  $("btnUploadMsds")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด MSDS ตามระบบของคุณ"));

  // Optional proorder_id (hidden or select). If absent/empty -> null
  function getOptionalProorderId() {
    const el = $("proorder_id");
    if (!el) return null;
    const v = toNum(el.value, 0);
    return v > 0 ? v : null;
  }

  // ===== Submit =====
  $("formCreate").addEventListener("submit", async (e) => {
    e.preventDefault();

    const orderuse   = toNum(qtyInput.value, 0);
    const orderbuy   = toNum(totalInput.value, 0);
    const chem_price = orderuse > 0 ? round2(orderbuy / orderuse) : 0;

    const payload = {
      prodetail_id: null,
      chem_id: Number(($("chem_id").value || 0)),
      proorder_id: getOptionalProorderId(),     // nullable
      company_id: Number(($("company_id").value || 0)),
      orderuse,
      chem_price,   // computed
      orderbuy,     // user input
      coa: ($("coa").value || "").trim() || null,
      msds: ($("msds").value || "").trim() || null,
    };

    if (!payload.chem_id)    return alert("กรุณาเลือกชื่อทางการค้า");
    if (!payload.company_id) return alert("กรุณาเลือกชื่อบริษัทที่ขายสารเคมี");
    if (payload.orderuse < 200) return alert("ปริมาณที่สั่งต้องไม่น้อยกว่า 200");

    try {
      const res = await fetch("/api/productorderdetail/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (${res.status})`);

      alert("บันทึกสำเร็จ");
      const pid = payload.proorder_id;
      if (pid) location.href = `/productorderdetail/index.html?id=${pid}`;
      else     location.href = `/productorderdetail/index.html`;
    } catch (err) {
      console.error(err);
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });
});
