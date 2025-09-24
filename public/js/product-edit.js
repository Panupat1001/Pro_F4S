// public/js/product-edit.js
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const form = document.getElementById("productForm");
  const brandSelect = document.getElementById("brand_id");

  // โหลดแบรนด์ทั้งหมดมาใส่ใน select
  async function loadBrands(selectedId) {
    try {
      const res = await fetch("/brand/read-all"); // ต้องมี API ดึงแบรนด์ทั้งหมด
      const brands = await res.json();
      brandSelect.innerHTML = brands
        .map(
          (b) =>
            `<option value="${b.brand_id}" ${
              b.brand_id == selectedId ? "selected" : ""
            }>${b.brand_name}</option>`
        )
        .join("");
    } catch (e) {
      console.error("โหลด brand error:", e);
      brandSelect.innerHTML = `<option value="">-- โหลดแบรนด์ไม่สำเร็จ --</option>`;
    }
  }

  // โหลดข้อมูล product
  async function loadProduct() {
    if (!id) return;
    try {
      const res = await fetch(`/product/${id}`);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();

      document.getElementById("product_name").value = data.product_name || "";
      document.getElementById("notify_no").value = data.notify_no || "";
      document.getElementById("notify_date").value = data.notify_date || "";
      document.getElementById("expire_date").value = data.expire_date || "";

      await loadBrands(data.brand_id);

      // แสดงรูปเก่า + เก็บค่าไว้ใน hidden input
      if (data.product_picture1) {
        document.getElementById("preview1").src = data.product_picture1;
        document.getElementById("old_picture1").value = data.product_picture1;
      }
      if (data.product_picture2) {
        document.getElementById("preview2").src = data.product_picture2;
        document.getElementById("old_picture2").value = data.product_picture2;
      }
      if (data.product_picture3) {
        document.getElementById("preview3").src = data.product_picture3;
        document.getElementById("old_picture3").value = data.product_picture3;
      }
    } catch (err) {
      console.error("โหลด product error:", err);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      window.location.href = "/product/index.html";
    }
  }

  // preview image ทันทีที่เลือกไฟล์ใหม่
  ["product_picture1", "product_picture2", "product_picture3"].forEach(
    (field, idx) => {
      document.getElementById(field).addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById(`preview${idx + 1}`).src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  );

  // submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const url = id ? `/product/${id}` : "/product/create";
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        body: formData,
      });

      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      alert("บันทึกสำเร็จ");
      window.location.href = "/product/index.html";
    } catch (err) {
      console.error("บันทึก error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  });

  // โหลดข้อมูลเริ่มต้น
  if (id) {
    await loadProduct();
  } else {
    await loadBrands(null);
  }
});
