document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('productdetail-tbody');
  const pager = document.getElementById('productdetail-pagination');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  // แทนที่หัวคอลัมน์ให้ตรงตามที่ต้องการ

  // state
  const state = {
    page: 1,
    pageSize: 10,
    q: '',
    sortField: 'product_name',
    sortOrder: 'asc'
  };

  async function fetchList() {
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      q: state.q,
      sortField: state.sortField,
      sortOrder: state.sortOrder
    });

    const res = await fetch(`/productdetail/list?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    return res.json();
  }

  function renderRows(items) {
    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="text-center text-muted" colspan="5">ไม่มีข้อมูล</td>
        </tr>`;
      return;
    }

    tbody.innerHTML = items.map((x) => {
      const done = x.productdetail_status === 'เสร็จสิ้น' || x.productdetail_status === true;
      const statusBadge = done
        ? '<span class="badge text-bg-success">เสร็จสิ้น</span>'
        : '<span class="badge text-bg-secondary">ยังไม่เสร็จ</span>';

      return `
        <tr>
        <td class="text-end">${x.product_id}</td>
        <td>${escapeHtml(x.product_name || '-')}</td>
          <td>${escapeHtml(x.brand_name || '-')}</td>
          <td>${statusBadge}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <a class="btn btn-sm text-white"
               style="background-color:#00d312; border-color:#00d312;" href="/productdetail/edit.html?productId=${x.product_id}">📋
              </a>
            </div>
            <div class="btn-group btn-group-sm">
              <a class="btn btn-sm btn-dark"
              href="/productdetail/edit.html?productId=${x.product_id}">
              เพิ่มสูตร
              </a>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function renderPager(total) {
    const totalPages = Math.max(Math.ceil(total / state.pageSize), 1);
    const cur = state.page;

    let html = `<ul class="pagination justify-content-center">`;
    const add = (label, page, disabled = false, active = false) => {
      html += `
        <li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${page}">${label}</a>
        </li>`;
    };

    add('«', 1, cur === 1);
    add('‹', Math.max(cur - 1, 1), cur === 1);

    const windowSize = 2;
    const start = Math.max(1, cur - windowSize);
    const end = Math.min(totalPages, cur + windowSize);
    for (let p = start; p <= end; p++) add(String(p), p, false, p === cur);

    add('›', Math.min(cur + 1, totalPages), cur === totalPages);
    add('»', totalPages, cur === totalPages);

    html += `</ul>`;
    pager.innerHTML = html;
  }

  async function load() {
    try {
      const data = await fetchList();
      renderRows(data.items);
      renderPager(data.total);
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `
        <tr>
          <td class="text-danger" colspan="5">เกิดข้อผิดพลาดในการโหลดข้อมูล</td>
        </tr>`;
    }
  }

  // sort handlers
  document.querySelectorAll('thead th[data-field]').forEach((th) => {
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
      state.page = 1;
      load();
    });
  });

  // pagination click
  pager.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    const p = parseInt(a.getAttribute('data-page'), 10);
    if (Number.isInteger(p) && p > 0) {
      state.page = p;
      load();
    }
  });

  // search
  searchBtn?.addEventListener('click', () => {
    state.q = searchInput.value.trim();
    state.page = 1;
    load();
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      state.q = searchInput.value.trim();
      state.page = 1;
      load();
    }
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  load();
});
