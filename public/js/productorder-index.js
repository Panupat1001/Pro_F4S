// /public/js/productorder-index.js
document.addEventListener('DOMContentLoaded', () => {
  // --------- DOM refs ---------
  const tbody = document.getElementById('productorder-tbody');
  const pager = document.getElementById('productorder-pagination');
  const tableWrapper = document.getElementById('table-wrapper');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  // --------- State ---------
  const state = {
    page: 1,
    pageSize: 10,
    q: '',
    sortField: 'order_date', // ปรับตามคอลัมน์จริงใน DB
    sortOrder: 'desc',
    total: 0,
    items: [],
  };

  // --------- Utils ---------
  const escape = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  function fmtDate(d) {
    if (!d) return '-';
    // รองรับทั้ง 'YYYY-MM-DD' และ ISO string
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return escape(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
  }

  function statusBadge(s) {
    const k = String(s ?? '').toLowerCase();
    let cls = 'secondary';
    if (['pending', 'รอดำเนินการ'].includes(k)) cls = 'warning';
    else if (['confirmed', 'ยืนยัน'].includes(k)) cls = 'info';
    else if (['paid', 'ชำระเงินแล้ว'].includes(k)) cls = 'primary';
    else if (['shipped', 'จัดส่งแล้ว'].includes(k)) cls = 'success';
    else if (['cancelled', 'ยกเลิก'].includes(k)) cls = 'danger';
    return `<span class="badge text-bg-${cls}">${escape(s || '-')}</span>`;
  }

  // --------- API ---------
  async function fetchList() {
    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      q: state.q,
      sortField: state.sortField,
      sortOrder: state.sortOrder,
    });

    const res = await fetch(`/productorder/list?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');

    // รองรับทั้งรูปแบบ { items, total } และ array[] เผื่อ API ฝั่งคุณยังไม่แยก total
    const data = await res.json();
    if (Array.isArray(data)) {
      state.items = data;
      state.total = data.length;
      return;
    }
    state.items = Array.isArray(data.items) ? data.items : [];
    state.total = Number(data.total ?? state.items.length);
  }

 function renderRows(items) {
  if (!tbody) return;
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((x) => `
    <tr>
      <td>#${escape(x.proorder_id)}</td>
      <td>${fmtDate(x.order_date)}</td>
      <td>${escape(x.order_lot)}</td>
      <td>${escape(x.order_quantity)}</td>
      <td class="text-nowrap">
        <a class="btn btn-sm btn-outline-secondary me-1"
           href="/productorder/detail.html?id=${encodeURIComponent(x.proorder_id)}">
          <i class="bi bi-eye"></i> ดู
        </a>
        <a class="btn btn-sm btn-primary"
           href="/productorder/edit.html?id=${encodeURIComponent(x.proorder_id)}">
          <i class="bi bi-pencil-square"></i> แก้ไข
        </a>
      </td>
    </tr>
  `).join('');
}


  function renderPager() {
    if (!pager) return;
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const cur = Math.min(Math.max(1, state.page), totalPages);

    function pageBtn(p, label = p, disabled = false, active = false) {
      const dis = disabled ? ' disabled' : '';
      const act = active ? ' active' : '';
      return `
        <li class="page-item${dis}${act}">
          <a class="page-link" href="#" data-page="${p}">${label}</a>
        </li>`;
    }

    const hasPrev = cur > 1;
    const hasNext = cur < totalPages;

    // สร้างช่วงเลขหน้าเล็กๆ
    const windowSize = 5;
    const start = Math.max(1, cur - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);
    const realStart = Math.max(1, end - windowSize + 1);

    let html = '';
    html += pageBtn(cur - 1, '&laquo;', !hasPrev, false);
    for (let p = realStart; p <= end; p++) {
      html += pageBtn(p, String(p), false, p === cur);
    }
    html += pageBtn(cur + 1, '&raquo;', !hasNext, false);

    pager.innerHTML = html;

    // bind click
    pager.querySelectorAll('a.page-link').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const p = Number(a.getAttribute('data-page'));
        if (!Number.isFinite(p) || p === state.page) return;
        state.page = Math.max(1, p);
        load();
      });
    });
  }

  function toggleTableWrapper() {
    if (!tableWrapper) return;
    if (state.total === 0) tableWrapper.style.display = 'none';
    else tableWrapper.style.display = '';
  }

  // --------- Load ---------
  async function load() {
    try {
      await fetchList();
      renderRows(state.items);
      renderPager();
      toggleTableWrapper();
    } catch (err) {
      console.error('โหลดรายการสั่งซื้อไม่สำเร็จ:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-danger py-4">
              โหลดข้อมูลไม่สำเร็จ
            </td>
          </tr>`;
      }
    }
  }

  // --------- Events ---------
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      state.q = String(searchInput?.value ?? '').trim();
      state.page = 1;
      load();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.q = String(searchInput.value ?? '').trim();
        state.page = 1;
        load();
      }
    });
  }

  // (ถ้าจะทำให้คลิกหัวตารางเพื่อ sort ได้ ให้เพิ่ม id ให้ <th> แล้ว bind ตรงนี้)
  // ตัวอย่าง:
  // document.getElementById('th-order-date')?.addEventListener('click', () => {
  //   state.sortField = 'order_date';
  //   state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  //   state.page = 1;
  //   load();
  // });

  // --------- First load ---------
  load();
});
