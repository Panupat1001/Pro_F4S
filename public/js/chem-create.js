// /js/chem-create.js
(function () {
  const $ = (sel) => document.querySelector(sel);

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

  // ปิด/เปิดฟอร์ม
  function setFormEnabled(enabled) {
    inputs().forEach(el => el.disabled = !enabled);
    if (btnSave) btnSave.disabled = !enabled;
  }

  // แสดง Alert
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

  // ===== Submit -> ยืนยันก่อนบันทึก =====
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (confirmModal && confirmBtn) {
      confirmModal.show();
      confirmBtn.addEventListener('click', onConfirmOnce, { once: true });
      return;
    }

    // fallback confirm ธรรมดา
    const ok = confirm('ต้องการบันทึกข้อมูลสารเคมีนี้ใช่หรือไม่?');
    if (ok) doSave();
  });

  async function onConfirmOnce() {
    confirmModal.hide();
    await doSave();
  }

  async function doSave() {
    const payload = {
      chem_name: $('#chem_name').value.trim(),
      inci_name: $('#inci_name').value.trim(),
      chem_type: $('#chem_type').value.trim(),
      chem_unit: $('#chem_unit').value.trim(),
      chem_quantity: toFloat($('#chem_quantity').value),
      chem_reorder: toFloat($('#chem_reorder').value),
      price_gram: toFloat($('#price_gram').value),
      chem_note: $('#chem_note').value.trim()
    };

    // validate เบื้องต้น
    if (!payload.chem_name || !payload.inci_name) {
      showAlert('warning', 'กรุณากรอกชื่อทางการค้า และ INCI Name');
      return;
    }

    setFormEnabled(false);
    if (btnSave) {
      btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';
    }

    try {
      // ให้ตรงกับ BE: POST /chem/create
      const res = await fetch('/chem/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err?.message || 'บันทึกไม่สำเร็จ');
      }

      showAlert('success', 'บันทึกสำเร็จ');
      setTimeout(() => (location.href = '/chem/index.html'), 800);
    } catch (e) {
      console.error(e);
      showAlert('danger', e.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setFormEnabled(true);
      if (btnSave) {
        btnSave.innerHTML = '<i class="bi bi-save"></i> บันทึก';
      }
    }
  }
})();
