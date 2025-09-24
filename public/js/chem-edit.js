// /js/chem-edit.js
(function () {
  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const alertBox = $('#alertBox');
  const btnSave = $('#btnSave');
  const form = $('#chemForm');
  const inputs = () => form?.querySelectorAll('input, textarea, select') ?? [];

  // เตรียม Bootstrap Modal (ถ้ามี)
  const confirmModalEl = document.getElementById('confirmModal');
  const confirmBtn = document.getElementById('confirmSave');
  const confirmModal = (typeof bootstrap !== 'undefined' && confirmModalEl)
    ? new bootstrap.Modal(confirmModalEl)
    : null;

  if (!id) {
    showAlert('danger', 'ไม่พบรหัสรายการ (id) สำหรับแก้ไข');
    if (btnSave) btnSave.disabled = true;
    return; // <- อย่าพิมพ์ตัวอักษรอื่นต่อจากนี้ (ลบคำว่า "ถูกไหม")
  }

  setFormEnabled(false);

  (async function loadData() {
    try {
      const item = await getDetail(id);
      $('#chem_name').value     = item.chem_name     ?? '';
      $('#inci_name').value     = item.inci_name     ?? '';
      $('#chem_type').value     = item.chem_type     ?? '';
      $('#chem_unit').value     = item.chem_unit     ?? '';
      $('#chem_quantity').value = String(item.chem_quantity ?? 0);
      $('#chem_reorder').value  = String(item.chem_reorder  ?? 0);
      $('#price_gram').value    = String(item.price_gram    ?? 0);
      $('#chem_note').value     = item.chem_note     ?? '';
    } catch (e) {
      console.error(e);
      const msg = e?.code === 404 ? 'ไม่พบข้อมูลรายการนี้' : 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
      showAlert('danger', msg);
      if (btnSave) btnSave.disabled = true;
      return;
    } finally {
      setFormEnabled(true);
    }
  })();

  // กด submit -> แสดงยืนยันก่อน
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // ใช้ Bootstrap Modal ถ้ามี
    if (confirmModal && confirmBtn) {
      confirmModal.show();
      confirmBtn.addEventListener('click', onConfirmOnce, { once: true });
      return;
    }

    // Fallback: confirm() ธรรมดา
    const ok = confirm('คุณต้องการบันทึกการแก้ไขสารเคมีนี้ใช่หรือไม่?');
    if (ok) doSave();
  });

  async function onConfirmOnce() {
    confirmModal.hide();
    await doSave();
  }

  async function doSave() {
    const payload = {
      chem_id: id,
      chem_name: $('#chem_name').value.trim(),
      inci_name: $('#inci_name').value.trim(),
      chem_type: $('#chem_type').value.trim(),
      chem_unit: $('#chem_unit').value.trim(),
      chem_quantity: toFloat($('#chem_quantity').value),
      chem_reorder: toFloat($('#chem_reorder').value),
      price_gram: toFloat($('#price_gram').value),
      chem_note: $('#chem_note').value.trim()
    };

    if (!payload.chem_name || !payload.inci_name) {
      showAlert('warning', 'กรุณากรอกชื่อทางการค้า และ INCI Name');
      return;
    }

    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';
    }
    setFormEnabled(false);

    try {
      // ให้ตรงกับ BE: PATCH /chem/update/:id
      const res = await fetch(`/chem/update/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || 'บันทึกไม่สำเร็จ');
      }

      showAlert('success', 'บันทึกการแก้ไขสำเร็จ');
      setTimeout(() => (location.href = '/chem/index.html'), 800);
    } catch (e) {
      console.error(e);
      showAlert('danger', e.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="bi bi-save"></i> บันทึกการแก้ไข';
      }
      setFormEnabled(true);
    }
  }

  // -------- helper functions --------
  async function getDetail(id) {
    const tryFetch = async (url) => {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.status === 404) {
        const err = new Error('Not found'); err.code = 404; throw err;
      }
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    };

    try {
      // /chem/detail -> object
      const item = await tryFetch(`/chem/detail?id=${encodeURIComponent(id)}`);
      return item;
    } catch (e) {
      if (e.code === 404) {
        // /chem/read/:id -> array
        const rows = await tryFetch(`/chem/read/${encodeURIComponent(id)}`);
        const item = Array.isArray(rows) ? rows[0] : rows;
        if (!item) { const err = new Error('Not found'); err.code = 404; throw err; }
        return item;
      }
      throw e;
    }
  }

  function setFormEnabled(enabled) {
    inputs().forEach(el => el.disabled = !enabled);
    if (btnSave) btnSave.disabled = !enabled;
  }

  function showAlert(type, msg) {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }

  function toFloat(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
  }
})();
