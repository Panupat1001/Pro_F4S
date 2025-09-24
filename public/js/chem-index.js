// public/js/chem-index.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("chem-tbody");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const pager = document.getElementById("chem-pagination");
  const tableWrapper = document.getElementById("chem-table-wrapper"); // ✅ ครอบตาราง

  if (!tbody) return; // กันกรณีใช้ไฟล์นี้กับหน้าที่ไม่มีตาราง

  const PAGE_SIZE = 12;
  let fullData = [];
  let currentPage = 1;

  // ✅ ตัวแปรสถานะการเรียง
  let sortField = null;          // เช่น "chem_name"
  let sortDirection = "asc";     // "asc" | "desc"

  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

  async function fetchList(keyword = "") {
    const url = keyword
      ? `/chem/read?q=${encodeURIComponent(keyword)}`
      : `/chem/read`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    return res.json();
  }

  // ✅ อัปเดตไอคอนลูกศรบนหัวตารางตามสถานะเรียง
  function updateSortIcons() {
    document.querySelectorAll("thead th[data-field] .sort-icon").forEach(icon => {
      icon.className = "bi bi-arrow-down-up sort-icon"; // reset เป็น ↕
    });
    if (sortField) {
      const activeIcon = document.querySelector(`thead th[data-field="${sortField}"] .sort-icon`);
      if (activeIcon) {
        activeIcon.className = sortDirection === "asc"
          ? "bi bi-arrow-up sort-icon"     // ขึ้น = น้อย→มาก
          : "bi bi-arrow-down sort-icon";  // ลง = มาก→น้อย
      }
    }
  }

  // ✅ เรียง fullData ตาม field/dir แล้วเรนเดอร์ใหม่
  function sortData(field) {
    if (sortField === field) {
      // คลิกซ้ำสลับทิศทาง
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

  function renderTablePage(data, page = 1) {
    const total = data.length;

    // ❌ ไม่มีข้อมูล → ซ่อนทั้งตาราง + pagination แล้วจบ
    if (total === 0) {
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = ""; // ล้างแถวเดิม
      return;
    }

    // ✅ มีข้อมูล → แสดงตาราง
    if (tableWrapper) tableWrapper.style.display = "";

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    let html = pageItems
      .map(
        (item) => `
        <tr>
          <td>${escape(item.chem_name)}</td>
          <td>${escape(item.inci_name)}</td>
          <td>${escape(item.chem_type)}</td>
          <td>${escape(item.chem_quantity)}</td>
          <td class="text-nowrap">
            <a href="/chem/detail.html?id=${encodeURIComponent(item.chem_id)}"
               class="btn btn-sm text-white"
               style="background-color:#00d312; border-color:#00d312;"
               title="ดูรายละเอียด">📋</a>
            <a href="/chem/edit.html?id=${encodeURIComponent(item.chem_id)}"
               class="btn btn-dark btn-sm btn-edit" data-id="${escape(item.chem_id)}" title="แก้ไขข้อมูล">
               <i class="bi bi-pencil"></i>
            </a>
          </td>
        </tr>`
      )
      .join("");

    // เติมแถวเปล่าให้ครบ 12 แถวเสมอ (คงความสูงตาราง)
    const blanks = PAGE_SIZE - pageItems.length;
    if (blanks > 0) {
      html += Array.from({ length: blanks })
        .map(
          () => `
          <tr>
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
          </tr>`
        )
        .join("");
    }

    tbody.innerHTML = html;

    if (pager) renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!pager) return;

    if (totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }

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

      // ถ้าต้องการให้มีการเรียงเริ่มต้น เช่น ตามชื่อสินค้า:
      // sortField = "chem_name"; sortDirection = "asc";
      // sortData จะเรียก render เองอยู่แล้ว แต่เพื่อเคสที่ไม่ตั้งค่าเริ่มต้น:
      updateSortIcons();
      renderTablePage(fullData, 1);
    } catch (e) {
      console.error(e);
      // กรณี error ให้ซ่อนตารางเหมือนกัน
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
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

  // ✅ จับคลิกหัวตารางเพื่อเรียง
  document.querySelectorAll("thead th[data-field]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-field");
      sortData(field);
    });
  });

  // เดลิเกตกดปุ่มแก้ไข
  tbody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    if (!editBtn) return;
    const id = editBtn.getAttribute("data-id");
    if (!id) return;
    window.location.href = `/chem/create.html?id=${encodeURIComponent(id)}`;
  });
  
});
