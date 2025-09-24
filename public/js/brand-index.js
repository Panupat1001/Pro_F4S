// /public/js/brand-index.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("brand-tbody");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const pager = document.getElementById("brand-pagination");
  const tableWrapper = document.getElementById("brand-table-wrapper");

  if (!tbody) return;

  const PAGE_SIZE = 12;
  let fullData = [];
  let currentPage = 1;

  let sortField = null;      // เช่น "brand_name"
  let sortDirection = "asc"; // "asc" | "desc"

  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

  async function fetchList(keyword = "") {
    const url = keyword
      ? `/api/brand/read?q=${encodeURIComponent(keyword)}`
      : `/api/brand/read`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    return res.json();
  }

  function updateSortIcons() {
    document.querySelectorAll("thead th[data-field] .sort-icon").forEach((icon) => {
      icon.className = "bi bi-arrow-down-up sort-icon"; // reset ↕
    });
    if (sortField) {
      const activeIcon = document.querySelector(
        `thead th[data-field="${sortField}"] .sort-icon`
      );
      if (activeIcon) {
        activeIcon.className =
          sortDirection === "asc" ? "bi bi-arrow-up sort-icon" : "bi bi-arrow-down sort-icon";
      }
    }
  }

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

      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDirection === "asc" ? -1 : 1;
      if (valB == null) return sortDirection === "asc" ? 1 : -1;

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

  let html = pageItems
    .map(
      (item) => `
      <tr>
        <td>${escape(item.brand_name)}</td>
        <td>${escape(item.owner_name)}</td>
        <td>${escape(item.brand_line)}</td>
        <td>${escape(item.brand_phonenumber)}</td>
        <td class="text-nowrap">
          <a href="/brand/detail.html?id=${encodeURIComponent(item.brand_id)}"
             class="btn btn-sm text-white"
             style="background-color:#00d312; border-color:#00d312;"
             title="ดูรายละเอียด">📋</a>
          <a href="/brand/edit.html?id=${encodeURIComponent(item.brand_id)}"
             class="btn btn-dark btn-sm btn-edit" data-id="${escape(item.brand_id)}" title="แก้ไขข้อมูล">
             <i class="bi bi-pencil"></i>
          </a>
        </td>
      </tr>`
    )
    .join("");

  // ✅ ไม่มีการเติมแถวเปล่าอีกแล้ว
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
      updateSortIcons();
      renderTablePage(fullData, 1);
    } catch (e) {
      console.error(e);
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
  }

  load();

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => load(searchInput.value.trim()));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load(searchInput.value.trim());
    });
  }

  document.querySelectorAll("thead th[data-field]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-field");
      sortData(field);
    });
  });

  tbody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    if (!editBtn) return;
    const id = editBtn.getAttribute("data-id");
    if (!id) return;
    window.location.href = `/brand/edit.html?id=${encodeURIComponent(id)}`;
  });
});
