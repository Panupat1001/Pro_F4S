// public/js/product-edit.js
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { alert('ลิงก์ไม่ถูกต้อง: ไม่พบ id'); return; }

  // ----- DOM -----
  const form        = document.getElementById('productForm');

  const brandSelect = document.getElementById('brand_id');
  const productName = document.getElementById('product_name');

  const notifyNo    = document.getElementById('notify_no');
  const notifyDate  = document.getElementById('notify_date');
  const expireDate  = document.getElementById('expire_date');

  // file inputs
  const file1 = document.getElementById('product_picture1');
  const file2 = document.getElementById('product_picture2');
  const file3 = document.getElementById('product_picture3');

  // hidden (เก็บ URL จริงที่จะส่งไป DB)
  const old1  = document.getElementById('old_picture1');
  const old2  = document.getElementById('old_picture2');
  const old3  = document.getElementById('old_picture3');

  // previews
  const preview1 = document.getElementById('preview1');
  const preview2 = document.getElementById('preview2');
  const preview3 = document.getElementById('preview3');

  // Bootstrap confirm modal (ถ้ามีในหน้า)
  const confirmModalEl = document.getElementById('confirmModal');
  const confirmBtn     = document.getElementById('confirmSave');
  const confirmModal = (typeof bootstrap !== 'undefined' && confirmModalEl)
    ? new bootstrap.Modal(confirmModalEl)
    : null;

  // helpers
  const setVal = (el, v) => { if (el) el.value = v ?? ''; };
  const setImg = (img, url) => { if (img) img.src = url || ''; };

  // ===== โหลดข้อมูล =====
  (async function load() {
    try {
      // เติมแบรนด์ถ้ามี endpoint
      if (brandSelect) {
        try {
          const br = await fetch('/brand/read-all', { headers: { Accept: 'application/json' } });
          if (br.ok) {
            const brands = await br.json();
            brandSelect.innerHTML =
              `<option value="">-- เลือกแบรนด์ --</option>` +
              brands.map(b => `<option value="${b.brand_id}">${b.brand_name}</option>`).join('');
          }
        } catch { /* no-op */ }
      }

      const res = await fetch(`/product/${id}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('โหลดรายละเอียดไม่สำเร็จ');
      const d = await res.json();

      // map ค่าให้ตรงฟอร์มนี้
      const v = {
        brand_id:     d.brand_id ?? '',
        product_name: d.product_name ?? '',
        notify_no:    d.product_fdanum ?? d.notify_no ?? '',
        notify_date:  d.product_fdadate ?? d.notify_date ?? '',
        expire_date:  d.product_exp ?? d.expire_date ?? '',
        pic1:         d.product_picture1 ?? '',
        pic2:         d.product_picture2 ?? '',
        pic3:         d.product_picture3 ?? '',
      };

      setVal(brandSelect, v.brand_id);
      setVal(productName, v.product_name);
      setVal(notifyNo,    v.notify_no);
      setVal(notifyDate,  v.notify_date);
      setVal(expireDate,  v.expire_date);

      // เซ็ตค่า hidden เป็น URL เดิม
      setVal(old1, v.pic1);
      setVal(old2, v.pic2);
      setVal(old3, v.pic3);

      // พรีวิว
      setImg(preview1, v.pic1);
      setImg(preview2, v.pic2);
      setImg(preview3, v.pic3);

      // เคลียร์ค่าไฟล์ (อนุญาตตั้งเป็นค่าว่าง)
      if (file1) file1.value = '';
      if (file2) file2.value = '';
      if (file3) file3.value = '';
    } catch (e) {
      console.error('โหลดข้อมูล error:', e);
      showAlert('danger', 'โหลดข้อมูลไม่สำเร็จ');
    }
  })();

async function uploadAndBind(fileInput, hiddenInput, previewImg) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];

  try {
    const formData = new FormData();
    formData.append('file', file); // ตรงกับ upload.single('file')

    const up = await fetch('/upload/product-image', { method: 'POST', body: formData });
    const uploaded = await up.json().catch(() => null);

    if (!up.ok) {
      const msg = uploaded?.message || `อัปโหลดไม่สำเร็จ (${up.status})`;
      throw new Error(msg);
    }

    const url = uploaded?.url;
    if (!url) throw new Error('รูปแบบผลลัพธ์อัปโหลดไม่ถูกต้อง');

    if (hiddenInput) hiddenInput.value = url;
    if (previewImg) previewImg.src = url;
  } catch (err) {
    console.error('อัปโหลดรูปผิดพลาด:', err);
    showAlert('danger', err.message || 'อัปโหลดรูปไม่สำเร็จ');
    if (fileInput) fileInput.value = ''; // reset เพื่อเลือกใหม่
  }
}


  if (file1) file1.addEventListener('change', () => uploadAndBind(file1, old1, preview1));
  if (file2) file2.addEventListener('change', () => uploadAndBind(file2, old2, preview2));
  if (file3) file3.addEventListener('change', () => uploadAndBind(file3, old3, preview3));

  // ===== บันทึก (PATCH JSON) + ยืนยันก่อน =====
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      // ถ้ามี Bootstrap Modal ให้ใช้ยืนยันก่อน
      if (confirmModal && confirmBtn) {
        confirmModal.show();
        confirmBtn.addEventListener('click', () => {
          confirmModal.hide();
          doSave();
        }, { once: true });
        return;
      }

      // fallback: confirm ธรรมดา
      const ok = confirm('คุณต้องการบันทึกการแก้ไขผลิตภัณฑ์นี้ใช่หรือไม่?');
      if (ok) doSave();
    });
  }

  async function doSave() {
    const payload = {
      brand_id:        brandSelect ? (brandSelect.value || null) : null,
      product_name:    productName ? (productName.value || null) : null,
      product_fdanum:  notifyNo    ? (notifyNo.value || null)    : null,
      product_fdadate: notifyDate  ? (notifyDate.value || null)  : null,
      product_exp:     expireDate  ? (expireDate.value || null)  : null,
      // ส่ง URL รูปจาก hidden (ไม่ใช่ไฟล์)
      product_picture1: old1 ? (old1.value || null) : null,
      product_picture2: old2 ? (old2.value || null) : null,
      product_picture3: old3 ? (old3.value || null) : null,
    };

    try {
      const res = await fetch(`/product/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      if (!res.ok) throw new Error(out?.message || 'บันทึกไม่สำเร็จ');

      showAlert('success', out?.message || 'บันทึกสำเร็จ');
      // redirect อัตโนมัติหลังบันทึก
      setTimeout(() => { location.href = '/product/index.html'; }, 800);
    } catch (e) {
      console.error('บันทึก error:', e);
      showAlert('danger', e.message || 'บันทึกไม่สำเร็จ');
    }
  }

  async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
  }
});

// ===== helper alert (Bootstrap) =====
function showAlert(type, msg) {
  const alertBox = document.getElementById('alertBox');
  if (!alertBox) return alert(msg);
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
}
