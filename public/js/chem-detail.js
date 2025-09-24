// /public/js/chem-detail.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // 1) ดึง id จาก query string
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    alert("ไม่พบพารามิเตอร์ id");
    return;
  }

  // 2) helper ใส่ค่าแบบปลอดภัย
  const setVal = (id, v) => { const el = $(id); if (el) el.value = v ?? ""; };

  // 3) โหลดรายละเอียด: พยายาม /chem/:id ก่อน ถ้า 404 ค่อยลอง /chem/read?id=
  async function fetchDetail() {
    // ทางเลือกที่ 1: /chem/:id
    try {
      const r = await fetch(`/chem/${encodeURIComponent(id)}`);
      if (r.ok) return await r.json();
      if (r.status !== 404) throw new Error(`GET /chem/${id} -> ${r.status}`);
    } catch (e) {
      console.warn("fallback to /chem/read?id=", e);
    }

    // ทางเลือกที่ 2: /chem/read?id=
    const r2 = await fetch(`/chem/read?id=${encodeURIComponent(id)}`);
    if (!r2.ok) throw new Error(`GET /chem/read?id= -> ${r2.status}`);
    const arr = await r2.json();
    if (!arr || arr.length === 0) throw new Error("ไม่พบข้อมูลรายการนี้");
    return arr[0];
  }

  async function load() {
    try {
      const data = await fetchDetail();
      console.log("chem-detail:", data); // ดูใน DevTools > Console

      // 4) map ค่าลง input/textarea — ชื่อ id ต้องตรงกับหน้า HTML
      setVal("chem_name", data.chem_name);
      setVal("inci_name", data.inci_name);
      setVal("chem_code", data.chem_code ?? data.chem_id);
      setVal("chem_type", data.chem_type);
      setVal("chem_unit", data.chem_unit);
      setVal("chem_quantity", data.chem_quantity);
      setVal("chem_reorder", data.chem_reorder);
      setVal("price_gram", data.price_gram);
      setVal("chem_note", data.chem_note);
    } catch (err) {
      console.error(err);
      alert("โหลดรายละเอียดไม่สำเร็จ");
    }
  }

  load();
});
