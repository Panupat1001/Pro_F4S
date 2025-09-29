// /public/js/productorder-create.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const productSelect = $('product_select');
  const productCode   = $('product_code');     // ต้องแสดง product_id
  const orderQty      = $('order_quantity');
  const orderLot      = $('order_lot');        // ให้ผู้ใช้กรอก 11 ตัว ระบบแสดงเป็น YYYY-#####-NN
  const orderDate     = $('order_date');
  const orderExp      = $('order_exp');
  const form          = $('proorderForm');

  // ====== LOT mask: แสดง YYYY-#####-NN แต่เก็บเลขล้วน 11 หลัก ======
  const LOT_DIGITS_MAX = 11; // 4 + 5 + 2
  const LOT_VIEW_REGEX = /^\d{4}-\d{5}-\d{2}$/; // สำหรับการแสดงผลเท่านั้น

  // ตั้งค่าช่อง LOT
  if (orderLot) {
    if (!orderLot.placeholder) orderLot.placeholder = '2025-12345-01';
    orderLot.maxLength = 13; // รวมขีด 2 ตัว
    orderLot.title = 'พิมพ์รหัสล็อต 11 หลัก (ปี4 + รหัสผลิตภัณฑ์5 + ล็อต2) ระบบจะแสดงขีดให้เอง';
  }

  // ดึงเฉพาะตัวเลข
  function onlyDigits(s) {
    return String(s ?? '').replace(/\D/g, '');
  }

  // แปลงเลขล้วน -> รูปแบบแสดง YYYY-#####-NN
  function toLotView(digits) {
    const d = onlyDigits(digits).slice(0, LOT_DIGITS_MAX);
    if (d.length <= 4) return d;                               // YYYY
    if (d.length <= 9) return `${d.slice(0,4)}-${d.slice(4)}`; // YYYY-#####
    return `${d.slice(0,4)}-${d.slice(4,9)}-${d.slice(9,11)}`; // YYYY-#####-NN
  }

  // บังคับ mask ระหว่างพิมพ์/วาง
  orderLot?.addEventListener('input', () => {
    orderLot.value = toLotView(orderLot.value);
  });
  orderLot?.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    orderLot.value = toLotView(text);
  });

  // ====== Helpers ทั่วไป ======
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])
    );
  }
  function normalizeProducts(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.data))  return payload.data;
    return [];
  }
  const getPid   = (p) => p?.product_id ?? p?.id ?? p?.productId ?? null;
  const getPname = (p) => p?.product_name ?? p?.name ?? `#${getPid(p) ?? ''}`;

  // ====== โหลดรายการสินค้า (option.value และ data-code = product_id) ======
  async function loadProducts() {
    try {
      const res = await fetch('/product/options-ready-all', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`options-ready-all HTTP ${res.status}`);
      const raw  = await res.json();
      const list = normalizeProducts(raw);

      if (!list.length) {
        productSelect.innerHTML = '<option value="">— ไม่มีสินค้า —</option>';
        return;
      }

      const items = list.map((p) => ({ id: getPid(p), name: getPname(p) })).filter(x => x.id != null);

      productSelect.innerHTML =
        '<option value="">— เลือกผลิตภัณฑ์ —</option>' +
        items.map((p) =>
          `<option value="${escapeHtml(String(p.id))}" data-code="${escapeHtml(String(p.id))}">
             ${escapeHtml(p.name)}
           </option>`
        ).join('');
    } catch (e) {
      console.error('โหลดสินค้าไม่สำเร็จ:', e);
      productSelect.innerHTML = '<option value="">— โหลดสินค้าไม่สำเร็จ —</option>';
    }
  }

  // เมื่อเลือกสินค้า → ให้ช่อง product_code แสดง product_id ตรง ๆ
  productSelect?.addEventListener('change', () => {
    const opt = productSelect.selectedOptions[0];
    productCode.value = opt ? (opt.getAttribute('data-code') || opt.value || '') : '';
  });

  // ใส่วันสั่ง → auto เติมวันหมดอายุ (+2 ปี) ถ้ายังว่าง
  orderDate?.addEventListener('change', () => {
    if (orderDate.value && !orderExp.value) {
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

  // ====== Validate & Submit ======
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!productSelect?.value) { alert('กรุณาเลือกผลิตภัณฑ์'); productSelect?.focus(); return; }
    if (!orderQty?.value)      { alert('กรุณากรอกจำนวนสั่ง'); orderQty?.focus(); return; }
    if (!orderDate?.value)     { alert('กรุณาเลือกวันที่สั่ง'); orderDate?.focus(); return; }

    const qty = Number(orderQty.value);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('จำนวนสั่งต้องเป็นตัวเลขมากกว่า 0');
      orderQty.focus();
      return;
    }

    // LOT: เช็คเฉพาะว่าเป็นตัวเลข 11 หลัก แล้วค่อย strip ขีดก่อนส่ง
    const lotView = (orderLot?.value || '').trim();
    const lotDigits = onlyDigits(lotView);
    if (lotDigits.length !== LOT_DIGITS_MAX) {
      alert('รหัสล็อตต้องมีเลขรวม 11 หลัก (เช่น 2025-12345-01 หรือ 20251234501)');
      orderLot?.focus();
      return;
    }

    const payload = {
      product_id: Number(productSelect.value),
      order_quantity: qty,
      order_lot: lotDigits,               // <<< เก็บเลขล้วน 11 หลัก (ไม่เก็บขีด)
      order_date: orderDate.value || null,
      order_exp: orderExp?.value || null,
      PH: null, color: null, smell: null, amount: null, price: null
    };

    try {
      const res = await fetch('/productorder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'บันทึกไม่สำเร็จ');
        throw new Error(errText);
      }
      const out = await res.json().catch(() => ({}));
      alert('บันทึกสำเร็จ #' + (out?.id ?? ''));
      location.href = '/productorder/index.html';
    } catch (err) {
      console.error('บันทึก error:', err);
      alert('บันทึกไม่สำเร็จ: ' + (err?.message || ''));
    }
  });

  // เริ่มต้น
  loadProducts();
});
