// /public/js/productorderdetail-create.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const toNum = (v, d = 0) => {
    const n = Number(String(v ?? "").replaceAll(",", ""));
    return Number.isFinite(n) ? n : d;
  };

  const chemSel = $("chem_id");
  const compSel = $("company_id");
  const orderBuy = $("orderbuy"); // ✅ เปลี่ยนจาก orderUse → orderBuy
  const form = $("formCreate");
  const btnBack = $("btnBack");

  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}\n${text.slice(0,150)}...`);
    if (text.trim().startsWith("<")) throw new Error(`Expected JSON but got HTML from ${url}`);
    return JSON.parse(text);
  };

  const setOptions = (sel, rows, mapFn, placeholder) => {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    rows.forEach((r) => {
      const { value, label } = mapFn(r);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  };

  // โหลด chem
  fetchJson("/chem/read-all")
    .then((rows) => {
      setOptions(
        chemSel,
        rows,
        (c) => ({
          value: c.id ?? c.chem_id,
          label: `${c.chem_name}${c.chem_unit ? " [" + c.chem_unit + "]" : ""}`,
        }),
        "— เลือกสารเคมี —"
      );
    })
    .catch((err) => console.error("load chem error:", err));

  // โหลด company
  fetchJson("/company/read")
    .then((rows) => {
      setOptions(
        compSel,
        rows,
        (c) => ({
          value: c.company_id ?? c.id,
          label: c.company_name ?? c.name,
        }),
        "— เลือกบริษัทผู้ขาย —"
      );
    })
    .catch((err) => console.error("load company error:", err));

  // ปุ่มย้อนกลับ
  btnBack?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorderdetail";
  });

  // ✅ บันทึก — ใช้เฉพาะ orderbuy
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const chem_id = toNum(chemSel.value);
    const company_id = toNum(compSel.value);
    const orderbuy = toNum(orderBuy.value);

    if (!chem_id || !company_id || orderbuy <= 0) {
      alert("กรุณาเลือกสารเคมี บริษัท และกรอกจำนวนกรัม (> 0)");
      return;
    }

    const payload = { chem_id, company_id, orderbuy }; // ✅ ไม่มี orderuse แล้ว

    try {
      const res = await fetch("/productorderdetail/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาด");

      alert("✅ บันทึกสำเร็จ!");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("❌ บันทึกล้มเหลว: " + err.message);
    }
  });
});
