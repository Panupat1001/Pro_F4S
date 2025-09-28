// /public/js/productorder-create.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const productSelect = $('product_select');
  const productCode   = $('product_code');
  const orderQty      = $('order_quantity');
  const orderLot      = $('order_lot');
  const orderDate     = $('order_date');
  const orderExp      = $('order_exp');
  const form          = $('proorderForm');

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
        code: p.product_code ?? p.notify_no ?? p.product_fdanum ?? (p.id ?? p.product_id)
      }));

      productSelect.innerHTML =
        '<option value="">— เลือกผลิตภัณฑ์ —</option>' +
        items.map((p) =>
          `<option value="${p.id}" data-code="${p.code}">${escapeHtml(p.name)}</option>`
        ).join('');
    } catch (e) {
      console.error('โหลดสินค้า (เฉพาะ status=1) ไม่สำเร็จ:', e);
      // ❌ ไม่ fallback เพื่อไม่ให้ดึงมาทุกตัว
      productSelect.innerHTML = '<option value="">— โหลดสินค้าเฉพาะที่พร้อมไม่สำเร็จ (ตรวจสอบ API /product/options-ready-all) —</option>';
      alert('โหลดสินค้าเฉพาะที่พร้อมไม่สำเร็จ: โปรดตรวจสอบว่ามี API /product/options-ready-all และ server ได้รีสตาร์ทแล้ว');
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])
    );
  }

  productSelect.addEventListener('change', () => {
    const opt = productSelect.selectedOptions[0];
    productCode.value = opt ? (opt.getAttribute('data-code') || productSelect.value || '') : '';
  });

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
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!productSelect.value) { alert('กรุณาเลือกผลิตภัณฑ์'); return; }
    if (!orderQty.value)      { alert('กรุณากรอกจำนวนสั่ง'); return; }
    if (!orderDate.value)     { alert('กรุณาเลือกวันที่สั่ง'); return; }

    const payload = {
      product_id: Number(productSelect.value),
      order_quantity: Number(orderQty.value),
      order_lot: orderLot.value || null,
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
});
