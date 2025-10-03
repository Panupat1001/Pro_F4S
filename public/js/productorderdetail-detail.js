// /public/js/productorderdetail-detail.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  // --- ดึง id จาก query หลายชื่อให้ครอบคลุม ---
  const id =
    Number(qs.get("id")) ||
    Number(qs.get("pod_id")) ||
    Number(qs.get("detailId")) ||
    0;

  // --- utils ---
  const toNum = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const fmtInt = (n) =>
    Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtMoney = (n) =>
    Number(n ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const setVal = (el, v, opt = {}) => {
    if (!el) return;
    const { mode = "text", placeholder = "-" } = opt;
    const val =
      v === null || v === undefined || v === "" ? placeholder : String(v);
    if (mode === "input") el.value = val;
    else el.textContent = val;
  };

  // --- elements ---
  const el = {
    chem_name: $("chem_name"),
    company_name: $("company_name"),
    orderuse: $("orderuse"),
    chem_price: $("chem_price"),
    orderbuy: $("orderbuy"),
    coa: $("coa"),
    msds: $("msds"),
  };

  // --- โหลดข้อมูลหลัก ---
  async function fetchDetail(detailId) {
    if (!detailId) throw new Error("ไม่พบรหัสรายการ (id)");

    // รองรับหลาย endpoint ที่คุณมีอยู่จริง
    const urls = [
      `/productorderdetail/read/${detailId}`, // route ที่คุณมีแล้ว (คืน object เดียว)
      `/productorderdetail/read?id=${detailId}`, // เผื่ออีกแบบ
      `/productorderdetail/${detailId}`, // กรณีมี alias
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();

        // map ให้กลายเป็น object แถวเดียว
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) continue;

        // รองรับชื่อฟิลด์หลายแบบ (จาก SQL JOIN ที่คุณเขียนไว้)
        const view = {
          chem_name:
            row.chem_name ??
            row.CHEM_NAME ??
            row.chemName ??
            (row.chem_id ? `[${row.chem_id}]` : "-"),
          company_name:
            row.company_name ?? row.COMPANY_NAME ?? row.companyName ?? "-",
          orderuse: toNum(row.orderuse ?? row.ORDERUSE ?? row.qty ?? 0, 0),
          chem_price: toNum(row.chem_price ?? row.CHEM_PRICE ?? row.price ?? 0, 0),
          orderbuy: toNum(row.orderbuy ?? row.ORDERBUY ?? row.total ?? 0, 0),
          coa: row.coa ?? row.COA ?? null,
          msds: row.msds ?? row.MSDS ?? null,
        };

        return view;
      } catch {
        // ลอง url ถัดไป
      }
    }

    // ถ้าทุก url ไม่เวิร์ก ให้โยน error
    const e = new Error("ไม่พบข้อมูลรายการ (404)");
    e.code = 404;
    throw e;
  }

  async function init() {
    // สถานะโหลดเบื้องต้น
    setVal(el.chem_name, "กำลังโหลด...", { mode: "input" });
    setVal(el.company_name, "", { mode: "input" });
    setVal(el.orderuse, "", { mode: "input" });
    setVal(el.chem_price, "", { mode: "input" });
    setVal(el.orderbuy, "", { mode: "input" });
    setVal(el.coa, "", { mode: "input" });
    setVal(el.msds, "", { mode: "input" });

    try {
      const v = await fetchDetail(id);

      // ใส่ค่าลงฟอร์ม (readonly inputs)
      setVal(el.chem_name, v.chem_name, { mode: "input" });
      setVal(el.company_name, v.company_name, { mode: "input" });
      setVal(el.orderuse, fmtInt(v.orderuse), { mode: "input" });
      setVal(el.chem_price, fmtMoney(v.chem_price), { mode: "input" });
      setVal(el.orderbuy, fmtMoney(v.orderbuy), { mode: "input" });
      setVal(el.coa, v.coa || "-", { mode: "input" });
      setVal(el.msds, v.msds || "-", { mode: "input" });

      // ถ้าราคา/กรัมว่าง แต่มี orderuse/total → คำนวณให้
      if (!toNum(v.chem_price) && toNum(v.orderuse) > 0) {
        const calc = toNum(v.orderbuy) / toNum(v.orderuse);
        setVal(el.chem_price, fmtMoney(calc), { mode: "input" });
      }
    } catch (err) {
      console.error(err);
      const msg =
        err?.code === 404
          ? "ไม่พบข้อมูลรายการ (อาจถูกลบแล้วหรือรหัสไม่ถูกต้อง)"
          : (err?.message || "โหลดข้อมูลไม่สำเร็จ");
      alert(msg);

      // แสดง placeholder ให้ครบ
      setVal(el.chem_name, "-", { mode: "input" });
      setVal(el.company_name, "-", { mode: "input" });
      setVal(el.orderuse, "-", { mode: "input" });
      setVal(el.chem_price, "-", { mode: "input" });
      setVal(el.orderbuy, "-", { mode: "input" });
      setVal(el.coa, "-", { mode: "input" });
      setVal(el.msds, "-", { mode: "input" });
    }
  }

  // ปุ่มย้อนกลับ (ถ้ามีในหน้า)
  // ถ้าใช้ <a href="..."> ก็ไม่จำเป็น ส่วนนี้เผื่อกรณีมีปุ่ม id=btnBack
  $("btnBack")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer) history.back();
    else location.href = "/productorderdetail/index.html";
  });

  init();
});
