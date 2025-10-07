// /public/js/showdetail-index.js
document.addEventListener('DOMContentLoaded', function () {
  const tbody = document.getElementById('productorder-tbody');
  const pager = document.getElementById('productorder-pagination');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  const tableWrapper =
    document.getElementById('productorder-table-wrapper') ||
    (tbody ? tbody.closest('.table-responsive') : null) ||
    (tbody ? tbody.parentElement : null);

  // Client-side paging
  const PAGE_SIZE = 10;
  let currentPage = 1;

  // สถานะค้นหา/เรียง
  const state = {
    page: 1,            // ส่งให้ BE ถ้าจำเป็น (ที่นี่เรา slice ฝั่ง client)
    pageSize: 10000,    // ดึงมาเยอะ ๆ แล้วค่อยแบ่งหน้าเอง
    q: '',
    sortField: 'product_name', // default ให้ตรงกับหัวตาราง
    sortOrder: 'asc',
    allItems: []
  };

  // ===== Helpers =====
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );

  const sortBy = (arr, field, order) => {
    const dir = order === 'desc' ? -1 : 1;
    return arr.slice().sort((a, b) => {
      const av = (a?.[field] ?? '').toString().toLowerCase();
      const bv = (b?.[field] ?? '').toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  };

  // ===== Fetch from BE =====
  function fetchList() {
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      q: state.q,
      sortField: state.sortField,
      sortOrder: state.sortOrder
    });

return fetch('/showdetail/list?' + params.toString(), { headers: { Accept: 'application/json' }
    }).then((res) => {
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    });
  }

  // ===== Render =====
  function renderTablePage(data, page) {
    const total = data.length;

    if (!total) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (pager) pager.innerHTML = '';
      if (tbody) tbody.innerHTML = '';
      return;
    }
    if (tableWrapper) tableWrapper.style.display = '';

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page || 1), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    const html = pageItems
      .map((x) => {
        // ให้ตรงกับ route /productorder/list ที่เราทำไว้: id, product_name, product_image, batch_code, brand_name
        const id = x.id ?? x.productorder_id ?? '';
        const productName =
          x.product_name ??
          x.name ??
          (x.product && (x.product.product_name ?? x.product.name)) ??
          '-';
        const brandName = x.brand_name ?? x.brand ?? '-';
        const batchCode = x.batch_code ?? x.batch ?? '-';
        const img = x.product_image ?? x.image_url ?? x.image ?? '';

        const viewHref = id ? `/productorder/detail.html?id=${encodeURIComponent(id)}` : 'javascript:void(0)';

        return `
          <tr data-id="${esc(id)}">
            <td>${esc(productName)}</td>
            <td class="text-center" style="width:150px;">
              ${
                img
                  ? `<img src="${esc(img)}" alt="${esc(productName)}" class="img-thumbnail" style="max-height:90px;object-fit:cover;">`
                  : `<div class="text-muted">-</div>`
              }
            </td>
            <td>${esc(batchCode)}</td>
            <td>${esc(brandName)}</td>
            <td class="text-nowrap">
              <div class="btn-group btn-group-sm">
                <a href="${id ? `/productorder/detail.html?id=${encodeURIComponent(id)}` : '#'}"
                   class="btn btn-sm text-white"
                   style="background-color:#00d312; border-color:#00d312;"
                   title="ดูรายละเอียด" ${id ? '' : 'tabindex="-1" aria-disabled="true" disabled'}>
                  📋
                </a>
                <a href="${id ? `/productorder/edit.html?id=${encodeURIComponent(id)}` : '#'}"
                   class="btn btn-dark btn-sm btn-edit"
                   data-id="${esc(id)}"
                   title="แก้ไขข้อมูล" ${id ? '' : 'tabindex="-1" aria-disabled="true" disabled'}>
                  <i class="bi bi-pencil"></i>
                </a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.innerHTML = html;
    if (pager) renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const cur = currentPage;
    let html = '<ul class="pagination justify-content-center">';

    const add = (label, page, disabled, active) => {
      html += `
        <li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${page}">${label}</a>
        </li>`;
    };

    add('«', 1, cur === 1, false);
    add('‹', Math.max(cur - 1, 1), cur === 1, false);

    const windowSize = 2;
    let start = Math.max(1, cur - windowSize);
    let end = Math.min(totalPages, cur + windowSize);
    for (let p = start; p <= end; p++) add(String(p), p, false, p === cur);

    add('›', Math.min(cur + 1, totalPages), cur === totalPages, false);
    add('»', totalPages, cur === totalPages, false);

    html += '</ul>';
    pager.innerHTML = html;
  }

  // ===== Load + wire events =====
  function load() {
    fetchList()
      .then((data) => {
        // รองรับ response ได้หลายรูปแบบ
        let items = [];
        if (Array.isArray(data)) items = data;
        else if (Array.isArray(data?.items)) items = data.items;
        else if (Array.isArray(data?.data)) items = data.data;
        else if (data && typeof data === 'object') {
          for (const k in data) {
            if (Array.isArray(data[k])) {
              items = data[k];
              break;
            }
          }
        }

        // เรียง client ให้ตรงกับหัวข้อที่เลือก (ป้องกันกรณี BE ไม่ได้เรียงให้)
        const safeItems = Array.isArray(items) ? items : [];
        const sorted = state.sortField
          ? sortBy(safeItems, state.sortField, state.sortOrder)
          : safeItems;

        state.allItems = sorted;
        renderTablePage(state.allItems, 1);
      })
      .catch((err) => {
        console.error('[showdetail-index] load error:', err);
        if (tbody) {
          tbody.innerHTML =
            '<tr><td class="text-danger" colspan="5">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        }
        if (pager) pager.innerHTML = '';
      });
  }

  // sort handler ตามหัวตาราง (ให้ตรงกับ index.html)
  const ths = document.querySelectorAll('thead th[data-field]');
  ths.forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-field');
      if (!field) return;

      if (state.sortField === field) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortOrder = 'asc';
      }

      // re-sort ที่ client แล้ว render ใหม่ทันที (รวดเร็ว)
      state.allItems = sortBy(state.allItems, state.sortField, state.sortOrder);
      renderTablePage(state.allItems, 1);

      // ไฮไลต์ไอคอนคอลัมน์ที่กำลัง sort
      document
        .querySelectorAll('thead th[data-field] .sort-icon')
        .forEach((i) => i.classList.remove('text-primary'));
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.classList.add('text-primary');
    });
  });

  // pagination click
  pager.addEventListener('click', function (e) {
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    const p = parseInt(a.getAttribute('data-page'), 10);
    if (Number.isFinite(p) && p > 0) {
      renderTablePage(state.allItems, p);
      tableWrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // search
  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      state.q = (searchInput?.value || '').trim();
      load();
    });
  }
  if (searchInput) {
    // Enter เพื่อค้นหา
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        state.q = (searchInput?.value || '').trim();
        load();
      }
    });
    // debounce input
    let t = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = (searchInput?.value || '').trim();
        load();
      }, 400);
    });
  }

  // init
  load();
});
