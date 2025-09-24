// public/js/product-detail.js
document.addEventListener("DOMContentLoaded", async () => {
  // อ่าน id จาก query string
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("ไม่พบรหัสผลิตภัณฑ์");
    window.location.href = "/product/index.html";
    return;
  }

  // ฟังก์ชัน escape
  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

  try {
    const res = await fetch(`/product/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");

    const data = await res.json(); // { product_name, brand_name, notify_no, ... }

    // เติมค่าใส่ฟิลด์
    document.getElementById("product_name").value = data.product_name || "";
    document.getElementById("brand_name").value = data.brand_name || "";
    document.getElementById("notify_no").value = data.notify_no || "";
    document.getElementById("notify_date").value = data.notify_date || "";
    document.getElementById("expire_date").value = data.expire_date || "";

    // map สถานะจาก code → text
    const statusMap = {
      0: "ยังไม่หมดอายุ",
      1: "ใกล้หมดอายุ",
      2: "หมดอายุ",
    };
    document.getElementById("status").value =
      statusMap[data.status] ?? "-";

    // รูปภาพ
    ["product_picture1", "product_picture2", "product_picture3"].forEach((field) => {
      const el = document.getElementById(field);
      if (!el) return;
      if (data[field]) {
        el.src = data[field];
        el.style.display = "inline-block";
      } else {
        el.style.display = "none";
      }
    });
  } catch (err) {
    console.error("โหลดรายละเอียด product error:", err);
    alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    window.location.href = "/product/index.html";
  }
});
