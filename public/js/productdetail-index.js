// /public/js/productdetail-index.js
document.addEventListener('DOMContentLoaded', function () {
  var tbody = document.getElementById('productdetail-tbody');
  var pager = document.getElementById('productdetail-pagination');
  var searchInput = document.getElementById('searchInput');
  var searchBtn = document.getElementById('searchBtn');

  // ตัวหุ้มตาราง (ไว้ show/hide เวลาไม่มีข้อมูล)
  var tableWrapper =
    document.getElementById('productdetail-table-wrapper') ||
    (tbody ? tbody.closest('.table-responsive') : null) ||
    (tbody ? tbody.parentElement : null);

  // ----- ตั้งค่าหน้าละกี่รายการ (Client-side) -----
  var PAGE_SIZE = 10;
  var currentPage = 1;

  // state สำหรับคิวรีไป BE (ยังคงคิวรีเพื่อดึงรายการทั้งหมดมา แล้วแบ่งหน้าในฝั่ง client)
  var state = {
    page: 1,           // ไม่ได้ใช้ในการแบ่งหน้า (client ทำเอง) แต่ส่งไป BE ได้ถ้าอยาก
    pageSize: 10000,   // ขอรายการจำนวนมากจาก BE เพื่อให้ client slice ได้
    q: '',
    sortField: 'product_name',
    sortOrder: 'asc',
    allItems: []
  };

  // โหลดรายการจาก BE (พยายามดึง "ทั้งหมด" แล้วให้ client slice)
  function fetchList() {
    var params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),   // ขอเยอะๆ
      q: state.q,
      sortField: state.sortField,
      sortOrder: state.sortOrder
    });
    return fetch('/productdetail/list?' + params.toString(), {
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    });
  }

  // —— แบบใหม่: renderTablePage (แนวเดียวกับตัวอย่างที่ให้มา) ——
  function renderTablePage(data, page) {
    var total = data.length;

    // ไม่มีข้อมูล → ซ่อนทั้งตาราง + pagination
    if (total === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (pager) pager.innerHTML = '';
      if (tbody) tbody.innerHTML = '';
      return;
    }

    // มีข้อมูล → แสดงตาราง
    if (tableWrapper) tableWrapper.style.display = '';

    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page || 1), totalPages);

    var start = (currentPage - 1) * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    var pageItems = data.slice(start, end);

    // ไม่เติมแถว placeholder — render เฉพาะที่มีจริง
    var html = pageItems.map(function (x) {
      var done = x.productdetail_status === 'เสร็จสิ้น' || x.productdetail_status === true;
      var statusBadge = done
        ? '<span class="badge text-bg-success">เสร็จสิ้น</span>'
        : '<span class="badge text-bg-secondary">ยังไม่เสร็จ</span>';
   return '' +
  '<tr data-product-id="' + x.product_id + '">' +
    '<td class="text-end">' + x.product_id + '</td>' +
    '<td>' + escapeHtml(x.product_name || '-') + '</td>' +
    '<td>' + escapeHtml(x.brand_name || '-') + '</td>' +
    '<td>' + (x.productdetail_status === 'เสร็จสิ้น' || x.productdetail_status === true
        ? '<span class="badge text-bg-success">เสร็จสิ้น</span>'
        : '<span class="badge text-bg-danger">ยังไม่เสร็จ</span>') + '</td>' +
    '<td class="text-center">' +
      '<div class="btn-group btn-group-sm me-1">' +
        '<a class="btn btn-sm text-white" style="background-color:#00d312; border-color:#00d312;" ' +
           'href="/productdetail/detail.html?productId=' + encodeURIComponent(x.product_id) + '" title="ดูสูตร">📋</a>' +
      '</div>' +
      '<div class="btn-group btn-group-sm">' +
        '<a class="btn btn-sm btn-dark" ' +
           'href="/productdetail/edit.html?productId=' + encodeURIComponent(x.product_id) + '">เพิ่มสูตร</a>' +
      '</div>' +
    '</td>' +
  '</tr>';

    }).join('');

    tbody.innerHTML = html;

    // วาดเพจจิ้งฝั่ง client
    if (pager) renderPagination(totalPages);
  }

  // วาดเพจจิ้งแบบ client
  function renderPagination(totalPages) {
    var cur = currentPage;
    var html = '<ul class="pagination justify-content-center">';

    function add(label, page, disabled, active) {
      html += '' +
        '<li class="page-item ' + (disabled ? 'disabled' : '') + ' ' + (active ? 'active' : '') + '">' +
          '<a class="page-link" href="#" data-page="' + page + '">' + label + '</a>' +
        '</li>';
    }

    add('«', 1, cur === 1, false);
    add('‹', Math.max(cur - 1, 1), cur === 1, false);

    var windowSize = 2;
    var start = Math.max(1, cur - windowSize);
    var end = Math.min(totalPages, cur + windowSize);
    for (var p = start; p <= end; p++) add(String(p), p, false, p === cur);

    add('›', Math.min(cur + 1, totalPages), cur === totalPages, false);
    add('»', totalPages, cur === totalPages, false);

    html += '</ul>';
    pager.innerHTML = html;
  }

  function load() {
    fetchList()
      .then(function (data) {
        state.allItems = Array.isArray(data.items) ? data.items : [];
        // แบ่งหน้าใน client
        renderTablePage(state.allItems, 1);
      })
      .catch(function (err) {
        console.error(err);
        if (tbody) {
          tbody.innerHTML = '<tr><td class="text-danger" colspan="5">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        }
      });
  }

  // sort handlers (กด sort → ให้ BE เรียง แล้ว client แบ่งหน้า)
  var ths = document.querySelectorAll('thead th[data-field]');
  for (var i = 0; i < ths.length; i++) {
    var th = ths[i];
    th.style.cursor = 'pointer';
    th.addEventListener('click', (function (thEl) {
      return function () {
        var field = thEl.getAttribute('data-field');
        if (!field) return;

        if (state.sortField === field) {
          state.sortOrder = (state.sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          state.sortField = field;
          state.sortOrder = 'asc';
        }
        load();
      };
    })(th));
  }

  // pagination click (client)
  pager.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-page]');
    if (!a) return;
    e.preventDefault();
    var p = parseInt(a.getAttribute('data-page'), 10);
    if (isFinite(p) && p > 0) {
      renderTablePage(state.allItems, p);
    }
  });

  // search
  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      state.q = (searchInput && searchInput.value ? searchInput.value.trim() : '');
      load();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        state.q = searchInput.value.trim();
        load();
      }
    });
  }

  // ปุ่มเพิ่มสูตร: ใช้ id จากปุ่ม/แถว
  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="add-recipe"]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;

    var tr = btn.closest('tr');
    var pidFromBtn = Number(btn.getAttribute('data-product-id')) || 0;
    var pidFromRow = tr ? Number(tr.getAttribute('data-product-id')) : 0;
    var pid = pidFromBtn || pidFromRow;

    if (!pid) {
      alert('ไม่พบ product_id จากแถวนี้');
      return;
    }
    btn.disabled = true;
    location.href = '/productdetail/input.html?productId=' + pid;
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  // init
  load();
});
