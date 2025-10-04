// /public/js/productorderdetail-create.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const toNum = (v, d = 0) => {
    if (typeof v === "string") v = v.replace(/,/g, "");
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ===== Elements =====
  const chemSel     = $("chem_id");
  const compSel     = $("company_id");
  const qtyGram     = $("orderbuy");     // ปริมาณที่สั่งซื้อ (กรัม)
  const totalPrice  = $("chem_price");   // ราคารวมที่จ่าย (บาท) [optional]
  const unitPriceEl = $("price_gram");   // ราคา/กรัม (บาท) (readonly)

  // ===== Back button =====
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorderdetail/index.html";
  });

  // ===== เติมตัวเลือก chem & company =====
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
      } catch {}
    }
    return [];
  }

  async function loadOptions() {
    const chemUrls = ["/chem/read-all?limit=5000", "/chem/read", "/chem/search?q=a"];
    const companyUrls = ["/company/read"];

    const mapChem = (x) => {
      const id   = x.id ?? x.chem_id ?? x.CHEM_ID ?? x.chemId;
      const name = x.chem_name ?? x.name ?? x.CHEM_NAME ?? x.chemName ?? x.inci_name;
      if (!id || !name) return null;
      return { id: Number(id), name: String(name) };
    };
    const mapCompany = (x) => {
      const id   = x.id ?? x.company_id ?? x.COMPANY_ID ?? x.companyId;
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

    chemItems.forEach((x) => {
      const op = document.createElement("option");
      op.value = x.id;
      op.textContent = x.name;
      chemSel.appendChild(op);
    });

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

  // ===== คำนวณราคา/กรัม (บาท) = ราคารวม(บาท) / ปริมาณ(กรัม) [คำนวณเมื่อครบเท่านั้น] =====
  unitPriceEl.readOnly = true;
  function recalcUnit() {
    const qtyRaw   = (qtyGram.value ?? "").trim();
    const totalRaw = (totalPrice.value ?? "").trim();

    const qty   = toNum(qtyRaw, 0);
    const total = toNum(totalRaw, 0);

    if (qtyRaw === "" || qty <= 0 || totalRaw === "" || total <= 0) {
      // ถ้ายังไม่กรอกราคา/ปริมาณ หรือเป็น 0 → ไม่โชว์ค่า
      unitPriceEl.value = "";
      return;
    }
    const unit = round2(total / qty);  // บาท/กรัม
    unitPriceEl.value = fmtMoney(unit);
  }
  qtyGram.addEventListener("input", recalcUnit);
  totalPrice.addEventListener("input", recalcUnit);

  // ===== อัปเดตราคา/กรัมลงตาราง chem (เฉพาะเมื่อมีราคา) =====
  async function updateChemPriceGram(chemId, unitPrice) {
    const price = Math.round(Number(unitPrice) * 100) / 100;
    const res = await fetch(`/chem/${chemId}/price-gram`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ price_gram: price }),
    });
    return res.ok;
  }

  // ===== บันทึก =====
  $("formCreate").addEventListener("submit", async (e) => {
    e.preventDefault();

    const chem_id    = toNum((chemSel.value || 0), 0);
    const company_id = toNum((compSel.value || 0), 0);
    const qtyRaw     = (qtyGram.value ?? "").trim();
    const totalRaw   = (totalPrice.value ?? "").trim();

    const qty        = toNum(qtyRaw, 0);      // กรัม (จำเป็น)
    const total      = toNum(totalRaw, 0);    // บาท (optional)
    const hasTotal   = totalRaw !== "" && total > 0;

    // ✅ ตรวจเฉพาะปริมาณ (กรัม) ต้อง > 0
    if (!chem_id)    return alert("กรุณาเลือกสารเคมี");
    if (!company_id) return alert("กรุณาเลือกบริษัทผู้ขาย");
    if (!(qty > 0))  return alert("โปรดกรอกปริมาณที่สั่งซื้อ (> 0 กรัม)");

    // ถ้ามีราคา → คำนวณ บาท/กรัม และอัปเดต chem
    if (hasTotal) {
      const unitPrice = round2(total / qty); // บาท/กรัม
      try {
        const updated = await updateChemPriceGram(chem_id, unitPrice);
        if (!updated) {
          // ไม่เตือนผู้ใช้เพื่อไม่กวน, แค่ log ไว้
          console.warn("อัปเดต price_gram ใน chem ไม่สำเร็จ");
        }
      } catch (err) {
        console.warn("อัปเดต price_gram ใน chem ผิดพลาด:", err);
      }
    }

    // สร้าง payload:
    // - orderuse = ปริมาณ (กรัม)
    // - chem_price = ราคารวม(บาท) [optional → null ถ้าไม่ได้กรอก]
    // - orderbuy  = ราคารวม(บาท) [คง mapping เดิมของคุณ → optional เช่นกัน]
    const payload = {
      prodetail_id: null,
      chem_id,
      proorder_id: null,
      company_id,
      orderuse: qty,                          // กรัม
      chem_price: hasTotal ? total : null,    // บาท (nullable)
      orderbuy:   hasTotal ? total : null,    // บาท (nullable)
      coa:  ($("coa").value || "").trim() || null,
      msds: ($("msds").value || "").trim() || null,
    };

    try {
      const res = await fetch("/productorderdetail/create?merge=0", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (${res.status})`);

      alert("บันทึกสำเร็จ");
      location.href = `/productorderdetail/index.html`;
    } catch (err) {
      console.error(err);
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });

  // ปุ่มอัปโหลด (placeholder)
  $("btnUploadCoa")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด COA ตามระบบของคุณ"));
  $("btnUploadMsds")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด MSDS ตามระบบของคุณ"));
});
