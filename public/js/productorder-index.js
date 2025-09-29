// /public/js/productorder-index.js
document.addEventListener('DOMContentLoaded', function () {
  var tbody = document.getElementById('productorder-tbody');
  var pager = document.getElementById('productorder-pagination');
  var searchInput = document.getElementById('searchInput');
  var searchBtn = document.getElementById('searchBtn');

  // ตัวหุ้มตาราง (ไว้ show/hide เวลาไม่มีข้อมูล)
  var tableWrapper =
    document.getElementById('productorder-table-wrapper') ||
    (tbody ? tbody.closest('.table-responsive') : null) ||
    (tbody ? tbody.parentElement : null);

  // ----- ตั้งค่าหน้าละกี่รายการ (Client-side) -----
  var PAGE_SIZE = 10;
  var currentPage = 1;

  var state = {
    page: 1,
    pageSize: 10000,
    q: '',
    sortField: 'order_date',
    sortOrder: 'desc',
    allItems: []
  };

  // โหลดรายการจาก BE
  function fetchList() {
    var params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      q: state.q,
      sortField: state.sortField,
      sortOrder: state.sortOrder
    });
    return fetch('/productorder/list?' + params.toString(), {
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    });
  }

  // —— render หน้าตาราง (client slice) ——
  function renderTablePage(data, page) {
    var total = data.length;

    if (total === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (pager) pager.innerHTML = '';
      if (tbody) tbody.innerHTML = '';
      return;
    }
    if (tableWrapper) tableWrapper.style.display = '';

    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, page || 1), totalPages);

    var start = (currentPage - 1) * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    var pageItems = data.slice(start, end);

    var html = pageItems.map(function (x) {
      // ----- ตัวช่วยดึงชื่อผลิตภัณฑ์แบบกันเหนียว -----
      var productName =
        x.product_name ??
        x.productName ??
        (x.product && (x.product.product_name ?? x.product.name)) ??
        x.name ??
        '-';

      // ป้องกัน XSS
      productName = escapeHtml(productName);

      var id = x.proorder_id != null ? x.proorder_id : '';
      var lot = escapeHtml(x.order_lot || '-');
      var orderDate = formatDate(x.order_date);
      var expDate = formatDate(x.order_exp);

      return '' +
        '<tr data-proorder-id="' + id + '">' +
          '<td>' + productName + '</td>' +
          '<td>' + lot + '</td>' +
          '<td>' + orderDate + '</td>' +
          '<td>' + expDate + '</td>' +
          '<td class="text-center">' +
            '<div class="btn-group btn-group-sm">' +
              '<a class="btn btn-sm text-white" style="background-color:#00d312; border-color:#00d312;" ' +
                 'href="/productorder/detail.html?id=' + encodeURIComponent(id) + '" title="ดูรายละเอียด">📋</a>' +
            '</div>' +
          '</td>' +
        '</tr>';
    }).join('');

    tbody.innerHTML = html;

    if (pager) renderPagination(totalPages);
  }

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
        // ----- รองรับหลายรูปแบบ response -----
        var items = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (Array.isArray(data.items)) {
          items = data.items;
        } else if (Array.isArray(data.data)) {
          items = data.data;
        } else if (data && typeof data === 'object') {
          // หา array แรกๆ ใน object เผื่อ BE ห่อชื่ออื่น
          for (var k in data) {
            if (Array.isArray(data[k])) { items = data[k]; break; }
          }
        }

        // ดีบั๊กโครงสร้างจริง
        try { console.log('[productorder] sample item:', items[0]); } catch (e) {}

        state.allItems = items || [];
        renderTablePage(state.allItems, 1);
      })
      .catch(function (err) {
        console.error(err);
        if (tbody) {
          tbody.innerHTML = '<tr><td class="text-danger" colspan="5">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        }
        if (pager) pager.innerHTML = '';
      });
  }

  // sort handlers
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

  // utils
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function formatDate(v) {
    if (!v) return '-';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      var d = new Date(v);
      if (isNaN(d.getTime())) return escapeHtml(String(v));
      var y = d.getFullYear();
      var m = pad2(d.getMonth() + 1);
      var day = pad2(d.getDate());
      return y + '-' + m + '-' + day;
    } catch {
      return escapeHtml(String(v));
    }
  }

  // init
  load();
});
