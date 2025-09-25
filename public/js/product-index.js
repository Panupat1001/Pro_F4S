// /public/js/product-index.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("product-tbody");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const pager = document.getElementById("product-pager");
  const tableWrapper = document.getElementById("product-table-wrapper"); // ครอบตาราง

  if (!tbody) return;

  const PAGE_SIZE = 7;
  let fullData = [];
  let currentPage = 1;

  // ตัวแปรสถานะการเรียง
  let sortField = "product_name";   // ชื่อคอลัมน์สำหรับ sort ฝั่ง client
  let sortDirection = "asc";        // "asc" | "desc"

  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

  async function fetchList(keyword = "") {
    const url = keyword
      ? `/product/read-all?q=${encodeURIComponent(keyword)}`
      : `/product/read-all`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    return res.json(); // ← array
  }

  // อัปเดตไอคอนลูกศรบนหัวตารางตามสถานะเรียง
  function updateSortIcons() {
    document.querySelectorAll("thead th[data-sort] .sort-icon").forEach((icon) => {
      icon.className = "bi bi-arrow-down-up sort-icon"; // reset ↕
    });
    if (sortField) {
      const activeIcon = document.querySelector(
        `thead th[data-sort="${sortField}"] .sort-icon`
      );
      if (activeIcon) {
        activeIcon.className =
          sortDirection === "asc"
            ? "bi bi-arrow-up sort-icon"
            : "bi bi-arrow-down sort-icon";
      }
    }
  }

  // เรียง fullData แล้ว render หน้าแรก
  function sortData(field) {
    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }

    fullData.sort((a, b) => {
      let valA = a?.[field];
      let valB = b?.[field];

      // รองรับ null/undefined
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDirection === "asc" ? -1 : 1;
      if (valB == null) return sortDirection === "asc" ? 1 : -1;

      // ถ้าเป็นวันที่ (notify_date, expire_date) ให้เทียบแบบ Date
      if (field === "notify_date" || field === "expire_date") {
        const dA = new Date(valA); const dB = new Date(valB);
        const aT = isNaN(dA.getTime()) ? 0 : dA.getTime();
        const bT = isNaN(dB.getTime()) ? 0 : dB.getTime();
        if (aT < bT) return sortDirection === "asc" ? -1 : 1;
        if (aT > bT) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }

      // ตัวเลข vs ข้อความ
      const numA = Number(valA);
      const numB = Number(valB);
      const bothNumeric = !Number.isNaN(numA) && !Number.isNaN(numB);

      if (bothNumeric) {
        if (numA < numB) return sortDirection === "asc" ? -1 : 1;
        if (numA > numB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      } else {
        const sA = String(valA).toLowerCase();
        const sB = String(valB).toLowerCase();
        if (sA < sB) return sortDirection === "asc" ? -1 : 1;
        if (sA > sB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }
    });

    updateSortIcons();
    renderTablePage(fullData, 1);
  }

  function statusBadge(statusNumber) {
    // 0=ยังไม่หมดอายุ, 1=ใกล้หมดอายุ, 2=หมดอายุ
    const map = {
      0: { text: "ยังไม่หมดอายุ", cls: "badge bg-success" },
      1: { text: "ใกล้หมดอายุ", cls: "badge bg-warning text-dark" },
      2: { text: "หมดอายุ", cls: "badge bg-danger" },
    };
    const meta = map[Number(statusNumber)] ?? { text: "-", cls: "badge bg-secondary" };
    return `<span class="${meta.cls}">${escape(meta.text)}</span>`;
  }

  function renderTablePage(data, page = 1) {
    const total = data.length;

    if (total === 0) {
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = "";
      return;
    }
    if (tableWrapper) tableWrapper.style.display = "";

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    const html = pageItems
      .map(
        (item) => `
        <tr>
          <td>${escape(item.product_name)}</td>
          <td class="text-center">
            ${
              item.product_image
                ? `<img src="${escape(item.product_image)}" class="img-thumbnail" style="max-width:70px; max-height:70px;">`
                : "-"
            }
          </td>
          <td>${escape(item.notify_no)}</td>
          <td>${escape(item.notify_date)}</td>
          <td>${escape(item.expire_date)}</td>
          <td>${escape(item.brand_name)}</td>
          <td>${statusBadge(item.status)}</td>
          <td class="text-nowrap">
            <a href="/product/detail.html?id=${encodeURIComponent(item.id)}"
               class="btn btn-sm text-white"
               style="background-color:#00d312; border-color:#00d312;"
               title="ดูรายละเอียด">📋</a>
            <a href="/product/edit.html?id=${encodeURIComponent(item.id)}"
               class="btn btn-dark btn-sm btn-edit" data-id="${escape(item.id)}" title="แก้ไขข้อมูล">
               <i class="bi bi-pencil"></i>
            </a>
          </td>
        </tr>`
      )
      .join("");

    // ✅ ไม่มีการเติมแถวเปล่า
    tbody.innerHTML = html;

    if (pager) renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!pager) return;

    totalPages = Math.max(1, totalPages);

    const prevDisabled = currentPage === 1 ? "disabled" : "";
    const nextDisabled = currentPage === totalPages ? "disabled" : "";

    const pages = [];
    const windowSize = 2;
    const addPage = (p) =>
      pages.push(
        `<li class="page-item ${p === currentPage ? "active" : ""}">
           <a class="page-link" href="#" data-page="${p}">${p}</a>
         </li>`
      );

    // หน้าแรก
    addPage(1);
    if (currentPage - windowSize > 2)
      pages.push(`<li class="page-item disabled"><span class="page-link">…</span></li>`);

    const start = Math.max(2, currentPage - windowSize);
    const end = Math.min(totalPages - 1, currentPage + windowSize);
    for (let p = start; p <= end; p++) addPage(p);

    if (currentPage + windowSize < totalPages - 1)
      pages.push(`<li class="page-item disabled"><span class="page-link">…</span></li>`);

    if (totalPages > 1) addPage(totalPages);

    pager.innerHTML = `
      <ul class="pagination justify-content-center mb-0">
        <li class="page-item ${prevDisabled}">
          <a class="page-link" href="#" data-page="${currentPage - 1}">«</a>
        </li>
        ${pages.join("")}
        <li class="page-item ${nextDisabled}">
          <a class="page-link" href="#" data-page="${currentPage + 1}">»</a>
        </li>
      </ul>`;

    pager.querySelectorAll("a.page-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const p = Number(a.getAttribute("data-page"));
        if (!Number.isNaN(p)) renderTablePage(fullData, p);
      });
    });
  }

  async function load(keyword = "") {
    try {
      const data = await fetchList(keyword);
      fullData = Array.isArray(data) ? data : [];

      // เรียงครั้งแรกตาม sortField เริ่มต้น
      updateSortIcons();
      sortData(sortField); // จะ render เองที่หน้า 1
    } catch (e) {
      console.error(e);
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
  }

  // โหลดครั้งแรก
  load();

  // ค้นหา
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => load(searchInput.value.trim()));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load(searchInput.value.trim());
    });
  }

  // จับคลิกหัวตาราง (data-sort)
  document.querySelectorAll("thead th[data-sort]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      sortData(field);
    });
  });

  // เดลิเกตกดปุ่มแก้ไข
  tbody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    if (!editBtn) return;
    const id = editBtn.getAttribute("data-id");
    if (!id) return;
    window.location.href = `/product/edit.html?id=${encodeURIComponent(id)}`;
  });
});
