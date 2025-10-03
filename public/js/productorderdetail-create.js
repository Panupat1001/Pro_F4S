// /public/js/productorderdetail-create.js  (no proorder_id)
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

  // 🆕 formatter สำหรับตัวเลขธรรมดา (ไว้โชว์ reorder สวย ๆ)
  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  // back
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorder/index.html";
  });

  // โหลด option จาก route ที่มีอยู่
  async function loadOptions() {
    const chemUrls = ["/chem/read-all?limit=5000", "/chem/read", "/chem/search?q=a"];
    const companyUrls = ["/company/read"];

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

    // 🆕 โหลดค่า reorder ของเคมีตัวแรกทันที (ถ้ามีค่า selected อยู่แล้ว)
    if (chemSel?.value) {
      await updateChemReorder(+chemSel.value);
    }
  }

  loadOptions().catch((err) => {
    console.error(err);
    alert(err.message || "โหลดตัวเลือกไม่สำเร็จ");
  });

  // คำนวณราคา/กรัม = orderbuy / orderuse
  const totalInput = $("orderbuy");
  const qtyInput   = $("orderuse");
  const unitBox    = $("chem_price");

  // 🆕 ป้องกันพิมพ์เองในช่องราคา/กรัม (ให้ระบบคำนวณ)
  if (unitBox) {
    unitBox.readOnly = true;
  }

  function recalc() {
    const total = toNum(totalInput.value, 0);
    const qty   = toNum(qtyInput.value, 0);
    const unit  = qty > 0 ? round2(total / qty) : 0;
    unitBox.value = fmtMoney(unit);
  }
  totalInput.addEventListener("input", recalc);
  qtyInput.addEventListener("input", recalc);

async function updateChemReorder(chemId) {
  const help = document.getElementById('orderuse_help');
  const qtyInput = document.getElementById('orderuse');
  if (!chemId) {
    help && (help.textContent = 'reorder');
    qtyInput?.setAttribute('placeholder', 'เช่น 2500');
    return;
  }

  // เรียงลำดับด้วยเส้นทางที่ "มีจริง" ในโปรเจ็กต์คุณ
  const candidates = [
    `/chem/detail?id=${chemId}`,   // คืน object เดียว
    `/chem/read/${chemId}`,        // คืน array
    // สำรอง ถ้าคุณเผื่อเพิ่มไว้ทีหลัง
    `/chem/${chemId}`,
  ];

  let reorder = null, ok = false;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();

      // map ให้ครอบ
      const row = Array.isArray(data) ? (data[0] || null) : data;
      if (row) {
        reorder =
          row.chem_reorder ??
          row.CHEM_REORDER ??
          row.reorder ??
          row.data?.chem_reorder ??
          null;
        ok = true;
        break;
      }
    } catch {}
  }

  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (ok && reorder != null) {
    help && (help.textContent = `reorder: ${fmt(reorder)} กรัม`);
    qtyInput && (qtyInput.placeholder = String(reorder));
    // qtyInput.min = String(Number(reorder) || 0); // ถ้าต้องการบังคับขั้นต่ำ
  } else {
    help && (help.textContent = 'reorder: -');
    qtyInput?.setAttribute('placeholder', 'เช่น 2500');
  }
}

  // 🆕 เวลาเปลี่ยนเคมีให้โหลด reorder ใหม่
  $("chem_id")?.addEventListener("change", (e) => {
    const val = Number(e.target.value || 0);
    updateChemReorder(val);
  });

  // ปุ่มอัปโหลด (placeholder)
  $("btnUploadCoa")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด COA ตามระบบของคุณ"));
  $("btnUploadMsds")?.addEventListener("click", () => alert("เชื่อมต่ออัปโหลด MSDS ตามระบบของคุณ"));

  // บันทึก
  $("formCreate").addEventListener("submit", async (e) => {
    e.preventDefault();

    const chem_id    = toNum(($("chem_id").value || 0), 0);
    const company_id = toNum(($("company_id").value || 0), 0);
    const orderuse   = toNum(qtyInput.value, 0);
    const orderbuy   = toNum(totalInput.value, 0);
    const chem_price = orderuse > 0 ? round2(orderbuy / orderuse) : 0;

    if (!chem_id)    return alert("กรุณาเลือกชื่อทางการค้า");
    if (!company_id) return alert("กรุณาเลือกชื่อบริษัทที่ขายสารเคมี");
    if (orderuse < 200) return alert("ปริมาณที่สั่งต้องไม่น้อยกว่า 200");

    const payload = {
      prodetail_id: null,
      chem_id,
      proorder_id: null,     // ✅ ไม่ส่งค่า (ตามที่ต้องการ)
      company_id,
      orderuse,
      chem_price,            // คำนวณ
      orderbuy,              // ราคารวมที่จ่าย
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
      // ✅ กลับหน้ารายการแบบไม่กรอง
      location.href = `/productorderdetail/index.html`;
    } catch (err) {
      console.error(err);
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });
});
