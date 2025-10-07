// /public/js/productorderdetail-index.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("productorderdetail-tbody");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const pager = document.getElementById("productorderdetail-pagination");
  const tableWrapper = document.getElementById("productorderdetail-table-wrapper");

  if (!tbody) return;

  const PAGE_SIZE = 12;
  let fullData = [];
  let currentPage = 1;

  // สถานะการเรียง
  let sortField = null;
  let sortDirection = "asc"; // "asc" | "desc"

  // ===== Helpers =====
  const getParam = (k, d = null) =>
    new URLSearchParams(location.search).get(k) ?? d;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

  const fmtNum = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? v.toLocaleString() : "-";
  };

  function normalizePdfUrl(u) {
    if (!u) return null;
    return u.startsWith("/uploads/") ? u.replace("/uploads/", "/files/") : u;
  }

  function pdfLinkHTML(url, label) {
    if (!url) return '<span class="text-muted">-</span>';
    const safe = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
    return `
      <a href="${safe}" target="_blank" rel="noopener"
         class="btn btn-sm btn-outline-primary">
        <i class="bi bi-filetype-pdf"></i> ${label}
      </a>
    `;
  }

  // ===== Load data =====
  async function fetchList(keyword = "") {
    const proorderId = getParam("proorder_id", "");
    const qs = new URLSearchParams();
    if (keyword) qs.set("q", keyword);
    if (proorderId) qs.set("proorder_id", proorderId);

    const url = qs.toString()
      ? `/productorderdetail/read?${qs.toString()}`
      : `/productorderdetail/read`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
    return res.json();
  }

  // ===== Sorting =====
  function updateSortIcons() {
    document
      .querySelectorAll("thead th[data-field] .sort-icon")
      .forEach((icon) => (icon.className = "bi bi-arrow-down-up sort-icon"));

    if (sortField) {
      const active = document.querySelector(
        `thead th[data-field="${sortField}"] .sort-icon`
      );
      if (active) {
        active.className =
          sortDirection === "asc"
            ? "bi bi-arrow-up sort-icon"
            : "bi bi-arrow-down sort-icon";
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
      let A = a?.[field];
      let B = b?.[field];

      if (A == null && B == null) return 0;
      if (A == null) return sortDirection === "asc" ? -1 : 1;
      if (B == null) return sortDirection === "asc" ? 1 : -1;

      const nA = Number(A);
      const nB = Number(B);
      const numeric = !Number.isNaN(nA) && !Number.isNaN(nB);

      if (numeric) {
        if (nA < nB) return sortDirection === "asc" ? -1 : 1;
        if (nA > nB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }

      const sA = String(A).toLowerCase();
      const sB = String(B).toLowerCase();
      if (sA < sB) return sortDirection === "asc" ? -1 : 1;
      if (sA > sB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    updateSortIcons();
    renderTablePage(fullData, 1);
  }

  // ===== Render Table =====
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
    const items = data.slice(start, end);

    const html = items
      .map((x) => {
        const price = Number(x.chem_price);
        const disableBuy = Number.isFinite(price) && price > 0;

        const coaUrl = normalizePdfUrl(x.coa ?? x.COA ?? null);
        const msdsUrl = normalizePdfUrl(x.msds ?? x.MSDS ?? null);

        const buyBtn = disableBuy
          ? `<a class="btn btn-sm btn-secondary disabled"
                 href="javascript:void(0)"
                 tabindex="-1"
                 aria-disabled="true"
                 title="มีราคาแล้ว — ปิดการสั่งซื้อ">
               สั่งซื้อ
             </a>`
          : `<a class="btn btn-sm btn-warning"
                 href="/productorderdetail/buy.html?pod_id=${encodeURIComponent(
                   x.pod_id
                 )}&chem_id=${encodeURIComponent(
            x.chem_id
          )}&chem_name=${encodeURIComponent(x.chem_name)}">
               สั่งซื้อ
             </a>`;

        return `
        <tr>
          <td>${esc(x.chem_name)}</td>
          <td>${esc(x.order_lot)}</td>
          <td>${esc(x.company_name)}</td>
          <td>${fmtNum(x.orderuse)}</td>
          <td>${fmtNum(x.chem_price)}</td>
          <td>${fmtNum(x.orderbuy)}</td>
          <td class="text-center">${pdfLinkHTML(coaUrl, "COA")}</td>
          <td class="text-center">${pdfLinkHTML(msdsUrl, "MSDS")}</td>
          <td class="text-nowrap">
            ${buyBtn}
            <a href="/productorderdetail/edit.html?id=${encodeURIComponent(
              x.pod_id
            )}"
               class="btn btn-dark btn-sm btn-edit"
               data-id="${esc(x.pod_id)}"
               title="แก้ไข">
               <i class="bi bi-pencil"></i>
            </a>
          </td>
        </tr>`;
      })
      .join("");

    tbody.innerHTML = html;
    renderPagination(totalPages);
  }

  // ===== Pagination =====
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
      pages.push(
        `<li class="page-item disabled"><span class="page-link">…</span></li>`
      );

    const start = Math.max(2, currentPage - windowSize);
    const end = Math.min(totalPages - 1, currentPage + windowSize);
    for (let p = start; p <= end; p++) addPage(p);

    if (currentPage + windowSize < totalPages - 1)
      pages.push(
        `<li class="page-item disabled"><span class="page-link">…</span></li>`
      );

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

  // ===== Load & init =====
  async function load(keyword = "") {
    try {
      const data = await fetchList(keyword);
      fullData = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.items)
        ? data.items
        : [];

      updateSortIcons();
      renderTablePage(fullData, 1);
    } catch (e) {
      console.error(e);
      if (tableWrapper) tableWrapper.style.display = "none";
      if (pager) pager.innerHTML = "";
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
  }

  load();

  // ===== Search =====
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => load(searchInput.value.trim()));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load(searchInput.value.trim());
    });
  }

  // ===== Sort Click =====
  document.querySelectorAll("thead th[data-field]").forEach((th) => {
    th.style.cursor = "pointer";
    if (!th.querySelector(".sort-icon")) {
      const i = document.createElement("i");
      i.className = "bi bi-arrow-down-up sort-icon ms-1";
      th.appendChild(i);
    }
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-field");
      sortData(field);
    });
  });

  // ===== Edit Click =====
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-edit");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    location.href = `/productorderdetail/edit.html?id=${encodeURIComponent(id)}`;
  });
});
