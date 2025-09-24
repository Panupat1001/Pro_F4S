// public/js/productdetail-index.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("productdetail-tbody");
  const pagination = document.getElementById("productdetail-pagination");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const ths = document.querySelectorAll("thead th[data-field]");

  let currentPage = 1;
  let currentQuery = "";
  let sortBy = "created_at";
  let sortDir = "desc"; // เริ่มล่าสุดก่อน

  async function fetchList() {
    try {
      const url = `/productdetail/read?page=${currentPage}&q=${encodeURIComponent(
        currentQuery
      )}&sortBy=${encodeURIComponent(sortBy)}&sortDir=${encodeURIComponent(sortDir)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();

      renderTable(data.data || []);
      renderPagination(data.currentPage || 1, data.totalPages || 1);
    } catch (e) {
      console.error(e);
      tbody.innerHTML =
        `<tr><td colspan="4" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
  }

  function renderTable(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (d) => `
        <tr>
          <td>${d.product_name ?? "-"}</td>
          <td>${d.detail_text ?? "-"}</td>
          <td>${d.created_at ?? "-"}</td>
          <td class="text-nowrap">
            <a href="/productdetail/detail.html?id=${d.id}" class="btn btn-sm btn-info">
              <i class="bi bi-eye"></i>
            </a>
            <a href="/productdetail/edit.html?id=${d.id}" class="btn btn-sm btn-primary">
              <i class="bi bi-pencil"></i>
            </a>
            <button class="btn btn-sm btn-danger btn-del" data-id="${d.id}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`
      )
      .join("");
  }

  function renderPagination(current, total) {
    pagination.innerHTML = "";
    if (total <= 1) return;

    const ul = document.createElement("ul");
    ul.className = "pagination justify-content-center";

    for (let i = 1; i <= total; i++) {
      const li = document.createElement("li");
      li.className = "page-item " + (i === current ? "active" : "");
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener("click", (e) => {
        e.preventDefault();
        currentPage = i;
        fetchList();
      });
      ul.appendChild(li);
    }
    pagination.appendChild(ul);
  }

  // Search
  searchBtn.addEventListener("click", () => {
    currentQuery = searchInput.value.trim();
    currentPage = 1;
    fetchList();
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      currentQuery = searchInput.value.trim();
      currentPage = 1;
      fetchList();
    }
  });

  // Sorting (คลิกหัวตาราง)
  ths.forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-field");
      if (sortBy === field) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortBy = field;
        sortDir = "asc";
      }
      currentPage = 1;
      fetchList();
    });
  });

  // Delete
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (!confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) return;

    try {
      const res = await fetch(`/productdetail/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      fetchList();
    } catch (err) {
      console.error(err);
      alert("ลบไม่สำเร็จ");
    }
  });

  // First load
  fetchList();
});
