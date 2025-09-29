// /public/js/productorder-detail.js
document.addEventListener("DOMContentLoaded", init);

async function init() {
  const qs = new URLSearchParams(location.search);
  const id = qs.get("id");
  if (!id) {
    alert("ไม่พบรหัสคำสั่งผลิต");
    location.href = "/productorder/index.html";
    return;
  }

  const $ = (id) => document.getElementById(id);
  const fmtNum = (n) =>
    (n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "-");

  try {
    // --- โหลดออเดอร์ ---
    const order = await fetchOrder(id);

    // --- ใส่ฟิลด์บน ---
    $("product_name").value = order.product_name ?? "-";
    $("product_code").value = order.product_code ?? "-";
    $("order_lot").value = order.order_lot ?? "-"; // แ
