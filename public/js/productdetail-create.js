// public/js/productdetail-create.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("detailForm");
  const productSelect = document.getElementById("product_id");
  const brandName = document.getElementById("brand_name");
  const productCode = document.getElementById("product_code");
  const fdaText = document.getElementById("fda_text");

  // โหลด product list
  (async function loadProducts() {
    try {
      const res = await fetch("/product/read-all");
      if (!res.ok) throw new Error("โหลดผลิตภัณฑ์ไม่สำเร็จ");
      const products = await res.json();
      productSelect.innerHTML =
        `<option value="">-- เลือกผลิตภัณฑ์ --</option>` +
        products.map(p => `<option value="${p.id}">${p.product_name}</option>`).join("");
    } catch (err) {
      console.error(err);
      alert("โหลดผลิตภัณฑ์ไม่สำเร็จ");
    }
  })();

  // เมื่อเลือก product → เติมข้อมูล
  productSelect.addEventListener("change", async () => {
    const id = productSelect.value;
    brandName.value = "";
    productCode.value = "";
    fdaText.textContent = "-";
    if (!id) return;

    try {
      const res = await fetch(`/product/${id}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const d = await res.json();
      brandName.value   = d.brand_name || "";
      productCode.value = d.id || id;
      const fdanum  = d.product_fdanum ?? d.notify_no ?? "";
      const fdadate = d.product_fdadate ?? d.notify_date ?? "";
      fdaText.textContent = fdanum ? `${fdanum}${fdadate ? " • " + fdadate : ""}` : "-";
    } catch (err) {
      console.error(err);
      alert("โหลดรายละเอียดไม่สำเร็จ");
    }
  });

  // กด "ต่อไป" -> ยังไม่บันทึก แค่เก็บร่างแล้วไป edit.html
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pid = productSelect.value;
    if (!pid) { alert("กรุณาเลือกผลิตภัณฑ์"); return; }

    // ดึงข้อมูลล่าสุดของ product เพื่อความครบ
    try {
      const res = await fetch(`/product/${pid}`);
      if (!res.ok) throw new Error();
      const p = await res.json();

      const draft = {
        product_id: Number(p.id),
        product_name: p.product_name || "",
        brand_name: p.brand_name || "",
        product_code: p.id,                                   // ใช้ id เป็นรหัส
        notify_text: (p.product_fdanum ?? p.notify_no ?? "") +
                     ((p.product_fdadate ?? p.notify_date) ? ` • ${p.product_fdadate ?? p.notify_date}` : ""),
        status: 0,                 // ค่าเริ่มต้น "ยังไม่เสร็จ"
        chems: [],                 // รายการสารที่จะเพิ่มในหน้า edit
        remain_percent: 100        // เริ่มต้น 100%
      };

      sessionStorage.setItem("productdetailDraft", JSON.stringify(draft));
      location.href = "/productdetail/edit.html?draft=1";
    } catch {
      alert("โหลดข้อมูลสินค้าไม่สำเร็จ");
    }
  });
});
