// /public/js/productorder-create.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const productSelect = $('product_select');
  const productCode   = $('product_code');
  const orderQty      = $('order_quantity');
  const orderLot      = $('order_lot');      // ✅ ใช้แสดงอย่างเดียว
  const orderDate     = $('order_date');
  const orderExp      = $('order_exp');
  const form          = $('proorderForm');

  // ----- ช่อง LOT: ปรับเป็น readonly + แค่แสดงตัวอย่าง -----
  if (orderLot) {
    if (!orderLot.placeholder) orderLot.placeholder = '2025-12345-01';
    orderLot.readOnly = true; // ✅ ไม่ให้แก้/ไม่เก็บ
    orderLot.dataset.previewOnly = '1';
    orderLot.title = 'แสดงตัวอย่างจากปี + รหัสผลิตภัณฑ์ + ล็อต (ไม่ถูกบันทึก)';
  }

  function normalizeProducts(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.data))  return payload.data;
    return [];
  }

  async function loadProducts() {
    try {
      console.log('[productorder-create] fetching /product/options-ready-all');
      const res = await fetch('/product/options-ready-all', { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`options-ready-all HTTP ${res.status} ${txt}`);
      }
      const raw  = await res.json();
      const list = normalizeProducts(raw);
      console.log('[productorder-create] options-ready-all count =', list.length);

      if (!list.length) {
        productSelect.innerHTML = '<option value="">— ไม่มีสินค้า (status=1 ทั้งหมด) —</option>';
        return;
      }

      const items = list.map((p) => ({
        id:   p.id ?? p.product_id,
        name: p.product_name ?? p.name ?? `#${p.id ?? p.product_id}`,
        // ใช้เลข อย. เป็น code (ตารางไม่มี product_code)
        code: p.product_fdanum ?? p.notify_no ?? (p.id ?? p.product_id)
      }));

      productSelect.innerHTML =
        '<option value="">— เลือกผลิตภัณฑ์ —</option>' +
        items.map((p) =>
          `<option value="${p.id}" data-code="${p.code}">${escapeHtml(p.name)}</option>`
        ).join('');
    } catch (e) {
      console.error('โหลดสินค้า (เฉพาะ status=1) ไม่สำเร็จ:', e);
      productSelect.innerHTML = '<option value="">— โหลดสินค้าเฉพาะที่พร้อมไม่สำเร็จ (ตรวจสอบ API /product/options-ready-all) —</option>';
      alert('โหลดสินค้าเฉพาะที่พร้อมไม่สำเร็จ: โปรดตรวจสอบว่ามี API /product/options-ready-all และ server ได้รีสตาร์ทแล้ว');
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])
    );
  }

  // อัปเดต code เมื่อเลือกสินค้า
  productSelect.addEventListener('change', () => {
    const opt = productSelect.selectedOptions[0];
    productCode.value = opt ? (opt.getAttribute('data-code') || productSelect.value || '') : '';
    updateLotPreview();
  });

  // ----- ใส่วันสั่ง → auto เติมวันหมดอายุ (+2 ปี) ถ้ายังว่าง -----
  orderDate.addEventListener('change', () => {
    if (!orderExp.value && orderDate.value) {
      const dt = new Date(orderDate.value);
      if (!Number.isNaN(dt.getTime())) {
        dt.setFullYear(dt.getFullYear() + 2);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        orderExp.value = `${y}-${m}-${d}`;
      }
    }
    updateLotPreview();
  });

  // ----- แสดง LOT “ตัวอย่าง” เท่านั้น (ไม่เก็บ) -----
  function updateLotPreview() {
    if (!orderLot) return;

    const y = (() => {
      if (!orderDate.value) return '';
      const dt = new Date(orderDate.value);
      if (Number.isNaN(dt.getTime())) return '';
      return String(dt.getFullYear());
    })();

    const code = (productCode.value || '').replace(/\D/g, ''); // เอาเฉพาะตัวเลขเพื่อทำให้กลางเป็น 5 หลัก
    const mid5 = code ? code.slice(-5).padStart(5, '0') : '00000';

    // suffix ล็อต 2 หลัก: ถ้าอยากให้ผู้ใช้พิมพ์ ก็สามารถต่อยอดมาอ่านจากอีก input ได้
    const suffix = '01';

    if (y && code) {
      orderLot.value = `${y}-${mid5}-${suffix}`;
    } else if (y || code) {
      // แสดงโครงร่างให้เห็น
      orderLot.value = `${y || '----'}-${mid5}-${suffix}`;
    } else {
      orderLot.value = '';
    }
  }

  // ❌ ลบ logic บังคับรูปแบบ/ดัก input/paste ของ LOT ทั้งหมด (เพราะไม่เก็บแล้ว)

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!productSelect.value) { alert('กรุณาเลือกผลิตภัณฑ์'); return; }
    if (!orderQty.value)      { alert('กรุณากรอกจำนวนสั่ง'); return; }
    if (!orderDate.value)     { alert('กรุณาเลือกวันที่สั่ง'); return; }

    // ✅ ไม่ตรวจ/ไม่ส่ง order_lot แล้ว
    const payload = {
      product_id: Number(productSelect.value),
      order_quantity: Number(orderQty.value),
      // order_lot: (ตัดออก)  // ❌ ไม่เก็บ
      order_date: orderDate.value || null,
      order_exp: orderExp.value || null,
      PH: null, color: null, smell: null, amount: null, price: null
    };

    try {
      const res = await fetch('/productorder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'บันทึกไม่สำเร็จ'));
      const out = await res.json();
      alert('บันทึกสำเร็จ #' + (out?.id ?? ''));
      location.href = '/productorder/index.html';
    } catch (err) {
      console.error('บันทึก error:', err);
      alert('บันทึกไม่สำเร็จ');
    }
  });

  loadProducts();
  // อัปเดตตัวอย่าง LOT ครั้งแรก (กรณีมีค่า default)
  updateLotPreview();
});
